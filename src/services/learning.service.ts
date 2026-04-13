import logger from "../configs/logger";
import SessionMessageRepository from "../repositories/session-message.repository";
import AiService from "./ai.service";
import ContextService from "./context.service";
// import type { ISessionMessage } from "../entities/mongo/session-message.schema";
import { GLOBAL_CONTEXT_ANALYSIS_PROMPT, CONTEXT_ANALYSIS_PROMPT } from "../prompts";

export const AUTO_LEARN_INTERVAL = 50;
/** Every N messages in a session, analyze the last exchange for global importance */
const GLOBAL_LEARN_INTERVAL = 8;
const ANALYSIS_HISTORY_LIMIT = 200;

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

    const messages = await this.messageRepository.findBySessionId(
      sessionId,
      ANALYSIS_HISTORY_LIMIT,
    );
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
