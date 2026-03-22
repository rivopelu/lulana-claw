import { Bot } from "grammy";
import OpenAI from "openai";
import logger from "../configs/logger";
import SessionService, { type ChatType } from "../services/session.service";
import AiService from "../services/ai.service";
import ContextService from "../services/context.service";
import TaskService, { parseRemindTime, type TaskType } from "../services/task.service";
import TaskRepository from "../repositories/task.repository";
import ClientRepository from "../repositories/client.repository";
import AiModelRepository from "../repositories/ai-model.repository";

// ── Task capability prompt injected into every message system prompt ────────
// AI appends [TASK_CREATE:{...}] at the end of its reply when it needs to create a task.
// This works across all models/providers regardless of function-calling support.
const TASK_CAPABILITY_PROMPT = `
Kamu memiliki kemampuan menyimpan task, reminder, catatan, meeting, dan deadline.
Jika pengguna meminta membuat reminder/task/catatan/meeting/deadline, respons seperti biasa DAN tambahkan di baris paling akhir (jangan di tengah teks):
[TASK_CREATE:{"type":"...","title":"...","description":"...","remind_at_text":"..."}]
Aturan:
- type: "task" | "reminder" | "notes" | "meeting" | "deadline"
- title: wajib, judul singkat
- description: opsional, boleh dihilangkan
- remind_at_text: opsional — format: HH:MM (misal 10:00), DD/MM HH:MM (misal 25/03 14:00), 30m, 2h, 1d
- JANGAN tampilkan atau jelaskan blok [TASK_CREATE:...] ke pengguna, cukup tambahkan di akhir
- Hanya tambahkan jika pengguna benar-benar meminta menyimpan/mengingatkan sesuatu`.trim();

export type BotStatus = "starting" | "running" | "stopping" | "stopped" | "error";

interface BotEntry {
  bot: Bot;
  status: BotStatus;
  error?: string;
}

const HISTORY_LIMIT = 20;

/** Exponential backoff retry for AI calls — 3 attempts: ~2s, ~6s, ~18s */
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const delays = [2000, 6000, 18000];
  let lastErr: unknown;
  for (let i = 0; i <= delays.length; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isRateLimit = err instanceof OpenAI.APIError && err.status === 429;
      const isServerErr = err instanceof OpenAI.APIError && (err.status ?? 0) >= 500;
      // 4xx (except 429) are client errors — no point retrying
      if ((!isRateLimit && !isServerErr) || i === delays.length) break;
      const retryAfter =
        isRateLimit && err instanceof OpenAI.APIError
          ? Number(err.headers?.["retry-after"] ?? 0) * 1000 || delays[i]
          : delays[i];
      logger.warn(
        `${label} retry ${i + 1} in ${retryAfter / 1000}s (status ${(err as InstanceType<typeof OpenAI.APIError>).status})`,
      );
      await new Promise((r) => setTimeout(r, retryAfter));
    }
  }
  throw lastErr;
}

class BotManager {
  private static _instance: BotManager | null = null;
  private bots = new Map<string, BotEntry>();
  /** Per-chat sequential queue: key = `${clientId}:${chatId}` */
  private chatQueues = new Map<string, Promise<void>>();
  private sessionService = new SessionService();
  private aiService = new AiService();
  private contextService = new ContextService();
  private taskService = new TaskService();
  private taskRepository = new TaskRepository();
  private clientRepository = new ClientRepository();
  private aiModelRepository = new AiModelRepository();

  /** Enqueue work for a specific chat so messages are processed one at a time */
  private enqueue(clientId: string, chatId: number, work: () => Promise<void>): void {
    const key = `${clientId}:${chatId}`;
    const prev = this.chatQueues.get(key) ?? Promise.resolve();
    const next = prev.then(work).catch(() => {
      /* errors handled inside work */
    });
    this.chatQueues.set(key, next);
    // Clean up entry once the chain settles to avoid memory leak
    next.finally(() => {
      if (this.chatQueues.get(key) === next) this.chatQueues.delete(key);
    });
  }

  private schedulerStarted = false;

  private constructor() {}

