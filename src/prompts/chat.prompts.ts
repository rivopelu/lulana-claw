import type { ChatType } from "../services/session.service";

// ---------------------------------------------------------------------------
// Data-driven context builder types (plain objects, no circular deps)
// ---------------------------------------------------------------------------

export interface RagHistoryItem {
  created_at: Date | string | number;
  from_name?: string | null;
  role: string;
  content: string;
}

export interface RagContextItem {
  name: string;
  content: string;
}

export interface PendingTaskItem {
  type: string;
  title: string;
  remind_at?: number | null;
  id: string;
}

export interface BudgetSessionItem {
  title: string;
  budget_amount: number;
  total_spent: number;
  remaining: number;
  id: string;
}

export interface CalendarEventItem {
  summary: string;
  start: { dateTime?: string; date?: string };
}

/** Anti-hallucination safety instruction injected into every system prompt */
export const ANTI_HALLUCINATION_INSTRUCTION = `### INSTRUKSI PENTING:
- Jika kamu tidak tahu sesuatu, katakan jujur — JANGAN mengarang fakta, nama, tempat, atau informasi yang tidak ada di konteks.
- Tentang identitasmu: HANYA gunakan info yang ada di konteks. JANGAN mengarang saudara, teman bot lain, organisasi, atau backstory yang tidak tercantum.
- JANGAN gunakan placeholder text seperti "sebutkan makanan kesukaan", "isi nama di sini", atau teks dalam kurung kotak/kurung biasa sebagai bagian dari respons — kalau tidak tahu, jawab langsung dengan jujur.
- Kamu adalah AI — kamu tidak makan, tidak punya makanan favorit, tidak punya tubuh fisik. Boleh bahas makanan tapi jangan klaim punya preferensi pribadi.
- Jika ditanya tentang dirimu yang tidak ada di konteks, jawab jujur: "Aku nggak tahu" atau "Tidak ada info tentang itu di konteksku."
- JANGAN PERNAH tampilkan kode, fungsi, API call, print(), atau sintaks pemrograman apapun dalam respons — respons harus berupa teks biasa saja.
- JANGAN tampilkan marker internal seperti [TASK_CREATE:...], [EXPENSE_LOG:...], atau marker lainnya dalam teks yang terlihat pengguna.`;

/** Static group-chat instruction injected when chatType is not private */
export const GROUP_CHAT_PROMPT = `### KONTEKS GRUP:
Kamu sedang berada di grup chat. Pesan dari pengguna diformat sebagai [NamaPengirim]: pesan.
- Perhatikan siapa yang mengatakan apa dan tujukan responmu kepada orang yang tepat
- Jangan pernah mencampuradukkan identitas antar pengguna
- LARANGAN KERAS SAPAAN: JANGAN PERNAH memulai respons dengan menyebut nama orang + kalimat pembuka casual apapun. Contoh yang DILARANG: "Eh ada [nama]!", "Eh, [nama]! Lagi apa nih~", "[nama]! Lagi apa nih~", "Kirain siapa~", "Ada [nama] nih!", "[nama]! Hehe~", "[nama]! Gimana kabar?" — langsung balas isi pesannya tanpa basa-basi nama.
- TIDAK PERLU menyebut nama pengirim di awal respons sama sekali kecuali ada lebih dari 2 orang aktif dan perlu memperjelas ke siapa kamu berbicara
- Jika percakapan sudah berjalan, langsung jawab tanpa greeting, tanpa re-introduce, tanpa pertanyaan balik yang tidak relevan
- JANGAN buat task/reminder dari pernyataan status orang lain di grup ("aku lapar", "aku capek", "aku ngantuk") — itu obrolan biasa, bukan perintah ke kamu
- Fokus pada apa yang diminta. Respons harus singkat dan to the point`;

/**
 * Build the platform/source context block injected into the system prompt.
 */
export function buildPlatformContext(
  platform: string,
  channelName: string,
  chatType: ChatType,
): string {
  return `### SUMBER PESAN:\nPlatform: ${platform}\nNama Sesi/Channel: ${channelName}\nTipe Chat: ${chatType}`;
}

/**
 * Return the group-chat instruction if this is a group chat, otherwise empty string.
 */
export function buildGroupContext(isGroup: boolean): string {
  return isGroup ? GROUP_CHAT_PROMPT : "";
}

/**
 * Build the RAG long-term memory section injected into the system prompt.
 */
export function buildRagSection(ragContext: string): string {
  return `### LONG-TERM MEMORY (Retrieved from Database):\n${ragContext}\n*Gunakan informasi di atas jika relevan untuk menjawab pertanyaan pengguna.*`;
}

/**
 * Build the RAG retrieved-context string from history and knowledge items.
 * Returns empty string if both arrays are empty.
 */
export function buildRagContext(
  relHistory: RagHistoryItem[],
  relContexts: RagContextItem[],
): string {
  let result = "";
  if (relHistory.length > 0) {
    result +=
      "\n### Relevant Past Conversations:\n" +
      relHistory
        .map(
          (h) =>
            `[${new Date(h.created_at).toLocaleDateString()}] ${h.from_name || h.role}: ${h.content}`,
        )
        .join("\n");
  }
  if (relContexts.length > 0) {
    result +=
      "\n### Relevant Knowledge/Context:\n" +
      relContexts.map((c) => `- ${c.name}: ${c.content}`).join("\n");
  }
  return result;
}

/**
 * Build the pending-tasks context block.
 * Returns empty string if no tasks.
 */
export function buildPendingTasksContext(tasks: PendingTaskItem[]): string {
  if (tasks.length === 0) return "";
  return (
    "\n### Jadwal/Task Pending saat ini:\n" +
    tasks
      .map(
        (t, i) =>
          `${i + 1}. [${t.type.toUpperCase()}] ${t.title}${t.remind_at ? ` (Remind: ${new Date(t.remind_at).toLocaleString()})` : ""} - ID: ${t.id.slice(-8)}`,
      )
      .join("\n")
  );
}

/**
 * Build the active budget-sessions context block.
 * Returns empty string if no sessions.
 */
export function buildBudgetContext(sessions: BudgetSessionItem[]): string {
  if (sessions.length === 0) return "";
  const fmt = (n: number) => `Rp${n.toLocaleString("id-ID")}`;
  return (
    "### SESI BUDGET AKTIF:\n" +
    sessions
      .map(
        (s, i) =>
          `${i + 1}. [${s.title}] Budget: ${fmt(s.budget_amount)} | Terpakai: ${fmt(s.total_spent)} | Sisa: ${fmt(s.remaining)} - ID: ${s.id.slice(-8)}`,
      )
      .join("\n")
  );
}

/**
 * Build the Google Calendar events context block.
 * Returns empty string if no events.
 */
export function buildCalendarContext(events: CalendarEventItem[]): string {
  if (events.length === 0) return "";
  return (
    "### GOOGLE CALENDAR (7 hari ke depan):\n" +
    events
      .map((e) => {
        const start = e.start.dateTime ?? e.start.date ?? "";
        return `- ${e.summary} | ${new Date(start).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}`;
      })
      .join("\n")
  );
}
