import { Bot } from "grammy";
import logger from "../configs/logger";
import AiModelRepository from "../repositories/ai-model.repository";
import ClientRepository from "../repositories/client.repository";
import TaskRepository from "../repositories/task.repository";
import ChatService from "../services/chat.service";
import SessionService, { type ChatType } from "../services/session.service";
import { BOT_MSG } from "../prompts";

export type BotStatus = "starting" | "running" | "stopping" | "stopped" | "error";

interface BotEntry {
  bot: Bot;
  status: BotStatus;
  error?: string;
}

class BotManager {
  private static _instance: BotManager | null = null;
  private bots = new Map<string, BotEntry>();
  /** Per-chat sequential queue: key = `${clientId}:${chatId}` */
  private chatQueues = new Map<string, Promise<void>>();
  private sessionService = new SessionService();
  private chatService = new ChatService();
  private taskRepository = new TaskRepository();
  private clientRepository = new ClientRepository();
  private aiModelRepository = new AiModelRepository();

  /** Enqueue work for a specific chat/thread so messages are processed one at a time */
  private enqueue(clientId: string, chatId: number, work: () => Promise<void>, threadId?: number): void {
    const key = threadId != null ? `${clientId}:${chatId}:${threadId}` : `${clientId}:${chatId}`;
    const prev = this.chatQueues.get(key) ?? Promise.resolve();
    const next = prev.then(work).catch(() => {
      /* errors handled inside work */
    });
    this.chatQueues.set(key, next);
    // Clean up entry once the chain settles to avoid memory leak
    next.finally(() => {
      if (this.chatQueues.get(key) === next) this.chatQueues.delete(key);
    });
  }

  private schedulerStarted = false;

  private constructor() {}

  /** Start the global reminder scheduler (runs once, shared across all bots) */
  startReminderScheduler(): void {
    if (this.schedulerStarted) return;
    this.schedulerStarted = true;

    // TODO: Implement unified cross-platform reminder logic
    logger.info("[BotManager] Unified reminder scheduler initialized");
  }

  static getInstance(): BotManager {
    if (!BotManager._instance) {
      BotManager._instance = new BotManager();
    }
    return BotManager._instance;
  }