  /** Start the global reminder scheduler (runs once, shared across all bots) */
  startReminderScheduler(): void {
    if (this.schedulerStarted) return;
    this.schedulerStarted = true;

    setInterval(async () => {
      try {
        const due = await this.taskRepository.findDueReminders(Date.now());
        for (const task of due) {
          const entry = this.bots.get(task.client_id);
          if (!entry || entry.status !== "running") continue;

          const TYPE_EMOJI: Record<string, string> = {
            task: "📋", reminder: "⏰", notes: "📝", meeting: "🤝", deadline: "🚨",
          };
          const emoji = TYPE_EMOJI[task.type ?? "task"] ?? "📋";
          const desc = task.description ? `\n${task.description}` : "";

          try {
            await entry.bot.api.sendMessage(
              task.chat_id,
              `${emoji} *Reminder:* ${task.title}${desc}`,
              { parse_mode: "Markdown" },
            );
            await this.taskRepository.update(task.id, { reminded: true });
            logger.info(`[Scheduler] Reminder sent for task ${task.id}`);
          } catch (err) {
            logger.error(`[Scheduler] Failed to send reminder for task ${task.id}: ${(err as Error).message}`);
          }
        }
      } catch (err) {
        logger.error(`[Scheduler] Error checking reminders: ${(err as Error).message}`);
      }
    }, 30_000); // check every 30 seconds

    logger.info("[Scheduler] Reminder scheduler started");
  }

  static getInstance(): BotManager {
    if (!BotManager._instance) BotManager._instance = new BotManager();
    return BotManager._instance;
  }

