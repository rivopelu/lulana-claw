import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api"
import { API } from "@/lib/constants"
import type { BaseResponse } from "@/types/api"
import type { AppContext, ContextCategory, ContextType } from "@/types/context"

export function useContexts() {
  return useQuery({
    queryKey: ["contexts"],
    queryFn: () => apiGet<BaseResponse<AppContext[]>>(API.CONTEXT.LIST),
    select: (res) => res.response_data ?? [],
  })
}

export interface CreateContextBody {
  name: string
  type: ContextType
  category: ContextCategory
  content: string
  client_id?: string
  session_id?: string
  order?: number
}

export function useCreateContext() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateContextBody) =>
      apiPost<BaseResponse<AppContext>>(API.CONTEXT.LIST, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contexts"] }),
  })
}

export function useUpdateContext() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: { name?: string; category?: ContextCategory; content?: string; order?: number }
    }) => apiPut<BaseResponse<null>>(API.CONTEXT.DETAIL(id), body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contexts"] }),
  })
}

export function useDeleteContext() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(API.CONTEXT.DETAIL(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contexts"] }),
  })
}
