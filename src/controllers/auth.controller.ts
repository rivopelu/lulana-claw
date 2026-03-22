import type { Context } from "hono";
import type { RequestSignUp } from "../types/request/request-sign-up";
import { AuthService } from "../services/auth.service";
import AccountService from "../services/account.service";
import { responseHelper } from "../libs/response-helper";
import type { RequestSignIn } from "../types/request/request-sign-in";
import type { ResponseSignIn } from "../types/response/response-sign-in";
import { getAccountId } from "../libs/utils";
import { Controller, Get, Middleware, Post } from "hono-decorators";
import JwtMiddleware from "../middleware/jwt-middleware";

@Controller("auth")
export class AuthController {
  private authService = new AuthService();
  private accountService = new AccountService();

  /** Public — check whether the system has been initialized (any account exists) */
  @Get("setup")
  async checkSetup(c: Context) {
    const initialized = await this.authService.isInitialized();
    return c.json(responseHelper.data({ initialized }));
  }

  /** Public — only succeeds when no account exists yet (first-time setup) */
  @Post("setup")
  async setupFirstAccount(c: Context) {
    const body: RequestSignUp = await c.req.json<RequestSignUp>();
    await this.authService.setupFirstAccount(body);
    return c.json(responseHelper.success("Account created. Please sign in."));
  }

  /** Protected — create an account; only accessible by an authenticated user */
  @Post("sign-up")
  @Middleware([JwtMiddleware])
  async createAccount(c: Context) {
    const body: RequestSignUp = await c.req.json<RequestSignUp>();
    await this.authService.createAccount(body);
    return c.json(responseHelper.success());
  }

  @Post("sign-in")
  async signIn(c: Context) {
    const body: RequestSignIn = await c.req.json<RequestSignIn>();
    const account = await this.authService.verifySignIn(body);
    const getAccountData = await this.accountService.getAccountDataByAccount(account);
    const token = await this.authService.generateToken({ email: account.email, id: account.id });
    const responseData: ResponseSignIn = {
      token: token,
      account: getAccountData,
    };
    return c.json(responseHelper.data(responseData));
  }

  @Get("me")
  @Middleware([JwtMiddleware])
  async getMe(c: Context) {
    const accountId = getAccountId(c);
    const accountData = await this.accountService.getAccountDataById(accountId);
    return c.json(responseHelper.data(accountData));
  }
}
