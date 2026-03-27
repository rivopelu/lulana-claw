import ContentDraftRepository from "../repositories/content-draft.repository";
import AiModelRepository from "../repositories/ai-model.repository";
import SessionRepository from "../repositories/session.repository";
import SessionMessageRepository from "../repositories/session-message.repository";
import type { ContentDraft } from "../entities/pg/content-draft.entity";
import { BadRequestException, NotFoundException } from "../libs/exception";
import { generateId } from "../libs/string-utils";
import AiService from "./ai.service";
import { env } from "../configs/env";
import logger from "../configs/logger";
import {
  CONTENT_GENERATION_SYSTEM,
  CONTENT_NO_HISTORY_PROMPT,
  CONTENT_CUSTOM_PROMPT_PREFIX,
  CONTENT_CUSTOM_INSTRUCTION_SUFFIX,
} from "../prompts";

export type ContentDraftStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "revised"
  | "partial_published"
  | "published";

export type PublishPlatform = "instagram" | "threads";

export interface ResponseContentDraft {
  id: string;
  account_id: string;
  theme: string;
  mood: string;
  visual_concept: string;
  caption: string;
  hashtags: string[];
  scheduled_at: number | null;
  status: ContentDraftStatus;
  asset_url: string | null;
  asset_type: "image" | "video" | null;
  revision_notes: string | null;
  ig_post_id: string | null;
  threads_post_id: string | null;
  published_at: number | null;
  created_date: number;
}

function toResponse(d: ContentDraft): ResponseContentDraft {
  return {
    id: d.id,
    account_id: d.account_id,
    theme: d.theme,
    mood: d.mood,
    visual_concept: d.visual_concept,
    caption: d.caption,
    hashtags: (d.hashtags as string[]) ?? [],
    scheduled_at: d.scheduled_at ?? null,
    status: d.status as ContentDraftStatus,
    asset_url: d.asset_url ?? null,
    asset_type: (d.asset_type as "image" | "video" | null) ?? null,
    revision_notes: d.revision_notes ?? null,
    ig_post_id: d.ig_post_id ?? null,
    threads_post_id: d.threads_post_id ?? null,
    published_at: d.published_at ?? null,
    created_date: d.created_date,
  };
}

export default class ContentService {
  private repository = new ContentDraftRepository();
  private aiModelRepository = new AiModelRepository();
  private sessionRepository = new SessionRepository();
  private messageRepository = new SessionMessageRepository();
  private aiService = new AiService();

  async generate(
    accountId: string,
    aiModelId?: string,
    customPrompt?: string,
  ): Promise<ResponseContentDraft> {
    // Find the AI model to use
    let model;
    if (aiModelId) {
      model = await this.aiModelRepository.findByIdAndAccountId(aiModelId, accountId);
      if (!model) throw new NotFoundException("AI model not found");
    } else {
      const models = await this.aiModelRepository.findAll(accountId);
      if (models.length === 0)
        throw new BadRequestException("No AI model configured. Add one in AI Models first.");
      model = models[0];
    }

    // Build chat history context from Luna's recent conversations
    const chatContext = await this.buildChatContext(accountId, customPrompt);

    let raw: string;
    try {
      raw = await this.aiService.chat(
        model.api_key,
        model.model_id,
        model.provider,
        [],
        chatContext,
        CONTENT_GENERATION_SYSTEM,
      );
    } catch (err: any) {
      const msg = err?.message ?? "AI provider error";
      const status = err?.status ?? err?.statusCode;
      if (status === 429)
        throw new BadRequestException(
          "AI provider rate limit reached. Please try again in a moment.",
        );
      if (status === 401 || status === 403)
        throw new BadRequestException("Invalid AI API key. Check your AI model credentials.");
      throw new BadRequestException(`AI generation failed: ${msg}`);
    }

    let parsed: {
      theme: string;
      mood: string;
      visual_concept: string;
      caption: string;
      hashtags: string[];
    };

    try {
      // Extract JSON object from anywhere in the response (handles markdown fences and leading text)
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON object found");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      logger.warn(`[ContentService] AI response was not valid JSON:\n${raw}`);
      throw new BadRequestException("AI returned an invalid content format. Please try again.");
    }

    const id = generateId();
    await this.repository.save({
      id,
      account_id: accountId,
      theme: parsed.theme ?? "No theme",
      mood: parsed.mood ?? "neutral",
      visual_concept: parsed.visual_concept ?? "",
      caption: parsed.caption ?? "",
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
      status: "pending",
      created_by: accountId,
    });

    const draft = await this.repository.findById(id);
    return toResponse(draft!);
  }

