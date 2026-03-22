import { db } from "../database/database";
import { AiModelEntity, type AiModel, type NewAiModel } from "../entities/pg/ai-model.entity";
import { and, eq } from "drizzle-orm";

export default class AiModelRepository {
  async findAll(accountId: string): Promise<AiModel[]> {
    return db
      .select()
      .from(AiModelEntity)
      .where(and(eq(AiModelEntity.account_id, accountId), eq(AiModelEntity.active, true)));
  }

  async findByIdAndAccountId(id: string, accountId: string): Promise<AiModel | undefined> {
    const data = await db
      .select()
      .from(AiModelEntity)
      .where(
        and(
          eq(AiModelEntity.id, id),
          eq(AiModelEntity.account_id, accountId),
          eq(AiModelEntity.active, true),
        ),
      )
      .limit(1);
    return data[0];
  }

  async save(model: NewAiModel): Promise<void> {
    await db.insert(AiModelEntity).values(model);
  }

  async update(id: string, data: Partial<NewAiModel>): Promise<void> {
    await db.update(AiModelEntity).set(data).where(eq(AiModelEntity.id, id));
  }
}
