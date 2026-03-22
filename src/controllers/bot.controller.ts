import type { Context } from "hono";
import { Controller, Get, Middleware, Post } from "hono-decorators";
import { responseHelper } from "../libs/response-helper";
import JwtMiddleware from "../middleware/jwt-middleware";
import { getAccountId } from "../libs/utils";
import BotService from "../services/bot.service";

@Controller("bot")
@Middleware([JwtMiddleware])
export class BotController {
  private botService = new BotService();

  /** GET /bot/statuses — returns all in-memory bot statuses */
  @Get("statuses")
  async getAllStatuses(c: Context) {
    const statuses = this.botService.getAllBotStatuses();
    return c.json(responseHelper.data(statuses));
  }

  /** GET /bot/:clientId/status */
  @Get(":clientId/status")
  async getStatus(c: Context) {
    const clientId = c.req.param("clientId");
    const status = this.botService.getBotStatus(clientId);
    return c.json(responseHelper.data(status));
  }

  /** POST /bot/:clientId/start */
  @Post(":clientId/start")
  async start(c: Context) {
    const clientId = c.req.param("clientId");
    const accountId = getAccountId(c);
    const result = await this.botService.startBot(clientId, accountId);
    return c.json(responseHelper.data(result));
  }

  /** POST /bot/:clientId/stop */
  @Post(":clientId/stop")
  async stop(c: Context) {
    const clientId = c.req.param("clientId");
    const accountId = getAccountId(c);
    const result = await this.botService.stopBot(clientId, accountId);
    return c.json(responseHelper.data(result));
  }

  /** POST /bot/:clientId/restart */
  @Post(":clientId/restart")
  async restart(c: Context) {
    const clientId = c.req.param("clientId");
    const accountId = getAccountId(c);
    const result = await this.botService.restartBot(clientId, accountId);
    return c.json(responseHelper.data(result));
  }
}
