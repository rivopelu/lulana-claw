/** User-facing messages sent by the Telegram bot */
export const BOT_MSG = {
  NO_SESSION: "⚙️ No active session.\nRun /setup <name> to get started.",
  NO_AI_MODEL: "⚠️ No AI model assigned.",
  AI_MODEL_NOT_FOUND: "⚠️ Assigned AI model not found.",
  AI_ERROR: "❌ Gagal mendapat respons. Coba lagi nanti.",
  SESSION_NOT_FOUND: (sessionName: string, platform: string) =>
    `⚠️ Tidak dapat menemukan sesi '${sessionName}' di platform ${platform}.`,
} as const;
