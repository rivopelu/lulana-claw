import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, apiDelete, apiGet } from "@/lib/api"
import { API } from "@/lib/constants"
import type { BaseResponse } from "@/types/api"
import type { MediaAsset } from "@/types/media"

export function useMediaAssets() {
  return useQuery({
    queryKey: ["media"],
    queryFn: () => apiGet<BaseResponse<MediaAsset[]>>(API.MEDIA.LIST),
    select: (res) => res.response_data ?? [],
  })
}

export function useUploadMedia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append("file", file)
      return api.post(API.MEDIA.UPLOAD, { body: form }).json<BaseResponse<MediaAsset>>()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media"] }),
  })
}

export function useDeleteMedia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(API.MEDIA.DELETE(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media"] }),
  })
}
