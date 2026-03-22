import { useMutation, useQuery } from "@tanstack/react-query"
import { apiGet, apiPost } from "@/lib/api"
import { setToken, clearToken } from "@/stores/authStore"
import { API } from "@/lib/constants"
import type { BaseResponse } from "@/types/api"
import type { SignInRequest, SignUpRequest, SignInResponse, User } from "@/types/user"

export function useSetup() {
  return useQuery({
    queryKey: ["auth", "setup"],
    queryFn: () => apiGet<BaseResponse<{ initialized: boolean }>>(API.AUTH.SETUP),
    select: (res) => res.response_data ?? { initialized: false },
    staleTime: Infinity, // setup state never changes mid-session
  })
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<BaseResponse<User>>(API.AUTH.ME),
    select: (res) => res.response_data,
    retry: false,
  })
}

export function useSignIn() {
  return useMutation({
    mutationFn: (body: SignInRequest) =>
      apiPost<BaseResponse<SignInResponse>>(API.AUTH.SIGN_IN, body),
    onSuccess: (res) => {
      if (res.response_data?.token) {
        setToken(res.response_data.token)
      }
    },
  })
}

/** First-time setup: create the very first account (no auth required) */
export function useSetupAccount() {
  return useMutation({
    mutationFn: (body: SignUpRequest) =>
      apiPost<BaseResponse<null>>(API.AUTH.SETUP, body),
  })
}

export function useSignOut() {
  return useMutation({
    mutationFn: async () => {
      clearToken()
    },
  })
}
