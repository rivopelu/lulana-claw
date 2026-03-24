import { bigint, pgEnum, pgTable, text, varchar } from "drizzle-orm/pg-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { baseEntity, entityId } from "./_base.entity";
import { AccountEntity } from "./account.entity";
import { ClientEntity } from "./client.entity";
import { BudgetSessionEntity } from "./budget-session.entity";

export const transactionCategoryEnum = pgEnum("transaction_category", [
  "food",
  "transport",
  "entertainment",
  "shopping",
  "health",
  "other",
]);

export const transactionTypeEnum = pgEnum("transaction_type", ["expense", "income"]);

export const FinancialTransactionEntity = pgTable("financial_transaction", {
  ...entityId,
  account_id: varchar("account_id", { length: 255 })
    .notNull()
    .references(() => AccountEntity.id),
  client_id: varchar("client_id", { length: 255 })
    .notNull()
    .references(() => ClientEntity.id),
  /** Telegram/Discord chat_id */
  chat_id: bigint("chat_id", { mode: "number" }).notNull(),
  /** Which budget session this belongs to — null = standalone transaction */
  budget_session_id: varchar("budget_session_id", { length: 255 }).references(
    () => BudgetSessionEntity.id,
  ),
  description: varchar("description", { length: 500 }).notNull(),
  /** Amount in smallest currency unit (IDR integer) */
  amount: bigint("amount", { mode: "number" }).notNull(),
  category: transactionCategoryEnum("category").default("other").notNull(),
  type: transactionTypeEnum("type").default("expense").notNull(),
  /** Unix ms of the transaction — defaults to insertion time */
  transaction_date: bigint("transaction_date", { mode: "number" })
    .$defaultFn(() => Date.now())
    .notNull(),
  note: text("note"),
  ...baseEntity,
});

export type FinancialTransaction = InferSelectModel<typeof FinancialTransactionEntity>;
export type NewFinancialTransaction = InferInsertModel<typeof FinancialTransactionEntity>;
