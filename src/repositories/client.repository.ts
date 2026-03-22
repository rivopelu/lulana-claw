import { db } from "../database/database";
import { type Client, ClientEntity, type NewClient } from "../entities/pg/client.entity";
import { and, count, eq, ilike, or } from "drizzle-orm";
import type { IPaginationParams } from "../types/paginated-params";

export default class ClientRepository {
  async findAll(
    accountId: string,
    params: IPaginationParams,
  ): Promise<{ data: Client[]; total: number }> {
    const whereClause = and(
      eq(ClientEntity.account_id, accountId),
      eq(ClientEntity.active, true),
      params.q ? or(ilike(ClientEntity.name, `%${params.q}%`)) : undefined,
    );

    const [data, total] = await Promise.all([
      db
        .select()
        .from(ClientEntity)
        .where(whereClause)
        .limit(params.size)
        .offset(params.page * params.size),
      db.select({ count: count() }).from(ClientEntity).where(whereClause),
    ]);

    return { data, total: total[0].count };
  }

  async findByIdAndAccountId(id: string, accountId: string): Promise<Client | undefined> {
    const data = await db
      .select()
      .from(ClientEntity)
      .where(
        and(
          eq(ClientEntity.id, id),
          eq(ClientEntity.account_id, accountId),
          eq(ClientEntity.active, true),
        ),
      )
      .limit(1);

    return data[0];
  }

  async save(client: NewClient): Promise<void> {
    await db.insert(ClientEntity).values(client);
  }

  async update(id: string, data: Partial<NewClient>): Promise<void> {
    await db.update(ClientEntity).set(data).where(eq(ClientEntity.id, id));
  }
}
