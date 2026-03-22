import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../configs/env";

const pool = new Pool({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  port: env.DB_PORT,
  ssl: false,
});
export const db = drizzle({ client: pool });
