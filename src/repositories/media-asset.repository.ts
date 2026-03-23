import { db } from "../database/database";
import { MediaAssetEntity, type MediaAsset, type NewMediaAsset } from "../entities/pg/media-asset.entity";
import { and, eq, desc } from "drizzle-orm";

export default class MediaAssetRepository {
  async save(asset: NewMediaAsset): Promise<void> {
    await db.insert(MediaAssetEntity).values(asset);
  }

  async findById(id: string): Promise<MediaAsset | undefined> {
    const data = await db
      .select()
      .from(MediaAssetEntity)
      .where(and(eq(MediaAssetEntity.id, id), eq(MediaAssetEntity.active, true)))
      .limit(1);
    return data[0];
  }

  async findByIdAndAccountId(id: string, accountId: string): Promise<MediaAsset | undefined> {
    const data = await db
      .select()
      .from(MediaAssetEntity)
      .where(
        and(
          eq(MediaAssetEntity.id, id),
          eq(MediaAssetEntity.account_id, accountId),
          eq(MediaAssetEntity.active, true),
        ),
      )
      .limit(1);
    return data[0];
  }

  async findAllByAccountId(accountId: string): Promise<MediaAsset[]> {
    return db
      .select()
      .from(MediaAssetEntity)
      .where(and(eq(MediaAssetEntity.account_id, accountId), eq(MediaAssetEntity.active, true)))
      .orderBy(desc(MediaAssetEntity.created_date));
  }

  async softDelete(id: string, deletedBy: string): Promise<void> {
    await db
      .update(MediaAssetEntity)
      .set({ active: false, deleted_date: Date.now(), deleted_by: deletedBy })
      .where(eq(MediaAssetEntity.id, id));
  }
}
