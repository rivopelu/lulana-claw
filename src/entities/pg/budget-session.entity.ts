import { bigint, pgEnum, pgTable, varchar } from "drizzle-orm/pg-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { baseEntity, entityId } from "./_base.entity";
import { AccountEntity } from "./account.entity";
import { ClientEntity } from "./client.entity";

export const budgetSessionStatusEnum = pgEnum("budget_session_status", [
  "active",
  "completed",
  "cancelled",
]);

export const BudgetSessionEntity = pgTable("budget_session", {
  ...entityId,
  account_id: varchar("account_id", { length: 255 })
    .notNull()
    .references(() => AccountEntity.id),
  client_id: varchar("client_id", { length: 255 })
    .notNull()
    .references(() => ClientEntity.id),
  /** Telegram/Discord chat_id */
  chat_id: bigint("chat_id", { mode: "number" }).notNull(),
  /** Optional session link */
  session_id: varchar("session_id", { length: 255 }),
  /** Human-readable activity name, e.g. "Jalan-jalan ke Mall" */
  title: varchar("title", { length: 500 }).notNull(),
  /** Budget ceiling in smallest currency unit (IDR integer) */
  budget_amount: bigint("budget_amount", { mode: "number" }).notNull(),
  currency: varchar("currency", { length: 10 }).default("IDR").notNull(),
  status: budgetSessionStatusEnum("status").default("active").notNull(),
  /** Unix ms when session was opened */
  started_at: bigint("started_at", { mode: "number" })
    .$defaultFn(() => Date.now())
    .notNull(),
  /** Unix ms when session was closed — null while still active */
  ended_at: bigint("ended_at", { mode: "number" }),
  ...baseEntity,
});

export type BudgetSession = InferSelectModel<typeof BudgetSessionEntity>;
export type NewBudgetSession = InferInsertModel<typeof BudgetSessionEntity>;
