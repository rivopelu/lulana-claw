export type ChatType = "private" | "group" | "supergroup" | "channel"

export interface Session {
  id: string
  client_id: string
  chat_id: number
  chat_type: ChatType
  name: string
  ai_model_id: string | null
  active: boolean
  created_date: number
}
