import { pgEnum, pgTable, varchar } from "drizzle-orm/pg-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { baseEntity, entityId } from "./_base.entity";
import { AccountEntity } from "./account.entity";

export const clientTypeEnum = pgEnum("client_type", ["telegram", "discord", "whatsapp", "http"]);

export const ClientEntity = pgTable("client", {
  ...entityId,
  account_id: varchar("account_id", { length: 255 })
    .notNull()
    .references(() => AccountEntity.id),
  name: varchar("name", { length: 255 }).notNull(),
  type: clientTypeEnum("type").notNull(),
  ...baseEntity,
});

export type Client = InferSelectModel<typeof ClientEntity>;
export type NewClient = InferInsertModel<typeof ClientEntity>;
