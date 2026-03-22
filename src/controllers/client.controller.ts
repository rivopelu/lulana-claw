import type { Context } from "hono";
import { Controller, Delete, Get, Middleware, Post, Put } from "hono-decorators";
import { responseHelper } from "../libs/response-helper";
import JwtMiddleware from "../middleware/jwt-middleware";
import { getAccountId, getPaginationParam } from "../libs/utils";
import ClientService from "../services/client.service";
import type { RequestCreateClient } from "../types/request/request-create-client";
import type { RequestUpdateClient } from "../types/request/request-update-client";
import type { RequestUpsertCredential } from "../types/request/request-upsert-credential";

@Controller("client")
@Middleware([JwtMiddleware])
export class ClientController {
  private clientService = new ClientService();

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
