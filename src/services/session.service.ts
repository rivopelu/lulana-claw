import SessionRepository from "../repositories/session.repository";
import SessionMessageRepository from "../repositories/session-message.repository";
import type { Session } from "../entities/pg/session.entity";
import type { ISessionMessage } from "../entities/mongo/session-message.schema";
import { generateId } from "../libs/string-utils";

export type ChatType = "private" | "group" | "supergroup" | "channel";

export default class SessionService {
  private sessionRepository = new SessionRepository();
  private messageRepository = new SessionMessageRepository();

  async setupSession(
    clientId: string,
    chatId: number,
    chatType: ChatType,
    name: string,
    createdBy: string,
  ): Promise<Session> {
    const existing = await this.sessionRepository.findByClientIdAndChatId(clientId, chatId);

    if (existing) {
      // Rename existing session
      await this.sessionRepository.update(existing.id, {
        name,
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
      created_by: createdBy,
    };
    await this.sessionRepository.save(newSession);
    return (await this.sessionRepository.findById(newSession.id))!;
  }

  async getSession(clientId: string, chatId: number): Promise<Session | undefined> {
    return this.sessionRepository.findByClientIdAndChatId(clientId, chatId);
  }

  async addMessage(
    sessionId: string,
    role: ISessionMessage["role"],
    content: string,
    fromId?: string,
    fromName?: string,
  ): Promise<void> {
    await this.messageRepository.create({
      session_id: sessionId,
      role,
      content,
      from_id: fromId,
      from_name: fromName,
    });
  }

  async getHistory(sessionId: string, limit?: number): Promise<ISessionMessage[]> {
    return this.messageRepository.findBySessionId(sessionId, limit);
  }
}
