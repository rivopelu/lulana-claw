import { OpenAI } from "openai";
import logger from "../configs/logger";
import AiService from "./ai.service";
import ContextService from "./context.service";
import GoogleService from "./google.service";
import LearningService from "./learning.service";
import SessionService, { type ChatType } from "./session.service";
import TaskService, { parseRemindTime, type ResponseTask } from "./task.service";
import FinanceService, { type ResponseBudgetSession } from "./finance.service";
import VectorService from "./vector.service";

const HISTORY_LIMIT = 20;
const FINANCE_CAPABILITY_PROMPT = `
## KEUANGAN & BUDGETING — WAJIB EKSEKUSI LANGSUNG

Kamu SUDAH terhubung ke sistem pencatatan keuangan pengguna. Kamu HARUS langsung mengeksekusi aksi keuangan tanpa tanya konfirmasi, tanpa preview, tanpa nanya ulang.

### ATURAN KERAS — EXPENSE_LOG:
Jika ada ### SESI BUDGET AKTIF di konteks, dan pengguna menyebutkan APAPUN yang mereka beli, bayar, atau keluarkan uang — WAJIB langsung buat [EXPENSE_LOG:...].
TIDAK PEDULI apakah kalimatnya perintah, pernyataan, atau cerita santai:
- "sudah isi bensin 100rb" → WAJIB EXPENSE_LOG
- "tadi beli makan 45rb" → WAJIB EXPENSE_LOG
- "habis bayar parkir 5000" → WAJIB EXPENSE_LOG
- "beli kopi 30rb" → WAJIB EXPENSE_LOG
- "jajan 25rb" → WAJIB EXPENSE_LOG

### LARANGAN KERAS:
- JANGAN hanya bilang "sudah dicatat" / "oke dicatet" tanpa marker [EXPENSE_LOG:...] — itu TIDAK menyimpan apapun ke database
- JANGAN tanya "mau dicatat?" atau minta konfirmasi — langsung catat
- JANGAN lewatkan nominal yang disebutkan — selalu parse angka dari pesan (100rb = 100000, 5k = 5000, 1,5jt = 1500000)

### KAPAN MEMBUAT BUDGET_START:
- Pengguna menyebut budget untuk suatu kegiatan: "mau jalan-jalan budget 1 juta", "belanja modal 500rb", "trip ke bali budget 3 juta"
- Buat HANYA jika belum ada sesi aktif untuk kegiatan yang sama

### KAPAN MEMBUAT BUDGET_END:
- Pengguna mengakhiri kegiatan: "selesai jalan-jalan", "udah pulang", "trip selesai", "belanjanya udah"

### SETELAH EXPENSE_LOG:
- Sebutkan sisa budget dalam respons: "Sisa budget kamu Rp X dari Rp Y" (hitung dari ### SESI BUDGET AKTIF: kurangi total_spent dengan amount baru)
- Respons tetap natural dan singkat

### ATURAN UMUM:
- Semua marker TIDAK TERLIHAT pengguna — taruh di baris paling akhir respons
- EXPENSE_LOG ini BERBEDA dari TASK_CREATE — tidak perlu kata eksplisit seperti "catet" atau "simpan", cukup ada nominal pengeluaran + sesi aktif

---

6. MULAI SESI BUDGET:
[BUDGET_START:{"title":"nama kegiatan singkat","budget_amount":1000000}]

7. CATAT PENGELUARAN/PEMASUKAN (gunakan ID 8-karakter dari ### SESI BUDGET AKTIF):
[EXPENSE_LOG:{"budget_session_id":"8_char_id","description":"deskripsi singkat","amount":100000,"category":"food|transport|entertainment|shopping|health|other","type":"expense|income"}]

8. AKHIRI SESI BUDGET:
[BUDGET_END:{"id":"8_char_id"}]`.trim();

