import { bigint, jsonb, pgEnum, pgTable, text, varchar } from "drizzle-orm/pg-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { baseEntity, entityId } from "./_base.entity";
import { AccountEntity } from "./account.entity";

export const contentDraftStatusEnum = pgEnum("content_draft_status", [
  "pending",
  "approved",
  "rejected",
  "revised",
  "partial_published",
  "published",
]);

export const contentDraftAssetTypeEnum = pgEnum("content_draft_asset_type", ["image", "video"]);

export const ContentDraftEntity = pgTable("content_draft", {
  ...entityId,
  account_id: varchar("account_id", { length: 255 })
    .notNull()
    .references(() => AccountEntity.id),
  /** AI-generated content concept */
  theme: varchar("theme", { length: 500 }).notNull(),
  mood: varchar("mood", { length: 255 }).notNull(),
  visual_concept: text("visual_concept").notNull(),
  caption: text("caption").notNull(),
  hashtags: jsonb("hashtags").$type<string[]>().default([]),
  /** Unix ms — when to publish to Instagram */
  scheduled_at: bigint("scheduled_at", { mode: "number" }),
  status: contentDraftStatusEnum("status").default("pending").notNull(),
  /** User-uploaded photo/video (served from /uploads/content/) */
  asset_url: varchar("asset_url", { length: 1000 }),
  asset_type: contentDraftAssetTypeEnum("asset_type"),
  /** Revision feedback when status = revised */
  revision_notes: text("revision_notes"),
  /** Instagram post ID after successful publish */
  ig_post_id: varchar("ig_post_id", { length: 255 }),
  /** Threads post ID after successful publish */
  threads_post_id: varchar("threads_post_id", { length: 255 }),
  published_at: bigint("published_at", { mode: "number" }),
  ...baseEntity,
});

export type ContentDraft = InferSelectModel<typeof ContentDraftEntity>;
export type NewContentDraft = InferInsertModel<typeof ContentDraftEntity>;
