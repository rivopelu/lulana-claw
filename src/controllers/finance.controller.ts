import type { Context } from "hono";
import { Controller, Delete, Get, Middleware, Post, Put } from "hono-decorators";
import { responseHelper } from "../libs/response-helper";
import JwtMiddleware from "../middleware/jwt-middleware";
import { getAccountId } from "../libs/utils";
import FinanceService from "../services/finance.service";

@Controller("finance")
@Middleware([JwtMiddleware])
export class FinanceController {
  private financeService = new FinanceService();

  // ── Budget Sessions ────────────────────────────────────────────────────────

  @Get("sessions")
  async getSessions(c: Context) {
    const accountId = getAccountId(c);
    const status = c.req.query("status") as "active" | "completed" | "cancelled" | undefined;
    const sessions = await this.financeService.getAllSessions(accountId, status);
    return c.json(responseHelper.data(sessions));
  }

  @Get("sessions/:id")
  async getSessionById(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    const session = await this.financeService.getSessionById(id, accountId);
    return c.json(responseHelper.data(session));
  }

  @Post("sessions")
  async createSession(c: Context) {
    const accountId = getAccountId(c);
    const body = await c.req.json();
    const session = await this.financeService.createBudgetSession(body, accountId);
    return c.json(responseHelper.data(session), 201);
  }

  @Put("sessions/:id/complete")
  async completeSession(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    await this.financeService.completeSession(id, accountId);
    return c.json(responseHelper.success("Session completed"));
  }

  @Put("sessions/:id/cancel")
  async cancelSession(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    await this.financeService.cancelSession(id, accountId);
    return c.json(responseHelper.success("Session cancelled"));
  }

  @Delete("sessions/:id")
  async deleteSession(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    await this.financeService.deleteSession(id, accountId);
    return c.json(responseHelper.success("Session deleted"));
  }

  // ── Transactions ───────────────────────────────────────────────────────────

  @Get("transactions")
  async getTransactions(c: Context) {
    const accountId = getAccountId(c);
    const budgetSessionId = c.req.query("budget_session_id");
    const fromDate = c.req.query("from_date") ? Number(c.req.query("from_date")) : undefined;
    const toDate = c.req.query("to_date") ? Number(c.req.query("to_date")) : undefined;
    const transactions = await this.financeService.getAllTransactions(accountId, {
      budgetSessionId,
      fromDate,
      toDate,
    });
    return c.json(responseHelper.data(transactions));
  }

  @Get("sessions/:id/transactions")
  async getTransactionsBySession(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    const transactions = await this.financeService.getTransactionsBySession(id, accountId);
    return c.json(responseHelper.data(transactions));
  }

  @Post("transactions")
  async createTransaction(c: Context) {
    const accountId = getAccountId(c);
    const body = await c.req.json();
    const tx = await this.financeService.createTransaction(body, accountId);
    return c.json(responseHelper.data(tx), 201);
  }

  @Delete("transactions/:id")
  async deleteTransaction(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    await this.financeService.deleteTransaction(id, accountId);
    return c.json(responseHelper.success("Transaction deleted"));
  }
}