  private registerHandlers(bot: Bot, clientId: string): void {
    // ── Debug: log every incoming update ───────────────────────────────────
    bot.use((ctx, next) => {
      const msg = ctx.message;
      if (msg) {
        logger.info(
          `[Bot:${clientId}] update — chat:${msg.chat.id} type:${msg.chat.type} text:${msg.text ?? "(no text)"}`,
        );
      }
      return next();
    });

    // ── /setup <name> ──────────────────────────────────────────────────────
    bot.command("setup", async (ctx) => {
      const name = ctx.match?.trim();
      if (!name) {
        await ctx.reply("Usage: /setup <session name>\nExample: /setup My Support Group");
        return;
      }

      const chatId = ctx.chat.id;
      const chatType = ctx.chat.type as ChatType;
      const fromId = ctx.from?.id?.toString() ?? "system";

      try {
        // Inherit client-level model when creating a new session
        const clientRecord = await this.clientRepository.findById(clientId);
        const session = await this.sessionService.setupSession(
          clientId,
          chatId,
          chatType,
          name,
          fromId,
          clientRecord?.ai_model_id ?? null,
        );
        const isNew = session.created_by === fromId && session.updated_date == null;
        await ctx.reply(
          isNew
            ? `✅ Session *"${name}"* created! You can now chat with me.`
            : `✏️ Session renamed to *"${name}"*.`,
          { parse_mode: "Markdown" },
        );
      } catch (err) {
        logger.error(`[Bot:${clientId}] /setup error: ${(err as Error).message}`);
        await ctx.reply("❌ Failed to setup session. Please try again.");
      }
    });

    // ── /model ─────────────────────────────────────────────────────────────
    // /model          → show current model for this session
    // /model <id>     → assign a specific ai_model id to this session
    // /model reset    → fall back to client-level default
    bot.command("model", async (ctx) => {
      const chatId = ctx.chat.id;
      const session = await this.sessionService.getSession(clientId, chatId);

      if (!session) {
        await ctx.reply("⚙️ No session. Run /setup <name> first.");
        return;
      }

      const arg = ctx.match?.trim();

      // Show current
      if (!arg) {
        const modelId = session.ai_model_id;
        if (!modelId) {
          await ctx.reply(
            "🤖 No model assigned to this session.\nUse /model <model\\_id> to set one.",
            { parse_mode: "Markdown" },
          );
          return;
        }
        const m = await this.aiModelRepository.findById(modelId);
        await ctx.reply(`🤖 Current model: *${m?.name ?? modelId}* (\`${m?.model_id ?? "?"}\`)`, {
          parse_mode: "Markdown",
        });
        return;
      }

      // Reset to client default
      if (arg === "reset") {
        const clientRecord = await this.clientRepository.findById(clientId);
        await this.sessionService.setSessionModel(
          session.id,
          clientRecord?.ai_model_id ?? null,
          ctx.from?.id?.toString() ?? "system",
        );
        await ctx.reply("↩️ Model reset to client default.");
        return;
      }

      // Assign by ai_model row id
      const model = await this.aiModelRepository.findById(arg);
      if (!model) {
        await ctx.reply("❌ Model not found. Check the dashboard for valid model IDs.");
        return;
      }
      await this.sessionService.setSessionModel(
        session.id,
        model.id,
        ctx.from?.id?.toString() ?? "system",
      );
      await ctx.reply(`✅ Model set to *${model.name}* (\`${model.model_id}\`) for this session.`, {
        parse_mode: "Markdown",
      });
    });

    // ── /task ──────────────────────────────────────────────────────────────
    // /task <title>                     → create task (no reminder)
    // /task <title> | <time>            → create task with reminder
    // /task reminder <title> | <time>   → type=reminder
    // /task notes <text>                → type=notes
    // /task meeting <title> | <time>    → type=meeting
    // /task deadline <title> | <time>   → type=deadline
    bot.command("task", async (ctx) => {
      const arg = ctx.match?.trim();
      if (!arg) {
        await ctx.reply(
          "📋 *Cara pakai /task:*\n" +
            "`/task Beli kopi` — buat task\n" +
            "`/task Beli kopi | 30m` — dengan reminder 30 menit lagi\n" +
            "`/task Beli kopi | 14:30` — reminder jam 14:30\n" +
            "`/task Beli kopi | 25/12 09:00` — reminder tanggal tertentu\n\n" +
            "*Tipe:* `reminder` | `notes` | `meeting` | `deadline`\n" +
            "`/task reminder Minum obat | 1h`",
          { parse_mode: "Markdown" },
        );
        return;
      }

      const chatId = ctx.chat.id;
      const fromId = ctx.from?.id?.toString() ?? "system";
      const session = await this.sessionService.getSession(clientId, chatId);

      // Parse type prefix
      const typeKeywords = ["reminder", "notes", "meeting", "deadline", "task"] as const;
      type TType = (typeof typeKeywords)[number];
      let taskType: TType = "task";
      let rest = arg;
      for (const kw of typeKeywords) {
        if (rest.toLowerCase().startsWith(kw + " ")) {
          taskType = kw;
          rest = rest.slice(kw.length + 1).trim();
          break;
        }
      }

      // Parse title | time
      const pipeIdx = rest.lastIndexOf("|");
      let title = rest;
      let remindAt: number | undefined;
      if (pipeIdx !== -1) {
        title = rest.slice(0, pipeIdx).trim();
        const timeStr = rest.slice(pipeIdx + 1).trim();
        const parsed = parseRemindTime(timeStr);
        if (!parsed) {
          await ctx.reply(
            "❌ Format waktu tidak dikenali.\nContoh: `30m` `2h` `1d` `14:30` `25/12 09:00`",
            { parse_mode: "Markdown" },
          );
          return;
        }
        remindAt = parsed;
      }

      if (!title) {
        await ctx.reply("❌ Judul task tidak boleh kosong.");
        return;
      }

      // Get client accountId via ai model or client record
      const clientRecord = await this.clientRepository.findById(clientId);
      if (!clientRecord) {
        await ctx.reply("❌ Client tidak ditemukan.");
        return;
      }

      const task = await this.taskService.create(
        {
          client_id: clientId,
          chat_id: chatId,
          session_id: session?.id,
          type: taskType,
          title,
          remind_at: remindAt,
        },
        clientRecord.account_id,
      );

      const TYPE_EMOJI: Record<TType, string> = {
        task: "📋",
        reminder: "⏰",
        notes: "📝",
        meeting: "🤝",
        deadline: "🚨",
      };

      const remindInfo = remindAt
        ? `\n⏰ Reminder: *${new Date(remindAt).toLocaleString("id-ID")}*`
        : "";
      await ctx.reply(
        `${TYPE_EMOJI[taskType]} *${title}* disimpan!\nID: \`${task.id.slice(-8)}\`${remindInfo}`,
        { parse_mode: "Markdown" },
      );
    });

    // ── /tasks ─────────────────────────────────────────────────────────────
    bot.command("tasks", async (ctx) => {
      const chatId = ctx.chat.id;
      const clientRecord = await this.clientRepository.findById(clientId);
      if (!clientRecord) return;

      const tasks = await this.taskService.getByChatId(clientId, chatId, "pending");

      if (tasks.length === 0) {
        await ctx.reply("📭 Tidak ada task yang pending.");
        return;
      }

      const TYPE_EMOJI: Record<string, string> = {
        task: "📋", reminder: "⏰", notes: "📝", meeting: "🤝", deadline: "🚨",
      };

      const lines = tasks.map((t, i) => {
        const remind = t.remind_at
          ? ` — ⏰ ${new Date(t.remind_at).toLocaleString("id-ID")}`
          : "";
        return `${i + 1}. ${TYPE_EMOJI[t.type] ?? "📋"} *${t.title}*${remind}\n   ID: \`${t.id.slice(-8)}\``;
      });

      await ctx.reply(
        `📋 *Task Pending (${tasks.length}):*\n\n${lines.join("\n\n")}\n\n_Ketik /donetask <ID> untuk selesaikan_`,
        { parse_mode: "Markdown" },
      );
    });

    // ── /donetask ──────────────────────────────────────────────────────────
    bot.command("donetask", async (ctx) => {
      const idSuffix = ctx.match?.trim();
      if (!idSuffix) {
        await ctx.reply("Usage: `/donetask <8-char ID>`\nDapat ID dari /tasks", {
          parse_mode: "Markdown",
        });
        return;
      }

      const chatId = ctx.chat.id;
      const clientRecord = await this.clientRepository.findById(clientId);
      if (!clientRecord) return;

      const tasks = await this.taskService.getByChatId(clientId, chatId, "pending");
      const match = tasks.find((t) => t.id.endsWith(idSuffix) || t.id === idSuffix);

      if (!match) {
        await ctx.reply("❌ Task tidak ditemukan. Cek ID dengan /tasks");
        return;
      }

      await this.taskService.markDone(match.id, clientRecord.account_id);
      await ctx.reply(`✅ *${match.title}* selesai!`, { parse_mode: "Markdown" });
    });

    // ── /updatecontext ─────────────────────────────────────────────────────
    // Analyzes session chat history and auto-generates/updates a session context
    bot.command("updatecontext", async (ctx) => {
      const chatId = ctx.chat.id;
      const fromId = ctx.from?.id?.toString() ?? "system";

      const session = await this.sessionService.getSession(clientId, chatId);
      if (!session) {
        await ctx.reply("⚙️ No active session. Run /setup <name> first.");
        return;
      }

      const clientRecord = await this.clientRepository.findById(clientId);
      const modelId = session.ai_model_id ?? clientRecord?.ai_model_id;
      if (!modelId) {
        await ctx.reply("⚠️ No AI model assigned to this session.");
        return;
      }
      const aiModel = await this.aiModelRepository.findById(modelId);
      if (!aiModel) {
        await ctx.reply("⚠️ Assigned AI model not found.");
        return;
      }

      await ctx.reply("🔍 Menganalisa riwayat percakapan...");
      await ctx.replyWithChatAction("typing");

      try {
        // Fetch last 200 messages for analysis
        const history = await this.sessionService.getHistory(session.id, 200);
        if (history.length < 3) {
          await ctx.reply("⚠️ Riwayat percakapan terlalu sedikit untuk dianalisa. Chat dulu lebih banyak!");
          return;
        }

        const historyText = history
          .map((m) => `[${m.role.toUpperCase()}${m.from_name ? ` - ${m.from_name}` : ""}]: ${m.content}`)
          .join("\n");

        const metaPrompt = `Kamu adalah analis percakapan AI. Tugasmu menganalisa riwayat chat berikut dan menghasilkan dokumen konteks komprehensif.

Analisa dan ekstrak:
1. **Kepribadian & gaya komunikasi** yang digunakan asisten (formal/santai, humor, dll)
2. **Instruksi & preferensi** yang diberikan oleh pengguna
3. **Pengetahuan & topik** yang sering dibahas
4. **Pola interaksi** (bagaimana asisten merespons, strategi yang berhasil)
5. **Hal-hal yang harus dihindari** berdasarkan feedback negatif

Tulis dalam format markdown yang jelas dan terstruktur. Gunakan bahasa yang sama dengan percakapan (Indonesia/Inggris).

Riwayat percakapan:
---
${historyText}
---

Hasilkan dokumen konteks yang akan digunakan sebagai panduan perilaku asisten di sesi ini.`;

        const generatedContext = await withRetry(
          () =>
            this.aiService.chat(
              aiModel.api_key,
              aiModel.model_id,
              aiModel.provider,
              [],
              metaPrompt,
            ),
          `[Bot:${clientId}:updatecontext]`,
        );

        // Save as session context (upsert: delete old auto-generated one first)
        const existing = await this.contextService.getAutoContext(session.id);
        if (existing) {
          await this.contextService.updateById(existing.id, {
            content: generatedContext,
          });
          await ctx.reply(
            `✅ Konteks sesi *"${session.name}"* berhasil diperbarui dari ${history.length} pesan.\n\n_Konteks baru akan aktif pada pesan berikutnya._`,
            { parse_mode: "Markdown" },
          );
        } else {
          await this.contextService.createAutoContext(
            session.id,
            aiModel.account_id,
            clientId,
            session.name,
            generatedContext,
            fromId,
          );
          await ctx.reply(
            `✅ Konteks sesi *"${session.name}"* berhasil dibuat dari ${history.length} pesan.\n\n_Konteks akan aktif pada pesan berikutnya._`,
            { parse_mode: "Markdown" },
          );
        }
      } catch (err) {
        logger.error(`[Bot:${clientId}] /updatecontext error: ${(err as Error).message}`);
        await ctx.reply("❌ Gagal menganalisa percakapan. Coba lagi nanti.");
      }
    });

    // ── Regular messages ───────────────────────────────────────────────────
    bot.on("message:text", (ctx) => {
      if (ctx.message.text.startsWith("/")) return;

      const chatType = ctx.chat.type;
      const isGroup = chatType === "group" || chatType === "supergroup";
      const rawText = ctx.message.text;

      // In groups: only respond when mentioned or when replying to the bot
      if (isGroup) {
        const botId = ctx.me.id;
        const botUsername = ctx.me.username?.toLowerCase() ?? "";

        // Simple string check — reliable across all Unicode/emoji edge cases
        const isMentioned =
          botUsername.length > 0 &&
          rawText.toLowerCase().includes(`@${botUsername}`);
        const isReplyToBot = ctx.message.reply_to_message?.from?.id === botId;

        logger.info(
          `[Bot:${clientId}] group msg — mention:${isMentioned} replyToBot:${isReplyToBot} botUser:@${botUsername} text:"${rawText.slice(0, 80)}"`,
        );

        if (!isMentioned && !isReplyToBot) return;
      }

      const chatId = ctx.chat.id;
      // Strip @mention from the message text so AI doesn't see it
      const userText =
        isGroup && ctx.me.username
          ? rawText.replace(new RegExp(`@${ctx.me.username}`, "gi"), "").trim()
          : rawText;

      // Ignore empty messages (e.g. user sent only @botname with no text)
      if (!userText) return;

      const fromId = ctx.from?.id?.toString();
      const fromName = ctx.from?.first_name ?? "User";
      const label = `[Bot:${clientId}:${chatId}]`;

      // Enqueue — same chat processed one at a time, no concurrent AI calls
      this.enqueue(clientId, chatId, async () => {
        // 1. Session check
        const session = await this.sessionService.getSession(clientId, chatId);
        if (!session) {
          await ctx.reply("⚙️ No active session.\nRun /setup <name> to get started.");
          return;
        }

        // 2. Resolve AI model: session-level → client-level → error
        const clientRecord = await this.clientRepository.findById(clientId);
        const modelId = session.ai_model_id ?? clientRecord?.ai_model_id;
        if (!modelId) {
          await ctx.reply(
            "⚠️ No AI model assigned.\nAsk the admin to configure one in the dashboard.",
          );
          return;
        }

        const aiModel = await this.aiModelRepository.findById(modelId);
        if (!aiModel) {
          await ctx.reply("⚠️ Assigned AI model not found. Please contact the admin.");
          return;
        }

        try {
          // 3. Save user message
          await this.sessionService.addMessage(session.id, "user", userText, fromId, fromName);

          // 4. Typing indicator
          await ctx.replyWithChatAction("typing");

          // 5. Fetch history
          const history = await this.sessionService.getHistory(session.id, HISTORY_LIMIT + 1);

          // 5b. Build system prompt from contexts + current time + task capability
          const entityMode = clientRecord?.entity_mode ?? "per_session";
          const baseSystemPrompt = await this.contextService.buildSystemPrompt(
            aiModel.account_id,
            clientId,
            session.id,
            entityMode,
          );
          const nowStr = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
          const systemPrompt = [
            baseSystemPrompt,
            `[Waktu sekarang: ${nowStr}]`,
            TASK_CAPABILITY_PROMPT,
          ]
            .filter(Boolean)
            .join("\n\n");

          // 6. Call AI with exponential backoff
          const rawReply = await withRetry(
            () =>
              this.aiService.chat(
                aiModel.api_key,
                aiModel.model_id,
                aiModel.provider,
                history.slice(0, -1),
                userText,
                systemPrompt,
              ),
            label,
          );

          // 6b. Parse [TASK_CREATE:{...}] markers from the AI response
          const TASK_MARKER_RE = /\[TASK_CREATE:([\s\S]*?)\]/g;
          const TYPE_EMOJI: Record<string, string> = {
            task: "📋", reminder: "⏰", notes: "📝", meeting: "🤝", deadline: "🚨",
          };
          const taskConfirmations: string[] = [];
          let match: RegExpExecArray | null;

          while ((match = TASK_MARKER_RE.exec(rawReply)) !== null) {
            try {
              const args = JSON.parse(match[1]) as {
                type?: string;
                title?: string;
                description?: string;
                remind_at_text?: string;
              };
              if (!args.title) continue;

              const taskType: TaskType = (
                ["task", "reminder", "notes", "meeting", "deadline"] as TaskType[]
              ).includes(args.type as TaskType)
                ? (args.type as TaskType)
                : "task";

              const remindAt = args.remind_at_text
                ? (parseRemindTime(args.remind_at_text) ?? undefined)
                : undefined;

              const task = await this.taskService.create(
                {
                  client_id: clientId,
                  chat_id: chatId,
                  session_id: session?.id,
                  type: taskType,
                  title: args.title,
                  description: args.description,
                  remind_at: remindAt,
                },
                aiModel.account_id,
              );

              const emoji = TYPE_EMOJI[taskType] ?? "📋";
              const remindInfo = remindAt
                ? ` — ⏰ ${new Date(remindAt).toLocaleString("id-ID")}`
                : "";
              taskConfirmations.push(`${emoji} *${args.title}*${remindInfo} \`[${task.id.slice(-8)}]\``);
              logger.info(`${label} Task created via AI: ${task.id} type=${taskType}`);
            } catch (tcErr) {
              logger.error(`${label} task marker parse error: ${(tcErr as Error).message}`);
            }
          }

          // 7. Clean marker from reply text + append confirmations
          let reply = rawReply.replace(/\[TASK_CREATE:[\s\S]*?\]/g, "").trim();
          if (taskConfirmations.length > 0) {
            const confirmBlock = `✅ Tersimpan:\n${taskConfirmations.join("\n")}`;
            reply = reply ? `${reply}\n\n${confirmBlock}` : confirmBlock;
          }
          if (!reply) reply = "Sorry, I could not generate a response.";

          await ctx.reply(reply, { parse_mode: "Markdown" });

          // 8. Save assistant reply (without the marker)
          await this.sessionService.addMessage(session.id, "assistant", reply);
        } catch (err) {
          const apiErr = err instanceof OpenAI.APIError ? err : null;
          const status = apiErr?.status;

          if (status === 429) {
            logger.error(`${label} AI quota exhausted after all retries`);
            await ctx.reply(
              "⚠️ Batas kuota AI tercapai. Coba beberapa saat lagi atau hubungi admin untuk cek kuota API.",
            );
          } else if (status === 400) {
            logger.error(`${label} AI bad request: ${apiErr?.message}`);
            await ctx.reply(
              `⚙️ Model tidak valid atau tidak didukung provider ini: \`${aiModel.model_id}\`\nHubungi admin untuk mengganti model.`,
              { parse_mode: "Markdown" },
            );
          } else if (status === 401 || status === 403) {
            logger.error(`${label} AI auth error (${status})`);
            await ctx.reply("🔑 Autentikasi AI gagal. Hubungi admin untuk cek API key.");
          } else if (status && status >= 500) {
            logger.error(`${label} AI provider error (${status})`);
            await ctx.reply("🔧 Provider AI sedang bermasalah. Coba lagi nanti.");
          } else {
            logger.error(`${label} AI error: ${(err as Error).message}`);
            await ctx.reply("❌ Gagal mendapat respons. Coba lagi nanti.");
          }
        }
      });
    });
  }

