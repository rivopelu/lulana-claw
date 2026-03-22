import type { Context } from "hono";
import { Controller, Get, Middleware } from "hono-decorators";
import { responseHelper } from "../libs/response-helper";
import JwtMiddleware from "../middleware/jwt-middleware";
import { clientTypeEnum } from "../entities/pg/client.entity";

@Controller("master")
export class MasterController {
  @Get("client-types")
  @Middleware([JwtMiddleware])
  getClientTypes(c: Context) {
    return c.json(responseHelper.data(clientTypeEnum.enumValues));
  }
}
