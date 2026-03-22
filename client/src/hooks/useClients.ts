import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api"
import { API } from "@/lib/constants"
import type { BaseResponse } from "@/types/api"
import type { BotStatus, Client, ClientDetail, CreateClientRequest } from "@/types/client"

// ─── Bot status ────────────────────────────────────────────────────────────

export type BotStatuses = Record<string, { status: BotStatus; error?: string }>

export function useBotStatuses() {
  return useQuery({
    queryKey: ["bot-statuses"],
    queryFn: () => apiGet<BaseResponse<BotStatuses>>(API.BOT.STATUSES),
    select: (res) => res.response_data ?? {},
    refetchInterval: 3_000,
  })
}

export function useStartBot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (clientId: string) =>
      apiPost<BaseResponse<{ status: BotStatus }>>(API.BOT.START(clientId), {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bot-statuses"] }),
  })
}

export function useStopBot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (clientId: string) =>
      apiPost<BaseResponse<{ status: BotStatus }>>(API.BOT.STOP(clientId), {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bot-statuses"] }),
  })
}

export function useRestartBot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (clientId: string) =>
      apiPost<BaseResponse<{ status: BotStatus }>>(API.BOT.RESTART(clientId), {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bot-statuses"] }),
  })
}

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: () => apiGet<BaseResponse<Client[]>>("client?page=0&size=100"),
    select: (res) => res.response_data ?? [],
  })
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ["clients", id],
    queryFn: () => apiGet<BaseResponse<ClientDetail>>(API.CLIENT.DETAIL(id)),
    select: (res) => res.response_data,
    enabled: !!id,
  })
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateClientRequest) =>
      apiPost<BaseResponse<null>>(API.CLIENT.LIST, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  })
}

export function useUpdateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name: string } }) =>
      apiPut<BaseResponse<null>>(API.CLIENT.DETAIL(id), body),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["clients"] })
      qc.invalidateQueries({ queryKey: ["clients", id] })
    },
  })
}

export function useDeleteClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(API.CLIENT.DETAIL(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  })
}

export function useAddCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ clientId, body }: { clientId: string; body: { key: string; value: string } }) =>
      apiPost<BaseResponse<null>>(API.CLIENT.CREDENTIAL(clientId), body),
    onSuccess: (_data, { clientId }) =>
      qc.invalidateQueries({ queryKey: ["clients", clientId] }),
  })
}

export function useUpdateCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      clientId,
      credId,
      body,
    }: {
      clientId: string
      credId: string
      body: { value: string }
    }) => apiPut<BaseResponse<null>>(API.CLIENT.CREDENTIAL_ITEM(clientId, credId), body),
    onSuccess: (_data, { clientId }) =>
      qc.invalidateQueries({ queryKey: ["clients", clientId] }),
  })
}

export function useDeleteCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ clientId, credId }: { clientId: string; credId: string }) =>
      apiDelete(API.CLIENT.CREDENTIAL_ITEM(clientId, credId)),
    onSuccess: (_data, { clientId }) =>
      qc.invalidateQueries({ queryKey: ["clients", clientId] }),
  })
}
