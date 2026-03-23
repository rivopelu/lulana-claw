import type { Context } from "hono";
import { Controller, Delete, Get, Middleware, Post } from "hono-decorators";
import { responseHelper } from "../libs/response-helper";
import JwtMiddleware from "../middleware/jwt-middleware";
import { getAccountId } from "../libs/utils";
import AppService from "../services/app.service";

@Controller("app")
@Middleware([JwtMiddleware])
export class AppController {
  private appService = new AppService();

  @Get("")
  async listConnections(c: Context) {
    const accountId = getAccountId(c);
    const connections = await this.appService.listConnections(accountId);
    return c.json(responseHelper.data(connections));
  }

  @Get("google/auth-url")
  async getGoogleAuthUrl(c: Context) {
    const url = this.appService.getGoogleAuthUrl();
    return c.json(responseHelper.data({ url }));
  }

  @Post("google/connect")
  async connectGoogle(c: Context) {
    const accountId = getAccountId(c);
    const { code } = await c.req.json<{ code: string }>();
    const conn = await this.appService.connectGoogle(code, accountId);
    return c.json(responseHelper.data(conn), 201);
  }

  @Delete(":id")
  async disconnect(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    await this.appService.disconnect(id, accountId);
    return c.json(responseHelper.success("App disconnected"));
  }
}