const TASK_CAPABILITY_PROMPT = `
## SISTEM AKSI

Kamu memiliki kemampuan nyata untuk menyimpan task, reminder, catatan, meeting, deadline, dan mengirim pesan ke platform lain.

### KAPAN MEMBUAT MARKER (HANYA jika ada perintah eksplisit di pesan SAAT INI):
Buat marker HANYA jika pengguna dalam pesan SAAT INI secara eksplisit meminta:
- Mencatat sesuatu: "catet", "catat", "simpan", "ingat ini"
- Membuat reminder: "ingatkan", "remind me", "kasih reminder", + waktu spesifik
- Membuat task: "buat task", "to-do", "perlu dikerjakan"
- Membuat meeting/deadline: "jadwalkan meeting", "deadline"-nya

### KAPAN TIDAK MEMBUAT MARKER (LARANGAN KERAS):
- JANGAN buat task dari obrolan santai, pertanyaan, atau percakapan biasa
- JANGAN buat task karena ada informasi di LONG-TERM MEMORY atau RELEVANT PAST CONVERSATIONS — memori lama bukan perintah baru
- JANGAN buat task dari kata konfirmasi: "oke", "siap", "gaskan", "lanjut", "mantap", "sip", "ngobrol"
- JANGAN buat task hanya karena ada kata "nanti" atau "besok" dalam obrolan biasa
- JANGAN buat task dari pernyataan status/perasaan: "aku lapar", "aku ngantuk", "aku capek", "aku bosen", "aku laper", "lapar nih" — itu obrolan biasa, BUKAN perintah
- JANGAN buat task dari percakapan di grup yang tidak secara langsung dan eksplisit ditujukan sebagai perintah kepadamu dengan kata kerja aksi ("ingatkan", "catet", "buat reminder")
- JANGAN mengarang task yang tidak diminta secara eksplisit di pesan saat ini

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

5. MENYIMPAN KE GLOBAL CONTEXT (berlaku di SEMUA percakapan Luna):
[GLOBAL_CONTEXT_UPDATE:{"content":"informasi penting yang harus selalu diingat Luna di semua platform dan sesi"}]

Kapan pakai GLOBAL_CONTEXT_UPDATE:
- Pengguna/admin secara eksplisit minta Luna "ingat ini selalu", "catat global", "update context global", "harus selalu diingat", dll
- Ada fakta penting tentang Luna (link sosmed, kemampuan baru, identitas) yang harus diingat selamanya
- Ada instruksi permanen dari pemilik/admin yang berlaku untuk semua percakapan
JANGAN pakai untuk catatan biasa atau info personal pengguna biasa — gunakan TASK_CREATE untuk itu.

---
Gunakan ID 8-karakter dari bagian ### CURRENT SCHEDULE/TASKS untuk TASK_DONE dan TASK_DELETE.`.trim();

const GOOGLE_CAPABILITY_PROMPT = `
## GOOGLE WORKSPACE — WAJIB EKSEKUSI LANGSUNG

Kamu SUDAH terhubung ke Google Workspace pengguna sebagai asisten mereka. Kamu BISA dan HARUS langsung mengeksekusi aksi Google tanpa preview, tanpa tanya konfirmasi, tanpa minta persetujuan.

### TRIGGER → AKSI WAJIB:
- "kirim email ke ...", "send email", "emailkan" → WAJIB pakai [GMAIL_SEND:...]
- "buat event", "jadwalkan di kalender", "tambah ke kalender" → WAJIB pakai [GCAL_CREATE:...]
- "cek email", "lihat inbox" → WAJIB pakai [GMAIL_LIST:...]
- "buat dokumen", "buat doc" → WAJIB pakai [GDOC_CREATE:...]

### ATURAN KERAS:
- JANGAN preview isi email dan tanya "sudah oke?" — langsung kirim
- JANGAN bilang "nanti akan diintegrasikan" — kamu SUDAH terhubung sekarang
- JANGAN minta konfirmasi — pengguna sudah memerintahkan, langsung eksekusi
- Isi email/dokumen: tulis dalam SATU BARIS, gunakan \\n untuk baris baru (bukan enter)
- Marker TIDAK TERLIHAT pengguna — taruh di baris paling akhir respons

### FORMAT MARKER:
[GMAIL_SEND:{"to":"email@contoh.com","subject":"subjek","body":"baris 1\\nbaris 2\\nbaris 3"}]
[GCAL_CREATE:{"title":"judul","start":"2026-03-24T10:00:00","end":"2026-03-24T11:00:00","description":"opsional"}]
[GMAIL_LIST:{"max":5}]
[GDOC_CREATE:{"title":"judul","content":"isi dokumen satu baris dengan \\n untuk enter"}]

### ATURAN EMAIL:
- Tandatangani email sebagai: "Luna\\nAsisten Pribadi Rivo"
- JANGAN gunakan "[Nama Kamu]" atau placeholder apapun — kamu adalah Luna, asisten Rivo
- Tulis isi email dalam satu string, gunakan \\n untuk baris baru`.trim();

