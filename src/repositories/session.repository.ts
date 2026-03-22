import { db } from "../database/database";
import { type Session, SessionEntity, type NewSession } from "../entities/pg/session.entity";
import { and, eq } from "drizzle-orm";

export default class SessionRepository {
  async findByClientIdAndChatId(clientId: string, chatId: number): Promise<Session | undefined> {
    const data = await db
      .select()
      .from(SessionEntity)
      .where(
        and(
          eq(SessionEntity.client_id, clientId),
          eq(SessionEntity.chat_id, chatId),
          eq(SessionEntity.active, true),
        ),
      )
      .limit(1);
    return data[0];
  }

  async findById(id: string): Promise<Session | undefined> {
    const data = await db
      .select()
      .from(SessionEntity)
      .where(and(eq(SessionEntity.id, id), eq(SessionEntity.active, true)))
      .limit(1);
    return data[0];
  }

  async save(session: NewSession): Promise<void> {
    await db.insert(SessionEntity).values(session);
  }

  async update(id: string, data: Partial<NewSession>): Promise<void> {
    await db.update(SessionEntity).set(data).where(eq(SessionEntity.id, id));
  }
}
