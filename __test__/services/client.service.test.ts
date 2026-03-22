import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

// Prevent real DB connection
mock.module("pg", () => ({ Pool: mock(() => ({})) }));
mock.module("../../src/database/database", () => ({ db: {} }));

import ClientRepository from "../../src/repositories/client.repository";
import ClientCredentialRepository from "../../src/repositories/client-credential.repository";
import ClientService from "../../src/services/client.service";
import type { Client } from "../../src/entities/pg/client.entity";
import type { ClientCredential } from "../../src/entities/pg/client-credential.entity";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ACCOUNT_ID = "ACCOUNT001";
const CLIENT_ID = "CLIENT001";
const CRED_ID = "CRED001";

const mockClient: Client = {
  id: CLIENT_ID,
  account_id: ACCOUNT_ID,
  name: "Lula Telegram Bot",
  type: "telegram",
  active: true,
  created_date: 1700000000000,
  created_by: ACCOUNT_ID,
  updated_date: null,
  updated_by: null,
  deleted_date: null,
  deleted_by: null,
};

const mockCredential: ClientCredential = {
  id: CRED_ID,
  client_id: CLIENT_ID,
  key: "bot_token",
  value: "12345:TOKEN",
  active: true,
  created_date: 1700000000000,
  created_by: ACCOUNT_ID,
  updated_date: null,
  updated_by: null,
  deleted_date: null,
  deleted_by: null,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ClientService", () => {
  let service: ClientService;
  let clientFindAll: ReturnType<typeof spyOn>;
  let clientFindById: ReturnType<typeof spyOn>;
  let clientSave: ReturnType<typeof spyOn>;
  let clientUpdate: ReturnType<typeof spyOn>;
  let credFindByClientId: ReturnType<typeof spyOn>;
  let credFindById: ReturnType<typeof spyOn>;
  let credFindByClientIdAndKey: ReturnType<typeof spyOn>;
  let credSave: ReturnType<typeof spyOn>;
  let credUpdate: ReturnType<typeof spyOn>;

  beforeEach(() => {
    service = new ClientService();
    clientFindAll = spyOn(ClientRepository.prototype, "findAll").mockResolvedValue({
      data: [],
      total: 0,
    });
    clientFindById = spyOn(ClientRepository.prototype, "findByIdAndAccountId").mockResolvedValue(
      mockClient,
    );
    clientSave = spyOn(ClientRepository.prototype, "save").mockResolvedValue(undefined);
    clientUpdate = spyOn(ClientRepository.prototype, "update").mockResolvedValue(undefined);
    credFindByClientId = spyOn(
      ClientCredentialRepository.prototype,
      "findByClientId",
    ).mockResolvedValue([]);
    credFindById = spyOn(ClientCredentialRepository.prototype, "findById").mockResolvedValue(
      mockCredential,
    );
    credFindByClientIdAndKey = spyOn(
      ClientCredentialRepository.prototype,
      "findByClientIdAndKey",
    ).mockResolvedValue(undefined);
    credSave = spyOn(ClientCredentialRepository.prototype, "save").mockResolvedValue(undefined);
    credUpdate = spyOn(ClientCredentialRepository.prototype, "update").mockResolvedValue(undefined);
  });

  afterEach(() => {
    mock.restore();
  });

  // ─── createClient ──────────────────────────────────────────────────────────

  describe("createClient", () => {
    it("should save client and each credential", async () => {
      await service.createClient(
        { name: "My Bot", type: "telegram", credentials: [{ key: "bot_token", value: "TOKEN" }] },
        ACCOUNT_ID,
      );

      expect(clientSave).toHaveBeenCalledTimes(1);
      expect(credSave).toHaveBeenCalledTimes(1);
    });

    it("should save multiple credentials", async () => {
      await service.createClient(
        {
          name: "My Bot",
          type: "telegram",
          credentials: [
            { key: "bot_token", value: "TOKEN" },
            { key: "webhook_url", value: "https://example.com" },
          ],
        },
        ACCOUNT_ID,
      );

      expect(credSave).toHaveBeenCalledTimes(2);
    });

    it("should persist correct account_id and type", async () => {
      await service.createClient({ name: "Bot", type: "telegram", credentials: [] }, ACCOUNT_ID);

      const saved = clientSave.mock.calls[0][0] as Client;
      expect(saved.account_id).toBe(ACCOUNT_ID);
      expect(saved.type).toBe("telegram");
    });

    it("should not call credential save when credentials array is empty", async () => {
      await service.createClient({ name: "Bot", type: "telegram", credentials: [] }, ACCOUNT_ID);

      expect(credSave).not.toHaveBeenCalled();
    });
  });

  // ─── getClients ────────────────────────────────────────────────────────────

  describe("getClients", () => {
    it("should return paginated client summaries", async () => {
      clientFindAll.mockResolvedValue({ data: [mockClient], total: 1 });

      const result = await service.getClients(ACCOUNT_ID, { page: 0, size: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.data[0].id).toBe(CLIENT_ID);
    });

    it("should return empty list when no clients exist", async () => {
      const result = await service.getClients(ACCOUNT_ID, { page: 0, size: 10 });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("should map entity fields correctly to summary DTO", async () => {
      clientFindAll.mockResolvedValue({ data: [mockClient], total: 1 });

      const result = await service.getClients(ACCOUNT_ID, { page: 0, size: 10 });
      const summary = result.data[0];

      expect(summary.id).toBe(mockClient.id);
      expect(summary.name).toBe(mockClient.name);
      expect(summary.type).toBe(mockClient.type);
      expect(summary.active).toBe(true);
    });

    it("should not expose credentials in list response", async () => {
      clientFindAll.mockResolvedValue({ data: [mockClient], total: 1 });

      const result = await service.getClients(ACCOUNT_ID, { page: 0, size: 10 });

      expect((result.data[0] as any).credentials).toBeUndefined();
    });
  });

  // ─── getClientById ─────────────────────────────────────────────────────────

  describe("getClientById", () => {
    it("should return client with credentials", async () => {
      credFindByClientId.mockResolvedValue([mockCredential]);

      const result = await service.getClientById(CLIENT_ID, ACCOUNT_ID);

      expect(result.id).toBe(CLIENT_ID);
      expect(result.credentials).toHaveLength(1);
      expect(result.credentials[0].key).toBe("bot_token");
    });

    it("should throw when client not found", async () => {
      clientFindById.mockResolvedValue(undefined);

      await expect(service.getClientById("MISSING", ACCOUNT_ID)).rejects.toThrow();
    });

    it("should return empty credentials when client has none", async () => {
      const result = await service.getClientById(CLIENT_ID, ACCOUNT_ID);

      expect(result.credentials).toHaveLength(0);
    });

    it("should not expose account_id or audit fields in response", async () => {
      const result = await service.getClientById(CLIENT_ID, ACCOUNT_ID);

      expect((result as any).account_id).toBeUndefined();
      expect((result as any).created_by).toBeUndefined();
    });
  });

  // ─── updateClient ──────────────────────────────────────────────────────────

  describe("updateClient", () => {
    it("should call update with new name and updated_by", async () => {
      await service.updateClient(CLIENT_ID, { name: "New Name" }, ACCOUNT_ID);

      const updated = clientUpdate.mock.calls[0][1] as Partial<Client>;
      expect(updated.name).toBe("New Name");
      expect(updated.updated_by).toBe(ACCOUNT_ID);
      expect(updated.updated_date).toBeDefined();
    });

    it("should throw when client not found", async () => {
      clientFindById.mockResolvedValue(undefined);

      await expect(service.updateClient("MISSING", { name: "X" }, ACCOUNT_ID)).rejects.toThrow();
    });

    it("should not call update when client not found", async () => {
      clientFindById.mockResolvedValue(undefined);

      await expect(service.updateClient("MISSING", { name: "X" }, ACCOUNT_ID)).rejects.toThrow();
      expect(clientUpdate).not.toHaveBeenCalled();
    });
  });

  // ─── deleteClient ──────────────────────────────────────────────────────────

  describe("deleteClient", () => {
    it("should set active=false and deleted_by on soft delete", async () => {
      await service.deleteClient(CLIENT_ID, ACCOUNT_ID);

      const updated = clientUpdate.mock.calls[0][1] as Partial<Client>;
      expect(updated.active).toBe(false);
      expect(updated.deleted_by).toBe(ACCOUNT_ID);
      expect(updated.deleted_date).toBeDefined();
    });

    it("should throw when client not found", async () => {
      clientFindById.mockResolvedValue(undefined);

      await expect(service.deleteClient("MISSING", ACCOUNT_ID)).rejects.toThrow();
    });
  });

  // ─── addCredential ─────────────────────────────────────────────────────────

  describe("addCredential", () => {
    it("should save a new credential", async () => {
      await service.addCredential(
        CLIENT_ID,
        { key: "webhook_url", value: "https://x.com" },
        ACCOUNT_ID,
      );

      expect(credSave).toHaveBeenCalledTimes(1);
      const saved = credSave.mock.calls[0][0] as ClientCredential;
      expect(saved.key).toBe("webhook_url");
      expect(saved.client_id).toBe(CLIENT_ID);
    });

    it("should throw when credential key already exists", async () => {
      credFindByClientIdAndKey.mockResolvedValue(mockCredential);

      await expect(
        service.addCredential(CLIENT_ID, { key: "bot_token", value: "NEW" }, ACCOUNT_ID),
      ).rejects.toThrow();
    });

    it("should throw when client not found", async () => {
      clientFindById.mockResolvedValue(undefined);

      await expect(
        service.addCredential("MISSING", { key: "bot_token", value: "TOKEN" }, ACCOUNT_ID),
      ).rejects.toThrow();
    });

    it("should not call credential save when client not found", async () => {
      clientFindById.mockResolvedValue(undefined);

      await expect(
        service.addCredential("MISSING", { key: "k", value: "v" }, ACCOUNT_ID),
      ).rejects.toThrow();
      expect(credSave).not.toHaveBeenCalled();
    });
  });

  // ─── updateCredential ──────────────────────────────────────────────────────

  describe("updateCredential", () => {
    it("should update key and value", async () => {
      await service.updateCredential(
        CLIENT_ID,
        CRED_ID,
        { key: "bot_token", value: "NEW_TOKEN" },
        ACCOUNT_ID,
      );

      const updated = credUpdate.mock.calls[0][1] as Partial<ClientCredential>;
      expect(updated.value).toBe("NEW_TOKEN");
      expect(updated.updated_by).toBe(ACCOUNT_ID);
    });

    it("should throw when client not found", async () => {
      clientFindById.mockResolvedValue(undefined);

      await expect(
        service.updateCredential("MISSING", CRED_ID, { key: "k", value: "v" }, ACCOUNT_ID),
      ).rejects.toThrow();
    });

    it("should throw when credential belongs to a different client", async () => {
      credFindById.mockResolvedValue({ ...mockCredential, client_id: "OTHER_CLIENT" });

      await expect(
        service.updateCredential(CLIENT_ID, CRED_ID, { key: "k", value: "v" }, ACCOUNT_ID),
      ).rejects.toThrow();
    });

    it("should throw when credential not found", async () => {
      credFindById.mockResolvedValue(undefined);

      await expect(
        service.updateCredential(CLIENT_ID, CRED_ID, { key: "k", value: "v" }, ACCOUNT_ID),
      ).rejects.toThrow();
    });
  });

  // ─── deleteCredential ──────────────────────────────────────────────────────

  describe("deleteCredential", () => {
    it("should set active=false on soft delete", async () => {
      await service.deleteCredential(CLIENT_ID, CRED_ID, ACCOUNT_ID);

      const updated = credUpdate.mock.calls[0][1] as Partial<ClientCredential>;
      expect(updated.active).toBe(false);
      expect(updated.deleted_by).toBe(ACCOUNT_ID);
    });

    it("should throw when client not found", async () => {
      clientFindById.mockResolvedValue(undefined);

      await expect(service.deleteCredential("MISSING", CRED_ID, ACCOUNT_ID)).rejects.toThrow();
    });

    it("should throw when credential belongs to a different client", async () => {
      credFindById.mockResolvedValue({ ...mockCredential, client_id: "OTHER_CLIENT" });

      await expect(service.deleteCredential(CLIENT_ID, CRED_ID, ACCOUNT_ID)).rejects.toThrow();
    });
  });
});