export interface ProcessMessageParams {
  clientId: string;
  chatId: number;
  chatType: ChatType;
  text: string;
  fromId: number;
  fromName: string;
  platform: string;
  channelName?: string;
  aiModel: {
    account_id: string;
    model_id: string;
    api_key: string;
    provider: string;
  };
  entityMode?: "single" | "per_session";
}

export default class ChatService {
  /** Accounts whose Calendar API returned 403 — skip until server restart/reconnect */
  static calendarForbidden = new Set<string>();

  private aiService = new AiService();
  private contextService = new ContextService();
  private financeService = new FinanceService();
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
      platform,
      channelName,
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
      platform,
      channelName ?? session.name,
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

    // Fetch active budget sessions for this chat
    let activeBudgetSessions: ResponseBudgetSession[] = [];
    let budgetContext = "";
    try {
      activeBudgetSessions = await this.financeService.getActiveSessions(clientId, chatId);
      if (activeBudgetSessions.length > 0) {
        const fmt = (n: number) => `Rp${n.toLocaleString("id-ID")}`;
        budgetContext =
          "### SESI BUDGET AKTIF:\n" +
          activeBudgetSessions
            .map(
              (s, i) =>
                `${i + 1}. [${s.title}] Budget: ${fmt(s.budget_amount)} | Terpakai: ${fmt(s.total_spent)} | Sisa: ${fmt(s.remaining)} - ID: ${s.id.slice(-8)}`,
            )
            .join("\n");
      }
    } catch (e) {
      logger.warn(`${label} Failed to fetch budget sessions: ${(e as Error).message}`);
    }

    // Fetch Google Calendar events if connected (skip if known forbidden)
    let googleCalendarContext = "";
    let googleConnected = false;
    try {
      const gToken = await this.googleService.getValidToken(aiModel.account_id);
      if (gToken) {
        googleConnected = true;
        if (!ChatService.calendarForbidden.has(aiModel.account_id)) {
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
      }
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("Forbidden") || msg.includes("403")) {
        ChatService.calendarForbidden.add(aiModel.account_id);
        logger.warn(
          `${label} Google Calendar forbidden — suppressing further attempts until reconnect`,
        );
      } else {
        logger.warn(`${label} Failed to fetch Google Calendar: ${msg}`);
      }
    }

