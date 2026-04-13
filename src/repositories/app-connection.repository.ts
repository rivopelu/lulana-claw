import { and, eq } from "drizzle-orm";
import { db } from "../database/database";
import {
  AppConnectionEntity,
  type AppConnection,
  type NewAppConnection,
} from "../entities/pg/app-connection.entity";

export default class AppConnectionRepository {
  async findAllByAccountId(accountId: string): Promise<AppConnection[]> {
    return db
      .select()
      .from(AppConnectionEntity)
      .where(
        and(eq(AppConnectionEntity.account_id, accountId), eq(AppConnectionEntity.active, true)),
      );
  }

  async findByAccountIdAndType(
    accountId: string,
    appType: string,
  ): Promise<AppConnection | undefined> {
    const data = await db
      .select()
      .from(AppConnectionEntity)
      .where(
        and(
          eq(AppConnectionEntity.account_id, accountId),
          eq(AppConnectionEntity.app_type, appType),
          eq(AppConnectionEntity.active, true),
        ),
      )
      .limit(1);
    return data[0];
  }

  async findById(id: string): Promise<AppConnection | undefined> {
    const data = await db
      .select()
      .from(AppConnectionEntity)
      .where(and(eq(AppConnectionEntity.id, id), eq(AppConnectionEntity.active, true)))
      .limit(1);
    return data[0];
  }

  async save(conn: NewAppConnection): Promise<AppConnection> {
    const data = await db.insert(AppConnectionEntity).values(conn).returning();
    return data[0];
  }

  async update(id: string, data: Partial<NewAppConnection>): Promise<void> {
    await db.update(AppConnectionEntity).set(data).where(eq(AppConnectionEntity.id, id));
  }

  async softDelete(id: string, deletedBy: string): Promise<void> {
    await db
      .update(AppConnectionEntity)
      .set({
        active: false,
        deleted_date: Date.now(),
        deleted_by: deletedBy,
      })
      .where(eq(AppConnectionEntity.id, id));
  }
}
