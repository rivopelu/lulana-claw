import type {Context} from "hono";
import type {RequestSignUp} from "../types/request/request-sign-up";
import {AuthService} from "../services/auth.service";
import AccountService from "../services/account.service";
import {responseHelper} from "../libs/response-helper";

export class AuthController {

  private authService = new AuthService();
  private accountService = new AccountService();


  async createAccount(c: Context) {
    const body: RequestSignUp = await c.req.json<RequestSignUp>();
    await this.authService.createAccount(body);
    return c.json(responseHelper.success())
  }
}