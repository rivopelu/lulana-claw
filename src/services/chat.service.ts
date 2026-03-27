import { OpenAI } from "openai";
import logger from "../configs/logger";
import AiService from "./ai.service";
import ContextService from "./context.service";
import GoogleService from "./google.service";
import LearningService from "./learning.service";
import SessionService, { type ChatType } from "./session.service";
import TaskService, { parseRemindTime, type ResponseTask } from "./task.service";
import FinanceService, { type ResponseBudgetSession } from "./finance.service";
import VectorService from "./vector.service";
import {
  TASK_CAPABILITY_PROMPT,
  FINANCE_CAPABILITY_PROMPT,
  GOOGLE_CAPABILITY_PROMPT,
  ANTI_HALLUCINATION_INSTRUCTION,
  buildPlatformContext,
  buildGroupContext,
  buildRagSection,
  buildRagContext,
  buildPendingTasksContext,
  buildBudgetContext,
  buildCalendarContext,
} from "../prompts";

const HISTORY_LIMIT = 20;

export interface ProcessMessageParams {
  clientId: string;
  chatId: number;
  chatType: ChatType;
  text: string;
  fromId: number;
  fromName: string;
  platform: string;
  channelName?: string;
  threadId?: number;
  aiModel: {
    account_id: string;
    model_id: string;
    api_key: string;
    provider: string;
  };
  entityMode?: "single" | "per_session";
}

export default class ChatService {
  /** Accounts whose Calendar API returned 403 — skip until server restart/reconnect */
  static calendarForbidden = new Set<string>();

  private aiService = new AiService();
  private contextService = new ContextService();
  private financeService = new FinanceService();
  private googleService = new GoogleService();
  private learningService = new LearningService();
  private sessionService = new SessionService();
  private taskService = new TaskService();
  private vectorService = new VectorService();

  async processMessage(params: ProcessMessageParams): Promise<{ reply: string; markers: any[] }> {
    const {
      clientId,
      chatId,
      chatType,
      text,
      fromId,
      fromName,
      platform,
      channelName,
      threadId,
      aiModel,
      entityMode = "per_session",
    } = params;
    const label = threadId
      ? `[Chat:${clientId}:${chatId}:thread${threadId}]`
      : `[Chat:${clientId}:${chatId}]`;

    const session = await this.sessionService.ensureSession(clientId, chatId, chatType, fromName, threadId);

    let userEmbedding: number[] | undefined;
    try {
      userEmbedding = await this.aiService.generateEmbedding(
        aiModel.api_key,
        aiModel.provider,
        text,
      );
    } catch (e) {
      logger.warn(`${label} Failed to generate embedding: ${(e as Error).message}`);
    }

    await this.sessionService.addMessage(
      session.id,
      "user",
      text,
      fromId.toString(),
      fromName,
      userEmbedding,
      platform,
      channelName ?? session.name,
    );

    let ragContext = "";
    if (userEmbedding) {
      const relHistory = await this.vectorService.searchHistory(session.id, userEmbedding, 10);
      const relContexts = await this.vectorService.searchContexts(
        aiModel.account_id,
        userEmbedding,
        {
          clientId,
          sessionId: session.id,
          limit: 3,
        },
      );

      ragContext = buildRagContext(relHistory, relContexts);
    }

    const history = await this.sessionService.getHistory(session.id, HISTORY_LIMIT + 1);

    let pendingTasks: ResponseTask[] = [];
    let pendingTasksContext = "";
    try {
      pendingTasks = await this.taskService.getByChatId(clientId, chatId, "pending");
      pendingTasksContext = buildPendingTasksContext(pendingTasks);
    } catch (e) {
      logger.warn(`${label} Failed to fetch tasks: ${(e as Error).message}`);
    }

    // Fetch active budget sessions for this chat
    let activeBudgetSessions: ResponseBudgetSession[] = [];
    let budgetContext = "";
    try {
      activeBudgetSessions = await this.financeService.getActiveSessions(clientId, chatId);
      budgetContext = buildBudgetContext(activeBudgetSessions);
    } catch (e) {
      logger.warn(`${label} Failed to fetch budget sessions: ${(e as Error).message}`);
    }

    // Fetch Google Calendar events if connected (skip if known forbidden)
    let googleCalendarContext = "";
    let googleConnected = false;
    try {
      const gToken = await this.googleService.getValidToken(aiModel.account_id);
      if (gToken) {
        googleConnected = true;
        if (!ChatService.calendarForbidden.has(aiModel.account_id)) {
          const events = await this.googleService.listCalendarEvents(gToken.token, 7);
          googleCalendarContext = buildCalendarContext(events);
        }
      }
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("Forbidden") || msg.includes("403")) {
        ChatService.calendarForbidden.add(aiModel.account_id);
        logger.warn(
          `${label} Google Calendar forbidden — suppressing further attempts until reconnect`,
        );
      } else {
        logger.warn(`${label} Failed to fetch Google Calendar: ${msg}`);
      }
    }

