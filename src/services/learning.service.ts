import logger from "../configs/logger";
import SessionMessageRepository from "../repositories/session-message.repository";
import AiService from "./ai.service";
import ContextService from "./context.service";

export const AUTO_LEARN_INTERVAL = 50;
const ANALYSIS_HISTORY_LIMIT = 200;

const CONTEXT_ANALYSIS_PROMPT = `Kamu adalah sistem analisis memori percakapan. Tugasmu adalah membuat dokumen konteks yang merangkum informasi penting dari riwayat percakapan berikut, agar asisten AI bisa memahami pengguna lebih baik di masa mendatang.

Sertakan bagian-bagian berikut jika relevan:
1. **Informasi Pengguna** — nama, pekerjaan, lokasi, peran, atau fakta pribadi yang disebutkan
2. **Topik & Proyek Aktif** — hal-hal yang sedang dikerjakan atau sering dibahas
3. **Preferensi & Kebiasaan** — gaya komunikasi, bahasa yang disukai, pola permintaan
4. **Pengetahuan Penting** — keputusan, informasi teknis, atau konteks yang perlu diingat
5. **Pola Interaksi** — bagaimana pengguna biasanya meminta bantuan

Tulis dalam format markdown yang ringkas dan terstruktur. Hilangkan informasi yang tidak relevan atau basi. Fokus pada hal yang akan membuat asisten lebih personal dan relevan.`.trim();

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
}