  async getAll(
    accountId: string,
    status?: ContentDraft["status"],
  ): Promise<ResponseContentDraft[]> {
    const list = await this.repository.findAllByAccountId(accountId, status);
    return list.map(toResponse);
  }

  async getById(id: string, accountId: string): Promise<ResponseContentDraft> {
    const draft = await this.repository.findByIdAndAccountId(id, accountId);
    if (!draft) throw new NotFoundException("Content draft not found");
    return toResponse(draft);
  }

  async approve(
    id: string,
    accountId: string,
    scheduledAt?: number,
    publishNow = false,
    platforms?: PublishPlatform[],
  ): Promise<ResponseContentDraft> {
    const draft = await this.repository.findByIdAndAccountId(id, accountId);
    if (!draft) throw new NotFoundException("Content draft not found");

    await this.repository.update(id, {
      status: "approved",
      scheduled_at: scheduledAt ?? null,
      updated_by: accountId,
      updated_date: Date.now(),
    });

    if (publishNow) {
      return this.publish(id, accountId, platforms);
    }

    const updated = await this.repository.findById(id);
    return toResponse(updated!);
  }

  async reject(id: string, accountId: string): Promise<void> {
    const draft = await this.repository.findByIdAndAccountId(id, accountId);
    if (!draft) throw new NotFoundException("Content draft not found");
    await this.repository.update(id, {
      status: "rejected",
      updated_by: accountId,
      updated_date: Date.now(),
    });
  }

  async revise(id: string, accountId: string, notes: string): Promise<void> {
    const draft = await this.repository.findByIdAndAccountId(id, accountId);
    if (!draft) throw new NotFoundException("Content draft not found");
    await this.repository.update(id, {
      status: "revised",
      revision_notes: notes,
      updated_by: accountId,
      updated_date: Date.now(),
    });
  }

  async updateCaption(
    id: string,
    accountId: string,
    caption: string,
    hashtags?: string[],
  ): Promise<ResponseContentDraft> {
    const draft = await this.repository.findByIdAndAccountId(id, accountId);
    if (!draft) throw new NotFoundException("Content draft not found");
    await this.repository.update(id, {
      caption,
      ...(hashtags !== undefined && { hashtags }),
      updated_by: accountId,
      updated_date: Date.now(),
    });
    const updated = await this.repository.findById(id);
    return toResponse(updated!);
  }

  async setAsset(
    id: string,
    accountId: string,
    assetUrl: string,
    assetType: "image" | "video",
  ): Promise<ResponseContentDraft> {
    const draft = await this.repository.findByIdAndAccountId(id, accountId);
    if (!draft) throw new NotFoundException("Content draft not found");
    await this.repository.update(id, {
      asset_url: assetUrl,
      asset_type: assetType,
      updated_by: accountId,
      updated_date: Date.now(),
    });
    const updated = await this.repository.findById(id);
    return toResponse(updated!);
  }

