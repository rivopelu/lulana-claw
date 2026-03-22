import type { Context } from "hono";
import { Controller, Delete, Get, Middleware, Post, Put } from "hono-decorators";
import { responseHelper } from "../libs/response-helper";
import JwtMiddleware from "../middleware/jwt-middleware";
import { getAccountId } from "../libs/utils";
import AiModelService from "../services/ai-model.service";
import type { RequestCreateAiModel } from "../types/request/request-create-ai-model";
import type { RequestUpdateAiModel } from "../types/request/request-update-ai-model";

@Controller("ai-model")
@Middleware([JwtMiddleware])
export class AiModelController {
  private aiModelService = new AiModelService();

  @Post("")
  async create(c: Context) {
    const body = await c.req.json<RequestCreateAiModel>();
    const accountId = getAccountId(c);
    await this.aiModelService.create(body, accountId);
    return c.json(responseHelper.success("AI model created"));
  }

  @Get("")
  async getAll(c: Context) {
    const accountId = getAccountId(c);
    const models = await this.aiModelService.getAll(accountId);
    return c.json(responseHelper.data(models));
  }

  @Get(":id")
  async getById(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    const model = await this.aiModelService.getById(id, accountId);
    return c.json(responseHelper.data(model));
  }

  @Put(":id")
  async update(c: Context) {
    const id = c.req.param("id");
    const body = await c.req.json<RequestUpdateAiModel>();
    const accountId = getAccountId(c);
    await this.aiModelService.update(id, body, accountId);
    return c.json(responseHelper.success("AI model updated"));
  }

  @Delete(":id")
  async delete(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    await this.aiModelService.delete(id, accountId);
    return c.json(responseHelper.success("AI model deleted"));
  }
}
