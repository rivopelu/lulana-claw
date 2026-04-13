export interface RequestCreateAiModel {
  name: string;
  model_id: string;
  provider: "openai" | "openrouter" | "gemini" | "anthropic" | "claude_code";
  api_key: string;
  base_url?: string;
}