  async publish(
    id: string,
    accountId: string,
    platforms?: PublishPlatform[],
  ): Promise<ResponseContentDraft> {
    const draft = await this.repository.findByIdAndAccountId(id, accountId);
    if (!draft) throw new NotFoundException("Content draft not found");
    if (draft.status !== "approved" && draft.status !== "partial_published")
      throw new BadRequestException("Only approved or partial_published drafts can be published");

    const hasAsset = !!draft.asset_url;
    const hashtags = (draft.hashtags as string[]) ?? [];

    // Determine target platforms
    const targets: PublishPlatform[] = platforms?.length
      ? platforms
      : hasAsset
        ? ["threads", "instagram"]
        : ["threads"];

    if (targets.includes("instagram") && !hasAsset) {
      throw new BadRequestException("Upload asset terlebih dahulu sebelum publish ke Instagram");
    }

    const updates: Record<string, unknown> = {
      updated_by: accountId,
      updated_date: Date.now(),
    };

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    if (targets.includes("threads") && !draft.threads_post_id) {
      try {
        const threadsId = await this.publishToThreads(
          draft.caption,
          hashtags,
          hasAsset ? draft.asset_url! : undefined,
          hasAsset ? (draft.asset_type ?? "image") : undefined,
        );
        updates.threads_post_id = threadsId;
        successCount++;
        logger.info(`[Publish] Threads ✅ ${threadsId}`);
      } catch (err: any) {
        failCount++;
        errors.push(`Threads: ${err.message}`);
        logger.error(`[Publish] Threads ❌ ${err.message}`);
      }
    } else if (draft.threads_post_id) {
      successCount++; // already published
    }

    if (targets.includes("instagram") && !draft.ig_post_id) {
      try {
        const igId = await this.publishToInstagram(
          draft.asset_url!,
          draft.caption,
          hashtags,
          draft.asset_type ?? "image",
        );
        updates.ig_post_id = igId;
        successCount++;
        logger.info(`[Publish] Instagram ✅ ${igId}`);
      } catch (err: any) {
        failCount++;
        errors.push(`Instagram: ${err.message}`);
        logger.error(`[Publish] Instagram ❌ ${err.message}`);
      }
    } else if (draft.ig_post_id) {
      successCount++; // already published
    }

    if (successCount === 0) {
      throw new BadRequestException(`Publish failed: ${errors.join(" | ")}`);
    }

    const allDone = failCount === 0;
    updates.status = allDone ? "published" : "partial_published";
    if (allDone) updates.published_at = Date.now();

    await this.repository.update(id, updates as any);
    const updated = await this.repository.findById(id);
    return toResponse(updated!);
  }

  async delete(id: string, accountId: string): Promise<void> {
    const draft = await this.repository.findByIdAndAccountId(id, accountId);
    if (!draft) throw new NotFoundException("Content draft not found");
    await this.repository.update(id, {
      active: false,
      deleted_by: accountId,
      deleted_date: Date.now(),
    });
  }

  /** Called by the publish scheduler every minute */
  async runPublishScheduler(): Promise<void> {
    const now = Date.now();
    const due = await this.repository.findDuePublish(now);
    if (due.length === 0) return;

    logger.info(`[ContentScheduler] ${due.length} draft(s) ready to publish`);

    await Promise.allSettled(
      due.map(async (draft) => {
        try {
          await this.publish(draft.id, draft.account_id);
          logger.info(`[ContentScheduler] ✅ Published draft ${draft.id}`);
        } catch (err) {
          logger.error(
            `[ContentScheduler] ❌ Failed to publish draft ${draft.id}: ${(err as Error).message}`,
          );
        }
      }),
    );
  }

