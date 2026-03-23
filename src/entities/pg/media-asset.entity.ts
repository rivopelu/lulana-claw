import { bigint, pgEnum, pgTable, varchar } from "drizzle-orm/pg-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { baseEntity, entityId } from "./_base.entity";
import { AccountEntity } from "./account.entity";

export const mediaAssetTypeEnum = pgEnum("media_asset_type", ["image", "video"]);

export const MediaAssetEntity = pgTable("media_asset", {
  ...entityId,
  account_id: varchar("account_id", { length: 255 })
    .notNull()
    .references(() => AccountEntity.id),
  /** Original filename from upload */
  filename: varchar("filename", { length: 500 }).notNull(),
  /** Path inside Supabase bucket (used for deletion) */
  storage_path: varchar("storage_path", { length: 1000 }).notNull(),
  /** Public URL */
  url: varchar("url", { length: 1000 }).notNull(),
  mime_type: varchar("mime_type", { length: 100 }).notNull(),
  /** File size in bytes */
  size: bigint("size", { mode: "number" }).notNull(),
  asset_type: mediaAssetTypeEnum("asset_type").notNull(),
  ...baseEntity,
});

export type MediaAsset = InferSelectModel<typeof MediaAssetEntity>;
export type NewMediaAsset = InferInsertModel<typeof MediaAssetEntity>;
