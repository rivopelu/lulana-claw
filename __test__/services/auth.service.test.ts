import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

// Prevent real DB connection
mock.module("pg", () => ({ Pool: mock(() => ({})) }));
mock.module("../../src/database/database", () => ({ db: {} }));

// Mock i18next
mock.module("i18next", () => ({ t: (key: string) => key }));

// Mock env config
mock.module("../../src/configs/env", () => ({
  env: {
    JWT_SECRET: "super-secret-key-for-testing",
    JWT_EXPIRES_IN_DAY: 7,
    PORT: 8090,
    NODE_ENV: "test",
    DB_HOST: "localhost",
    DB_PORT: 5432,
    DB_USER: "test",
    DB_PASSWORD: "test",
    DB_NAME: "test",
  },
}));

import AccountRepository from "../../src/repositories/account.repository";
import { AuthService } from "../../src/services/auth.service";
import type { Account } from "../../src/entities/pg/account.entity";

const mockAccount: Account = {
  id: "ACCOUNT001",
  email: "user@example.com",
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

describe("AuthService", () => {
  let service: AuthService;
  let existByEmailSpy: ReturnType<typeof spyOn>;
  let saveSpy: ReturnType<typeof spyOn>;
  let findByEmailSpy: ReturnType<typeof spyOn>;
  let hashSpy: ReturnType<typeof spyOn>;
  let verifySpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    service = new AuthService();
    existByEmailSpy = spyOn(AccountRepository.prototype, "existByEmail").mockResolvedValue(false);
    saveSpy = spyOn(AccountRepository.prototype, "save").mockResolvedValue(undefined);
    findByEmailSpy = spyOn(AccountRepository.prototype, "findByEmail").mockResolvedValue(
      mockAccount,
    );
    hashSpy = spyOn(Bun.password, "hash").mockResolvedValue("hashed-password");
    verifySpy = spyOn(Bun.password, "verify").mockResolvedValue(true);
  });

  afterEach(() => {
    mock.restore();
  });

  // ─── createAccount ────────────────────────────────────────────────────────

  describe("createAccount", () => {
    it("should save account successfully", async () => {
      await service.createAccount({
        name: "New User",
        email: "new@example.com",
        password: "pass123",
      });

      expect(saveSpy).toHaveBeenCalledTimes(1);
    });

    it("should throw when email already exists", async () => {
      existByEmailSpy.mockResolvedValue(true);

      await expect(
        service.createAccount({ name: "User", email: "dup@example.com", password: "pass" }),
      ).rejects.toThrow();
    });

    it("should hash the password before saving", async () => {
      hashSpy.mockResolvedValue("hashed-pw");

      await service.createAccount({ name: "User", email: "x@y.com", password: "plain" });

      expect(hashSpy).toHaveBeenCalledWith("plain");
      const saved = saveSpy.mock.calls[0][0] as Account;
      expect(saved.password).toBe("hashed-pw");
    });

    it("should generate a profile picture URL using the account name", async () => {
      await service.createAccount({ name: "Alice", email: "alice@example.com", password: "pass" });

      const saved = saveSpy.mock.calls[0][0] as Account;
      expect(saved.profile_picture).toContain("Alice");
    });

    it("should not call save when email already exists", async () => {
      existByEmailSpy.mockResolvedValue(true);

      await expect(
        service.createAccount({ name: "User", email: "dup@example.com", password: "pass" }),
      ).rejects.toThrow();

      expect(saveSpy).not.toHaveBeenCalled();
    });
  });

  // ─── verifySignIn ─────────────────────────────────────────────────────────

  describe("verifySignIn", () => {
    it("should return account on valid credentials", async () => {
      const result = await service.verifySignIn({
        email: "user@example.com",
        password: "password123",
      });

      expect(result.id).toBe("ACCOUNT001");
      expect(result.email).toBe("user@example.com");
    });

    it("should throw when email is not found", async () => {
      findByEmailSpy.mockResolvedValue(undefined as any);

      await expect(
        service.verifySignIn({ email: "wrong@example.com", password: "pass" }),
      ).rejects.toThrow();
    });

    it("should throw when password is wrong", async () => {
      verifySpy.mockResolvedValue(false);

      await expect(
        service.verifySignIn({ email: "user@example.com", password: "wrongpass" }),
      ).rejects.toThrow();
    });

    it("should call password.verify with the provided password and stored hash", async () => {
      await service.verifySignIn({ email: "user@example.com", password: "mypass" });

      expect(verifySpy).toHaveBeenCalledWith("mypass", mockAccount.password);
    });
  });

  // ─── generateToken ────────────────────────────────────────────────────────

  describe("generateToken", () => {
    it("should return a JWT string with 3 parts", async () => {
      const token = await service.generateToken({ id: "ACC001", email: "test@example.com" });
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });

    it("should generate different tokens for different payloads", async () => {
      const t1 = await service.generateToken({ id: "ACC001", email: "a@test.com" });
      const t2 = await service.generateToken({ id: "ACC002", email: "b@test.com" });
      expect(t1).not.toBe(t2);
    });
  });

  // ─── verifyToken ──────────────────────────────────────────────────────────

  describe("verifyToken", () => {
    it("should decode a token generated by generateToken", async () => {
      const token = await service.generateToken({ id: "ACC001", email: "test@example.com" });
      const payload = await service.verifyToken(token);

      expect(payload.sub).toBe("ACC001");
      expect((payload as any).email).toBe("test@example.com");
    });

    it("should throw on an invalid token", async () => {
      await expect(service.verifyToken("invalid.token.here")).rejects.toThrow();
    });

    it("should throw on a tampered token", async () => {
      const token = await service.generateToken({ id: "ACC001", email: "test@example.com" });
      const tampered = token.slice(0, -5) + "XXXXX";
      await expect(service.verifyToken(tampered)).rejects.toThrow();
    });
  });
});
