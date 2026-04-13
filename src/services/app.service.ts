import { generateId } from "../libs/string-utils";
import { NotFoundException } from "../libs/exception";
import AppConnectionRepository from "../repositories/app-connection.repository";
import type { AppConnection } from "../entities/pg/app-connection.entity";
import GoogleService from "./google.service";
import ChatService from "./chat.service";

export interface ResponseAppConnection {
  id: string;
  app_type: string;
  email?: string;
  display_name?: string;
  scopes?: string;
  connected_at: number;
}

function toResponse(conn: AppConnection): ResponseAppConnection {
  return {
    id: conn.id,
    app_type: conn.app_type,
    email: conn.email ?? undefined,
    display_name: conn.display_name ?? undefined,
    scopes: conn.scopes ?? undefined,
    connected_at: conn.created_date,
  };
}

export default class AppService {
  private repo = new AppConnectionRepository();
  private googleService = new GoogleService();

  getGoogleAuthUrl(): string {
    return this.googleService.buildAuthUrl();
  }

  async connectGoogle(code: string, accountId: string): Promise<ResponseAppConnection> {
    const tokens = await this.googleService.exchangeCode(code);
    const userInfo = await this.googleService.getUserInfo(tokens.access_token);

    // Upsert — replace existing Google connection if any
    const existing = await this.repo.findByAccountIdAndType(accountId, "google");
    if (existing) {
      ChatService.calendarForbidden.delete(accountId);
      await this.repo.update(existing.id, {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? existing.refresh_token,
        expires_at: Date.now() + tokens.expires_in * 1000,
        scopes: tokens.scope,
        email: userInfo.email,
        display_name: userInfo.name,
        active: true,
        updated_date: Date.now(),
        updated_by: accountId,
      });
      const updated = (await this.repo.findById(existing.id))!;
      return toResponse(updated);
    }

    // Clear forbidden cache so calendar is retried with new token
    ChatService.calendarForbidden.delete(accountId);

    const conn = await this.repo.save({
      id: generateId(),
      account_id: accountId,
      app_type: "google",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: Date.now() + tokens.expires_in * 1000,
      scopes: tokens.scope,
      email: userInfo.email,
      display_name: userInfo.name,
      created_by: accountId,
    });
    return toResponse(conn);
  }

  async listConnections(accountId: string): Promise<ResponseAppConnection[]> {
    const conns = await this.repo.findAllByAccountId(accountId);
    return conns.map(toResponse);
  }

  async disconnect(id: string, accountId: string): Promise<void> {
    const conn = await this.repo.findById(id);
    if (!conn || conn.account_id !== accountId)
      throw new NotFoundException("App connection not found");
    await this.repo.softDelete(id, accountId);
  }
}
