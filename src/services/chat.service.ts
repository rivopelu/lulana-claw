import { OpenAI } from "openai";
import logger from "../configs/logger";
import AiService from "./ai.service";
import ContextService from "./context.service";
import GoogleService from "./google.service";
import LearningService from "./learning.service";
import SessionService, { type ChatType } from "./session.service";
import TaskService, { parseRemindTime, type ResponseTask } from "./task.service";
import VectorService from "./vector.service";

const HISTORY_LIMIT = 20;
const TASK_CAPABILITY_PROMPT = `
## SISTEM AKSI

Kamu memiliki kemampuan nyata untuk menyimpan task, reminder, catatan, meeting, deadline, dan mengirim pesan ke platform lain.

### KAPAN MEMBUAT MARKER (HANYA jika ada perintah eksplisit):
Buat marker HANYA jika pengguna secara eksplisit meminta salah satu dari ini:
- Mencatat sesuatu: "catet", "catat", "simpan", "ingat ini"
- Membuat reminder: "ingatkan", "remind me", "kasih reminder", diikuti waktu spesifik
- Membuat task: "buat task", "to-do", "perlu dikerjakan"
- Membuat meeting/deadline: "jadwalkan meeting", "deadline"-nya

### KAPAN TIDAK MEMBUAT MARKER:
- JANGAN buat task/reminder dari kata konfirmasi biasa seperti: "oke", "siap", "gaskan", "lanjut", "mantap", "sip"
- JANGAN buat task dari obrolan umum, pertanyaan, atau diskusi biasa
- JANGAN buat task hanya karena ada kata "nanti" atau "besok" dalam konteks obrolan, bukan perintah
- JANGAN mengarang task yang tidak diminta

### ATURAN EKSEKUSI:
- JANGAN hanya bilang "siap dicatet!" tanpa marker — itu tidak menyimpan apapun
- Semua marker TIDAK TERLIHAT pengguna — tambahkan di baris paling akhir
- JANGAN tanya konfirmasi sebelum membuat marker

---

1. MEMBUAT TASK/CATATAN/REMINDER:
[TASK_CREATE:{"type":"task|reminder|notes|meeting|deadline","title":"judul singkat","description":"detail opsional","remind_at_text":"waktu jika ada, contoh: besok malam, 30m, 2h, 19:00, 24/03 20:00"}]

2. MENYELESAIKAN TASK (gunakan ID 8-karakter dari daftar task):
[TASK_DONE:{"id":"8_char_id"}]

3. MENGHAPUS/MEMBATALKAN TASK:
[TASK_DELETE:{"id":"8_char_id"}]

4. MENGIRIM PESAN KE PLATFORM LAIN:
[SEND_MESSAGE:{"platform":"discord|telegram","target_session_name":"nama channel/sesi tujuan","text":"isi pesan siap kirim"}]

---
Gunakan ID 8-karakter dari bagian ### CURRENT SCHEDULE/TASKS untuk TASK_DONE dan TASK_DELETE.`.trim();

