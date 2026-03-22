import { pgEnum, pgTable, varchar } from "drizzle-orm/pg-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { baseEntity, entityId } from "./_base.entity";
import { AccountEntity } from "./account.entity";
import { AiModelEntity } from "./ai-model.entity";

export const clientTypeEnum = pgEnum("client_type", ["telegram", "discord", "whatsapp", "http"]);
export const entityModeEnum = pgEnum("entity_mode", ["single", "per_session"]);

export const ClientEntity = pgTable("client", {
  ...entityId,
  account_id: varchar("account_id", { length: 255 })
    .notNull()
    .references(() => AccountEntity.id),
  name: varchar("name", { length: 255 }).notNull(),
  type: clientTypeEnum("type").notNull(),
  ai_model_id: varchar("ai_model_id", { length: 255 }).references(() => AiModelEntity.id),
  entity_mode: entityModeEnum("entity_mode").default("per_session").notNull(),
  ...baseEntity,
});

export type Client = InferSelectModel<typeof ClientEntity>;
export type NewClient = InferInsertModel<typeof ClientEntity>;
