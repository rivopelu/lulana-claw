import {pgTable, varchar} from "drizzle-orm/pg-core";
import type {InferInsertModel, InferSelectModel} from "drizzle-orm";
import {baseEntity, entityId} from "./_base.entity";


export const AccountEntity = pgTable("account", {
  ...entityId,
  email: varchar("email", {length: 255}).notNull().unique(),
  password: varchar("password", {length: 255}),
  name: varchar("name", {length: 255}),
  profile_picture: varchar("profile_picture", {length: 500}),
  ...baseEntity,
});

export type Account = InferSelectModel<typeof AccountEntity>;
export type NewAccount = InferInsertModel<typeof AccountEntity>;