    const baseSystemPrompt = await this.contextService.buildSystemPrompt(
      aiModel.account_id,
      clientId,
      session.id,
      entityMode,
    );
    const nowStr = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    const isGroup = chatType !== "private";
    const resolvedChannelName = channelName ?? session.name;
    const platformContext = buildPlatformContext(platform, resolvedChannelName, chatType);
    const groupContext = buildGroupContext(isGroup);
    const systemPrompt = [
      baseSystemPrompt,
      platformContext,
      groupContext,
      ANTI_HALLUCINATION_INSTRUCTION,
      ragContext ? buildRagSection(ragContext) : "",
      pendingTasksContext ? `### CURRENT SCHEDULE/TASKS:\n${pendingTasksContext}` : "",
      budgetContext,
      googleCalendarContext,
      googleConnected ? GOOGLE_CAPABILITY_PROMPT : "",
      `[Waktu sekarang: ${nowStr}]`,
      TASK_CAPABILITY_PROMPT,
      FINANCE_CAPABILITY_PROMPT,
    ]
      .filter(Boolean)
      .join("\n\n");

    const aiText = isGroup ? `[${fromName}]: ${text}` : text;
    const rawReply = await withRetry(
      () =>
        this.aiService.chat(
          aiModel.api_key,
          aiModel.model_id,
          aiModel.provider,
          history.slice(0, -1),
          aiText,
          systemPrompt,
        ),
      label,
    );

    const taskConfirmations: string[] = [];
    const outgoingMarkers: any[] = [];