    const baseSystemPrompt = await this.contextService.buildSystemPrompt(
      aiModel.account_id,
      clientId,
      session.id,
      entityMode,
    );
    const nowStr = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    const isGroup = chatType !== "private";
    const resolvedChannelName = channelName ?? session.name;
    const platformContext = `### SUMBER PESAN:\nPlatform: ${platform}\nNama Sesi/Channel: ${resolvedChannelName}\nTipe Chat: ${chatType}`;
    const groupContext = isGroup
      ? `### KONTEKS GRUP:
Kamu sedang berada di grup chat. Pesan dari pengguna diformat sebagai [NamaPengirim]: pesan.
- Perhatikan siapa yang mengatakan apa dan tujukan responmu kepada orang yang tepat
- Jangan pernah mencampuradukkan identitas antar pengguna
- JANGAN ucapkan sapaan dramatis ("Eh ada [nama]! Kirain siapa~") berulang-ulang kepada orang yang sama — sapaan hanya wajar di pesan pertama mereka muncul setelah lama tidak aktif, BUKAN setiap kali mereka kirim pesan
- Dalam alur percakapan yang sambung, langsung jawab tanpa re-greet atau re-introduce
- JANGAN buat task/reminder dari pernyataan status orang lain di grup ("aku lapar", "aku capek", "aku ngantuk") — itu obrolan biasa, bukan perintah ke kamu
- Fokus pada apa yang diminta. Jangan tambahkan pertanyaan balik atau roleplay yang tidak relevan dengan pertanyaan/perintah yang diterima`
      : "";
    const antiHallucinationInstruction = `### INSTRUKSI PENTING:\n- Jika kamu tidak tahu sesuatu, katakan jujur — JANGAN mengarang fakta, nama, tempat, atau informasi yang tidak ada di konteks.\n- Tentang identitasmu: HANYA gunakan info yang ada di konteks. JANGAN mengarang saudara, teman bot lain, organisasi, atau backstory yang tidak tercantum.\n- JANGAN gunakan placeholder text seperti "sebutkan makanan kesukaan", "isi nama di sini", atau teks dalam kurung kotak/kurung biasa sebagai bagian dari respons — kalau tidak tahu, jawab langsung dengan jujur.\n- Kamu adalah AI — kamu tidak makan, tidak punya makanan favorit, tidak punya tubuh fisik. Boleh bahas makanan tapi jangan klaim punya preferensi pribadi.\n- Jika ditanya tentang dirimu yang tidak ada di konteks, jawab jujur: "Aku nggak tahu" atau "Tidak ada info tentang itu di konteksku."`;
    const systemPrompt = [
      baseSystemPrompt,
      platformContext,
      groupContext,
      antiHallucinationInstruction,
      ragContext
        ? `### LONG-TERM MEMORY (Retrieved from Database):\n${ragContext}\n*Gunakan informasi di atas jika relevan untuk menjawab pertanyaan pengguna.*`
        : "",
      pendingTasksContext ? `### CURRENT SCHEDULE/TASKS:\n${pendingTasksContext}` : "",
      budgetContext,
      googleCalendarContext,
      googleConnected ? GOOGLE_CAPABILITY_PROMPT : "",
      `[Waktu sekarang: ${nowStr}]`,
      TASK_CAPABILITY_PROMPT,
      FINANCE_CAPABILITY_PROMPT,
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

    const taskConfirmations: string[] = [];
    const outgoingMarkers: any[] = [];

    for (const { action, args } of extractMarkers(rawReply)) {
      // helper to safely cast arg values
      const str = (v: unknown) => (typeof v === "string" ? v : String(v ?? ""));
      const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));

