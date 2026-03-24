export type BudgetSessionStatus = "active" | "completed" | "cancelled"
export type TransactionCategory =
  | "food"
  | "transport"
  | "entertainment"
  | "shopping"
  | "health"
  | "other"
export type TransactionType = "expense" | "income"

export interface BudgetSession {
  id: string
  title: string
  budget_amount: number
  currency: string
  status: BudgetSessionStatus
  started_at: number
  ended_at: number | null
  total_spent: number
  remaining: number
  created_date: number
}

export interface FinancialTransaction {
  id: string
  budget_session_id: string | null
  description: string
  amount: number
  category: TransactionCategory
  type: TransactionType
  transaction_date: number
  note: string | null
  created_date: number
}

export interface CreateBudgetSessionBody {
  client_id: string
  chat_id: number
  session_id?: string
  title: string
  budget_amount: number
  currency?: string
}

export interface CreateTransactionBody {
  client_id: string
  chat_id: number
  budget_session_id?: string
  description: string
  amount: number
  category?: TransactionCategory
  type?: TransactionType
  note?: string
}
