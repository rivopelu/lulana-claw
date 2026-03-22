import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("3000").transform(Number),
  NODE_ENV: z.enum(["development", "test", "production", "staging"]).default("development"),

  // PostgreSQL
  DB_HOST: z.string().min(1),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string(),
  DB_PORT: z.string().default("5432").transform(Number),

  // MongoDB
  MONGO_HOST: z.string().min(1),
  MONGO_PORT: z.string().default("27017").transform(Number),
  MONGO_USER: z.string().optional(),
  MONGO_PASSWORD: z.string().optional(),
  MONGO_NAME: z.string().min(1),

  // JWT
  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN_DAY: z.string().transform(Number),
});

const _env = envSchema.safeParse(process.env);
if (!_env.success) {
  console.error("❌ Environment Config Error:");
  _env.error.issues.forEach((issue) => {
    console.error(`   - ${issue.path.join(".")}: ${issue.message}`);
  });
  process.exit(1);
}

export const env = _env.data;
