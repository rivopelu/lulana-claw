import { useMutation, useQuery } from "@tanstack/react-query"
import { apiGet, apiPost } from "@/lib/api"
import { setToken, clearToken } from "@/stores/authStore"
import { API } from "@/lib/constants"
import type { BaseResponse } from "@/types/api"
import type { SignInRequest, SignInResponse, User } from "@/types/user"

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<BaseResponse<User>>(API.AUTH.ME),
    select: (res) => res.response_data,
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

export function useSignOut() {
  return useMutation({
    mutationFn: async () => {
      clearToken()
    },
  })
}
