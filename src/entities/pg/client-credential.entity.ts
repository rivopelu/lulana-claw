import { pgTable, varchar } from "drizzle-orm/pg-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { baseEntity, entityId } from "./_base.entity";
import { ClientEntity } from "./client.entity";

/**
 * Stores credentials for each client as individual key-value rows.
 *
 * Telegram example keys:
 *   - bot_token
 *   - webhook_url (optional, if using webhook instead of polling)
 *
 * Discord example keys:
 *   - bot_token
 *   - client_id
 *   - guild_id (optional)
 *
 * WhatsApp example keys:
 *   - api_key
 *   - phone_number_id
 *   - business_account_id
 *
 * HTTP example keys:
 *   - api_key
 */
export const ClientCredentialEntity = pgTable("client_credential", {
  ...entityId,
  client_id: varchar("client_id", { length: 255 })
    .notNull()
    .references(() => ClientEntity.id),
  key: varchar("key", { length: 100 }).notNull(),
  value: varchar("value", { length: 1000 }).notNull(),
  ...baseEntity,
});

export type ClientCredential = InferSelectModel<typeof ClientCredentialEntity>;
export type NewClientCredential = InferInsertModel<typeof ClientCredentialEntity>;
