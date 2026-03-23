import type { Context } from "hono";
import { Controller, Delete, Get, Middleware, Post, Put } from "hono-decorators";
import { responseHelper } from "../libs/response-helper";
import JwtMiddleware from "../middleware/jwt-middleware";
import { getAccountId, getPaginationParam } from "../libs/utils";
import ClientService from "../services/client.service";
import type { RequestCreateClient } from "../types/request/request-create-client";
import type { RequestUpdateClient } from "../types/request/request-update-client";
import type { RequestUpsertCredential } from "../types/request/request-upsert-credential";
import { BadRequestException } from "../libs/exception";
import AiModelRepository from "../repositories/ai-model.repository";

@Controller("client")
@Middleware([JwtMiddleware])
export class ClientController {
  private clientService = new ClientService();
  private aiModelRepository = new AiModelRepository();

  @Post("")
  async createClient(c: Context) {
    const body = await c.req.json<RequestCreateClient>();
    const accountId = getAccountId(c);
    await this.clientService.createClient(body, accountId);
    return c.json(responseHelper.success("Client created"));
  }

  @Get("")
  async getClients(c: Context) {
    const accountId = getAccountId(c);
    const params = getPaginationParam(c);
    const { data, total } = await this.clientService.getClients(accountId, params);
    return c.json(
      responseHelper.paginated(data, {
        page: params.page,
        size: params.size,
        totalData: total,
      }),
    );
  }

  @Get(":id")
  async getClientById(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    const client = await this.clientService.getClientById(id, accountId);
    return c.json(responseHelper.data(client));
  }

  @Put(":id")
  async updateClient(c: Context) {
    const id = c.req.param("id");
    const body = await c.req.json<RequestUpdateClient>();
    const accountId = getAccountId(c);
    await this.clientService.updateClient(id, body, accountId);
    return c.json(responseHelper.success("Client updated"));
  }

  @Delete(":id")
  async deleteClient(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    await this.clientService.deleteClient(id, accountId);
    return c.json(responseHelper.success("Client deleted"));
  }

  @Put(":id/entity-mode")
  async setEntityMode(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    const { entity_mode } = await c.req.json<{ entity_mode: "single" | "per_session" }>();
    if (entity_mode !== "single" && entity_mode !== "per_session") {
      throw new BadRequestException("entity_mode must be 'single' or 'per_session'");
    }
    await this.clientService.setEntityMode(id, entity_mode, accountId);
    return c.json(responseHelper.success("Entity mode updated"));
  }

  @Put(":id/model")
  async setModel(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    const { ai_model_id } = await c.req.json<{ ai_model_id: string | null }>();

    if (ai_model_id) {
      const model = await this.aiModelRepository.findByIdAndAccountId(ai_model_id, accountId);
      if (!model) throw new BadRequestException("AI model not found");
    }

    await this.clientService.setClientModel(id, ai_model_id ?? null, accountId);
    return c.json(responseHelper.success("Client model updated"));
  }

  @Post(":id/credential")
  async addCredential(c: Context) {
    const clientId = c.req.param("id");
    const body = await c.req.json<RequestUpsertCredential>();
    const accountId = getAccountId(c);
    await this.clientService.addCredential(clientId, body, accountId);
    return c.json(responseHelper.success("Credential added"));
  }

  @Put(":id/credential/:credentialId")
  async updateCredential(c: Context) {
    const clientId = c.req.param("id");
    const credentialId = c.req.param("credentialId");
    const body = await c.req.json<RequestUpsertCredential>();
    const accountId = getAccountId(c);
    await this.clientService.updateCredential(clientId, credentialId, body, accountId);
    return c.json(responseHelper.success("Credential updated"));
  }

  @Delete(":id/credential/:credentialId")
  async deleteCredential(c: Context) {
    const clientId = c.req.param("id");
    const credentialId = c.req.param("credentialId");
    const accountId = getAccountId(c);
    await this.clientService.deleteCredential(clientId, credentialId, accountId);
    return c.json(responseHelper.success("Credential deleted"));
  }
}