      if (action === "TASK_CREATE") {
        if (args.title) {
          const task = await this.taskService.create(
            {
              client_id: clientId,
              chat_id: chatId,
              session_id: session.id,
              type: (args.type as any) || "task",
              title: str(args.title),
              description: args.description ? str(args.description) : undefined,
              remind_at: args.remind_at_text
                ? (parseRemindTime(str(args.remind_at_text)) ?? undefined)
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
        const suffix = str(args.id);
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
          platform: str(args.platform),
          targetSessionName: str(args.target_session_name),
          text: str(args.text),
        });
        taskConfirmations.push(
          `📨 Pesan dijadwalkan untuk dikirim ke ${str(args.platform)} (${str(args.target_session_name)})`,
        );
      } else if (action === "GCAL_CREATE") {
        try {
          const gToken = await this.googleService.getValidToken(aiModel.account_id);
          if (gToken && args.title && args.start && args.end) {
            const event = await this.googleService.createCalendarEvent(
              gToken.token,
              str(args.title),
              str(args.start),
              str(args.end),
              args.description ? str(args.description) : undefined,
            );
            taskConfirmations.push(`📅 Event dibuat: *${event.summary}*\n${event.htmlLink}`);
          }
        } catch (e) {
          logger.error(`${label} GCAL_CREATE error: ${(e as Error).message}`);
          taskConfirmations.push(`⚠️ Gagal buat event kalender: ${googleErrorMessage(e)}`);
        }
      } else if (action === "GMAIL_SEND") {
        try {
          const gToken = await this.googleService.getValidToken(aiModel.account_id);
          if (gToken && args.to && args.subject && args.body) {
            await this.googleService.sendEmail(
              gToken.token,
              str(args.to),
              str(args.subject),
              str(args.body),
            );
            taskConfirmations.push(`📧 Email terkirim ke *${str(args.to)}*`);
          }
        } catch (e) {
          logger.error(`${label} GMAIL_SEND error: ${(e as Error).message}`);
          taskConfirmations.push(`⚠️ Gagal kirim email: ${googleErrorMessage(e)}`);
        }
      } else if (action === "GMAIL_LIST") {
        try {
          const gToken = await this.googleService.getValidToken(aiModel.account_id);
          if (gToken) {
            const emails = await this.googleService.listEmails(gToken.token, num(args.max) || 5);
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
          taskConfirmations.push(`⚠️ Gagal ambil email: ${googleErrorMessage(e)}`);
        }
      } else if (action === "GDOC_CREATE") {
        try {
          const gToken = await this.googleService.getValidToken(aiModel.account_id);
          if (gToken && args.title) {
            const doc = await this.googleService.createDocument(
              gToken.token,
              str(args.title),
              args.content ? str(args.content) : "",
            );
            taskConfirmations.push(`📄 Dokumen dibuat: *${str(args.title)}*\n${doc.url}`);
          }
        } catch (e) {
          logger.error(`${label} GDOC_CREATE error: ${(e as Error).message}`);
          taskConfirmations.push(`⚠️ Gagal buat dokumen: ${googleErrorMessage(e)}`);
        }
      } else if (action === "BUDGET_START") {
        if (args.title && args.budget_amount) {
          try {
            const budgetSession = await this.financeService.createBudgetSession(
              {
                client_id: clientId,
                chat_id: chatId,
                session_id: session.id,
                title: str(args.title),
                budget_amount: num(args.budget_amount),
                currency: args.currency ? str(args.currency) : "IDR",
              },
              aiModel.account_id,
            );
            taskConfirmations.push(
              `💰 Sesi budget *${budgetSession.title}* dimulai! Budget: Rp${budgetSession.budget_amount.toLocaleString("id-ID")} [${budgetSession.id.slice(-8)}]`,
            );
          } catch (e) {
            logger.error(`${label} BUDGET_START error: ${(e as Error).message}`);
          }
        }
      } else if (action === "EXPENSE_LOG") {
        if (args.description && args.amount) {
          try {
            const tx = await this.financeService.createTransaction(
              {
                client_id: clientId,
                chat_id: chatId,
                budget_session_id: args.budget_session_id
                  ? (() => {
                      const suffix = str(args.budget_session_id);
                      return activeBudgetSessions.find((s) => s.id.endsWith(suffix))?.id;
                    })()
                  : undefined,
                description: str(args.description),
                amount: num(args.amount),
                category: (args.category as any) || "other",
                type: (args.type as any) || "expense",
              },
              aiModel.account_id,
            );
            const emo = tx.type === "income" ? "💵" : "💸";
            taskConfirmations.push(
              `${emo} *${tx.description}*: Rp${tx.amount.toLocaleString("id-ID")} [${tx.category}]`,
            );
          } catch (e) {
            logger.error(`${label} EXPENSE_LOG error: ${(e as Error).message}`);
          }
        }
      } else if (action === "BUDGET_END") {
        if (args.id) {
          try {
            const suffix = str(args.id);
            const target = activeBudgetSessions.find((s) => s.id.endsWith(suffix));
            if (target) {
              await this.financeService.completeSession(target.id, aiModel.account_id);
              const fmt = (n: number) => `Rp${n.toLocaleString("id-ID")}`;
              taskConfirmations.push(
                `✅ Sesi *${target.title}* selesai!\nTotal: ${fmt(target.total_spent)} / ${fmt(target.budget_amount)} | Sisa: ${fmt(target.remaining)}`,
              );
            }
          } catch (e) {
            logger.error(`${label} BUDGET_END error: ${(e as Error).message}`);
          }
        }
      } else if (action === "GLOBAL_CONTEXT_UPDATE") {
        if (args.content && str(args.content).trim()) {
          try {
            await this.contextService.appendAutoGlobalContext(
              aiModel.account_id,
              str(args.content).trim(),
            );
            taskConfirmations.push(`🧠 Global context diperbarui!`);
            logger.info(`${label} Global context updated via marker`);
          } catch (e) {
            logger.error(`${label} GLOBAL_CONTEXT_UPDATE error: ${(e as Error).message}`);
          }
        }
      }
    }

    let reply = rawReply
      .replace(
        /\[(TASK_CREATE|TASK_DONE|TASK_DELETE|SEND_MESSAGE|GCAL_CREATE|GCAL_LIST|GMAIL_SEND|GMAIL_LIST|GDOC_CREATE|GLOBAL_CONTEXT_UPDATE|BUDGET_START|EXPENSE_LOG|BUDGET_END):\{[\s\S]*?\}\]/g,
        "",
      )
      .trim();
    if (taskConfirmations.length > 0) {
      reply = reply
        ? `${reply}\n\n✅ Info:\n${taskConfirmations.join("\n")}`
        : `✅ Info:\n${taskConfirmations.join("\n")}`;
    }

    // Safety: never send empty reply
    if (!reply.trim()) {
      reply = "✅ Selesai.";
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
      platform,
      channelName ?? session.name,
    );

    // Fire-and-forget: session auto-learn every AUTO_LEARN_INTERVAL messages
    this.learningService
      .maybeAutoLearn({
        sessionId: session.id,
        accountId: aiModel.account_id,
        clientId,
        sessionName: session.name,
        aiModel,
      })
      .catch((err) => logger.error(`${label} Auto-learn error: ${(err as Error).message}`));

    // Fire-and-forget: global context update — filter important knowledge from this exchange
    this.learningService
      .maybeUpdateGlobalContext({
        sessionId: session.id,
        accountId: aiModel.account_id,
        lastExchange: { userText: text, lunaReply: reply },
        aiModel,
      })
      .catch((err) => logger.warn(`${label} Global learn error: ${(err as Error).message}`));

    return { reply, markers: outgoingMarkers };
  }
}

