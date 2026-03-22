import { bigint, boolean, pgEnum, pgTable, text, varchar } from "drizzle-orm/pg-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { baseEntity, entityId } from "./_base.entity";
import { AccountEntity } from "./account.entity";
import { ClientEntity } from "./client.entity";

export const taskStatusEnum = pgEnum("task_status", ["pending", "done", "cancelled"]);
export const taskTypeEnum = pgEnum("task_type", ["task", "reminder", "notes", "meeting", "deadline"]);

export const TaskEntity = pgTable("task", {
  ...entityId,
  account_id: varchar("account_id", { length: 255 })
    .notNull()
    .references(() => AccountEntity.id),
  client_id: varchar("client_id", { length: 255 })
    .notNull()
    .references(() => ClientEntity.id),
  /** Telegram chat_id where reminder will be sent */
  chat_id: bigint("chat_id", { mode: "number" }).notNull(),
  /** Optional session link */
  session_id: varchar("session_id", { length: 255 }),
  type: taskTypeEnum("type").default("task").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  /** Unix ms timestamp when to send reminder — null = no reminder */
  remind_at: bigint("remind_at", { mode: "number" }),
  /** Whether the reminder has already been sent */
  reminded: boolean("reminded").default(false).notNull(),
  status: taskStatusEnum("status").default("pending").notNull(),
  ...baseEntity,
});

export type Task = InferSelectModel<typeof TaskEntity>;
export type NewTask = InferInsertModel<typeof TaskEntity>;
