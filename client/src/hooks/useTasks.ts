import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api"
import { API } from "@/lib/constants"
import type { BaseResponse } from "@/types/api"
import type { Task, TaskStatus, TaskType } from "@/types/task"

export function useTasks(status?: TaskStatus) {
  const url = status ? `${API.TASK.LIST}?status=${status}` : API.TASK.LIST
  return useQuery({
    queryKey: ["tasks", status],
    queryFn: () => apiGet<BaseResponse<Task[]>>(url),
    select: (res) => res.response_data ?? [],
    refetchInterval: 30_000,
  })
}

export interface CreateTaskBody {
  client_id: string
  chat_id: number
  session_id?: string
  type?: TaskType
  title: string
  description?: string
  remind_at?: number
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateTaskBody) => apiPost<BaseResponse<Task>>(API.TASK.LIST, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  })
}

export function useMarkTaskDone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiPut<BaseResponse<null>>(API.TASK.DONE(id), {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  })
}

export function useCancelTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiPut<BaseResponse<null>>(API.TASK.CANCEL(id), {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(API.TASK.DETAIL(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  })
}
