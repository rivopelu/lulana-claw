export type ClientType = "telegram" | "discord" | "whatsapp" | "http"

export interface ClientCredential {
  id: string
  key: string
  value: string
}

export interface Client {
  id: string
  name: string
  type: ClientType
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
