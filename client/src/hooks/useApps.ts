import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiDelete, apiGet, apiPost } from "@/lib/api"
import { API } from "@/lib/constants"
import type { BaseResponse } from "@/types/api"
import type { AppConnection } from "@/types/app"

export function useAppConnections() {
  return useQuery({
    queryKey: ["apps"],
    queryFn: () => apiGet<BaseResponse<AppConnection[]>>(API.APP.LIST),
    select: (res) => res.response_data ?? [],
  })
}

export function useGoogleAuthUrl() {
  return useQuery({
    queryKey: ["google-auth-url"],
    queryFn: () => apiGet<BaseResponse<{ url: string }>>(API.APP.GOOGLE_AUTH_URL),
    select: (res) => res.response_data?.url ?? "",
    enabled: false,
  })
}

export function useConnectGoogle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (code: string) =>
      apiPost<BaseResponse<AppConnection>>(API.APP.GOOGLE_CONNECT, { code }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["apps"] }),
  })
}

export function useDisconnectApp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(API.APP.DISCONNECT(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["apps"] }),
  })
}
