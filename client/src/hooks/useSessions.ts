import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPut } from "@/lib/api"
import { API } from "@/lib/constants"
import type { BaseResponse } from "@/types/api"
import type { Session } from "@/types/session"

export interface SessionMessage {
  _id: string
  session_id: string
  role: "user" | "assistant" | "system"
  content: string
  from_id?: string
  from_name?: string
  created_at: string
}

export function useSessionsByClient(clientId: string) {
  return useQuery({
    queryKey: ["sessions", clientId],
    queryFn: () => apiGet<BaseResponse<Session[]>>(API.SESSION.BY_CLIENT(clientId)),
    select: (res) => res.response_data ?? [],
    enabled: !!clientId,
  })
}

export function useSession(sessionId: string) {
  return useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => apiGet<BaseResponse<Session>>(API.SESSION.DETAIL(sessionId)),
    select: (res) => res.response_data,
    enabled: !!sessionId,
  })
}

export function useSessionMessages(sessionId: string, limit = 100) {
  return useQuery({
    queryKey: ["session-messages", sessionId, limit],
    queryFn: () =>
      apiGet<BaseResponse<SessionMessage[]>>(
        `${API.SESSION.DETAIL(sessionId)}/messages?limit=${limit}`,
      ),
    select: (res) => res.response_data ?? [],
    enabled: !!sessionId,
    refetchInterval: 5000,
  })
}

export function useSetSessionModel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, aiModelId, clientId }: { sessionId: string; aiModelId: string | null; clientId: string }) =>
      apiPut<BaseResponse<null>>(API.SESSION.SET_MODEL(sessionId), { ai_model_id: aiModelId }),
    onSuccess: (_data, { clientId }) =>
      qc.invalidateQueries({ queryKey: ["sessions", clientId] }),
  })
}
