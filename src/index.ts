import "reflect-metadata";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { env } from "./configs/env";
import logger from "./configs/logger";
import { ErrorHandler } from "./libs/error-handler";
import InitMiddlewares from "./middleware/init-middleware";
import { botManager } from "./bots/bot-manager";
import { discordManager } from "./bots/discord-manager";
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

  const [telegramClients, discordClients] = await Promise.all([
    clientRepo.findAllActiveByType("telegram"),
    clientRepo.findAllActiveByType("discord"),
  ]);

  const allClients = [
    ...telegramClients.map((c) => ({ ...c, platform: "telegram" as const })),
    ...discordClients.map((c) => ({ ...c, platform: "discord" as const })),
  ];

  if (allClients.length === 0) return;

  logger.info(
    `[BotManager] Auto-starting ${telegramClients.length} Telegram + ${discordClients.length} Discord bot(s)...`,
  );

  await Promise.allSettled(
    allClients.map(async (client) => {
      const tokenCred = await credRepo.findByClientIdAndKey(client.id, "bot_token");
      if (!tokenCred) {
        logger.warn(`[${client.platform}] Skipping client "${client.name}" — no bot_token credential`);
        return;
      }
      if (client.platform === "telegram") {
        await botManager.start(client.id, tokenCred.value);
        const { status, error } = botManager.getStatus(client.id);
        if (status === "running") {
          logger.info(`[Telegram] ✅ Bot "${client.name}" started`);
        } else {
          logger.warn(`[Telegram] ⚠️  Bot "${client.name}" failed: ${error}`);
        }
      } else {
        await discordManager.start(client.id, tokenCred.value);
        const { status, error } = discordManager.getStatus(client.id);
        if (status === "running" || status === "starting") {
          logger.info(`[Discord] ✅ Bot "${client.name}" started`);
        } else {
          logger.warn(`[Discord] ⚠️  Bot "${client.name}" failed: ${error}`);
        }
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
