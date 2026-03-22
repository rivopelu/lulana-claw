import { Bot } from "grammy";
import OpenAI from "openai";
import logger from "../configs/logger";
import SessionService, { type ChatType } from "../services/session.service";
import AiService from "../services/ai.service";
import ClientRepository from "../repositories/client.repository";
import AiModelRepository from "../repositories/ai-model.repository";

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
        `${label} retry ${i + 1} in ${retryAfter / 1000}s (status ${(err as OpenAI.APIError).status})`,
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

  private constructor() {}

  static getInstance(): BotManager {
    if (!BotManager._instance) BotManager._instance = new BotManager();
    return BotManager._instance;
  }

  private registerHandlers(bot: Bot, clientId: string): void {
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

    // ── Regular messages ───────────────────────────────────────────────────
    bot.on("message:text", (ctx) => {
      if (ctx.message.text.startsWith("/")) return;

      const chatId = ctx.chat.id;
      const userText = ctx.message.text;
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
        const modelId =
          session.ai_model_id ?? (await this.clientRepository.findById(clientId))?.ai_model_id;
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

          // 6. Call AI with exponential backoff (3 retries)
          const reply = await withRetry(
            () =>
              this.aiService.chat(
                aiModel.api_key,
                aiModel.model_id,
                aiModel.provider,
                history.slice(0, -1),
                userText,
              ),
            label,
          );

          // 7. Reply
          await ctx.reply(reply);

          // 8. Save assistant reply
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

    bot
      .start({
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