    for (const { action, args } of extractMarkers(rawReply)) {
      // helper to safely cast arg values
      const str = (v: unknown) => (typeof v === "string" ? v : String(v ?? ""));
      const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));

      if (action === "TASK_CREATE") {
        if (args.title) {
          const task = await this.taskService.create(
            {
              client_id: clientId,
              chat_id: chatId,
              session_id: session.id,
              type: (args.type as any) || "task",
              title: str(args.title),
              description: args.description ? str(args.description) : undefined,
              remind_at: args.remind_at_text
                ? (parseRemindTime(str(args.remind_at_text)) ?? undefined)
                : undefined,
            },
            aiModel.account_id,
          );
          const emo =
            { task: "📋", reminder: "⏰", notes: "📝", meeting: "🤝", deadline: "🚨" }[
              task.type as string
            ] || "📋";
          taskConfirmations.push(`${emo} *${task.title}* [${task.id.slice(-8)}]`);
        }
      } else if (action === "TASK_DONE" || action === "TASK_DELETE") {
        const suffix = str(args.id);
        const target = pendingTasks.find((t) => t.id.endsWith(suffix));
        if (target) {
          if (action === "TASK_DONE") {
            await this.taskService.markDone(target.id, aiModel.account_id);
            taskConfirmations.push(`✅ *${target.title}* selesai!`);
          } else {
            await this.taskService.delete(target.id, aiModel.account_id);
            taskConfirmations.push(`🗑️ *${target.title}* dihapus.`);
          }
        }
      } else if (action === "SEND_MESSAGE") {
        outgoingMarkers.push({
          type: "send_message",
          platform: str(args.platform),
          targetSessionName: str(args.target_session_name),
          text: str(args.text),
        });
        taskConfirmations.push(
          `📨 Pesan dijadwalkan untuk dikirim ke ${str(args.platform)} (${str(args.target_session_name)})`,
        );
      } else if (action === "GCAL_CREATE") {
        try {
          const gToken = await this.googleService.getValidToken(aiModel.account_id);
          if (gToken && args.title && args.start && args.end) {
            const event = await this.googleService.createCalendarEvent(
              gToken.token,
              str(args.title),
              str(args.start),
              str(args.end),
              args.description ? str(args.description) : undefined,
            );
            taskConfirmations.push(`📅 Event dibuat: *${event.summary}*\n${event.htmlLink}`);
          }
        } catch (e) {
          logger.error(`${label} GCAL_CREATE error: ${(e as Error).message}`);
          taskConfirmations.push(`⚠️ Gagal buat event kalender: ${googleErrorMessage(e)}`);
        }
      } else if (action === "GMAIL_SEND") {
        try {
          const gToken = await this.googleService.getValidToken(aiModel.account_id);
          if (gToken && args.to && args.subject && args.body) {
            await this.googleService.sendEmail(
              gToken.token,
              str(args.to),
              str(args.subject),
              str(args.body),
            );
            taskConfirmations.push(`📧 Email terkirim ke *${str(args.to)}*`);
          }
        } catch (e) {
          logger.error(`${label} GMAIL_SEND error: ${(e as Error).message}`);
          taskConfirmations.push(`⚠️ Gagal kirim email: ${googleErrorMessage(e)}`);
        }
      } else if (action === "GMAIL_LIST") {
        try {
          const gToken = await this.googleService.getValidToken(aiModel.account_id);
          if (gToken) {
            const emails = await this.googleService.listEmails(gToken.token, num(args.max) || 5);
            if (emails.length > 0) {
              taskConfirmations.push(
                `📬 *Email terbaru:*\n` +
                  emails
                    .map((e, i) => `${i + 1}. *${e.subject}* dari ${e.from}\n   ${e.snippet}`)
                    .join("\n"),
              );
            }
          }
        } catch (e) {
          logger.error(`${label} GMAIL_LIST error: ${(e as Error).message}`);
          taskConfirmations.push(`⚠️ Gagal ambil email: ${googleErrorMessage(e)}`);
        }
      } else if (action === "GDOC_CREATE") {
        try {
          const gToken = await this.googleService.getValidToken(aiModel.account_id);
          if (gToken && args.title) {
            const doc = await this.googleService.createDocument(
              gToken.token,
              str(args.title),
              args.content ? str(args.content) : "",
            );
            taskConfirmations.push(`📄 Dokumen dibuat: *${str(args.title)}*\n${doc.url}`);
          }
        } catch (e) {
          logger.error(`${label} GDOC_CREATE error: ${(e as Error).message}`);
          taskConfirmations.push(`⚠️ Gagal buat dokumen: ${googleErrorMessage(e)}`);
        }
      } else if (action === "BUDGET_START") {
        if (args.title && args.budget_amount) {
          // Guard: skip if an active session with the same title already exists
          const titleLower = str(args.title).toLowerCase();
          const duplicate = activeBudgetSessions.find(
            (s) => s.title.toLowerCase() === titleLower,
          );
          if (duplicate) {
            logger.info(`${label} BUDGET_START skipped — active session already exists: ${duplicate.id}`);
          } else try {
            const budgetSession = await this.financeService.createBudgetSession(
              {
                client_id: clientId,
                chat_id: chatId,
                session_id: session.id,
                title: str(args.title),
                budget_amount: num(args.budget_amount),
                currency: args.currency ? str(args.currency) : "IDR",
              },
              aiModel.account_id,
            );
            taskConfirmations.push(
              `💰 Sesi budget *${budgetSession.title}* dimulai! Budget: Rp${budgetSession.budget_amount.toLocaleString("id-ID")} [${budgetSession.id.slice(-8)}]`,
            );
          } catch (e) {
            logger.error(`${label} BUDGET_START error: ${(e as Error).message}`);
          }
        }
      } else if (action === "EXPENSE_LOG") {
        if (args.description && args.amount) {
          try {
            const tx = await this.financeService.createTransaction(
              {
                client_id: clientId,
                chat_id: chatId,
                budget_session_id: args.budget_session_id
                  ? (() => {
                      const suffix = str(args.budget_session_id);
                      return activeBudgetSessions.find((s) => s.id.endsWith(suffix))?.id;
                    })()
                  : undefined,
                description: str(args.description),
                amount: num(args.amount),
                category: (args.category as any) || "other",
                type: (args.type as any) || "expense",
              },
              aiModel.account_id,
            );
            const emo = tx.type === "income" ? "💵" : "💸";
            taskConfirmations.push(
              `${emo} *${tx.description}*: Rp${tx.amount.toLocaleString("id-ID")} [${tx.category}]`,
            );
          } catch (e) {
            logger.error(`${label} EXPENSE_LOG error: ${(e as Error).message}`);
          }
        }
      } else if (action === "BUDGET_END") {
        if (args.id) {
          try {
            const suffix = str(args.id);
            const target = activeBudgetSessions.find((s) => s.id.endsWith(suffix));
            if (target) {
              await this.financeService.completeSession(target.id, aiModel.account_id);
              const fmt = (n: number) => `Rp${n.toLocaleString("id-ID")}`;
              taskConfirmations.push(
                `✅ Sesi *${target.title}* selesai!\nTotal: ${fmt(target.total_spent)} / ${fmt(target.budget_amount)} | Sisa: ${fmt(target.remaining)}`,
              );
            }
          } catch (e) {
            logger.error(`${label} BUDGET_END error: ${(e as Error).message}`);
          }
        }
      } else if (action === "GLOBAL_CONTEXT_UPDATE") {
        if (args.content && str(args.content).trim()) {
          try {
            await this.contextService.appendAutoGlobalContext(
              aiModel.account_id,
              str(args.content).trim(),
            );
            taskConfirmations.push(`🧠 Global context diperbarui!`);
            logger.info(`${label} Global context updated via marker`);
          } catch (e) {
            logger.error(`${label} GLOBAL_CONTEXT_UPDATE error: ${(e as Error).message}`);
          }
        }
      }
    }

    let reply = rawReply
      .replace(
        /\[(TASK_CREATE|TASK_DONE|TASK_DELETE|SEND_MESSAGE|GCAL_CREATE|GCAL_LIST|GMAIL_SEND|GMAIL_LIST|GDOC_CREATE|GLOBAL_CONTEXT_UPDATE|BUDGET_START|EXPENSE_LOG|BUDGET_END):\{[\s\S]*?\}\]/g,
        "",
      )
      .trim();
    if (taskConfirmations.length > 0) {
      reply = reply
        ? `${reply}\n\n✅ Info:\n${taskConfirmations.join("\n")}`
        : `✅ Info:\n${taskConfirmations.join("\n")}`;
    }

    // Safety: never send empty reply
    if (!reply.trim()) {
      reply = "✅ Selesai.";
    }

    let replyEmbedding: number[] | undefined;
    try {
      replyEmbedding = await this.aiService.generateEmbedding(
        aiModel.api_key,
        aiModel.provider,
        reply,
      );
    } catch {}
    await this.sessionService.addMessage(
      session.id,
      "assistant",
      reply,
      undefined,
      undefined,
      replyEmbedding,
      platform,
      channelName ?? session.name,
    );

    // Fire-and-forget: session auto-learn every AUTO_LEARN_INTERVAL messages
    this.learningService
      .maybeAutoLearn({
        sessionId: session.id,
        accountId: aiModel.account_id,
        clientId,
        sessionName: session.name,
        aiModel,
      })
      .catch((err) => logger.error(`${label} Auto-learn error: ${(err as Error).message}`));

    // Fire-and-forget: global context update — filter important knowledge from this exchange
    this.learningService
      .maybeUpdateGlobalContext({
        sessionId: session.id,
        accountId: aiModel.account_id,
        lastExchange: { userText: text, lunaReply: reply },
        aiModel,
      })
      .catch((err) => logger.warn(`${label} Global learn error: ${(err as Error).message}`));

    return { reply, markers: outgoingMarkers };
  }
}

