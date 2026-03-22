export interface ResponseAiModel {
  id: string;
  name: string;
  model_id: string;
  provider: string;
  api_key_hint: string; // last 4 chars only, e.g. "...ab12"
  active: boolean;
  created_date: number;
}
