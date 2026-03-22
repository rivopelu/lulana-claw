import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api"
import { API } from "@/lib/constants"
import type { BaseResponse } from "@/types/api"
import type { AiModel, MasterAiModel } from "@/types/ai-model"

export function useAiModels() {
  return useQuery({
    queryKey: ["ai-models"],
    queryFn: () => apiGet<BaseResponse<AiModel[]>>(API.AI_MODEL.LIST),
    select: (res) => res.response_data ?? [],
  })
}

export function useMasterAiModels(provider = "openai") {
  return useQuery({
    queryKey: ["master-ai-models", provider],
    queryFn: () =>
      apiGet<BaseResponse<MasterAiModel[]>>(`${API.MASTER.AI_MODELS}?provider=${provider}`),
    select: (res) => res.response_data ?? [],
    staleTime: Infinity,
  })
}

export function useConnectOpenRouter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { code: string; name: string; model_id: string }) =>
      apiPost<BaseResponse<null>>(API.AI_MODEL.OAUTH_OPENROUTER, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-models"] }),
  })
}

export function useCreateAiModel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; model_id: string; provider: "openai" | "openrouter" | "gemini" | "anthropic"; api_key: string }) =>
      apiPost<BaseResponse<null>>(API.AI_MODEL.LIST, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-models"] }),
  })
}

export function useUpdateAiModel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: { name?: string; model_id?: string; provider?: string; api_key?: string }
    }) => apiPut<BaseResponse<null>>(API.AI_MODEL.DETAIL(id), body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-models"] }),
  })
}

export function useDeleteAiModel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(API.AI_MODEL.DETAIL(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-models"] }),
  })
}
