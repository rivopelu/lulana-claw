import { OpenAI } from "openai";
import logger from "../configs/logger";
import AiService from "./ai.service";
import ContextService from "./context.service";
import LearningService from "./learning.service";
import SessionService, { type ChatType } from "./session.service";
import TaskService, { parseRemindTime, type ResponseTask } from "./task.service";
import VectorService from "./vector.service";

const HISTORY_LIMIT = 20;
const TASK_CAPABILITY_PROMPT = `
## SISTEM AKSI — WAJIB DIEKSEKUSI LANGSUNG

Kamu memiliki kemampuan nyata untuk menyimpan task, reminder, catatan, meeting, deadline, dan mengirim pesan ke platform lain. Ini BUKAN sekadar obrolan — ini adalah aksi nyata yang harus kamu lakukan dengan marker di bawah.

### ATURAN PALING PENTING:
- Jika ada kata "catet", "catat", "ingatkan", "remind", "buat task", "simpan", "jadwalkan", "tolong ingat", "besok", "nanti", "jam sekian", atau perintah serupa → WAJIB langsung buat marker yang sesuai di akhir respons.
- JANGAN hanya bilang "siap dicatet!" atau "oke diingatkan!" tanpa marker — itu tidak akan menyimpan apa-apa ke sistem.
- JANGAN tanya konfirmasi, JANGAN tanya "ada yang mau ditambah?", JANGAN minta detail tambahan sebelum membuat marker. Buat dulu, bisa diubah nanti.
- Semua marker TIDAK TERLIHAT oleh pengguna — tambahkan diam-diam di baris paling akhir.

---

1. MEMBUAT TASK/CATATAN/REMINDER (WAJIB jika ada perintah mencatat atau mengingatkan):
[TASK_CREATE:{"type":"task|reminder|notes|meeting|deadline","title":"judul singkat","description":"detail opsional","remind_at_text":"waktu jika ada, contoh: besok malam, 30m, 2h, 19:00, 24/03 20:00"}]

Panduan type:
- "notes" → untuk catatan/info yang perlu disimpan ("catet bahwa...", "simpan info ini")
- "reminder" → untuk pengingat di waktu tertentu ("ingatkan jam...", "remind besok...")
- "task" → untuk pekerjaan/to-do ("buat task untuk...", "perlu dikerjakan...")
- "meeting" → untuk jadwal pertemuan
- "deadline" → untuk batas waktu

2. MENYELESAIKAN TASK (gunakan ID 8-karakter dari daftar task):
[TASK_DONE:{"id":"8_char_id"}]

3. MENGHAPUS/MEMBATALKAN TASK:
[TASK_DELETE:{"id":"8_char_id"}]

4. MENGIRIM PESAN KE PLATFORM LAIN (LANGSUNG, tanpa konfirmasi/preview):
[SEND_MESSAGE:{"platform":"discord|telegram","target_session_name":"nama channel/sesi tujuan","text":"isi pesan siap kirim"}]

---
Gunakan ID 8-karakter dari bagian ### CURRENT SCHEDULE/TASKS untuk TASK_DONE dan TASK_DELETE.`.trim();

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
  private learningService = new LearningService();
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
    const isGroup = chatType !== "private";
    const groupContext = isGroup
      ? `### KONTEKS GRUP:\nKamu sedang berada di grup chat. Pesan dari pengguna diformat sebagai [NamaPengirim]: pesan. Perhatikan baik-baik siapa yang mengatakan apa dan tujukan responmu kepada orang yang tepat. Jangan pernah mencampuradukkan identitas antar pengguna.`
      : "";
    const antiHallucinationInstruction = `### INSTRUKSI PENTING:\n- Jika kamu tidak tahu sesuatu, katakan dengan jujur — jangan mengarang fakta, tanggal, atau informasi yang tidak ada dalam konteks percakapan ini.\n- Jawab hanya berdasarkan informasi yang kamu miliki dari konteks dan history percakapan.`;
    const systemPrompt = [
      baseSystemPrompt,
      groupContext,
      antiHallucinationInstruction,
      ragContext
        ? `### LONG-TERM MEMORY (Retrieved from Database):\n${ragContext}\n*Gunakan informasi di atas jika relevan untuk menjawab pertanyaan pengguna.*`
        : "",
      pendingTasksContext ? `### CURRENT SCHEDULE/TASKS:\n${pendingTasksContext}` : "",
      `[Waktu sekarang: ${nowStr}]`,
      TASK_CAPABILITY_PROMPT,
    ]
      .filter(Boolean)
      .join("\n\n");

    const aiText = isGroup ? `[${fromName}]: ${text}` : text;
    const rawReply = await withRetry(
      () =>
        this.aiService.chat(
          aiModel.api_key,
          aiModel.model_id,
          aiModel.provider,
          history.slice(0, -1),
          aiText,
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
        if (action === "TASK_CREATE") {
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
        } else if (action === "TASK_DONE" || action === "TASK_DELETE") {
          const suffix = args.id;
          const target = pendingTasks.find((t) => t.id.endsWith(suffix));
          if (target) {
            if (action === "TASK_DONE") {
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

    // Fire-and-forget: auto-learn every AUTO_LEARN_INTERVAL messages
    this.learningService
      .maybeAutoLearn({
        sessionId: session.id,
        accountId: aiModel.account_id,
        clientId,
        sessionName: session.name,
        aiModel,
      })
      .catch((err) => logger.error(`${label} Auto-learn error: ${(err as Error).message}`));

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
