import { Bot } from "grammy";
import logger from "../configs/logger";
import SessionService, { type ChatType } from "../services/session.service";

export type BotStatus = "starting" | "running" | "stopping" | "stopped" | "error";

interface BotEntry {
  bot: Bot;
  status: BotStatus;
  error?: string;
}

/**
 * Singleton that manages the lifecycle of all Telegram bots in parallel.
 * Bots run as long-polling processes in the background.
 */
class BotManager {
  private static _instance: BotManager | null = null;
  private bots = new Map<string, BotEntry>();
  private sessionService = new SessionService();

  private constructor() {}

  static getInstance(): BotManager {
    if (!BotManager._instance) {
      BotManager._instance = new BotManager();
    }
    return BotManager._instance;
  }

  private registerHandlers(bot: Bot, clientId: string): void {
    /**
     * /setup <name>
     * Creates or renames a session for the current chat.
     * Required before the bot responds to messages.
     */
    bot.command("setup", async (ctx) => {
      const name = ctx.match?.trim();
      if (!name) {
        await ctx.reply("Usage: /setup <session name>\nExample: /setup My Support Group");
        return;
      }

      const chatId = ctx.chat.id;
      const chatType = ctx.chat.type as ChatType;
      const fromId = ctx.from?.id?.toString() ?? "system";

      try {
        const session = await this.sessionService.setupSession(
          clientId,
          chatId,
          chatType,
          name,
          fromId,
        );
        const isNew = session.created_by === fromId && session.updated_date == null;
        await ctx.reply(
          isNew
            ? `✅ Session *"${name}"* created! You can now chat with me.`
            : `✏️ Session renamed to *"${name}"*.`,
          { parse_mode: "Markdown" },
        );
      } catch (err) {
        logger.error(`[Bot:${clientId}] /setup error: ${(err as Error).message}`);
        await ctx.reply("❌ Failed to setup session. Please try again.");
      }
    });

    /**
     * Regular messages — requires an active session.
     * Saves user message to MongoDB; AI reply is a placeholder until integration.
     */
    bot.on("message:text", async (ctx) => {
      // Ignore commands
      if (ctx.message.text.startsWith("/")) return;

      const chatId = ctx.chat.id;
      const session = await this.sessionService.getSession(clientId, chatId);

      if (!session) {
        await ctx.reply("⚙️ This chat has no active session.\nRun /setup <name> to get started.");
        return;
      }

      const fromId = ctx.from?.id?.toString();
      const fromName = ctx.from?.first_name ?? "User";
      const text = ctx.message.text;

      try {
        // Save incoming message
        await this.sessionService.addMessage(session.id, "user", text, fromId, fromName);

        // AI placeholder — will be replaced with real GPT call
        const reply = `🤖 *[${session.name}]* AI response coming soon!`;
        await ctx.reply(reply, { parse_mode: "Markdown" });

        // Save assistant reply
        await this.sessionService.addMessage(session.id, "assistant", reply);
      } catch (err) {
        logger.error(`[Bot:${clientId}] message handler error: ${(err as Error).message}`);
      }
    });
  }

  async start(clientId: string, token: string): Promise<void> {
    const existing = this.bots.get(clientId);
    if (existing?.status === "running" || existing?.status === "starting") return;

    const bot = new Bot(token);
    this.registerHandlers(bot, clientId);

    const entry: BotEntry = { bot, status: "starting" };
    this.bots.set(clientId, entry);

    logger.info(`[BotManager] Starting bot for client ${clientId}`);

    bot
      .start({
        onStart: () => {
          entry.status = "running";
          entry.error = undefined;
          logger.info(`[BotManager] Bot ${clientId} is running`);
        },
      })
      .catch((err: Error) => {
        entry.status = "error";
        entry.error = err.message;
        logger.error(`[BotManager] Bot ${clientId} error: ${err.message}`);
      });

    // Wait for onStart (or error) — max 12 seconds
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (entry.status !== "starting") {
          clearInterval(check);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);
      const timeout = setTimeout(() => {
        clearInterval(check);
        if (entry.status === "starting") {
          entry.status = "error";
          entry.error = "Startup timed out";
        }
        resolve();
      }, 12_000);
    });
  }

  async stop(clientId: string): Promise<void> {
    const entry = this.bots.get(clientId);
    if (!entry || entry.status === "stopped" || entry.status === "stopping") return;

    logger.info(`[BotManager] Stopping bot for client ${clientId}`);
    entry.status = "stopping";
    try {
      await entry.bot.stop();
    } catch {
      // ignore stop errors
    }
    entry.status = "stopped";
    logger.info(`[BotManager] Bot ${clientId} stopped`);
  }

  async restart(clientId: string, token: string): Promise<void> {
    await this.stop(clientId);
    this.bots.delete(clientId);
    await this.start(clientId, token);
  }

  getStatus(clientId: string): { status: BotStatus; error?: string } {
    const entry = this.bots.get(clientId);
    if (!entry) return { status: "stopped" };
    return { status: entry.status, error: entry.error };
  }

  getAllStatuses(): Record<string, { status: BotStatus; error?: string }> {
    const result: Record<string, { status: BotStatus; error?: string }> = {};
    for (const [id, entry] of this.bots) {
      result[id] = { status: entry.status, error: entry.error };
    }
    return result;
  }
}

export const botManager = BotManager.getInstance();
