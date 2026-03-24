import SessionRepository from "../repositories/session.repository";
import SessionMessageRepository from "../repositories/session-message.repository";
import ClientRepository from "../repositories/client.repository";
import type { Session } from "../entities/pg/session.entity";
import type { ISessionMessage } from "../entities/mongo/session-message.schema";
import { generateId } from "../libs/string-utils";
import { NotFoundException } from "../libs/exception";

export type ChatType = "private" | "group" | "supergroup" | "channel";

export default class SessionService {
  private sessionRepository = new SessionRepository();
  private messageRepository = new SessionMessageRepository();
  private clientRepository = new ClientRepository();

  async setupSession(
    clientId: string,
    chatId: number,
    chatType: ChatType,
    name: string,
    createdBy: string,
    aiModelId?: string | null,
  ): Promise<Session> {
    const existing = await this.sessionRepository.findByClientIdAndChatId(clientId, chatId);

    if (existing) {
      await this.sessionRepository.update(existing.id, {
        name,
        ...(aiModelId !== undefined && { ai_model_id: aiModelId }),
        updated_by: createdBy,
        updated_date: Date.now(),
      });
      return { ...existing, name };
    }

    const newSession = {
      id: generateId(),
      client_id: clientId,
      chat_id: chatId,
      chat_type: chatType,
      name,
      ai_model_id: aiModelId ?? null,
      created_by: createdBy,
    };
    await this.sessionRepository.save(newSession);
    return (await this.sessionRepository.findById(newSession.id))!;
  }

  async setSessionModel(
    sessionId: string,
    aiModelId: string | null,
    updatedBy: string,
  ): Promise<void> {
    await this.sessionRepository.update(sessionId, {
      ai_model_id: aiModelId,
      updated_by: updatedBy,
      updated_date: Date.now(),
    });
  }

  async getSessionById(sessionId: string, accountId: string): Promise<Session> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) throw new NotFoundException("Session not found");
    const client = await this.clientRepository.findByIdAndAccountId(session.client_id, accountId);
    if (!client) throw new NotFoundException("Session not found");
    return session;
  }

  async getSession(clientId: string, chatId: number, threadId?: number): Promise<Session | undefined> {
    return this.sessionRepository.findByClientIdAndChatId(clientId, chatId, threadId);
  }

  async findTargetSession(accountId: string, platform: string, sessionName: string) {
    return this.sessionRepository.findTargetSession(accountId, platform, sessionName);
  }

  async ensureSession(
    clientId: string,
    chatId: number,
    chatType: ChatType,
    fallbackName: string,
    threadId?: number,
  ): Promise<Session> {
    const existing = await this.getSession(clientId, chatId, threadId);
    if (existing) return existing;

    const newSession = {
      id: generateId(),
      client_id: clientId,
      chat_id: chatId,
      chat_type: chatType,
      thread_id: threadId ?? null,
      name: threadId ? `${fallbackName} #${threadId}` : fallbackName,
      ai_model_id: null,
      created_by: "system",
    };
    await this.sessionRepository.save(newSession);
    return (await this.sessionRepository.findById(newSession.id))!;
  }

  async getSessionsByClientId(clientId: string): Promise<Session[]> {
    return this.sessionRepository.findAllByClientId(clientId);
  }

  async addMessage(
    sessionId: string,
    role: ISessionMessage["role"],
    content: string,
    fromId?: string,
    fromName?: string,
    embedding?: number[],
    platform?: string,
    channelName?: string,
  ): Promise<void> {
    await this.messageRepository.create({
      session_id: sessionId,
      role,
      content,
      from_id: fromId,
      from_name: fromName,
      platform,
      channel_name: channelName,
      embedding,
    });
  }

  async getHistory(sessionId: string, limit?: number): Promise<ISessionMessage[]> {
    return this.messageRepository.findBySessionId(sessionId, limit);
  }
}
