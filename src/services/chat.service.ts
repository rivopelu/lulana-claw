import { OpenAI } from "openai";
import logger from "../configs/logger";
import AiService from "./ai.service";
import ContextService from "./context.service";
import SessionService, { type ChatType } from "./session.service";
import TaskService, { parseRemindTime, type ResponseTask } from "./task.service";
import VectorService from "./vector.service";

const HISTORY_LIMIT = 10;
const TASK_CAPABILITY_PROMPT = `
Kamu memiliki kemampuan menyimpan, menyelesaikan, dan menghapus task/reminder/catatan/meeting/deadline, serta mengirim pesan ke platform lain.

1. UNTUK MEMBUAT BARU:
Jika pengguna meminta membuat sesuatu, tambahkan di baris paling akhir:
[TASK_CREATE:{"type":"task|reminder|notes|meeting|deadline","title":"...","description":"...","remind_at_text":"..."}]

2. UNTUK MENYELESAIKAN (DONE):
Jika pengguna mengatakan task tertentu sudah selesai, gunakan ID 8-karakter yang ada di daftar jadwal:
[TASK_DONE:{"id":"8_char_id"}]

3. UNTUK MENGHAPUS/BATAL (DELETE/CANCEL):
Jika pengguna meminta menghapus atau membatalkan task:
[TASK_DELETE:{"id":"8_char_id"}]

4. UNTUK MENGIRIM PESAN LINTAS PLATFORM:
Jika pengguna meminta kamu untuk mengirim pesan ke platform lain (discord, telegram) atau ke channel/grup tertentu, kamu HARUS LANGSUNG mengirimnya tanpa meminta konfirmasi, tanpa menampilkan preview, tanpa bertanya "gimana?" atau "langsung kirim?".
Tambahkan marker berikut di baris paling akhir respons:
[SEND_MESSAGE:{"platform":"discord|telegram","target_session_name":"nama channel/sesi tujuan","text":"isi pesan yang akan dikirim"}]
Isi "text" dengan pesan yang sudah siap dikirim, bukan preview atau draf. Tulis pesan yang natural sesuai konteks permintaan pengguna.

Aturan umum:
- JANGAN tampilkan, jelaskan, atau tunjukkan blok [...] ke pengguna — cukup tambahkan di akhir respons secara diam-diam.
- Untuk SEND_MESSAGE: JANGAN tanya konfirmasi, JANGAN tampilkan preview isi pesan, LANGSUNG buat markernya.
- Gunakan ID 8-karakter yang ada di bagian ### CURRENT SCHEDULE/TASKS untuk TASK_DONE dan TASK_DELETE.`.trim();

export interface ProcessMessageParams {
  clientId: string;
  chatId: number;
  chatType: ChatType;
  text: string;
  fromId: number;
  fromName: string;
  aiModel: {
    account_id: string;
    model_id: string;
    api_key: string;
    provider: string;
  };
  entityMode?: "single" | "per_session";
}

export default class ChatService {
  private aiService = new AiService();
  private contextService = new ContextService();
  private sessionService = new SessionService();
  private taskService = new TaskService();
  private vectorService = new VectorService();