  private async publishToThreads(
    caption: string,
    hashtags: string[],
    assetUrl?: string,
    assetType?: "image" | "video",
  ): Promise<string> {
    const accessToken = (env.THREADS_ACCESS_TOKEN ?? env.INSTAGRAM_ACCESS_TOKEN)?.trim();
    // Threads user ID: use dedicated env or fall back to Instagram user ID
    const threadsUserId = (env.THREADS_USER_ID ?? env.INSTAGRAM_BUSINESS_ACCOUNT_ID)?.trim();

    if (!accessToken || !threadsUserId) {
      throw new Error(
        "Threads credentials not configured (THREADS_ACCESS_TOKEN + THREADS_USER_ID)",
      );
    }

    const hashtagStr = hashtags.map((h) => `#${h}`).join(" ");
    const combined = `${caption}\n\n${hashtagStr}`.trim();
    let fullText: string;
    if (combined.length <= 400) {
      fullText = combined;
    } else if (caption.length <= 400) {
      fullText = caption; // drop hashtags to stay within 400-char limit
    } else {
      fullText = caption.slice(0, 397).trimEnd() + "…";
    }

    // Step 1: Create container
    const containerBody: Record<string, string> = { text: fullText };
    if (assetUrl && assetType === "video") {
      containerBody.media_type = "VIDEO";
      containerBody.video_url = assetUrl;
    } else if (assetUrl) {
      containerBody.media_type = "IMAGE";
      containerBody.image_url = assetUrl;
    } else {
      containerBody.media_type = "TEXT";
    }

    const createData = await this.igPost<{
      id?: string;
      error?: { message: string; is_transient?: boolean };
    }>(`https://graph.threads.net/v1.0/${threadsUserId}/threads`, accessToken, containerBody);
    if (!createData.id) {
      logger.error(`[Threads] Create container response: ${JSON.stringify(createData)}`);
      throw new Error(
        `Threads create container failed: ${createData.error?.message ?? JSON.stringify(createData)}`,
      );
    }

    logger.info(`[Threads] Container created: ${createData.id}`);

    // Step 2: Poll until FINISHED (only needed for media; text posts are instant)
    if (assetUrl) {
      await this.waitForContainer(createData.id, accessToken, "threads");
    }

    // Step 3: Publish
    const publishData = await this.igPost<{ id?: string; error?: { message: string } }>(
      `https://graph.threads.net/v1.0/${threadsUserId}/threads_publish`,
      accessToken,
      { creation_id: createData.id },
    );
    if (!publishData.id) {
      logger.error(`[Threads] Publish response: ${JSON.stringify(publishData)}`);
      throw new Error(
        `Threads publish failed: ${publishData.error?.message ?? JSON.stringify(publishData)}`,
      );
    }

    logger.info(`[Threads] Published: ${publishData.id}`);
    return publishData.id;
  }

  /** Fetch recent Luna conversations and build a context string for content generation */
  private async buildChatContext(accountId: string, customPrompt?: string): Promise<string> {
    const trimmedPrompt = customPrompt?.trim();
    const fallback = trimmedPrompt
      ? `${CONTENT_CUSTOM_PROMPT_PREFIX} ${trimmedPrompt}`
      : CONTENT_NO_HISTORY_PROMPT;
    const instruction = trimmedPrompt
      ? `\n\n${CONTENT_CUSTOM_PROMPT_PREFIX} ${trimmedPrompt}`
      : CONTENT_CUSTOM_INSTRUCTION_SUFFIX;

    try {
      const sessions = await this.sessionRepository.findAllByAccountId(accountId);
      if (sessions.length === 0) return fallback;

      const sessionIds = sessions.map((s) => s.id);
      // Fetch 100 most recent messages (newest-first), then reverse to chronological
      const messages = await this.messageRepository.findRecentBySessionIds(sessionIds, 100);
      messages.reverse();

      if (messages.length === 0) return fallback;

      const transcript = messages
        .filter((m) => m.role !== "system")
        .map((m) => {
          const speaker = m.role === "assistant" ? "Luna" : m.from_name || "User";
          return `[${speaker}]: ${m.content}`;
        })
        .join("\n");

      return `Berikut adalah cuplikan percakapan terbaru Luna dengan para penggunanya:\n\n${transcript}${instruction}`;
    } catch (err) {
      logger.warn(`[ContentService] Could not fetch chat history: ${(err as Error).message}`);
      return fallback;
    }
  }

