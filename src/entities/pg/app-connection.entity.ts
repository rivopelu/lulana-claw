import { bigint, pgTable, text, varchar } from "drizzle-orm/pg-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { baseEntity, entityId } from "./_base.entity";
import { AccountEntity } from "./account.entity";

export const AppConnectionEntity = pgTable("app_connection", {
  ...entityId,
  account_id: varchar("account_id", { length: 255 })
    .notNull()
    .references(() => AccountEntity.id),
  /** e.g. "google" */
  app_type: varchar("app_type", { length: 50 }).notNull(),
  access_token: text("access_token").notNull(),
  refresh_token: text("refresh_token"),
  /** Unix ms expiry of access_token */
  expires_at: bigint("expires_at", { mode: "number" }),
  /** Space-separated OAuth scopes granted */
  scopes: text("scopes"),
  /** Connected account email */
  email: varchar("email", { length: 255 }),
  display_name: varchar("display_name", { length: 255 }),
  ...baseEntity,
});

export type AppConnection = InferSelectModel<typeof AppConnectionEntity>;
export type NewAppConnection = InferInsertModel<typeof AppConnectionEntity>;
