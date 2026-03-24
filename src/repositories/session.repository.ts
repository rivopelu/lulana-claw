import { db } from "../database/database";
import { type Session, SessionEntity, type NewSession } from "../entities/pg/session.entity";
import { and, eq, isNull } from "drizzle-orm";

export default class SessionRepository {
  async findByClientIdAndChatId(
    clientId: string,
    chatId: number,
    threadId?: number,
  ): Promise<Session | undefined> {
    const data = await db
      .select()
      .from(SessionEntity)
      .where(
        and(
          eq(SessionEntity.client_id, clientId),
          eq(SessionEntity.chat_id, chatId),
          threadId != null
            ? eq(SessionEntity.thread_id, threadId)
            : isNull(SessionEntity.thread_id),
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

  async findAllByAccountId(accountId: string): Promise<Session[]> {
    const { ClientEntity } = await import("../entities/pg/client.entity");
    const rows = await db
      .select({ session: SessionEntity })
      .from(SessionEntity)
      .innerJoin(ClientEntity, eq(SessionEntity.client_id, ClientEntity.id))
      .where(
        and(
          eq(ClientEntity.account_id, accountId),
          eq(SessionEntity.active, true),
          eq(ClientEntity.active, true),
        ),
      );
    return rows.map((r) => r.session);
  }

  async findAllByClientId(clientId: string): Promise<Session[]> {
    return db
      .select()
      .from(SessionEntity)
      .where(and(eq(SessionEntity.client_id, clientId), eq(SessionEntity.active, true)))
      .orderBy(SessionEntity.created_date);
  }

  async update(id: string, data: Partial<NewSession>): Promise<void> {
    await db.update(SessionEntity).set(data).where(eq(SessionEntity.id, id));
  }

  async findTargetSession(
    accountId: string,
    platform: string,
    sessionName: string,
  ): Promise<{ session: Session; clientId: string } | undefined> {
    const { ClientEntity } = await import("../entities/pg/client.entity");
    const { ilike } = await import("drizzle-orm");
    const data = await db
      .select({
        session: SessionEntity,
        clientId: ClientEntity.id,
      })
      .from(SessionEntity)
      .innerJoin(ClientEntity, eq(SessionEntity.client_id, ClientEntity.id))
      .where(
        and(
          eq(ClientEntity.account_id, accountId),
          eq(ClientEntity.type, platform as any),
          ilike(SessionEntity.name, `%${sessionName}%`),
          eq(SessionEntity.active, true),
          eq(ClientEntity.active, true),
        ),
      )
      .limit(1);

    return data[0];
  }
}
