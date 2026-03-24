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
import ContentService from "./services/content.service";
import AccountRepository from "./repositories/account.repository";

const app = new Hono();
const port = env.PORT || 8080;
app.onError(ErrorHandler);

app.get("/panic", () => {
  throw new Error("Test Error");
});
new InitMiddlewares(app);

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
        logger.warn(
          `[${client.platform}] Skipping client "${client.name}" — no bot_token credential`,
        );
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

function startContentSchedulers(): void {
  const contentService = new ContentService();
  const accountRepo = new AccountRepository();

  // Publish scheduler — every 60 seconds, publish due approved drafts
  setInterval(async () => {
    try {
      await contentService.runPublishScheduler();
    } catch (err) {
      logger.error(`[ContentScheduler] Publish error: ${(err as Error).message}`);
    }
  }, 60_000);

  // Daily generation scheduler — runs every hour, triggers at configured hour
  let lastGeneratedDate = "";
  setInterval(async () => {
    const now = new Date();
    const currentHour = now.getHours();
    const dateKey = now.toDateString();
    if (currentHour !== env.CONTENT_GENERATE_HOUR || dateKey === lastGeneratedDate) return;
    lastGeneratedDate = dateKey;

    try {
      const accounts = await accountRepo.findAll();
      logger.info(`[ContentScheduler] Daily generation for ${accounts.length} account(s)`);
      await Promise.allSettled(
        accounts.map((acc) =>
          contentService.generate(acc.id).catch((e) => {
            logger.warn(`[ContentScheduler] Skipped account ${acc.id}: ${e.message}`);
          }),
        ),
      );
    } catch (err) {
      logger.error(`[ContentScheduler] Daily generation error: ${(err as Error).message}`);
    }
  }, 60_000);

  logger.info(
    `[ContentScheduler] Publish + daily generation schedulers started (generate at ${env.CONTENT_GENERATE_HOUR}:00)`,
  );
}

async function seedGlobalContexts(): Promise<void> {
  const contextService = new ContextService();
  const accountRepo = new AccountRepository();
  try {
    const accounts = await accountRepo.findAll();
    await Promise.allSettled(
      accounts.map((acc) => contextService.ensureCapabilitiesContext(acc.id)),
    );
    if (accounts.length > 0) {
      logger.info(
        `[Startup] Platform capabilities context seeded for ${accounts.length} account(s)`,
      );
    }
  } catch (err) {
    logger.warn(`[Startup] Could not seed capabilities context: ${(err as Error).message}`);
  }
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
    await seedGlobalContexts();
    await startActiveBots();
    botManager.startReminderScheduler();
    startContentSchedulers();
  } catch (error: any) {
    logger.error(`❌ Gagal: ${error.message}`);
    process.exit(1);
  }
}

bootstrap().then();

export { app };
