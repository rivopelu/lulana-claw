import BudgetSessionRepository from "../repositories/budget-session.repository";
import FinancialTransactionRepository from "../repositories/financial-transaction.repository";
import type { BudgetSession } from "../entities/pg/budget-session.entity";
import type { FinancialTransaction } from "../entities/pg/financial-transaction.entity";
import { NotFoundException } from "../libs/exception";
import { generateId } from "../libs/string-utils";

// ─── Request / Response types ────────────────────────────────────────────────

export type BudgetSessionStatus = "active" | "completed" | "cancelled";
export type TransactionCategory =
  | "food"
  | "transport"
  | "entertainment"
  | "shopping"
  | "health"
  | "other";
export type TransactionType = "expense" | "income";

export interface RequestCreateBudgetSession {
  client_id: string;
  chat_id: number;
  session_id?: string;
  title: string;
  budget_amount: number;
  currency?: string;
}

export interface RequestCreateTransaction {
  client_id: string;
  chat_id: number;
  budget_session_id?: string;
  description: string;
  amount: number;
  category?: TransactionCategory;
  type?: TransactionType;
  transaction_date?: number;
  note?: string;
}

export interface ResponseBudgetSession {
  id: string;
  title: string;
  budget_amount: number;
  currency: string;
  status: BudgetSessionStatus;
  started_at: number;
  ended_at: number | null;
  total_spent: number;
  remaining: number;
  created_date: number;
}