const MARKER_ACTIONS = [
  "TASK_CREATE",
  "TASK_DONE",
  "TASK_DELETE",
  "SEND_MESSAGE",
  "GCAL_CREATE",
  "GCAL_LIST",
  "GMAIL_SEND",
  "GMAIL_LIST",
  "GDOC_CREATE",
  "GLOBAL_CONTEXT_UPDATE",
  "BUDGET_START",
  "EXPENSE_LOG",
  "BUDGET_END",
] as const;

/**
 * Robustly extract action markers from AI reply using bracket counting.
 * Handles bodies that contain `]`, newlines, or other problematic characters.
 */
function extractMarkers(text: string): Array<{ action: string; args: Record<string, unknown> }> {
  const results: Array<{ action: string; args: Record<string, unknown> }> = [];

  for (const action of MARKER_ACTIONS) {
    const prefix = `[${action}:`;
    let searchFrom = 0;

    while (searchFrom < text.length) {
      const start = text.indexOf(prefix, searchFrom);
      if (start === -1) break;

      // Find matching } by tracking depth, respecting strings and escapes
      const bodyStart = start + prefix.length;
      if (text[bodyStart] !== "{") {
        searchFrom = start + 1;
        continue;
      }

      let depth = 0;
      let inString = false;
      let escape = false;
      let bodyEnd = -1;

      for (let i = bodyStart; i < text.length; i++) {
        const ch = text[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (ch === "\\") {
          escape = true;
          continue;
        }
        if (ch === '"') {
          inString = !inString;
          continue;
        }
        if (inString) continue;
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            bodyEnd = i;
            break;
          }
        }
      }

      if (bodyEnd === -1) {
        searchFrom = start + 1;
        continue;
      }

      const rawJson = text.slice(bodyStart, bodyEnd + 1);
      try {
        // Sanitize literal newlines/tabs inside JSON before parsing
        const cleanJson = rawJson.replace(/\r?\n/g, "\\n").replace(/\t/g, "\\t");
        const args = JSON.parse(cleanJson) as Record<string, unknown>;
        results.push({ action, args });
      } catch (err) {
        // ignore malformed marker
      }

      searchFrom = bodyEnd + 1;
    }
  }

  return results;
}

