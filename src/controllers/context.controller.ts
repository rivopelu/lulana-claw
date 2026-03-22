import type { Context } from "hono";
import { Controller, Delete, Get, Middleware, Post, Put } from "hono-decorators";
import { responseHelper } from "../libs/response-helper";
import JwtMiddleware from "../middleware/jwt-middleware";
import { getAccountId } from "../libs/utils";
import ContextService, {
  type RequestCreateContext,
  type RequestUpdateContext,
} from "../services/context.service";

@Controller("context")
@Middleware([JwtMiddleware])
export class ContextController {
  private contextService = new ContextService();

  /** GET /context — list all contexts for the account */
  @Get("")
  async getAll(c: Context) {
    const accountId = getAccountId(c);
    const list = await this.contextService.getAll(accountId);
    return c.json(responseHelper.data(list));
  }

  /** GET /context/:id */
  @Get(":id")
  async getById(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    const ctx = await this.contextService.getById(id, accountId);
    return c.json(responseHelper.data(ctx));
  }

  /** POST /context */
  @Post("")
  async create(c: Context) {
    const accountId = getAccountId(c);
    const body = await c.req.json<RequestCreateContext>();
    const ctx = await this.contextService.create(body, accountId);
    return c.json(responseHelper.data(ctx), 201);
  }

  /** PUT /context/:id */
  @Put(":id")
  async update(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    const body = await c.req.json<RequestUpdateContext>();
    await this.contextService.update(id, body, accountId);
    return c.json(responseHelper.success("Context updated"));
  }

  /** DELETE /context/:id */
  @Delete(":id")
  async delete(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    await this.contextService.delete(id, accountId);
    return c.json(responseHelper.success("Context deleted"));
  }
}
