import ClientRepository from "../repositories/client.repository";
import ClientCredentialRepository from "../repositories/client-credential.repository";
import { botManager, type BotStatus } from "../bots/bot-manager";
import { BadRequestException, NotFoundException } from "../libs/exception";

export default class BotService {
  private clientRepository = new ClientRepository();
  private credentialRepository = new ClientCredentialRepository();

  private async resolveToken(clientId: string, accountId: string): Promise<string> {
    const client = await this.clientRepository.findByIdAndAccountId(clientId, accountId);
    if (!client) throw new NotFoundException("Client not found");
    if (client.type !== "telegram")
      throw new BadRequestException("Only Telegram bots are supported");

    const tokenCred = await this.credentialRepository.findByClientIdAndKey(clientId, "bot_token");
    if (!tokenCred) throw new BadRequestException("bot_token credential not configured");

    return tokenCred.value;
  }

  async startBot(
    clientId: string,
    accountId: string,
  ): Promise<{ status: BotStatus; error?: string }> {
    const token = await this.resolveToken(clientId, accountId);
    await botManager.start(clientId, token);
    return botManager.getStatus(clientId);
  }

  async stopBot(
    clientId: string,
    accountId: string,
  ): Promise<{ status: BotStatus; error?: string }> {
    const client = await this.clientRepository.findByIdAndAccountId(clientId, accountId);
    if (!client) throw new NotFoundException("Client not found");

    await botManager.stop(clientId);
    return botManager.getStatus(clientId);
  }

  async restartBot(
    clientId: string,
    accountId: string,
  ): Promise<{ status: BotStatus; error?: string }> {
    const token = await this.resolveToken(clientId, accountId);
    await botManager.restart(clientId, token);
    return botManager.getStatus(clientId);
  }

  getBotStatus(clientId: string): { status: BotStatus; error?: string } {
    return botManager.getStatus(clientId);
  }

  getAllBotStatuses(): Record<string, { status: BotStatus; error?: string }> {
    return botManager.getAllStatuses();
  }
}
