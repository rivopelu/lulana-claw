export type AiProvider = "openai" | "openrouter" | "gemini" | "anthropic"

export interface AiModel {
  id: string
  name: string
  model_id: string
  provider: AiProvider
  api_key_hint: string
  active: boolean
  created_date: number
}

export interface MasterAiModel {
  id: string
  name: string
  context_window: number
}
