import { db } from "../database/database";
import { type Account, AccountEntity, type NewAccount } from "../entities/pg/account.entity";
import { and, count, eq } from "drizzle-orm";

export default class AccountRepository {
  async existsAny(): Promise<boolean> {
    const data = await db
      .select({ count: count() })
      .from(AccountEntity)
      .where(eq(AccountEntity.active, true));
    return data[0].count > 0;
  }

  async existByEmail(email: string): Promise<boolean> {
    const data = await db
      .select({ id: AccountEntity.id })
      .from(AccountEntity)
      .where(and(eq(AccountEntity.email, email), eq(AccountEntity.active, true)))
      .limit(1);

    return data.length > 0;
  }

  async findByEmail(email: string): Promise<Account> {
    const data = await db
      .select()
      .from(AccountEntity)
      .where(and(eq(AccountEntity.email, email), eq(AccountEntity.active, true)))
      .limit(1);

    return data[0];
  }

  async findAll(): Promise<Account[]> {
    return db.select().from(AccountEntity).where(eq(AccountEntity.active, true));
  }

  async save(account: NewAccount) {
    await db.insert(AccountEntity).values(account);
  }

  async findById(id: string) {
    const data = await db
      .select()
      .from(AccountEntity)
      .where(and(eq(AccountEntity.id, id), eq(AccountEntity.active, true)))
      .limit(1);

    return data[0];
  }
}
