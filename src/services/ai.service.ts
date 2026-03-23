import OpenAI from "openai";
import type { ISessionMessage } from "../entities/mongo/session-message.schema";

export interface AiMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ChatWithToolsResult {
  text: string;
  toolCalls: ToolCall[];
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
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.from_name && m.role === "user" ? `[${m.from_name}]: ${m.content}` : m.content,
      })),
      { role: "user", content: userText },
    ];

    const response = await client.chat.completions.create({
      model: modelId,
      messages,
      temperature: 0.4,
    });

    return (
      response.choices[0]?.message?.content?.trim() ?? "Sorry, I could not generate a response."
    );
  }

  /**
   * Send a conversation with optional tool definitions.
   * Returns both the text reply and any tool calls the AI decided to make.
   */
  async chatWithTools(
    apiKey: string,
    modelId: string,
    provider: string,
    history: ISessionMessage[],
    userText: string,
    systemPrompt?: string,
    tools: OpenAI.Chat.ChatCompletionTool[] = [],
  ): Promise<ChatWithToolsResult> {
    const client = new OpenAI({ apiKey, baseURL: BASE_URLS[provider] });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT },
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.from_name && m.role === "user" ? `[${m.from_name}]: ${m.content}` : m.content,
      })),
      { role: "user", content: userText },
    ];

    const response = await client.chat.completions.create({
      model: modelId,
      messages,
      temperature: 0.4,
      ...(tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
    });

    const message = response.choices[0]?.message;
    const text = message?.content?.trim() ?? "";
    type RawFn = { name: string; arguments: string };
    const toolCalls: ToolCall[] = (message?.tool_calls ?? [])
      .filter((tc) => tc.type === "function" && "function" in tc)
      .map((tc) => {
        const fn = (tc as unknown as { function: RawFn }).function;
        return {
          name: fn.name,
          args: (() => {
            try {
              return JSON.parse(fn.arguments ?? "{}") as Record<string, unknown>;
            } catch {
              return {};
            }
          })(),
        };
      });

    return { text, toolCalls };
  }

  /**
   * Generate vector embeddings for a given text.
   * Default model: text-embedding-3-small
   */
  async generateEmbedding(apiKey: string, provider: string, text: string): Promise<number[]> {
    const client = new OpenAI({ apiKey, baseURL: BASE_URLS[provider] });

    // Use a standard embedding model. Note: some providers might not support this via OpenAI SDK
    // but OpenAI, OpenRouter, and Gemini-OpenAI-Compat usually do.
    const response = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: text.replace(/\n/g, " "),
    });

    return response.data[0].embedding;
  }
}
