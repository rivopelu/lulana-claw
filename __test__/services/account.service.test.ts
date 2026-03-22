import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

// Prevent real DB connection
mock.module("pg", () => ({ Pool: mock(() => ({})) }));
mock.module("../../src/database/database", () => ({ db: {} }));

import AccountRepository from "../../src/repositories/account.repository";
import AccountService from "../../src/services/account.service";
import type { Account } from "../../src/entities/pg/account.entity";

const mockAccount: Account = {
  id: "ACCOUNT001",
  email: "test@example.com",
  name: "Test User",
  password: "hashed-password",
  profile_picture: "https://example.com/avatar.png",
  active: true,
  created_date: 1700000000000,
  created_by: "SYSTEM",
  updated_date: null,
  updated_by: null,
  deleted_date: null,
  deleted_by: null,
};

describe("AccountService", () => {
  let service: AccountService;

  beforeEach(() => {
    service = new AccountService();
  });

  describe("getAccountDataByAccount", () => {
    it("should map account entity to response DTO", async () => {
      const result = await service.getAccountDataByAccount(mockAccount);

      expect(result.id).toBe(mockAccount.id);
      expect(result.email).toBe(mockAccount.email);
      expect(result.name).toBe(mockAccount.name);
      expect(result.profile_picture).toBe(mockAccount.profile_picture);
    });

    it("should not expose password or audit fields", async () => {
      const result = await service.getAccountDataByAccount(mockAccount);

      expect((result as any).password).toBeUndefined();
      expect((result as any).created_by).toBeUndefined();
      expect((result as any).active).toBeUndefined();
    });
  });

  describe("getAccountDataById", () => {
    it("should return account data for a valid id", async () => {
      spyOn(AccountRepository.prototype, "findById").mockResolvedValue(mockAccount);

      const result = await service.getAccountDataById("ACCOUNT001");

      expect(result.id).toBe("ACCOUNT001");
      expect(result.email).toBe("test@example.com");
    });

    it("should propagate when account is not found", async () => {
      spyOn(AccountRepository.prototype, "findById").mockResolvedValue(undefined as any);

      // Service delegates to getAccountDataByAccount which accesses fields on undefined
      await expect(service.getAccountDataById("MISSING")).rejects.toThrow();
    });
  });
});