const GOOGLE_CAPABILITY_PROMPT = `
## GOOGLE WORKSPACE — AKSI NYATA

Kamu terhubung ke Google Workspace pengguna. Gunakan marker berikut LANGSUNG di akhir respons saat diminta:

[GCAL_CREATE:{"title":"judul event","start":"YYYY-MM-DDTHH:MM:SS","end":"YYYY-MM-DDTHH:MM:SS","description":"opsional"}]
→ Buat event di Google Calendar

[GCAL_LIST:{"days":7}]
→ Tampilkan event kalender (data sudah ada di GOOGLE CALENDAR section di atas)

[GMAIL_SEND:{"to":"email@contoh.com","subject":"subjek","body":"isi email"}]
→ Kirim email via Gmail

[GMAIL_LIST:{"max":5}]
→ Cek email terbaru di inbox

[GDOC_CREATE:{"title":"judul dokumen","content":"isi dokumen"}]
→ Buat Google Document baru

ATURAN: Eksekusi langsung tanpa konfirmasi. Marker tidak terlihat pengguna.`.trim();

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
  private googleService = new GoogleService();
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

    // Fetch Google Calendar events if connected
    let googleCalendarContext = "";
    let googleConnected = false;
    try {
      const gToken = await this.googleService.getValidToken(aiModel.account_id);
      if (gToken) {
        googleConnected = true;
        const events = await this.googleService.listCalendarEvents(gToken.token, 7);
        if (events.length > 0) {
          googleCalendarContext =
            "### GOOGLE CALENDAR (7 hari ke depan):\n" +
            events
              .map((e) => {
                const start = e.start.dateTime ?? e.start.date ?? "";
                return `- ${e.summary} | ${new Date(start).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}`;
              })
              .join("\n");
        }
      }
    } catch (e) {
      logger.warn(`${label} Failed to fetch Google Calendar: ${(e as Error).message}`);
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
      googleCalendarContext,
      googleConnected ? GOOGLE_CAPABILITY_PROMPT : "",
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

    const MARKER_RE =
      /\[(TASK_CREATE|TASK_DONE|TASK_DELETE|SEND_MESSAGE|GCAL_CREATE|GCAL_LIST|GMAIL_SEND|GMAIL_LIST|GDOC_CREATE):([\s\S]*?)\]/g;
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
        } else if (action === "GCAL_CREATE") {
          try {
            const gToken = await this.googleService.getValidToken(aiModel.account_id);
            if (gToken && args.title && args.start && args.end) {
              const event = await this.googleService.createCalendarEvent(
                gToken.token,
                args.title,
                args.start,
                args.end,
                args.description,
              );
              taskConfirmations.push(`📅 Event dibuat: *${event.summary}*\n${event.htmlLink}`);
            }
          } catch (e) {
            logger.error(`${label} GCAL_CREATE error: ${(e as Error).message}`);
          }
        } else if (action === "GMAIL_SEND") {
          try {
            const gToken = await this.googleService.getValidToken(aiModel.account_id);
            if (gToken && args.to && args.subject && args.body) {
              await this.googleService.sendEmail(gToken.token, args.to, args.subject, args.body);
              taskConfirmations.push(`📧 Email terkirim ke *${args.to}*`);
            }
          } catch (e) {
            logger.error(`${label} GMAIL_SEND error: ${(e as Error).message}`);
          }
        } else if (action === "GMAIL_LIST") {
          try {
            const gToken = await this.googleService.getValidToken(aiModel.account_id);
            if (gToken) {
              const emails = await this.googleService.listEmails(gToken.token, args.max ?? 5);
              if (emails.length > 0) {
                taskConfirmations.push(
                  `📬 *Email terbaru:*\n` +
                    emails
                      .map((e, i) => `${i + 1}. *${e.subject}* dari ${e.from}\n   ${e.snippet}`)
                      .join("\n"),
                );
              }
            }
          } catch (e) {
            logger.error(`${label} GMAIL_LIST error: ${(e as Error).message}`);
          }
        } else if (action === "GDOC_CREATE") {
          try {
            const gToken = await this.googleService.getValidToken(aiModel.account_id);
            if (gToken && args.title) {
              const doc = await this.googleService.createDocument(
                gToken.token,
                args.title,
                args.content ?? "",
              );
              taskConfirmations.push(`📄 Dokumen dibuat: *${args.title}*\n${doc.url}`);
            }
          } catch (e) {
            logger.error(`${label} GDOC_CREATE error: ${(e as Error).message}`);
          }
        }
      } catch (err) {
        logger.error(`${label} Marker parse error: ${(err as Error).message}`);
      }
    }

    let reply = rawReply
      .replace(
        /\[(TASK_CREATE|TASK_DONE|TASK_DELETE|SEND_MESSAGE|GCAL_CREATE|GCAL_LIST|GMAIL_SEND|GMAIL_LIST|GDOC_CREATE):[\s\S]*?\]/g,
        "",
      )
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
