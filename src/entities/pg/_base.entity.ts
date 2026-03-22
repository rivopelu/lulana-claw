import {bigint, boolean, varchar} from "drizzle-orm/pg-core";
import {generateId} from "../../libs/string-utils";

export const baseEntity = {
  active: boolean("active").default(true).notNull(),
  created_date: bigint("created_date", {mode: "number"})
    .$defaultFn(() => Date.now())
    .notNull(),
  created_by: varchar("created_by", {length: 256}).notNull(),
  updated_date: bigint("updated_date", {mode: "number"}),
  updated_by: varchar("updated_by", {length: 256}),
  deleted_date: bigint("deleted_date", {mode: "number"}),
  deleted_by: varchar("deleted_by", {length: 256}),
};
export const entityId = {
  id: varchar({length: 255})
    .primaryKey()
    .$defaultFn(() => generateId()),
};
