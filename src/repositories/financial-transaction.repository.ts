import { db } from "../database/database";
import {
  type FinancialTransaction,
  FinancialTransactionEntity,
  type NewFinancialTransaction,
} from "../entities/pg/financial-transaction.entity";
import { and, desc, eq, gte, lte, sum } from "drizzle-orm";

export default class FinancialTransactionRepository {
  async save(data: NewFinancialTransaction): Promise<void> {
    await db.insert(FinancialTransactionEntity).values(data);
  }

  async findById(id: string): Promise<FinancialTransaction | undefined> {
    const rows = await db
      .select()
      .from(FinancialTransactionEntity)
      .where(
        and(eq(FinancialTransactionEntity.id, id), eq(FinancialTransactionEntity.active, true)),
      )
      .limit(1);
    return rows[0];
  }

  async findByIdAndAccountId(
    id: string,
    accountId: string,
  ): Promise<FinancialTransaction | undefined> {
    const rows = await db
      .select()
      .from(FinancialTransactionEntity)
      .where(
        and(
          eq(FinancialTransactionEntity.id, id),
          eq(FinancialTransactionEntity.account_id, accountId),
          eq(FinancialTransactionEntity.active, true),
        ),
      )
      .limit(1);
    return rows[0];
  }

  async findAllByAccountId(
    accountId: string,
    opts?: { budgetSessionId?: string; fromDate?: number; toDate?: number },
  ): Promise<FinancialTransaction[]> {
    return db
      .select()
      .from(FinancialTransactionEntity)
      .where(
        and(
          eq(FinancialTransactionEntity.account_id, accountId),
          eq(FinancialTransactionEntity.active, true),
          opts?.budgetSessionId
            ? eq(FinancialTransactionEntity.budget_session_id, opts.budgetSessionId)
            : undefined,
          opts?.fromDate
            ? gte(FinancialTransactionEntity.transaction_date, opts.fromDate)
            : undefined,
          opts?.toDate ? lte(FinancialTransactionEntity.transaction_date, opts.toDate) : undefined,
        ),
      )
      .orderBy(desc(FinancialTransactionEntity.transaction_date));
  }

  async findByBudgetSessionId(budgetSessionId: string): Promise<FinancialTransaction[]> {
    return db
      .select()
      .from(FinancialTransactionEntity)
      .where(
        and(
          eq(FinancialTransactionEntity.budget_session_id, budgetSessionId),
          eq(FinancialTransactionEntity.active, true),
        ),
      )
      .orderBy(desc(FinancialTransactionEntity.transaction_date));
  }

  /** Sum of all expenses in a budget session */
  async sumExpensesBySession(budgetSessionId: string): Promise<number> {
    const result = await db
      .select({ total: sum(FinancialTransactionEntity.amount) })
      .from(FinancialTransactionEntity)
      .where(
        and(
          eq(FinancialTransactionEntity.budget_session_id, budgetSessionId),
          eq(FinancialTransactionEntity.type, "expense"),
          eq(FinancialTransactionEntity.active, true),
        ),
      );
    return Number(result[0]?.total ?? 0);
  }

  async update(id: string, data: Partial<NewFinancialTransaction>): Promise<void> {
    await db
      .update(FinancialTransactionEntity)
      .set(data)
      .where(eq(FinancialTransactionEntity.id, id));
  }
}
