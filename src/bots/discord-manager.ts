import type { Message } from "discord.js";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import logger from "../configs/logger";
import AiModelRepository from "../repositories/ai-model.repository";
import ClientRepository from "../repositories/client.repository";
import ChatService from "../services/chat.service";
import SessionService, { type ChatType } from "../services/session.service";
import type { BotStatus } from "./bot-manager";

interface DiscordBotEntry {
  client: Client;
  status: BotStatus;
  error?: string;
}

/**
 * Helper to convert a Discord snowflake to a safe JS number.
 * We use mod arithmetic to fit inside Number.MAX_SAFE_INTEGER to avoid
 * breaking the Drizzle schema which expects chat_id as a number.
 */
function snowflakeToSafeNumber(id: string): number {
  return Number(BigInt(id) % 9007199254740991n);
}

class DiscordManager {
  private static _instance: DiscordManager | null = null;
  private bots = new Map<string, DiscordBotEntry>();

  /** Per-chat sequential queue: key = `${clientId}:${chatId}` */
  private chatQueues = new Map<string, Promise<void>>();

  private sessionService = new SessionService();
  private chatService = new ChatService();
  private clientRepository = new ClientRepository();
  private aiModelRepository = new AiModelRepository();

  private enqueue(clientId: string, chatId: number, work: () => Promise<void>): void {
    const key = `${clientId}:${chatId}`;
    const prev = this.chatQueues.get(key) ?? Promise.resolve();
    const next = prev.then(work).catch(() => {});
    this.chatQueues.set(key, next);
    next.finally(() => {
      if (this.chatQueues.get(key) === next) this.chatQueues.delete(key);
    });
  }

  private constructor() {}

  static getInstance(): DiscordManager {
    if (!DiscordManager._instance) {
      DiscordManager._instance = new DiscordManager();
    }
    return DiscordManager._instance;
  }

  private registerHandlers(client: Client, clientId: string): void {
    client.on("messageCreate", async (message: Message) => {
      if (message.author.bot) return;

      const isGroup = message.guild !== null;
      const botId = client.user?.id;
      if (!botId) return;

      const rawText = message.content;

      // In Discord, check if bot is processing in DM or was mentioned in a group
      if (isGroup) {
        const isMentioned = message.mentions.has(botId);

        let isReplyToBot = false;
        if (message.reference?.messageId) {
          try {
            const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
            if (repliedMsg.author.id === botId) {
              isReplyToBot = true;
            }
          } catch {
            /* ignore fetch error */
          }
        }

        if (!isMentioned && !isReplyToBot) return;
      }

      // Convert Discord IDs to safe numbers for database compat
      const chatId = snowflakeToSafeNumber(message.channel.id);
      const fromId = snowflakeToSafeNumber(message.author.id);

      const chatType: ChatType = isGroup ? "group" : "private";

      // Remove bot mention from text
      const userText = isGroup
        ? rawText.replace(new RegExp(`<@!?${botId}>`, "gi"), "").trim()
        : rawText.trim();

      if (!userText) return;

      // React with 👀 to indicate message has been read
      try {
        await message.react("👀");
      } catch {
        /* ignore — bot may lack permission */
      }

      const fromName = message.author.username;
      const label = `[Discord:${clientId}:${chatId}]`;
      const channelName = (message.channel as any).name;
      const fallbackName = isGroup ? channelName || "Discord Channel" : `DM with ${fromName}`;

      this.enqueue(clientId, chatId, async () => {
        // 1. Session check or auto-create for Discord
        // For Discord, we auto-create sessions so users don't have to manually type /setup
        const session = await this.sessionService.ensureSession(
          clientId,
          chatId,
          chatType,
          fallbackName,
        );

        // 2. Resolve AI model
        const clientRecord = await this.clientRepository.findById(clientId);
        const modelId = session.ai_model_id ?? clientRecord?.ai_model_id;
        if (!modelId) {
          await message.reply("⚠️ No AI model assigned. Ask the admin to configure one.");
          return;
        }

        const aiModel = await this.aiModelRepository.findById(modelId);
        if (!aiModel) {
          await message.reply("⚠️ Assigned AI model not found.");
          return;
        }

        try {
          if ("sendTyping" in message.channel) {
            await message.channel.sendTyping();
          }

          const result = await this.chatService.processMessage({
            clientId,
            chatId,
            chatType,
            text: userText,
            fromId,
            fromName,
            aiModel,
            entityMode: clientRecord?.entity_mode,
          });

          await message.reply(result.reply);

          // Process Cross-Platform Markers
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
                    const { botManager } = await import("./bot-manager");
                    await botManager.sendMessage(
                      target.clientId,
                      target.session.chat_id,
                      marker.text,
                    );
                  } else if (marker.platform === "discord") {
                    await this.sendMessageByName(
                      target.clientId,
                      marker.targetSessionName,
                      marker.text,
                    );
                  }
                } else {
                  await message.reply(
                    `⚠️ Tidak dapat menemukan sesi '${marker.targetSessionName}' di platform ${marker.platform}.`,
                  );
                }
              }
            }
          }
        } catch (err) {
          logger.error(`${label} AI error: ${(err as Error).message}`);
          await message.reply("❌ Gagal mendapat respons. Coba lagi nanti.");
        }
      });
    });
  }

  async start(clientId: string, token: string): Promise<void> {
    const existing = this.bots.get(clientId);
    if (existing?.status === "running" || existing?.status === "starting") return;

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
      partials: [Partials.Channel, Partials.Message],
    });

    this.registerHandlers(client, clientId);

    const entry: DiscordBotEntry = { client, status: "starting" };
    this.bots.set(clientId, entry);
    logger.info(`[DiscordManager] Starting bot for client ${clientId}`);

    client.once("clientReady", () => {
      entry.status = "running";
      logger.info(`[DiscordManager] Bot ${clientId} is running as ${client.user?.tag}`);
    });

    try {
      await client.login(token);
    } catch (err: any) {
      entry.status = "error";
      entry.error = err.message;
      logger.error(`[DiscordManager] Bot ${clientId} error: ${err.message}`);
    }
  }

  async stop(clientId: string): Promise<void> {
    const entry = this.bots.get(clientId);
    if (!entry || entry.status === "stopped" || entry.status === "stopping") return;

    logger.info(`[DiscordManager] Stopping bot for client ${clientId}`);
    entry.status = "stopping";
    try {
      entry.client.destroy();
    } catch {
      /* ignore */
    }
    entry.status = "stopped";
    logger.info(`[DiscordManager] Bot ${clientId} stopped`);
  }

  async restart(clientId: string, token: string): Promise<void> {
    await this.stop(clientId);
    this.bots.delete(clientId);
    await this.start(clientId, token);
  }

  async sendMessageByName(clientId: string, sessionName: string, text: string): Promise<void> {
    const entry = this.bots.get(clientId);
    if (!entry || entry.status !== "running") return;
    try {
      const channel = entry.client.channels.cache.find((c: any) => c.name === sessionName);
      if (channel && channel.isTextBased()) {
        await (channel as any).send(text);
      } else {
        logger.warn(`[DiscordManager] Channel ${sessionName} not found or not text-based.`);
      }
    } catch (err) {
      logger.error(`[DiscordManager] Failed to send to ${sessionName}: ${(err as Error).message}`);
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

export const discordManager = DiscordManager.getInstance();
