import logger from "../configs/logger";
import SessionMessageRepository from "../repositories/session-message.repository";
import AiService from "./ai.service";
import ContextService from "./context.service";
import type { ISessionMessage } from "../entities/mongo/session-message.schema";

export const AUTO_LEARN_INTERVAL = 50;
/** Every N messages in a session, analyze the last exchange for global importance */
const GLOBAL_LEARN_INTERVAL = 8;

const GLOBAL_CONTEXT_ANALYSIS_PROMPT = `Kamu adalah sistem analisis percakapan Luna.

Tugas: Analisis percakapan berikut dan tentukan apakah ada INFORMASI PENTING yang harus disimpan sebagai pengetahuan GLOBAL Luna — yaitu pengetahuan yang berlaku dan relevan di SEMUA percakapan Luna di semua platform.

**Layak disimpan sebagai global:**
- Kemampuan/integrasi baru Luna (platform baru, tools baru, fitur baru)
- Fakta penting tentang identitas atau peran Luna yang ditetapkan admin/pemilik
- Konfigurasi atau preferensi yang diminta berlaku secara global
- Informasi penting tentang pemilik/admin Luna yang harus selalu diingat
- Event penting atau perubahan besar yang memengaruhi cara Luna berinteraksi

**Tidak perlu disimpan sebagai global:**
- Percakapan sehari-hari, obrolan santai, pertanyaan umum
- Informasi personal pengguna biasa (sudah tersimpan di session context)
- Topik sementara atau situasional
- Hal yang sudah jelas dari konteks identitas Luna

Balas HANYA dengan JSON valid (tanpa markdown fence):
{"is_important": true, "content": "ringkasan pengetahuan global yang perlu disimpan"}
atau
{"is_important": false}`.trim();
const ANALYSIS_HISTORY_LIMIT = 200;

const CONTEXT_ANALYSIS_PROMPT = `You are a conversation memory analysis system. Your task is to produce a context document summarizing important information from the following conversation history, so the AI assistant can better understand the user in future interactions.

Include the following sections where relevant:
1. **User Information** — name, occupation, location, role, or personal facts mentioned
2. **Active Topics & Projects** — things currently being worked on or frequently discussed
3. **Preferences & Habits** — communication style, preferred language, common request patterns
4. **Key Knowledge** — decisions made, technical context, or background that should be remembered
5. **Interaction Patterns** — how the user typically asks for help

Write in concise, structured markdown. Omit irrelevant or stale information. Focus on what will make the assistant more personalized and relevant.`.trim();

export interface AutoLearnParams {
  sessionId: string;
  accountId: string;
  clientId: string;
  sessionName: string;
  aiModel: {
    api_key: string;
    model_id: string;
    provider: string;
    account_id: string;
  };
}

export interface GlobalLearnParams {
  sessionId: string;
  accountId: string;
  lastExchange: { userText: string; lunaReply: string };
  aiModel: {
    api_key: string;
    model_id: string;
    provider: string;
  };
}

export default class LearningService {
  private aiService = new AiService();
  private contextService = new ContextService();
  private messageRepository = new SessionMessageRepository();

  /**
   * Check message count and trigger auto-learning if the interval is reached.
   * This is fire-and-forget — caller should NOT await this.
   */
  async maybeAutoLearn(params: AutoLearnParams): Promise<void> {
    try {
      const count = await this.messageRepository.countBySessionId(params.sessionId);
      if (count === 0 || count % AUTO_LEARN_INTERVAL !== 0) return;

      logger.info(
        `[LearningService] Auto-learn triggered at message #${count} for session ${params.sessionId}`,
      );
      await this.runAutoLearn(params, count);
    } catch (err) {
      logger.error(
        `[LearningService] maybeAutoLearn error for session ${params.sessionId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Run the full auto-learn cycle: analyze history → generate context → save/update.
   * Can also be called directly by /updatecontext command.
   */
  async runAutoLearn(params: AutoLearnParams, _messageCount?: number): Promise<string> {
    const { sessionId, accountId, clientId, sessionName, aiModel } = params;

    const messages = await this.messageRepository.findBySessionId(sessionId, ANALYSIS_HISTORY_LIMIT);
    if (messages.length < 5) {
      logger.info(`[LearningService] Not enough messages to learn from for session ${sessionId}`);
      return "";
    }

    const transcript = messages
      .map((m) => {
        const speaker = m.role === "assistant" ? "Luna" : m.from_name || "User";
        return `[${speaker}]: ${m.content}`;
      })
      .join("\n");

    const analysisResult = await this.aiService.chat(
      aiModel.api_key,
      aiModel.model_id,
      aiModel.provider,
      [],
      `Berikut adalah riwayat percakapan:\n\n${transcript}`,
      CONTEXT_ANALYSIS_PROMPT,
    );

    let embedding: number[] | undefined;
    try {
      embedding = await this.aiService.generateEmbedding(
        aiModel.api_key,
        aiModel.provider,
        analysisResult,
      );
    } catch {
      /* embedding is optional */
    }

    const existing = await this.contextService.getAutoContext(sessionId);
    if (existing) {
      await this.contextService.updateById(existing.id, { content: analysisResult });
      logger.info(`[LearningService] Auto-context updated for session ${sessionId}`);
    } else {
      await this.contextService.createAutoContext(
        sessionId,
        accountId,
        clientId,
        sessionName,
        analysisResult,
        "system",
        embedding,
      );
      logger.info(`[LearningService] Auto-context created for session ${sessionId}`);
    }

    return analysisResult;
  }

  /**
   * Analyze the last exchange and update global context if important.
   * Fire-and-forget — caller should NOT await this.
   * Runs every GLOBAL_LEARN_INTERVAL messages to throttle API calls.
   */
  async maybeUpdateGlobalContext(params: GlobalLearnParams): Promise<void> {
    try {
      const count = await this.messageRepository.countBySessionId(params.sessionId);
      if (count === 0 || count % GLOBAL_LEARN_INTERVAL !== 0) return;

      const { userText, lunaReply } = params.lastExchange;
      const exchange = `[User]: ${userText}\n[Luna]: ${lunaReply}`;

      const raw = await this.aiService.chat(
        params.aiModel.api_key,
        params.aiModel.model_id,
        params.aiModel.provider,
        [],
        `Percakapan:\n\n${exchange}`,
        GLOBAL_CONTEXT_ANALYSIS_PROMPT,
      );

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return;

      const result = JSON.parse(jsonMatch[0]) as { is_important: boolean; content?: string };
      if (!result.is_important || !result.content?.trim()) return;

      await this.contextService.appendAutoGlobalContext(params.accountId, result.content.trim());
      logger.info(`[LearningService] Global context updated for account ${params.accountId}`);
    } catch (err) {
      logger.warn(`[LearningService] maybeUpdateGlobalContext error: ${(err as Error).message}`);
    }
  }
}