  private async publishToInstagram(
    assetUrl: string,
    caption: string,
    hashtags: string[],
    assetType: "image" | "video",
  ): Promise<string> {
    // Trim to remove any accidental whitespace / newline from .env
    const accessToken = env.INSTAGRAM_ACCESS_TOKEN?.trim();
    const igUserId = env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim();

    if (!accessToken || !igUserId) {
      throw new Error(
        "Instagram credentials not configured (INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID)",
      );
    }

    const fullCaption = [caption, "", hashtags.map((h) => `#${h}`).join(" ")].join("\n").trim();

    // Step 1: Create media container — send all params as JSON body with Bearer header
    const createBody: Record<string, string> = { caption: fullCaption };
    if (assetType === "video") {
      createBody.media_type = "REELS";
      createBody.video_url = assetUrl;
    } else {
      createBody.image_url = assetUrl;
    }

    const createData = await this.igPost<{
      id?: string;
      error?: { message: string; code?: number; is_transient?: boolean };
    }>(`https://graph.instagram.com/v21.0/${igUserId}/media`, accessToken, createBody);
    if (!createData.id) {
      logger.error(`[Instagram] Create media response: ${JSON.stringify(createData)}`);
      throw new Error(
        `Instagram create media failed: ${createData.error?.message ?? JSON.stringify(createData)}`,
      );
    }

    logger.info(`[Instagram] Media container created: ${createData.id}`);

    // Step 2: Wait until container status = FINISHED
    await this.waitForContainer(createData.id, accessToken, "instagram");

    // Step 3: Publish the container
    const publishData = await this.igPost<{
      id?: string;
      error?: { message: string; is_transient?: boolean };
    }>(`https://graph.instagram.com/v21.0/${igUserId}/media_publish`, accessToken, {
      creation_id: createData.id,
    });
    if (!publishData.id) {
      logger.error(`[Instagram] Publish response: ${JSON.stringify(publishData)}`);
      throw new Error(
        `Instagram publish failed: ${publishData.error?.message ?? JSON.stringify(publishData)}`,
      );
    }

    logger.info(`[Instagram] Published successfully: ${publishData.id}`);
    return publishData.id;
  }

  /** Poll media container status until FINISHED (max 90s) */
  private async waitForContainer(
    containerId: string,
    accessToken: string,
    platform: "instagram" | "threads" = "instagram",
  ): Promise<void> {
    const baseUrl =
      platform === "threads"
        ? `https://graph.threads.net/v1.0`
        : `https://graph.instagram.com/v21.0`;
    const label = platform === "threads" ? "Threads" : "Instagram";
    const maxAttempts = 18; // 18 × 5s = 90s max
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise((r) => setTimeout(r, 5000));

      const res = await fetch(`${baseUrl}/${containerId}?fields=status_code,status`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = (await res.json()) as {
        status_code?: string; // Instagram field
        status?: string; // Threads field (also fallback)
        error?: { message: string };
      };

      // Threads returns `status`, Instagram returns `status_code`
      const statusValue = platform === "threads" ? data.status : (data.status_code ?? data.status);

      logger.info(
        `[${label}] Container ${containerId} status: ${statusValue} (attempt ${attempt}/${maxAttempts})`,
      );

      if (statusValue === "FINISHED") return;
      if (statusValue === "ERROR" || statusValue === "EXPIRED") {
        throw new Error(
          `Media container ${statusValue?.toLowerCase()}: ${data.status ?? "unknown reason"}`,
        );
      }
      // IN_PROGRESS → continue polling
    }
    throw new Error(`[${label}] Media container did not finish processing within 90 seconds`);
  }

  /** POST to Instagram Graph API with automatic retry on transient errors */
  private async igPost<T>(
    url: string,
    accessToken: string,
    body: Record<string, string>,
  ): Promise<T> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as T & { error?: { is_transient?: boolean; code?: number } };

      const isTransient = data.error?.is_transient || data.error?.code === 2;
      if (data.error && isTransient && attempt < maxAttempts) {
        const delay = attempt * 3000;
        logger.warn(
          `[Instagram] Transient error on attempt ${attempt}/${maxAttempts}, retrying in ${delay}ms...`,
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return data as T;
    }
    // Should not reach here
    throw new Error("Instagram API: max retries exceeded");
  }
}