  async processMessage(params: ProcessMessageParams): Promise<{ reply: string; markers: any[] }> {
    const {
      clientId,
      chatId,
      chatType,
      text,
      fromId,
      fromName,
      aiModel,
      entityMode = "per_session",
    } = params;
    const label = `[Chat:${clientId}:${chatId}]`;

    const session = await this.sessionService.ensureSession(clientId, chatId, chatType, fromName);

    let userEmbedding: number[] | undefined;
    try {
      userEmbedding = await this.aiService.generateEmbedding(
        aiModel.api_key,
        aiModel.provider,
        text,
      );
    } catch (e) {
      logger.warn(`${label} Failed to generate embedding: ${(e as Error).message}`);
    }

    await this.sessionService.addMessage(
      session.id,
      "user",
      text,
      fromId.toString(),
      fromName,
      userEmbedding,
    );

    let ragContext = "";
    if (userEmbedding) {
      const relHistory = await this.vectorService.searchHistory(session.id, userEmbedding, 10);
      const relContexts = await this.vectorService.searchContexts(
        aiModel.account_id,
        userEmbedding,
        {
          clientId,
          sessionId: session.id,
          limit: 3,
        },
      );

      if (relHistory.length > 0) {
        ragContext +=
          "\n### Relevant Past Conversations:\n" +
          relHistory
            .map(
              (h) =>
                `[${new Date(h.created_at).toLocaleDateString()}] ${h.from_name || h.role}: ${h.content}`,
            )
            .join("\n");
      }
      if (relContexts.length > 0) {
        ragContext +=
          "\n### Relevant Knowledge/Context:\n" +
          relContexts.map((c) => `- ${c.name}: ${c.content}`).join("\n");
      }
    }

    const history = await this.sessionService.getHistory(session.id, HISTORY_LIMIT + 1);

    let pendingTasks: ResponseTask[] = [];
    let pendingTasksContext = "";
    try {
      pendingTasks = await this.taskService.getByChatId(clientId, chatId, "pending");
      if (pendingTasks.length > 0) {
        pendingTasksContext =
          "\n### Jadwal/Task Pending saat ini:\n" +
          pendingTasks
            .map(
              (t, i) =>
                `${i + 1}. [${t.type.toUpperCase()}] ${t.title}${t.remind_at ? ` (Remind: ${new Date(t.remind_at).toLocaleString()})` : ""} - ID: ${t.id.slice(-8)}`,
            )
            .join("\n");
      }
    } catch (e) {
      logger.warn(`${label} Failed to fetch tasks: ${(e as Error).message}`);
    }

    const baseSystemPrompt = await this.contextService.buildSystemPrompt(
      aiModel.account_id,
      clientId,
      session.id,
      entityMode,
    );
    const nowStr = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    const systemPrompt = [
      baseSystemPrompt,
      ragContext
        ? `### LONG-TERM MEMORY (Retrieved from Database):\n${ragContext}\n*Gunakan informasi di atas jika relevan untuk menjawab pertanyaan pengguna.*`
        : "",
      pendingTasksContext ? `### CURRENT SCHEDULE/TASKS:\n${pendingTasksContext}` : "",
      `[Waktu sekarang: ${nowStr}]`,
      TASK_CAPABILITY_PROMPT,
    ]
      .filter(Boolean)
      .join("\n\n");

    const rawReply = await withRetry(
      () =>
        this.aiService.chat(
          aiModel.api_key,
          aiModel.model_id,
          aiModel.provider,
          history.slice(0, -1),
          text,
          systemPrompt,
        ),
      label,
    );

    const MARKER_RE = /\[(TASK_CREATE|TASK_DONE|TASK_DELETE|SEND_MESSAGE):([\s\S]*?)\]/g;
    const taskConfirmations: string[] = [];
    const outgoingMarkers: any[] = [];
    let markerMatch: RegExpExecArray | null;

    while ((markerMatch = MARKER_RE.exec(rawReply)) !== null) {
      const action = markerMatch[1];
      try {
        const args = JSON.parse(markerMatch[2]);
        if (action === "CREATE") {
          if (args.title) {
            const task = await this.taskService.create(
              {
                client_id: clientId,
                chat_id: chatId,
                session_id: session.id,
                type: args.type || "task",
                title: args.title,
                description: args.description,
                remind_at: args.remind_at_text
                  ? (parseRemindTime(args.remind_at_text) ?? undefined)
                  : undefined,
              },
              aiModel.account_id,
            );
            const emo =
              { task: "📋", reminder: "⏰", notes: "📝", meeting: "🤝", deadline: "🚨" }[
                task.type as string
              ] || "📋";
            taskConfirmations.push(`${emo} *${task.title}* [${task.id.slice(-8)}]`);
          }
        } else if (action === "DONE" || action === "DELETE") {
          const suffix = args.id;
          const target = pendingTasks.find((t) => t.id.endsWith(suffix));
          if (target) {
            if (action === "DONE") {
              await this.taskService.markDone(target.id, aiModel.account_id);
              taskConfirmations.push(`✅ *${target.title}* selesai!`);
            } else {
              await this.taskService.delete(target.id, aiModel.account_id);
              taskConfirmations.push(`🗑️ *${target.title}* dihapus.`);
            }
          }
        } else if (action === "SEND_MESSAGE") {
          outgoingMarkers.push({
            type: "send_message",
            platform: args.platform,
            targetSessionName: args.target_session_name,
            text: args.text,
          });
          taskConfirmations.push(
            `📨 Pesan dijadwalkan untuk dikirim ke ${args.platform} (${args.target_session_name})`,
          );
        }
      } catch (err) {
        logger.error(`${label} Marker parse error: ${(err as Error).message}`);
      }
    }

    let reply = rawReply
      .replace(/\[(TASK_CREATE|TASK_DONE|TASK_DELETE|SEND_MESSAGE):[\s\S]*?\]/g, "")
      .trim();
    if (taskConfirmations.length > 0) {
      reply = reply
        ? `${reply}\n\n✅ Info:\n${taskConfirmations.join("\n")}`
        : `✅ Info:\n${taskConfirmations.join("\n")}`;
    }

    let replyEmbedding: number[] | undefined;
    try {
      replyEmbedding = await this.aiService.generateEmbedding(
        aiModel.api_key,
        aiModel.provider,
        reply,
      );
    } catch {}
    await this.sessionService.addMessage(
      session.id,
      "assistant",
      reply,
      undefined,
      undefined,
      replyEmbedding,
    );

    return { reply, markers: outgoingMarkers };
  }
}

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
      if ((!isRateLimit && !isServerErr) || i === delays.length) break;
      const retryAfter =
        isRateLimit && err instanceof OpenAI.APIError
          ? Number(err.headers?.["retry-after"] ?? 0) * 1000 || delays[i]
          : delays[i];
      logger.warn(`${label} retry ${i + 1} in ${retryAfter / 1000}s`);
      await new Promise((r) => setTimeout(r, retryAfter));
    }
  }
  throw lastErr;
}
