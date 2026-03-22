import { db } from "../database/database";
import { type Task, TaskEntity, type NewTask } from "../entities/pg/task.entity";
import { and, eq, isNotNull, lte, count } from "drizzle-orm";

export default class TaskRepository {
  async save(task: NewTask): Promise<void> {
    await db.insert(TaskEntity).values(task);
  }

  async findById(id: string): Promise<Task | undefined> {
    const data = await db
      .select()
      .from(TaskEntity)
      .where(and(eq(TaskEntity.id, id), eq(TaskEntity.active, true)))
      .limit(1);
    return data[0];
  }

  async findByIdAndAccountId(id: string, accountId: string): Promise<Task | undefined> {
    const data = await db
      .select()
      .from(TaskEntity)
      .where(
        and(eq(TaskEntity.id, id), eq(TaskEntity.account_id, accountId), eq(TaskEntity.active, true)),
      )
      .limit(1);
    return data[0];
  }

  async findByChatId(clientId: string, chatId: number, status?: Task["status"]): Promise<Task[]> {
    return db
      .select()
      .from(TaskEntity)
      .where(
        and(
          eq(TaskEntity.client_id, clientId),
          eq(TaskEntity.chat_id, chatId),
          eq(TaskEntity.active, true),
          status ? eq(TaskEntity.status, status) : undefined,
        ),
      )
      .orderBy(TaskEntity.remind_at, TaskEntity.created_date);
  }

  async findAllByAccountId(accountId: string, status?: Task["status"]): Promise<Task[]> {
    return db
      .select()
      .from(TaskEntity)
      .where(
        and(
          eq(TaskEntity.account_id, accountId),
          eq(TaskEntity.active, true),
          status ? eq(TaskEntity.status, status) : undefined,
        ),
      )
      .orderBy(TaskEntity.remind_at, TaskEntity.created_date);
  }

  /** Find pending tasks whose remind_at has passed and haven't been sent yet */
  async findDueReminders(now: number): Promise<Task[]> {
    return db
      .select()
      .from(TaskEntity)
      .where(
        and(
          eq(TaskEntity.status, "pending"),
          eq(TaskEntity.reminded, false),
          eq(TaskEntity.active, true),
          isNotNull(TaskEntity.remind_at),
          lte(TaskEntity.remind_at, now),
        ),
      );
  }

  async update(id: string, data: Partial<NewTask>): Promise<void> {
    await db.update(TaskEntity).set(data).where(eq(TaskEntity.id, id));
  }

  async countByAccountId(accountId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(TaskEntity)
      .where(and(eq(TaskEntity.account_id, accountId), eq(TaskEntity.active, true)));
    return result[0].count;
  }
}
