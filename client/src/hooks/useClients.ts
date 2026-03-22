import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api"
import { API } from "@/lib/constants"
import type { BaseResponse } from "@/types/api"
import type { Client, ClientDetail, CreateClientRequest } from "@/types/client"

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

export function useDeleteClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(API.CLIENT.DETAIL(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  })
}
