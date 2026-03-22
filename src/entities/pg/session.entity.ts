import { bigint, pgEnum, pgTable, varchar } from "drizzle-orm/pg-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { baseEntity, entityId } from "./_base.entity";
import { ClientEntity } from "./client.entity";

export const chatTypeEnum = pgEnum("chat_type", ["private", "group", "supergroup", "channel"]);

export const SessionEntity = pgTable("session", {
  ...entityId,
  client_id: varchar("client_id", { length: 255 })
    .notNull()
    .references(() => ClientEntity.id),
  /** Telegram chat_id (can be negative for groups) */
  chat_id: bigint("chat_id", { mode: "number" }).notNull(),
  chat_type: chatTypeEnum("chat_type").notNull(),
  /** Name set by the user via /setup <name> */
  name: varchar("name", { length: 255 }).notNull(),
  ...baseEntity,
});

export type Session = InferSelectModel<typeof SessionEntity>;
export type NewSession = InferInsertModel<typeof SessionEntity>;
