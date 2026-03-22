export interface RequestCreateAiModel {
  name: string;
  model_id: string;
  provider: "openai";
  api_key: string;
}
