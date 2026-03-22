import AccountRepository from "../repositories/account.repository";
import type { RequestSignUp } from "../types/request/request-sign-up";
import { t } from "i18next";
import { env } from "../configs/env";
import type { JWTPayload } from "hono/utils/jwt/types";
import { sign, verify } from "hono/jwt";
import { BadRequestException } from "../libs/exception";
import type { RequestSignIn } from "../types/request/request-sign-in";
import { generateProfilePicture } from "../libs/string-utils";
import type { NewAccount } from "../entities/pg/account.entity";
import DateHelper from "../libs/date-helper";

export class AuthService {
  private accountRepository = new AccountRepository();

  async verifySignIn(data: RequestSignIn) {
    const account = await this.accountRepository.findByEmail(data.email);

    if (!account) {
      throw new BadRequestException(t("error.sign_in_failed"));
    }

    const verifyPassword = await Bun.password.verify(data.password, account.password);

    if (!verifyPassword) {
      throw new BadRequestException(t("error.sign_in_failed"));
    }

    return account;
  }

  async createAccount(data: RequestSignUp) {
    const checkEmail = await this.accountRepository.existByEmail(data.email);
    if (checkEmail) {
      throw new BadRequestException(t("error.email_already_exist"));
    }

    const encodedPassword = await Bun.password.hash(data.password);
    const profilePicture = generateProfilePicture(data.name);

    const newAccount: NewAccount = {
      email: data.email,
      password: encodedPassword,
      name: data.name,
      profile_picture: profilePicture,
      created_date: DateHelper.getEpochMs(),
      created_by: "SYSTEM",
    };

    await this.accountRepository.save(newAccount);
  }

  async generateToken(payload: { id: string; email: string }): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 60 * 60 * 24 * env.JWT_EXPIRES_IN_DAY;
    const jwtPayload: JWTPayload = {
      sub: payload.id,
      email: payload.email,
      iat: now,
      exp: now + expiresIn,
    };

    return sign(jwtPayload, env.JWT_SECRET);
  }

  async verifyToken(token: string): Promise<JWTPayload> {
    return verify(token, env.JWT_SECRET, "HS256");
  }
}
