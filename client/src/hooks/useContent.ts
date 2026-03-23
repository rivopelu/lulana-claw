import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, apiDelete, apiGet, apiPost, apiPut } from "@/lib/api"
import { API } from "@/lib/constants"
import type { BaseResponse } from "@/types/api"
import type { ContentDraft, ContentDraftStatus } from "@/types/content"

export function useContentDrafts(status?: ContentDraftStatus) {
  const url = status ? `${API.CONTENT.LIST}?status=${status}` : API.CONTENT.LIST
  return useQuery({
    queryKey: ["content", status],
    queryFn: () => apiGet<BaseResponse<ContentDraft[]>>(url),
    select: (res) => res.response_data ?? [],
    refetchInterval: 30_000,
  })
}

export function useContentDraft(id: string) {
  return useQuery({
    queryKey: ["content", id],
    queryFn: () => apiGet<BaseResponse<ContentDraft>>(API.CONTENT.DETAIL(id)),
    select: (res) => res.response_data,
    enabled: !!id,
  })
}

export function useGenerateDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ aiModelId, customPrompt }: { aiModelId?: string; customPrompt?: string } = {}) =>
      apiPost<BaseResponse<ContentDraft>>(API.CONTENT.GENERATE, {
        ai_model_id: aiModelId,
        custom_prompt: customPrompt,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] }),
  })
}

export type PublishPlatform = "instagram" | "threads"

export function useApproveDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      scheduled_at,
      publish_now,
      platforms,
    }: {
      id: string
      scheduled_at?: number
      publish_now?: boolean
      platforms?: PublishPlatform[]
    }) => apiPut<BaseResponse<ContentDraft>>(API.CONTENT.APPROVE(id), { scheduled_at, publish_now, platforms }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] }),
  })
}

export function useRejectDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiPut<BaseResponse<null>>(API.CONTENT.REJECT(id), {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] }),
  })
}

export function useReviseDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      apiPut<BaseResponse<null>>(API.CONTENT.REVISE(id), { notes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] }),
  })
}

export function useUpdateCaption() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      caption,
      hashtags,
    }: {
      id: string
      caption: string
      hashtags?: string[]
    }) => apiPut<BaseResponse<ContentDraft>>(API.CONTENT.CAPTION(id), { caption, hashtags }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] }),
  })
}

export function useSetAssetFromMedia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, mediaId }: { id: string; mediaId: string }) =>
      apiPut<BaseResponse<ContentDraft>>(API.CONTENT.ASSET_FROM_MEDIA(id), { media_id: mediaId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] }),
  })
}

export function useUploadAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const form = new FormData()
      form.append("file", file)
      return api.post(API.CONTENT.ASSET(id), { body: form }).json<BaseResponse<ContentDraft>>()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] }),
  })
}

export function usePublishDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, platforms }: { id: string; platforms?: PublishPlatform[] }) =>
      apiPost<BaseResponse<ContentDraft>>(API.CONTENT.PUBLISH(id), { platforms }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] }),
  })
}

export function useDeleteDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(API.CONTENT.DETAIL(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] }),
  })
}
