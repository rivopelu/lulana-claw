export type TaskType = "task" | "reminder" | "notes" | "meeting" | "deadline"
export type TaskStatus = "pending" | "done" | "cancelled"

export interface Task {
  id: string
  client_id: string
  chat_id: number
  session_id?: string | null
  type: TaskType
  title: string
  description?: string | null
  remind_at?: number | null
  reminded: boolean
  status: TaskStatus
  created_date: number
}
