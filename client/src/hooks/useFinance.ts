import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api"
import { API } from "@/lib/constants"
import type { BaseResponse } from "@/types/api"
import type {
  BudgetSession,
  BudgetSessionStatus,
  CreateBudgetSessionBody,
  CreateTransactionBody,
  FinancialTransaction,
} from "@/types/finance"

// ── Budget Sessions ──────────────────────────────────────────────────────────

export function useBudgetSessions(status?: BudgetSessionStatus) {
  const url = status ? `${API.FINANCE.SESSIONS}?status=${status}` : API.FINANCE.SESSIONS
  return useQuery({
    queryKey: ["budget-sessions", status],
    queryFn: () => apiGet<BaseResponse<BudgetSession[]>>(url),
    select: (res) => res.response_data ?? [],
    refetchInterval: 30_000,
  })
}

export function useBudgetSession(id: string) {
  return useQuery({
    queryKey: ["budget-session", id],
    queryFn: () => apiGet<BaseResponse<BudgetSession>>(API.FINANCE.SESSION_DETAIL(id)),
    select: (res) => res.response_data,
    enabled: !!id,
  })
}

export function useCreateBudgetSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateBudgetSessionBody) =>
      apiPost<BaseResponse<BudgetSession>>(API.FINANCE.SESSIONS, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget-sessions"] }),
  })
}

export function useCompleteBudgetSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiPut(API.FINANCE.SESSION_COMPLETE(id), {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget-sessions"] })
      qc.invalidateQueries({ queryKey: ["budget-session"] })
    },
  })
}

export function useCancelBudgetSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiPut(API.FINANCE.SESSION_CANCEL(id), {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget-sessions"] })
      qc.invalidateQueries({ queryKey: ["budget-session"] })
    },
  })
}

export function useDeleteBudgetSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(API.FINANCE.SESSION_DETAIL(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget-sessions"] }),
  })
}

// ── Transactions ─────────────────────────────────────────────────────────────

export function useTransactions(opts?: { budgetSessionId?: string }) {
  const url = opts?.budgetSessionId
    ? `${API.FINANCE.TRANSACTIONS}?budget_session_id=${opts.budgetSessionId}`
    : API.FINANCE.TRANSACTIONS
  return useQuery({
    queryKey: ["transactions", opts?.budgetSessionId],
    queryFn: () => apiGet<BaseResponse<FinancialTransaction[]>>(url),
    select: (res) => res.response_data ?? [],
    refetchInterval: 30_000,
  })
}

export function useSessionTransactions(sessionId: string) {
  return useQuery({
    queryKey: ["session-transactions", sessionId],
    queryFn: () =>
      apiGet<BaseResponse<FinancialTransaction[]>>(API.FINANCE.SESSION_TRANSACTIONS(sessionId)),
    select: (res) => res.response_data ?? [],
    enabled: !!sessionId,
    refetchInterval: 15_000,
  })
}

export function useCreateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateTransactionBody) =>
      apiPost<BaseResponse<FinancialTransaction>>(API.FINANCE.TRANSACTIONS, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] })
      qc.invalidateQueries({ queryKey: ["session-transactions"] })
      qc.invalidateQueries({ queryKey: ["budget-sessions"] })
    },
  })
}

export function useDeleteTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(API.FINANCE.TRANSACTION_DETAIL(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] })
      qc.invalidateQueries({ queryKey: ["session-transactions"] })
      qc.invalidateQueries({ queryKey: ["budget-sessions"] })
    },
  })
}
