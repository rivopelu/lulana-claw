import { botManager, type BotStatus } from "../bots/bot-manager";
import { discordManager } from "../bots/discord-manager";
import { BadRequestException, NotFoundException } from "../libs/exception";
import ClientCredentialRepository from "../repositories/client-credential.repository";
import ClientRepository from "../repositories/client.repository";

export default class BotService {
  private clientRepository = new ClientRepository();
  private credentialRepository = new ClientCredentialRepository();

  private async resolveTokenAndType(
    clientId: string,
    accountId: string,
  ): Promise<{ token: string; type: string }> {
    const client = await this.clientRepository.findByIdAndAccountId(clientId, accountId);
    if (!client) throw new NotFoundException("Client not found");
    if (client.type !== "telegram" && client.type !== "discord")
      throw new BadRequestException(`Bot type ${client.type} is not supported`);

    const tokenCred = await this.credentialRepository.findByClientIdAndKey(clientId, "bot_token");
    if (!tokenCred) throw new BadRequestException("bot_token credential not configured");

    return { token: tokenCred.value, type: client.type };
  }

  async startBot(
    clientId: string,
    accountId: string,
  ): Promise<{ status: BotStatus; error?: string }> {
    const { token, type } = await this.resolveTokenAndType(clientId, accountId);
    if (type === "telegram") {
      await botManager.start(clientId, token);
      return botManager.getStatus(clientId);
    } else {
      await discordManager.start(clientId, token);
      return discordManager.getStatus(clientId);
    }
  }

  async stopBot(
    clientId: string,
    accountId: string,
  ): Promise<{ status: BotStatus; error?: string }> {
    const client = await this.clientRepository.findByIdAndAccountId(clientId, accountId);
    if (!client) throw new NotFoundException("Client not found");

    if (client.type === "telegram") {
      await botManager.stop(clientId);
      return botManager.getStatus(clientId);
    } else {
      await discordManager.stop(clientId);
      return discordManager.getStatus(clientId);
    }
  }

  async restartBot(
    clientId: string,
    accountId: string,
  ): Promise<{ status: BotStatus; error?: string }> {
    const { token, type } = await this.resolveTokenAndType(clientId, accountId);
    if (type === "telegram") {
      await botManager.restart(clientId, token);
      return botManager.getStatus(clientId);
    } else {
      await discordManager.restart(clientId, token);
      return discordManager.getStatus(clientId);
    }
  }

  getBotStatus(clientId: string): { status: BotStatus; error?: string } {
    const tgStatus = botManager.getStatus(clientId);
    if (tgStatus && tgStatus.status !== "stopped") return tgStatus;

    const dcStatus = discordManager.getStatus(clientId);
    if (dcStatus && dcStatus.status !== "stopped") return dcStatus;

    return { status: "stopped" };
  }

  getAllBotStatuses(): Record<string, { status: BotStatus; error?: string }> {
    const tg = botManager.getAllStatuses();
    const dc = discordManager.getAllStatuses();
    return { ...tg, ...dc };
  }
}
