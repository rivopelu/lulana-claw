export type ClientType = "telegram" | "discord" | "whatsapp" | "http"
export type BotStatus = "starting" | "running" | "stopping" | "stopped" | "error"

export interface ClientCredential {
  id: string
  key: string
  value: string
}

export interface Client {
  id: string
  name: string
  type: ClientType
  ai_model_id: string | null
  active: boolean
  created_date: number
}

export interface ClientDetail extends Client {
  credentials: ClientCredential[]
}

export interface CreateClientRequest {
  name: string
  type: ClientType
  credentials: { key: string; value: string }[]
}
