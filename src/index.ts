import "reflect-metadata";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { env } from "./configs/env";
import logger from "./configs/logger";
import { ErrorHandler } from "./libs/error-handler";
import InitMiddlewares from "./middleware/init-middleware";
import { botManager } from "./bots/bot-manager";
import { connectMongo } from "./database/mongo";
import ClientRepository from "./repositories/client.repository";
import ClientCredentialRepository from "./repositories/client-credential.repository";
import ContextService from "./services/context.service";

const app = new Hono();
const port = env.PORT || 8080;
app.onError(ErrorHandler);

app.get("/panic", () => {
  throw new Error("Test Error");
});
new InitMiddlewares(app);

app.get("/", (c) => {
  return c.json({ message: "welcome" });
});

app.use("/assets/*", serveStatic({ root: "./client/dist" }));
app.get("*", serveStatic({ path: "./client/dist/index.html" }));

async function startActiveBots(): Promise<void> {
  const clientRepo = new ClientRepository();
  const credRepo = new ClientCredentialRepository();

  const clients = await clientRepo.findAllActiveByType("telegram");
  if (clients.length === 0) return;

  logger.info(`[BotManager] Auto-starting ${clients.length} Telegram bot(s)...`);

  await Promise.allSettled(
    clients.map(async (client) => {
      const tokenCred = await credRepo.findByClientIdAndKey(client.id, "bot_token");
      if (!tokenCred) {
        logger.warn(`[BotManager] Skipping client ${client.id} — no bot_token credential`);
        return;
      }
      await botManager.start(client.id, tokenCred.value);
      const { status, error } = botManager.getStatus(client.id);
      if (status === "running") {
        logger.info(`[BotManager] ✅ Bot "${client.name}" started`);
      } else {
        logger.warn(`[BotManager] ⚠️  Bot "${client.name}" failed: ${error}`);
      }
    }),
  );
}

async function bootstrap() {
  try {
    const server = Bun.serve({
      fetch: app.fetch,
      port: port,
    });

    process.stdout.write("\u001b[2J\u001b[0;0H");

    logger.info("🌍 I18n initialized successfully");
    logger.info(`🔥 API initialized on ${server.url}`);

    await connectMongo();
    await new ContextService().syncAllToDisk();
    await startActiveBots();
    botManager.startReminderScheduler();
  } catch (error: any) {
    logger.error(`❌ Gagal: ${error.message}`);
    process.exit(1);
  }
}

bootstrap().then();

export { app };