const MARKER_ACTIONS = [
  "TASK_CREATE",
  "TASK_DONE",
  "TASK_DELETE",
  "SEND_MESSAGE",
  "GCAL_CREATE",
  "GCAL_LIST",
  "GMAIL_SEND",
  "GMAIL_LIST",
  "GDOC_CREATE",
  "GLOBAL_CONTEXT_UPDATE",
  "BUDGET_START",
  "EXPENSE_LOG",
  "BUDGET_END",
] as const;

/**
 * Robustly extract action markers from AI reply using bracket counting.
 * Handles bodies that contain `]`, newlines, or other problematic characters.
 */
function extractMarkers(text: string): Array<{ action: string; args: Record<string, unknown> }> {
  const results: Array<{ action: string; args: Record<string, unknown> }> = [];

  for (const action of MARKER_ACTIONS) {
    const prefix = `[${action}:`;
    let searchFrom = 0;

    while (searchFrom < text.length) {
      const start = text.indexOf(prefix, searchFrom);
      if (start === -1) break;

      // Find matching } by tracking depth, respecting strings and escapes
      const bodyStart = start + prefix.length;
      if (text[bodyStart] !== "{") {
        searchFrom = start + 1;
        continue;
      }

      let depth = 0;
      let inString = false;
      let escape = false;
      let bodyEnd = -1;

      for (let i = bodyStart; i < text.length; i++) {
        const ch = text[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (ch === "\\") {
          escape = true;
          continue;
        }
        if (ch === '"') {
          inString = !inString;
          continue;
        }
        if (inString) continue;
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            bodyEnd = i;
            break;
          }
        }
      }

      if (bodyEnd === -1) {
        searchFrom = start + 1;
        continue;
      }

      const rawJson = text.slice(bodyStart, bodyEnd + 1);
      try {
        // Sanitize literal newlines/tabs inside JSON before parsing
        const cleanJson = rawJson.replace(/\r?\n/g, "\\n").replace(/\t/g, "\\t");
        const args = JSON.parse(cleanJson) as Record<string, unknown>;
        results.push({ action, args });
      } catch (err) {
        // ignore malformed marker
      }

      searchFrom = bodyEnd + 1;
    }
  }

  return results;
}

function googleErrorMessage(e: unknown): string {
  const msg = (e as Error).message ?? "";
  if (msg.includes("Forbidden") || msg.includes("403")) {
    return "Akses ditolak (403). Pastikan Google API sudah diaktifkan (Calendar/Gmail/Docs) di Google Cloud Console dan reconnect Google di halaman Apps.";
  }
  if (msg.includes("Unauthorized") || msg.includes("401")) {
    return "Token kadaluarsa. Silakan reconnect Google di halaman Apps.";
  }
  return msg;
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
