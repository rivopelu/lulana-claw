import { pgEnum, pgTable, varchar } from "drizzle-orm/pg-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { baseEntity, entityId } from "./_base.entity";
import { AccountEntity } from "./account.entity";

export const aiProviderEnum = pgEnum("ai_provider", [
  "openai",
  "openrouter",
  "gemini",
  "anthropic",
  "claude_code",
]);

export const AiModelEntity = pgTable("ai_model", {
  ...entityId,
  account_id: varchar("account_id", { length: 255 })
    .notNull()
    .references(() => AccountEntity.id),
  /** User-defined label, e.g. "Production GPT-4o" */
  name: varchar("name", { length: 255 }).notNull(),
  /** OpenAI model string, e.g. "gpt-4o" */
  model_id: varchar("model_id", { length: 100 }).notNull(),
  provider: aiProviderEnum("provider").notNull().default("openai"),
  /** API key — stored as-is; mask on response */
  api_key: varchar("api_key", { length: 500 }).notNull(),
  /** Optional custom base URL for proxies or specific local/shared instances */
  base_url: varchar("base_url", { length: 500 }),
  ...baseEntity,
});

export type AiModel = InferSelectModel<typeof AiModelEntity>;
export type NewAiModel = InferInsertModel<typeof AiModelEntity>;
