export type AiProvider = "openai" | "openrouter" | "gemini" | "anthropic" | "claude_code";

export interface AiModel {
  id: string;
  name: string;
  model_id: string;
  provider: AiProvider;
  api_key_hint: string;
  active: boolean;
  base_url?: string;
  created_date: number;
}

export interface MasterAiModel {
  id: string;
  name: string;
  context_window: number;
}