  async start(clientId: string, token: string): Promise<void> {
    const existing = this.bots.get(clientId);
    if (existing?.status === "running" || existing?.status === "starting") return;

    const bot = new Bot(token);
    this.registerHandlers(bot, clientId);

    const entry: BotEntry = { bot, status: "starting" };
    this.bots.set(clientId, entry);
    logger.info(`[BotManager] Starting bot for client ${clientId}`);

    // Clear any registered webhook so long-polling can receive all updates
    try {
      await bot.api.deleteWebhook({ drop_pending_updates: false });
      logger.info(`[BotManager] Webhook cleared for client ${clientId}`);
    } catch (err) {
      logger.warn(`[BotManager] Could not clear webhook for client ${clientId}: ${(err as Error).message}`);
    }

    bot
      .start({
        allowed_updates: ["message", "edited_message", "callback_query"],
        onStart: () => {
          entry.status = "running";
          entry.error = undefined;
          logger.info(`[BotManager] Bot ${clientId} is running`);
        },
      })
      .catch((err: Error) => {
        entry.status = "error";
        entry.error = err.message;
        logger.error(`[BotManager] Bot ${clientId} error: ${err.message}`);
      });

    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (entry.status !== "starting") {
          clearInterval(check);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);
      const timeout = setTimeout(() => {
        clearInterval(check);
        if (entry.status === "starting") {
          entry.status = "error";
          entry.error = "Startup timed out";
        }
        resolve();
      }, 12_000);
    });
  }

  async stop(clientId: string): Promise<void> {
    const entry = this.bots.get(clientId);
    if (!entry || entry.status === "stopped" || entry.status === "stopping") return;

    logger.info(`[BotManager] Stopping bot for client ${clientId}`);
    entry.status = "stopping";
    try {
      await entry.bot.stop();
    } catch {
      /* ignore */
    }
    entry.status = "stopped";
    logger.info(`[BotManager] Bot ${clientId} stopped`);
  }

  async restart(clientId: string, token: string): Promise<void> {
    await this.stop(clientId);
    this.bots.delete(clientId);
    await this.start(clientId, token);
  }

  getStatus(clientId: string): { status: BotStatus; error?: string } {
    const entry = this.bots.get(clientId);
    if (!entry) return { status: "stopped" };
    return { status: entry.status, error: entry.error };
  }

  getAllStatuses(): Record<string, { status: BotStatus; error?: string }> {
    const result: Record<string, { status: BotStatus; error?: string }> = {};
    for (const [id, entry] of this.bots) {
      result[id] = { status: entry.status, error: entry.error };
    }
    return result;
  }
}

export const botManager = BotManager.getInstance();