function googleErrorMessage(e: unknown): string {
  const msg = (e as Error).message ?? "";
  if (msg.includes("Forbidden") || msg.includes("403")) {
    return "Akses ditolak (403). Pastikan Google API sudah diaktifkan (Calendar/Gmail/Docs) di Google Cloud Console dan reconnect Google di halaman Apps.";
  }
  if (msg.includes("Unauthorized") || msg.includes("401")) {
    return "Token kadaluarsa. Silakan reconnect Google di halaman Apps.";
  }
  return msg;
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const delays = [2000, 6000, 18000];
  let lastErr: unknown;
  for (let i = 0; i <= delays.length; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isRateLimit = err instanceof OpenAI.APIError && err.status === 429;
      const isServerErr = err instanceof OpenAI.APIError && (err.status ?? 0) >= 500;
      if ((!isRateLimit && !isServerErr) || i === delays.length) break;
      const retryAfter =
        isRateLimit && err instanceof OpenAI.APIError
          ? Number(err.headers?.["retry-after"] ?? 0) * 1000 || delays[i]
          : delays[i];
      logger.warn(`${label} retry ${i + 1} in ${retryAfter / 1000}s`);
      await new Promise((r) => setTimeout(r, retryAfter));
    }
  }
  throw lastErr;
}
