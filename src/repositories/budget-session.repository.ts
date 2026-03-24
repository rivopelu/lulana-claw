import { db } from "../database/database";
import {
  type BudgetSession,
  BudgetSessionEntity,
  type NewBudgetSession,
} from "../entities/pg/budget-session.entity";
import { and, desc, eq } from "drizzle-orm";

export default class BudgetSessionRepository {
  async save(data: NewBudgetSession): Promise<void> {
    await db.insert(BudgetSessionEntity).values(data);
  }

  async findById(id: string): Promise<BudgetSession | undefined> {
    const rows = await db
      .select()
      .from(BudgetSessionEntity)
      .where(and(eq(BudgetSessionEntity.id, id), eq(BudgetSessionEntity.active, true)))
      .limit(1);
    return rows[0];
  }

  async findByIdAndAccountId(id: string, accountId: string): Promise<BudgetSession | undefined> {
    const rows = await db
      .select()
      .from(BudgetSessionEntity)
      .where(
        and(
          eq(BudgetSessionEntity.id, id),
          eq(BudgetSessionEntity.account_id, accountId),
          eq(BudgetSessionEntity.active, true),
        ),
      )
      .limit(1);
    return rows[0];
  }

  async findAllByAccountId(
    accountId: string,
    status?: BudgetSession["status"],
  ): Promise<BudgetSession[]> {
    return db
      .select()
      .from(BudgetSessionEntity)
      .where(
        and(
          eq(BudgetSessionEntity.account_id, accountId),
          eq(BudgetSessionEntity.active, true),
          status ? eq(BudgetSessionEntity.status, status) : undefined,
        ),
      )
      .orderBy(desc(BudgetSessionEntity.started_at));
  }

  /** Find active budget sessions for a specific chat */
  async findActiveByChatId(clientId: string, chatId: number): Promise<BudgetSession[]> {
    return db
      .select()
      .from(BudgetSessionEntity)
      .where(
        and(
          eq(BudgetSessionEntity.client_id, clientId),
          eq(BudgetSessionEntity.chat_id, chatId),
          eq(BudgetSessionEntity.status, "active"),
          eq(BudgetSessionEntity.active, true),
        ),
      )
      .orderBy(desc(BudgetSessionEntity.started_at));
  }

  async update(id: string, data: Partial<NewBudgetSession>): Promise<void> {
    await db.update(BudgetSessionEntity).set(data).where(eq(BudgetSessionEntity.id, id));
  }
}
