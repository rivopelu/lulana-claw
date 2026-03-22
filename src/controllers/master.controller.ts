import type { Context } from "hono";
import { Controller, Get, Middleware } from "hono-decorators";
import { responseHelper } from "../libs/response-helper";
import JwtMiddleware from "../middleware/jwt-middleware";
import { clientTypeEnum } from "../entities/pg/client.entity";
import { aiProviderEnum } from "../entities/pg/ai-model.entity";

const OPENAI_MODELS = [
  { id: "gpt-4o", name: "GPT-4o", context_window: 128000 },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", context_window: 128000 },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", context_window: 128000 },
  { id: "gpt-4", name: "GPT-4", context_window: 8192 },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", context_window: 16385 },
];

const AI_MODELS_BY_PROVIDER: Record<string, typeof OPENAI_MODELS> = {
  openai: OPENAI_MODELS,
};

@Controller("master")
export class MasterController {
  @Get("client-types")
  @Middleware([JwtMiddleware])
  getClientTypes(c: Context) {
    return c.json(responseHelper.data(clientTypeEnum.enumValues));
  }

  @Get("ai-providers")
  @Middleware([JwtMiddleware])
  getAiProviders(c: Context) {
    return c.json(responseHelper.data(aiProviderEnum.enumValues));
  }

  @Get("ai-models")
  @Middleware([JwtMiddleware])
  getAiModels(c: Context) {
    const provider = c.req.query("provider") ?? "openai";
    const models = AI_MODELS_BY_PROVIDER[provider] ?? OPENAI_MODELS;
    return c.json(responseHelper.data(models));
  }
}
