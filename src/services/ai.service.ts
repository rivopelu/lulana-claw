import OpenAI from "openai";
import type { ISessionMessage } from "../entities/mongo/session-message.schema";

export interface AiMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const DEFAULT_SYSTEM_PROMPT =
  "You are Luluna Claw, a helpful AI assistant. " +
  "Be concise, friendly, and accurate. " +
  "If you are asked something you don't know, say so honestly.";

const BASE_URLS: Record<string, string | undefined> = {
  openai: undefined, // default OpenAI endpoint
  openrouter: "https://openrouter.ai/api/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/",
  anthropic: "https://api.anthropic.com/v1/",
};

export default class AiService {
  /**
   * Send a conversation to an AI provider and return the assistant's reply.
   * Supports OpenAI and OpenRouter (OpenAI-compatible).
   */
  async chat(
    apiKey: string,
    modelId: string,
    provider: string,
    history: ISessionMessage[],
    userText: string,
    systemPrompt?: string,
  ): Promise<string> {
    const client = new OpenAI({ apiKey, baseURL: BASE_URLS[provider] });

    const messages: AiMessage[] = [
      { role: "system", content: systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userText },
    ];

    const response = await client.chat.completions.create({
      model: modelId,
      messages,
    });

    return (
      response.choices[0]?.message?.content?.trim() ?? "Sorry, I could not generate a response."
    );
  }
}
