export interface RequestCreateAiModel {
  name: string;
  model_id: string;
  provider: "openai" | "openrouter" | "gemini" | "anthropic";
  api_key: string;
}
