import {pgEnum, pgTable, varchar} from "drizzle-orm/pg-core";
import type {InferInsertModel, InferSelectModel} from "drizzle-orm";
import {baseEntity, entityId} from "./_base.entity";

export const clientTypeEnum = pgEnum("client_type", [
  "telegram",
  "discord",
  "whatsapp",
  "http",
]);

export const ClientEntity = pgTable("client", {
  ...entityId,
  name: varchar("name", {length: 255}).notNull(),
  type: clientTypeEnum("type").notNull(),
  ...baseEntity,
});

export type Client = InferSelectModel<typeof ClientEntity>;
export type NewClient = InferInsertModel<typeof ClientEntity>;