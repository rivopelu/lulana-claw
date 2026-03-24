import type { Context } from "hono";
import { Controller, Get, Post } from "hono-decorators";
import logger from "../configs/logger";
import { env } from "../configs/env";

/**
 * Public webhook endpoint for Meta Threads API.
 * No JWT middleware — Meta's servers call this directly.
 *
 * GET  /api/threads/webhook  — webhook verification (hub.challenge handshake)
 * POST /api/threads/webhook  — incoming webhook events (replies, mentions, etc.)
 */
@Controller("app/threads/callback")
export class ThreadsWebhookController {
  @Get("")
  handleVerification(c: Context) {
    const mode = c.req.query("hub.mode");
    const token = c.req.query("hub.verify_token");
    const challenge = c.req.query("hub.challenge");

    const verifyToken = env.THREADS_VERIFY_TOKEN;

    if (mode === "subscribe" && token === verifyToken) {
      logger.info("[Threads] Webhook verified successfully");
      return c.text(challenge ?? "", 200);
    }

    logger.warn(`[Threads] Webhook verification failed — token mismatch or missing`);
    return c.text("Forbidden", 403);
  }

  @Post("")
  async handleEvent(c: Context) {
    try {
      const body = await c.req.json();
      logger.info(`[Threads] Webhook event received: ${JSON.stringify(body)}`);
      // TODO: handle reply events — parse entry[].changes[].value and reply via Threads API
    } catch (e) {
      logger.warn(`[Threads] Failed to parse webhook body: ${(e as Error).message}`);
    }
    return c.text("OK", 200);
  }
}
