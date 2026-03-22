import ClientRepository from "../repositories/client.repository";
import ClientCredentialRepository from "../repositories/client-credential.repository";
import type { RequestCreateClient } from "../types/request/request-create-client";
import type { RequestUpdateClient } from "../types/request/request-update-client";
import type { RequestUpsertCredential } from "../types/request/request-upsert-credential";
import type {
  ResponseClient,
  ResponseClientCredential,
  ResponseClientSummary,
} from "../types/response/response-client";
import type { IPaginationParams } from "../types/paginated-params";
import { BadRequestException, NotFoundException } from "../libs/exception";
import { generateId } from "../libs/string-utils";

export default class ClientService {
  private clientRepository = new ClientRepository();
  private credentialRepository = new ClientCredentialRepository();

  async createClient(body: RequestCreateClient, accountId: string): Promise<void> {
    const clientId = generateId();

    await this.clientRepository.save({
      id: clientId,
      account_id: accountId,
      name: body.name,
      type: body.type,
      created_by: accountId,
    });

    for (const cred of body.credentials) {
      await this.credentialRepository.save({
        id: generateId(),
        client_id: clientId,
        key: cred.key,
        value: cred.value,
        created_by: accountId,
      });
    }
  }

  async getClients(accountId: string, params: IPaginationParams) {
    const { data, total } = await this.clientRepository.findAll(accountId, params);

    const result: ResponseClientSummary[] = data.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      active: c.active,
      created_date: c.created_date,
    }));

    return { data: result, total };
  }

  async getClientById(id: string, accountId: string): Promise<ResponseClient> {
    const client = await this.clientRepository.findByIdAndAccountId(id, accountId);
    if (!client) throw new NotFoundException("Client not found");

    const credentials = await this.credentialRepository.findByClientId(id);

    const credentialResult: ResponseClientCredential[] = credentials.map((c) => ({
      id: c.id,
      key: c.key,
      value: c.value,
    }));

    return {
      id: client.id,
      name: client.name,
      type: client.type,
      credentials: credentialResult,
      active: client.active,
      created_date: client.created_date,
    };
  }

  async updateClient(id: string, body: RequestUpdateClient, accountId: string): Promise<void> {
    const client = await this.clientRepository.findByIdAndAccountId(id, accountId);
    if (!client) throw new NotFoundException("Client not found");

    await this.clientRepository.update(id, {
      name: body.name,
      updated_by: accountId,
      updated_date: Date.now(),
    });
  }

  async deleteClient(id: string, accountId: string): Promise<void> {
    const client = await this.clientRepository.findByIdAndAccountId(id, accountId);
    if (!client) throw new NotFoundException("Client not found");

    await this.clientRepository.update(id, {
      active: false,
      deleted_by: accountId,
      deleted_date: Date.now(),
    });
  }

  async addCredential(
    clientId: string,
    body: RequestUpsertCredential,
    accountId: string,
  ): Promise<void> {
    const client = await this.clientRepository.findByIdAndAccountId(clientId, accountId);
    if (!client) throw new NotFoundException("Client not found");

    const existing = await this.credentialRepository.findByClientIdAndKey(clientId, body.key);
    if (existing) throw new BadRequestException(`Credential key "${body.key}" already exists`);

    await this.credentialRepository.save({
      id: generateId(),
      client_id: clientId,
      key: body.key,
      value: body.value,
      created_by: accountId,
    });
  }

  async updateCredential(
    clientId: string,
    credentialId: string,
    body: RequestUpsertCredential,
    accountId: string,
  ): Promise<void> {
    const client = await this.clientRepository.findByIdAndAccountId(clientId, accountId);
    if (!client) throw new NotFoundException("Client not found");

    const credential = await this.credentialRepository.findById(credentialId);
    if (!credential || credential.client_id !== clientId)
      throw new NotFoundException("Credential not found");

    await this.credentialRepository.update(credentialId, {
      key: body.key,
      value: body.value,
      updated_by: accountId,
      updated_date: Date.now(),
    });
  }

  async deleteCredential(clientId: string, credentialId: string, accountId: string): Promise<void> {
    const client = await this.clientRepository.findByIdAndAccountId(clientId, accountId);
    if (!client) throw new NotFoundException("Client not found");

    const credential = await this.credentialRepository.findById(credentialId);
    if (!credential || credential.client_id !== clientId)
      throw new NotFoundException("Credential not found");

    await this.credentialRepository.update(credentialId, {
      active: false,
      deleted_by: accountId,
      deleted_date: Date.now(),
    });
  }
}
