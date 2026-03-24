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

  // Google OAuth (optional — only needed for Google Workspace integration)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),

  // Instagram Graph API (optional — needed for content publishing)
  INSTAGRAM_ACCESS_TOKEN: z.string().optional(),
  INSTAGRAM_BUSINESS_ACCOUNT_ID: z.string().optional(),

  // Threads (optional — separate access token with threads_basic + threads_content_publish scope)
  THREADS_USER_ID: z.string().optional(),
  THREADS_ACCESS_TOKEN: z.string().optional(),
  THREADS_VERIFY_TOKEN: z.string().optional(),

  // Supabase Storage (for content asset uploads)
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("content-assets"),

  // Hour (0-23, local time) at which Luna auto-generates a daily content draft
  CONTENT_GENERATE_HOUR: z.string().default("9").transform(Number),
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
