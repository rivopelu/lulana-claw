import OpenAI from "openai";
import type { ISessionMessage } from "../entities/mongo/session-message.schema";
import { DEFAULT_SYSTEM_PROMPT } from "../prompts";

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

const BASE_URLS: Record<string, string | undefined> = {
  openai: undefined, // default OpenAI endpoint
  openrouter: "https://openrouter.ai/api/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/",
  anthropic: "https://api.anthropic.com/v1/",
  claude_code: "https://api.anthropic.com/v1/",
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
    baseUrl?: string,
  ): Promise<string> {
    if (provider === "claude_code") {
      return this.chatClaudeCodeProxy(apiKey, modelId, history, userText, systemPrompt, baseUrl);
    }
    if (provider === "anthropic") {
      return this.chatAnthropic(apiKey, modelId, history, userText, systemPrompt, baseUrl);
    }

    const client = new OpenAI({ apiKey, baseURL: baseUrl || BASE_URLS[provider] });

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
      temperature: 0.6,
    });

    return (
      response.choices[0]?.message?.content?.trim() ?? "Sorry, I could not generate a response."
    );
  }

  private async chatAnthropic(
    apiKey: string,
    modelId: string,
    history: ISessionMessage[],
    userText: string,
    systemPrompt?: string,
    baseUrl?: string,
  ): Promise<string> {
    const messages = [
      ...history.map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: m.from_name && m.role === "user" ? `[${m.from_name}]: ${m.content}` : m.content,
      })),
      { role: "user" as const, content: userText },
    ];

    const url = baseUrl
      ? `${baseUrl.replace(/\/$/, "")}/messages`
      : "https://api.anthropic.com/v1/messages";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        system: systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT,
        messages,
        max_tokens: 4096,
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic Error (${response.status}): ${err}`);
    }

    const data = (await response.json()) as any;
    return data.content?.[0]?.text?.trim() ?? "Sorry, I could not generate a response.";
  }

  private async chatClaudeCodeProxy(
    apiKey: string,
    modelId: string,
    history: ISessionMessage[],
    userText: string,
    systemPrompt?: string,
    baseUrl?: string,
  ): Promise<string> {
    const staticKey = "31439d9450ee063cf0e26d2aa5551d34849f599416605236027b4f6ff3eb0763";
    const defaultUrl = "http://38.147.122.69:3001";

    const finalKey = apiKey && apiKey.length > 20 && !apiKey.includes("...") ? apiKey : staticKey;
    const finalUrl = baseUrl || defaultUrl;

    const masked = `${finalKey.slice(0, 4)}...${finalKey.slice(-4)}`;
    console.log(`[ClaudeCodeProxy] Sending to ${finalUrl}/v1/messages with key ${masked}`);

    const messages = [
      ...history.map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: m.from_name && m.role === "user" ? `[${m.from_name}]: ${m.content}` : m.content,
      })),
      { role: "user" as const, content: userText },
    ];

    // Ensure URL points to /v1/messages
    const url = finalUrl.endsWith("/v1")
      ? `${finalUrl}/messages`
      : `${finalUrl.replace(/\/$/, "")}/v1/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": finalKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: modelId || "claude-3-7-sonnet-20250219",
        system: systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT,
        messages,
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`[ClaudeCodeProxy] Error ${response.status}: ${err}`);
      throw new Error(`Claude Code Proxy Error (${response.status}): ${err}`);
    }

    const data = (await response.json()) as any;
    console.log(`[ClaudeCodeProxy] Success response received`);
    // Anthropic format: data.content[0].text
    return data.content?.[0]?.text?.trim() ?? "Sorry, I could not generate a response.";
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
      temperature: 0.6,
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
    // Anthropic and Claude Code don't support OpenAI embedding endpoint.
    // Use OpenAI or Gemini if available, or skip for these providers.
    if (provider === "anthropic" || provider === "claude_code") {
      // Fallback or skip
      throw new Error(`Embeddings not supported for provider: ${provider}`);
    }

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
