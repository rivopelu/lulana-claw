export type ContextType = "global" | "client" | "session"
export type ContextCategory = "identity" | "personality" | "rules" | "knowledge" | "custom"

export interface AppContext {
  id: string
  name: string
  type: ContextType
  category: ContextCategory
  content: string
  client_id?: string
  session_id?: string
  order: number
  created_at: string
  updated_at?: string
}
