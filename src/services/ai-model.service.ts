import AiModelRepository from "../repositories/ai-model.repository";
import type { RequestCreateAiModel } from "../types/request/request-create-ai-model";
import type { RequestUpdateAiModel } from "../types/request/request-update-ai-model";
import type { ResponseAiModel } from "../types/response/response-ai-model";
import { NotFoundException } from "../libs/exception";
import { generateId } from "../libs/string-utils";

function maskApiKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return `...${key.slice(-6)}`;
}

function toResponse(m: {
  id: string;
  name: string;
  model_id: string;
  provider: string;
  api_key: string;
  active: boolean;
  base_url?: string | null;
  created_date: number;
}): ResponseAiModel {
  return {
    id: m.id,
    name: m.name,
    model_id: m.model_id,
    provider: m.provider,
    api_key_hint: maskApiKey(m.api_key),
    active: m.active,
    base_url: m.base_url ?? undefined,
    created_date: m.created_date,
  };
}

export default class AiModelService {
  private repository = new AiModelRepository();

  async create(body: RequestCreateAiModel, accountId: string): Promise<void> {
    await this.repository.save({
      id: generateId(),
      account_id: accountId,
      name: body.name,
      model_id: body.model_id,
      provider: body.provider,
      api_key: body.api_key,
      base_url: body.base_url,
      created_by: accountId,
    });
  }

  async getAll(accountId: string): Promise<ResponseAiModel[]> {
    const models = await this.repository.findAll(accountId);
    return models.map(toResponse);
  }

  async getById(id: string, accountId: string): Promise<ResponseAiModel> {
    const model = await this.repository.findByIdAndAccountId(id, accountId);
    if (!model) throw new NotFoundException("AI model not found");
    return toResponse(model);
  }

  async update(id: string, body: RequestUpdateAiModel, accountId: string): Promise<void> {
    const model = await this.repository.findByIdAndAccountId(id, accountId);
    if (!model) throw new NotFoundException("AI model not found");

    await this.repository.update(id, {
      ...(body.name && { name: body.name }),
      ...(body.model_id && { model_id: body.model_id }),
      ...(body.provider && {
        provider: body.provider as any,
      }),
      ...(body.api_key && { api_key: body.api_key }),
      ...(body.base_url !== undefined && { base_url: body.base_url }),
      updated_by: accountId,
      updated_date: Date.now(),
    });
  }

  async delete(id: string, accountId: string): Promise<void> {
    const model = await this.repository.findByIdAndAccountId(id, accountId);
    if (!model) throw new NotFoundException("AI model not found");

    await this.repository.update(id, {
      active: false,
      deleted_by: accountId,
      deleted_date: Date.now(),
    });
  }
}
