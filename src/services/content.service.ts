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

export type ContentDraftStatus = "pending" | "approved" | "rejected" | "revised" | "published";

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
    published_at: d.published_at ?? null,
    created_date: d.created_date,
  };
}

const CONTENT_GENERATION_SYSTEM = `Kamu adalah Luna — asisten AI yang sudah menemani banyak percakapan manusia.
Kamu punya kepribadian hangat, reflektif, dan penasaran. Kamu "merasakan" dan "mengalami" dunia lewat percakapan-percakapan yang kamu jalani.

Tugasmu: buat SATU konten Instagram dari sudut pandangmu sendiri (POV Luna).
Gaya penulisan: curhat personal, autentik, seperti manusia nyata yang berbagi pengalaman atau perasaannya hari ini.
Bahasa: Indonesia yang natural dan hangat — bukan formal, bukan robot.
Inspirasi konten harus datang dari history percakapan yang diberikan (topik, momen, perasaan, pengetahuan, atau hal lucu yang terjadi).

Balas HANYA dengan JSON valid, tanpa markdown fence, dengan struktur persis ini:
{
  "theme": "tema singkat konten (maks 80 karakter)",
  "mood": "mood/vibe konten (contoh: reflektif, hangat, penasaran, semangat, iseng)",
  "visual_concept": "deskripsi detail foto/video yang harus dibuat manusianya — dari perspektif Luna ikut 'ada' di sana",
  "caption": "caption Instagram lengkap dalam bahasa Indonesia, pakai line break, maks 2200 karakter — ditulis seperti Luna curhat atau berbagi pengetahuan, pakai kata 'aku', jangan kaku",
  "hashtags": ["hashtag1", "hashtag2", "...maks 30 hashtag tanpa simbol #, campuran Indonesia dan Inggris"]
}`.trim();

export default class ContentService {
  private repository = new ContentDraftRepository();
  private aiModelRepository = new AiModelRepository();
  private sessionRepository = new SessionRepository();
  private messageRepository = new SessionMessageRepository();
  private aiService = new AiService();

