import { env } from "../configs/env";
import logger from "../configs/logger";
import AppConnectionRepository from "../repositories/app-connection.repository";
import type { AppConnection } from "../entities/pg/app-connection.entity";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/documents",
].join(" ");

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink: string;
}

export default class GoogleService {
  private repo = new AppConnectionRepository();

  buildAuthUrl(): string {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI) {
      throw new Error("Google OAuth not configured (GOOGLE_CLIENT_ID or GOOGLE_REDIRECT_URI missing)");
    }
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<GoogleTokens> {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
      throw new Error("Google OAuth not configured");
    }
    const resp = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Google token exchange failed: ${err}`);
    }
    return resp.json() as Promise<GoogleTokens>;
  }

  async refreshToken(refreshToken: string): Promise<GoogleTokens> {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new Error("Google OAuth not configured");
    }
    const resp = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        grant_type: "refresh_token",
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Google token refresh failed: ${err}`);
    }
    return resp.json() as Promise<GoogleTokens>;
  }

  async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const resp = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!resp.ok) throw new Error("Failed to fetch Google user info");
    return resp.json() as Promise<GoogleUserInfo>;
  }

  /** Get a valid access token for the account, refreshing if needed */
  async getValidToken(accountId: string): Promise<{ token: string; conn: AppConnection } | null> {
    const conn = await this.repo.findByAccountIdAndType(accountId, "google");
    if (!conn) return null;

    const buffer = 5 * 60 * 1000; // 5 min buffer
    const isExpired = conn.expires_at && conn.expires_at - buffer < Date.now();

    if (isExpired && conn.refresh_token) {
      try {
        const tokens = await this.refreshToken(conn.refresh_token);
        const newExpiresAt = Date.now() + tokens.expires_in * 1000;
        await this.repo.update(conn.id, {
          access_token: tokens.access_token,
          expires_at: newExpiresAt,
        });
        return { token: tokens.access_token, conn: { ...conn, access_token: tokens.access_token } };
      } catch (err) {
        logger.error(`[GoogleService] Token refresh failed for ${accountId}: ${(err as Error).message}`);
        return null;
      }
    }

    return { token: conn.access_token, conn };
  }

  // ─── Calendar ─────────────────────────────────────────────────────────────

  async listCalendarEvents(accessToken: string, days = 7): Promise<CalendarEvent[]> {
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + days * 86400_000).toISOString();
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "20",
    });
    const resp = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!resp.ok) throw new Error(`Calendar list failed: ${resp.statusText}`);
    const data = (await resp.json()) as { items: CalendarEvent[] };
    return data.items ?? [];
  }

  async createCalendarEvent(
    accessToken: string,
    title: string,
    start: string,
    end: string,
    description?: string,
  ): Promise<CalendarEvent> {
    const body = {
      summary: title,
      description,
      start: start.includes("T") ? { dateTime: start } : { date: start },
      end: end.includes("T") ? { dateTime: end } : { date: end },
    };
    const resp = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    if (!resp.ok) throw new Error(`Calendar create failed: ${resp.statusText}`);
    return resp.json() as Promise<CalendarEvent>;
  }

  // ─── Gmail ────────────────────────────────────────────────────────────────

  async sendEmail(
    accessToken: string,
    to: string,
    subject: string,
    body: string,
  ): Promise<void> {
    const raw = btoa(
      `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`,
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const resp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });
    if (!resp.ok) throw new Error(`Gmail send failed: ${resp.statusText}`);
  }

  async listEmails(accessToken: string, max = 5): Promise<{ from: string; subject: string; snippet: string }[]> {
    const listResp = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}&labelIds=INBOX`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!listResp.ok) throw new Error(`Gmail list failed: ${listResp.statusText}`);
    const listData = (await listResp.json()) as { messages?: { id: string }[] };
    const messages = listData.messages ?? [];

    const details = await Promise.allSettled(
      messages.map(async (m) => {
        const r = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!r.ok) return null;
        const d = (await r.json()) as {
          snippet: string;
          payload: { headers: { name: string; value: string }[] };
        };
        const from = d.payload.headers.find((h) => h.name === "From")?.value ?? "";
        const subject = d.payload.headers.find((h) => h.name === "Subject")?.value ?? "(no subject)";
        return { from, subject, snippet: d.snippet };
      }),
    );

    return details
      .filter((r): r is PromiseFulfilledResult<{ from: string; subject: string; snippet: string }> =>
        r.status === "fulfilled" && r.value !== null,
      )
      .map((r) => r.value);
  }

  // ─── Google Docs ──────────────────────────────────────────────────────────

  async createDocument(
    accessToken: string,
    title: string,
    content: string,
  ): Promise<{ id: string; url: string }> {
    const createResp = await fetch("https://docs.googleapis.com/v1/documents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title }),
    });
    if (!createResp.ok) throw new Error(`Google Doc create failed: ${createResp.statusText}`);
    const doc = (await createResp.json()) as { documentId: string };

    // Insert content
    await fetch(`https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: content,
            },
          },
        ],
      }),
    });

    return {
      id: doc.documentId,
      url: `https://docs.google.com/document/d/${doc.documentId}/edit`,
    };
  }
}
