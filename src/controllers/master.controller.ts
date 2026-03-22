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
  { id: "o4-mini", name: "o4 Mini (Reasoning)", context_window: 200000 },
  { id: "o3", name: "o3 (Reasoning)", context_window: 200000 },
  { id: "o1", name: "o1 (Reasoning)", context_window: 200000 },
  { id: "o1-mini", name: "o1 Mini (Reasoning)", context_window: 128000 },
  { id: "codex-mini-latest", name: "Codex Mini (Latest)", context_window: 200000 },
];

const OPENROUTER_MODELS = [
  { id: "openai/o4-mini", name: "OpenAI o4 Mini", context_window: 200000 },
  { id: "openai/o3", name: "OpenAI o3", context_window: 200000 },
  { id: "openai/gpt-4o", name: "GPT-4o", context_window: 128000 },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", context_window: 128000 },
  { id: "openai/gpt-3.5-turbo", name: "GPT-3.5 Turbo", context_window: 16385 },
  { id: "anthropic/claude-sonnet-4-5", name: "Claude Sonnet 4.5", context_window: 200000 },
  { id: "anthropic/claude-3-5-sonnet", name: "Claude 3.5 Sonnet", context_window: 200000 },
  { id: "anthropic/claude-3-haiku", name: "Claude 3 Haiku", context_window: 200000 },
  { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", context_window: 1048576 },
  { id: "google/gemini-pro-1.5", name: "Gemini Pro 1.5", context_window: 1000000 },
  { id: "meta-llama/llama-3.1-8b-instruct", name: "Llama 3.1 8B Instruct", context_window: 131072 },
  {
    id: "meta-llama/llama-3.1-70b-instruct",
    name: "Llama 3.1 70B Instruct",
    context_window: 131072,
  },
  { id: "mistralai/mistral-7b-instruct", name: "Mistral 7B Instruct", context_window: 32768 },
];

const GEMINI_MODELS = [
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", context_window: 1048576 },
  { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", context_window: 1048576 },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", context_window: 2097152 },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", context_window: 1048576 },
  { id: "gemini-1.5-flash-8b", name: "Gemini 1.5 Flash 8B", context_window: 1048576 },
];

const ANTHROPIC_MODELS = [
  { id: "claude-opus-4-5", name: "Claude Opus 4.5", context_window: 200000 },
  { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", context_window: 200000 },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", context_window: 200000 },
  { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", context_window: 200000 },
  { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", context_window: 200000 },
  { id: "claude-3-opus-20240229", name: "Claude 3 Opus", context_window: 200000 },
];

const AI_MODELS_BY_PROVIDER: Record<string, typeof OPENAI_MODELS> = {
  openai: OPENAI_MODELS,
  openrouter: OPENROUTER_MODELS,
  gemini: GEMINI_MODELS,
  anthropic: ANTHROPIC_MODELS,
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