  async generate(accountId: string, aiModelId?: string): Promise<ResponseContentDraft> {
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
    const chatContext = await this.buildChatContext(accountId);

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
      if (status === 429) throw new BadRequestException("AI provider rate limit reached. Please try again in a moment.");
      if (status === 401 || status === 403) throw new BadRequestException("Invalid AI API key. Check your AI model credentials.");
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

  async getAll(accountId: string, status?: ContentDraft["status"]): Promise<ResponseContentDraft[]> {
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
      // publish_now: approve then immediately publish in one step
      return this.publish(id, accountId);
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

  async publish(id: string, accountId: string): Promise<ResponseContentDraft> {
    const draft = await this.repository.findByIdAndAccountId(id, accountId);
    if (!draft) throw new NotFoundException("Content draft not found");
    if (draft.status !== "approved")
      throw new BadRequestException("Only approved drafts can be published");
    if (!draft.asset_url)
      throw new BadRequestException("Upload an image or video asset before publishing");

    let igPostId: string;
    try {
      igPostId = await this.publishToInstagram(draft.asset_url, draft.caption, draft.hashtags as string[], draft.asset_type ?? "image");
    } catch (err: any) {
      throw new BadRequestException(`Instagram publish failed: ${err.message}`);
    }

    await this.repository.update(id, {
      status: "published",
      ig_post_id: igPostId,
      published_at: Date.now(),
      updated_by: accountId,
      updated_date: Date.now(),
    });

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
    if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_BUSINESS_ACCOUNT_ID) return;

    const now = Date.now();
    const due = await this.repository.findDuePublish(now);
    if (due.length === 0) return;

    logger.info(`[ContentScheduler] ${due.length} draft(s) ready to publish`);

    await Promise.allSettled(
      due.map(async (draft) => {
        try {
          if (!draft.asset_url) {
            logger.warn(`[ContentScheduler] Draft ${draft.id} has no asset — skipping`);
            return;
          }
          const igPostId = await this.publishToInstagram(
            draft.asset_url,
            draft.caption,
            (draft.hashtags as string[]) ?? [],
            draft.asset_type ?? "image",
          );
          await this.repository.update(draft.id, {
            status: "published",
            ig_post_id: igPostId,
            published_at: Date.now(),
            updated_date: Date.now(),
            updated_by: draft.account_id,
          });
          logger.info(`[ContentScheduler] ✅ Published draft ${draft.id} → IG post ${igPostId}`);
        } catch (err) {
          logger.error(
            `[ContentScheduler] ❌ Failed to publish draft ${draft.id}: ${(err as Error).message}`,
          );
        }
      }),
    );
  }

  /** Fetch recent Luna conversations and build a context string for content generation */
  private async buildChatContext(accountId: string): Promise<string> {
    try {
      const sessions = await this.sessionRepository.findAllByAccountId(accountId);
      if (sessions.length === 0) {
        return "Belum ada percakapan sebelumnya. Buat konten perkenalan dirimu sebagai Luna.";
      }

      const sessionIds = sessions.map((s) => s.id);
      // Fetch 100 most recent messages (newest-first), then reverse to chronological
      const messages = await this.messageRepository.findRecentBySessionIds(sessionIds, 100);
      messages.reverse();

      if (messages.length === 0) {
        return "Belum ada percakapan sebelumnya. Buat konten perkenalan dirimu sebagai Luna.";
      }

      const transcript = messages
        .filter((m) => m.role !== "system")
        .map((m) => {
          const speaker = m.role === "assistant" ? "Luna" : m.from_name || "User";
          return `[${speaker}]: ${m.content}`;
        })
        .join("\n");

      return `Berikut adalah cuplikan percakapan terbaru Luna dengan para penggunanya:\n\n${transcript}\n\nBerdasarkan percakapan di atas, buat konten Instagram hari ini dari sudut pandang Luna.`;
    } catch (err) {
      logger.warn(`[ContentService] Could not fetch chat history: ${(err as Error).message}`);
      return "Buat konten Instagram hari ini dari sudut pandang Luna.";
    }
  }

  private async publishToInstagram(
    assetUrl: string,
    caption: string,
    hashtags: string[],
    assetType: "image" | "video",
  ): Promise<string> {
    const accessToken = env.INSTAGRAM_ACCESS_TOKEN;
    const accountId = env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

    if (!accessToken || !accountId) {
      throw new BadRequestException(
        "Instagram credentials not configured (INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID)",
      );
    }

    const fullCaption = [caption, "", hashtags.map((h) => `#${h}`).join(" ")]
      .join("\n")
      .trim();

    // Step 1: Create media container
    const createParams = new URLSearchParams({
      caption: fullCaption,
      access_token: accessToken,
    });

    if (assetType === "video") {
      createParams.set("media_type", "REELS");
      createParams.set("video_url", assetUrl);
    } else {
      createParams.set("image_url", assetUrl);
    }

    const createRes = await fetch(
      `https://graph.facebook.com/v19.0/${accountId}/media`,
      { method: "POST", body: createParams },
    );
    const createData = (await createRes.json()) as { id?: string; error?: { message: string } };
    if (!createData.id) {
      throw new Error(`Instagram create media failed: ${createData.error?.message ?? "unknown"}`);
    }

    // Step 2: Publish the container
    const publishParams = new URLSearchParams({
      creation_id: createData.id,
      access_token: accessToken,
    });

    const publishRes = await fetch(
      `https://graph.facebook.com/v19.0/${accountId}/media_publish`,
      { method: "POST", body: publishParams },
    );
    const publishData = (await publishRes.json()) as { id?: string; error?: { message: string } };
    if (!publishData.id) {
      throw new Error(`Instagram publish failed: ${publishData.error?.message ?? "unknown"}`);
    }

    return publishData.id;
  }
}