export interface ResponseTransaction {
  id: string;
  budget_session_id: string | null;
  description: string;
  amount: number;
  category: TransactionCategory;
  type: TransactionType;
  transaction_date: number;
  note: string | null;
  created_date: number;
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function toSessionResponse(
  s: BudgetSession,
  totalSpent: number,
): ResponseBudgetSession {
  return {
    id: s.id,
    title: s.title,
    budget_amount: s.budget_amount,
    currency: s.currency,
    status: s.status as BudgetSessionStatus,
    started_at: s.started_at,
    ended_at: s.ended_at ?? null,
    total_spent: totalSpent,
    remaining: s.budget_amount - totalSpent,
    created_date: s.created_date,
  };
}

function toTransactionResponse(t: FinancialTransaction): ResponseTransaction {
  return {
    id: t.id,
    budget_session_id: t.budget_session_id ?? null,
    description: t.description,
    amount: t.amount,
    category: t.category as TransactionCategory,
    type: t.type as TransactionType,
    transaction_date: t.transaction_date,
    note: t.note ?? null,
    created_date: t.created_date,
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

export default class FinanceService {
  private sessionRepo = new BudgetSessionRepository();
  private txRepo = new FinancialTransactionRepository();

  // ── Budget Sessions ──────────────────────────────────────────────────────

  async createBudgetSession(
    body: RequestCreateBudgetSession,
    accountId: string,
  ): Promise<ResponseBudgetSession> {
    const id = generateId();
    await this.sessionRepo.save({
      id,
      account_id: accountId,
      client_id: body.client_id,
      chat_id: body.chat_id,
      session_id: body.session_id,
      title: body.title,
      budget_amount: body.budget_amount,
      currency: body.currency ?? "IDR",
      status: "active",
      created_by: accountId,
    });
    const saved = await this.sessionRepo.findById(id);
    return toSessionResponse(saved!, 0);
  }

  async getAllSessions(
    accountId: string,
    status?: BudgetSessionStatus,
  ): Promise<ResponseBudgetSession[]> {
    const sessions = await this.sessionRepo.findAllByAccountId(accountId, status);
    return Promise.all(
      sessions.map(async (s) => {
        const spent = await this.txRepo.sumExpensesBySession(s.id);
        return toSessionResponse(s, spent);
      }),
    );
  }

  async getSessionById(id: string, accountId: string): Promise<ResponseBudgetSession> {
    const session = await this.sessionRepo.findByIdAndAccountId(id, accountId);
    if (!session) throw new NotFoundException("Budget session not found");
    const spent = await this.txRepo.sumExpensesBySession(id);
    return toSessionResponse(session, spent);
  }

  async completeSession(id: string, accountId: string): Promise<void> {
    const session = await this.sessionRepo.findByIdAndAccountId(id, accountId);
    if (!session) throw new NotFoundException("Budget session not found");
    await this.sessionRepo.update(id, {
      status: "completed",
      ended_at: Date.now(),
      updated_by: accountId,
      updated_date: Date.now(),
    });
  }

  async cancelSession(id: string, accountId: string): Promise<void> {
    const session = await this.sessionRepo.findByIdAndAccountId(id, accountId);
    if (!session) throw new NotFoundException("Budget session not found");
    await this.sessionRepo.update(id, {
      status: "cancelled",
      ended_at: Date.now(),
      updated_by: accountId,
      updated_date: Date.now(),
    });
  }

  async deleteSession(id: string, accountId: string): Promise<void> {
    const session = await this.sessionRepo.findByIdAndAccountId(id, accountId);
    if (!session) throw new NotFoundException("Budget session not found");
    await this.sessionRepo.update(id, {
      active: false,
      deleted_by: accountId,
      deleted_date: Date.now(),
    });
  }

  // ── Transactions ─────────────────────────────────────────────────────────

  async createTransaction(
    body: RequestCreateTransaction,
    accountId: string,
  ): Promise<ResponseTransaction> {
    const id = generateId();
    await this.txRepo.save({
      id,
      account_id: accountId,
      client_id: body.client_id,
      chat_id: body.chat_id,
      budget_session_id: body.budget_session_id,
      description: body.description,
      amount: body.amount,
      category: (body.category ?? "other") as any,
      type: (body.type ?? "expense") as any,
      transaction_date: body.transaction_date ?? Date.now(),
      note: body.note,
      created_by: accountId,
    });
    const saved = await this.txRepo.findById(id);
    return toTransactionResponse(saved!);
  }

  async getAllTransactions(
    accountId: string,
    opts?: { budgetSessionId?: string; fromDate?: number; toDate?: number },
  ): Promise<ResponseTransaction[]> {
    const list = await this.txRepo.findAllByAccountId(accountId, opts);
    return list.map(toTransactionResponse);
  }

  async getTransactionsBySession(
    sessionId: string,
    accountId: string,
  ): Promise<ResponseTransaction[]> {
    // Verify session belongs to account
    const session = await this.sessionRepo.findByIdAndAccountId(sessionId, accountId);
    if (!session) throw new NotFoundException("Budget session not found");
    const list = await this.txRepo.findByBudgetSessionId(sessionId);
    return list.map(toTransactionResponse);
  }

  async deleteTransaction(id: string, accountId: string): Promise<void> {
    const tx = await this.txRepo.findByIdAndAccountId(id, accountId);
    if (!tx) throw new NotFoundException("Transaction not found");
    await this.txRepo.update(id, {
      active: false,
      deleted_by: accountId,
      deleted_date: Date.now(),
    });
  }

  // ── Bot helpers (called from chat.service) ────────────────────────────────

  /** Find active budget sessions for a chat (for AI context) */
  async getActiveSessions(clientId: string, chatId: number): Promise<ResponseBudgetSession[]> {
    const sessions = await this.sessionRepo.findActiveByChatId(clientId, chatId);
    return Promise.all(
      sessions.map(async (s) => {
        const spent = await this.txRepo.sumExpensesBySession(s.id);
        return toSessionResponse(s, spent);
      }),
    );
  }

  /** End active session by 8-char suffix ID */
  async completeByChatAndSuffix(
    clientId: string,
    chatId: number,
    suffix: string,
    accountId: string,
  ): Promise<BudgetSession | undefined> {
    const sessions = await this.sessionRepo.findActiveByChatId(clientId, chatId);
    const target = sessions.find((s) => s.id.endsWith(suffix));
    if (target) {
      await this.sessionRepo.update(target.id, {
        status: "completed",
        ended_at: Date.now(),
        updated_by: accountId,
        updated_date: Date.now(),
      });
    }
    return target;
  }
}