  private registerHandlers(bot: Bot, clientId: string): void {
    bot.on("message:text", async (ctx) => {
      const botId = ctx.me.id;
      const rawText = ctx.message.text;
      const isGroup = ctx.chat.type !== "private";

      if (isGroup) {
        const botUsername = ctx.me.username?.toLowerCase() ?? "";
        const isMentioned =
          botUsername.length > 0 && rawText.toLowerCase().includes(`@${botUsername}`);
        const isReplyToBot = ctx.message.reply_to_message?.from?.id === botId;

        logger.info(
          `[Bot:${clientId}] group msg — mention:${isMentioned} replyToBot:${isReplyToBot} botUser:@${botUsername}`,
        );
        if (!isMentioned && !isReplyToBot) return;
      }

      const chatId = ctx.chat.id;
      const chatType = ctx.chat.type as ChatType;
      const threadId = ctx.message.message_thread_id ?? undefined;
      const strippedText =
        isGroup && ctx.me.username
          ? rawText.replace(new RegExp(`@${ctx.me.username}`, "gi"), "").trim()
          : rawText;

      if (!strippedText) return;

      // Prepend replied-to message so Luna has context of what's being replied to
      const replyMsg = ctx.message.reply_to_message;
      const replyContext =
        replyMsg && "text" in replyMsg && replyMsg.text
          ? `[Membalas pesan dari ${replyMsg.from?.first_name ?? "seseorang"}: "${replyMsg.text}"]\n`
          : replyMsg && "caption" in replyMsg && replyMsg.caption
            ? `[Membalas pesan dari ${replyMsg.from?.first_name ?? "seseorang"}: "${replyMsg.caption}"]\n`
            : "";
      const userText = replyContext ? `${replyContext}${strippedText}` : strippedText;

      const fromId = ctx.from?.id?.toString();
      const fromName = ctx.from?.first_name ?? "User";
      const channelName = isGroup
        ? ("title" in ctx.chat ? ctx.chat.title : undefined) ?? ctx.chat.id.toString()
        : undefined;
      const label = threadId ? `[Bot:${clientId}:${chatId}:t${threadId}]` : `[Bot:${clientId}:${chatId}]`;

      // React with 👀 to indicate message has been read
      try {
        await ctx.react("👀");
      } catch {
        /* ignore — bot may lack permission */
      }

      this.enqueue(clientId, chatId, async () => {
        // Try thread-specific session first, fall back to main chat session
        const session =
          (threadId != null
            ? (await this.sessionService.getSession(clientId, chatId, threadId)) ??
              (await this.sessionService.getSession(clientId, chatId))
            : await this.sessionService.getSession(clientId, chatId));

        if (!session) {
          await ctx.reply(BOT_MSG.NO_SESSION,
            threadId ? { message_thread_id: threadId } : undefined);
          return;
        }

        // 2. Resolve AI model
        const clientRecord = await this.clientRepository.findById(clientId);
        const modelId = session.ai_model_id ?? clientRecord?.ai_model_id;
        if (!modelId) {
          await ctx.reply(BOT_MSG.NO_AI_MODEL,
            threadId ? { message_thread_id: threadId } : undefined);
          return;
        }

        const aiModel = await this.aiModelRepository.findById(modelId);
        if (!aiModel) {
          await ctx.reply(BOT_MSG.AI_MODEL_NOT_FOUND,
            threadId ? { message_thread_id: threadId } : undefined);
          return;
        }

        try {
          // 3. Process with ChatService
          const result = await this.chatService.processMessage({
            clientId,
            chatId,
            chatType,
            text: userText,
            fromId: Number(fromId),
            fromName,
            platform: "telegram",
            channelName,
            threadId,
            aiModel,
            entityMode: clientRecord?.entity_mode,
          });

          // 4. Send reply — keep inside the same thread/topic if applicable
          const replyOpts = threadId ? { message_thread_id: threadId } : undefined;
          try {
            await ctx.reply(result.reply, { parse_mode: "Markdown", ...replyOpts });
          } catch (err) {
            logger.warn(
              `${label} Markdown reply failed, falling back to plain text: ${(err as Error).message}`,
            );
            await ctx.reply(result.reply, replyOpts);
          }

          // 5. Process Cross-Platform Markers
          if (result.markers && result.markers.length > 0) {
            for (const marker of result.markers) {
              if (marker.type === "send_message") {
                const target = await this.sessionService.findTargetSession(
                  clientRecord!.account_id,
                  marker.platform,
                  marker.targetSessionName,
                );
                if (target) {
                  if (marker.platform === "telegram") {
                    await this.sendMessage(target.clientId, target.session.chat_id, marker.text);
                  } else if (marker.platform === "discord") {
                    const { discordManager } = await import("./discord-manager");
                    await discordManager.sendMessageByName(
                      target.clientId,
                      marker.targetSessionName,
                      marker.text,
                    );
                  }
                } else {
                  await ctx.reply(
                    BOT_MSG.SESSION_NOT_FOUND(marker.targetSessionName, marker.platform),
                  );
                }
              }
            }
          }
        } catch (err) {
          logger.error(`${label} AI error: ${(err as Error).message}`);
          await ctx.reply(BOT_MSG.AI_ERROR);
        }
      }, threadId);
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

    try {
      await bot.api.deleteWebhook({ drop_pending_updates: false });
    } catch (err) {
      logger.warn(
        `[BotManager] Could not clear webhook for ${clientId}: ${(err as Error).message}`,
      );
    }

    bot
      .start({
        allowed_updates: ["message", "edited_message", "callback_query"],
        onStart: () => {
          entry.status = "running";
          logger.info(`[BotManager] Bot ${clientId} is running`);
        },
      })
      .catch((err: Error) => {
        entry.status = "error";
        entry.error = err.message;
        logger.error(`[BotManager] Bot ${clientId} error: ${err.message}`);
      });

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
      /* ignore */
    }
    entry.status = "stopped";
    logger.info(`[BotManager] Bot ${clientId} stopped`);
  }

  async restart(clientId: string, token: string): Promise<void> {
    await this.stop(clientId);
    this.bots.delete(clientId);
    await this.start(clientId, token);
  }

  async sendMessage(clientId: string, chatId: number, text: string): Promise<void> {
    const entry = this.bots.get(clientId);
    if (!entry || entry.status !== "running") return;
    try {
      await entry.bot.api.sendMessage(chatId, text);
    } catch (err) {
      logger.error(`[BotManager] Failed to send message to ${chatId}: ${(err as Error).message}`);
    }
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
