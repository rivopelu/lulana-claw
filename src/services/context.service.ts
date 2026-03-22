import path from "path";
import fs from "fs";
import ContextRepository, { type CreateContextInput } from "../repositories/context.repository";
import type { IContext, ContextType, ContextCategory } from "../entities/mongo/context.schema";
import { NotFoundException } from "../libs/exception";
import { generateId } from "../libs/string-utils";
import logger from "../configs/logger";

const CONTEXTS_DIR = path.resolve("contexts");

function ensureContextsDir(): void {
  if (!fs.existsSync(CONTEXTS_DIR)) {
    fs.mkdirSync(CONTEXTS_DIR, { recursive: true });
  }
}

function contextFilePath(ctx: IContext): string {
  return path.join(CONTEXTS_DIR, `${ctx.type}_${ctx.category}_${ctx.context_id}.md`);
}

export interface RequestCreateContext {
  name: string;
  type: ContextType;
  category: ContextCategory;
  content: string;
  client_id?: string;
  session_id?: string;
  order?: number;
}

export interface RequestUpdateContext {
  name?: string;
  category?: ContextCategory;
  content?: string;
  order?: number;
}

export interface ResponseContext {
  id: string;
  name: string;
  type: ContextType;
  category: ContextCategory;
  content: string;
  client_id?: string;
  session_id?: string;
  order: number;
  created_at: Date;
  updated_at?: Date;
}

function toResponse(ctx: IContext): ResponseContext {
  return {
    id: ctx.context_id,
    name: ctx.name,
    type: ctx.type,
    category: ctx.category,
    content: ctx.content,
    client_id: ctx.client_id,
    session_id: ctx.session_id,
    order: ctx.order,
    created_at: ctx.created_at,
    updated_at: ctx.updated_at,
  };
}

export default class ContextService {
  private repository = new ContextRepository();

  async create(body: RequestCreateContext, accountId: string): Promise<ResponseContext> {
    const input: CreateContextInput = {
      context_id: generateId(),
      account_id: accountId,
      name: body.name,
      type: body.type,
      category: body.category,
      content: body.content,
      client_id: body.client_id,
      session_id: body.session_id,
      order: body.order ?? 0,
    };
    const ctx = await this.repository.create(input);
    this.writeToDisk(ctx);
    return toResponse(ctx);
  }

  async getAll(accountId: string): Promise<ResponseContext[]> {
    const list = await this.repository.findAllByAccountId(accountId);
    return list.map(toResponse);
  }

  async getById(contextId: string, accountId: string): Promise<ResponseContext> {
    const ctx = await this.repository.findByIdAndAccountId(contextId, accountId);
    if (!ctx) throw new NotFoundException("Context not found");
    return toResponse(ctx);
  }

  async update(contextId: string, body: RequestUpdateContext, accountId: string): Promise<void> {
    const ctx = await this.repository.findByIdAndAccountId(contextId, accountId);
    if (!ctx) throw new NotFoundException("Context not found");

    const updates: Partial<IContext> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.category !== undefined) updates.category = body.category;
    if (body.content !== undefined) updates.content = body.content;
    if (body.order !== undefined) updates.order = body.order;

    await this.repository.update(contextId, updates);

    // Re-write disk file with updated content
    const updated = await this.repository.findById(contextId);
    if (updated) {
      // If category changed, remove old file
      if (body.category && body.category !== ctx.category) {
        this.removeFromDisk(ctx);
      }
      this.writeToDisk(updated);
    }
  }

  async delete(contextId: string, accountId: string): Promise<void> {
    const ctx = await this.repository.findByIdAndAccountId(contextId, accountId);
    if (!ctx) throw new NotFoundException("Context not found");
    await this.repository.softDelete(contextId);
    this.removeFromDisk(ctx);
  }

  /** Sync all active contexts from MongoDB to disk as .md files */
  async syncAllToDisk(): Promise<void> {
    ensureContextsDir();

    // Clean up stale files
    const existingFiles = fs.readdirSync(CONTEXTS_DIR).filter((f) => f.endsWith(".md"));
    for (const file of existingFiles) {
      fs.unlinkSync(path.join(CONTEXTS_DIR, file));
    }

    const all = await this.repository.findAllActiveForSync();
    for (const ctx of all) {
      this.writeToDisk(ctx);
    }

    logger.info(`[ContextService] Synced ${all.length} context(s) to disk`);
  }

  /**
   * Build system prompt for a bot message.
   * Layers: global → client → session (if entity_mode = per_session)
   */
  async buildSystemPrompt(
    accountId: string,
    clientId: string,
    sessionId: string,
    entityMode: "single" | "per_session",
  ): Promise<string> {
    const globalContexts = await this.repository.findGlobal(accountId);
    const clientContexts = await this.repository.findByClientId(clientId);
    const sessionContexts =
      entityMode === "per_session" ? await this.repository.findBySessionId(sessionId) : [];

    const all = [...globalContexts, ...clientContexts, ...sessionContexts];
    if (all.length === 0) return "";

    return all.map((ctx) => `## ${ctx.name}\n\n${ctx.content}`).join("\n\n---\n\n");
  }

  private writeToDisk(ctx: IContext): void {
    ensureContextsDir();
    const filePath = contextFilePath(ctx);
    const content = `# ${ctx.name}\n\n**Type**: ${ctx.type}\n**Category**: ${ctx.category}\n\n${ctx.content}`;
    fs.writeFileSync(filePath, content, "utf-8");
  }

  private removeFromDisk(ctx: IContext): void {
    const filePath = contextFilePath(ctx);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
