import type { Context } from "hono";
import { Controller, Delete, Get, Middleware, Post, Put } from "hono-decorators";
import { responseHelper } from "../libs/response-helper";
import JwtMiddleware from "../middleware/jwt-middleware";
import { getAccountId } from "../libs/utils";
import ContentService from "../services/content.service";
import { uploadToSupabase } from "../libs/supabase-storage";

@Controller("content")
@Middleware([JwtMiddleware])
export class ContentController {
  private contentService = new ContentService();

  @Get("")
  async getAll(c: Context) {
    const accountId = getAccountId(c);
    const status = c.req.query("status") as
      | "pending"
      | "approved"
      | "rejected"
      | "revised"
      | "published"
      | undefined;
    const drafts = await this.contentService.getAll(accountId, status);
    return c.json(responseHelper.data(drafts));
  }

  @Get(":id")
  async getById(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    const draft = await this.contentService.getById(id, accountId);
    return c.json(responseHelper.data(draft));
  }

  @Post("generate")
  async generate(c: Context) {
    const accountId = getAccountId(c);
    const body = await c.req.json().catch(() => ({}));
    const draft = await this.contentService.generate(accountId, body.ai_model_id, body.custom_prompt);
    return c.json(responseHelper.data(draft), 201);
  }

  @Put(":id/approve")
  async approve(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    const body = await c.req.json().catch(() => ({}));
    const draft = await this.contentService.approve(
      id,
      accountId,
      body.scheduled_at,
      body.publish_now === true,
      Array.isArray(body.platforms) ? body.platforms : undefined,
    );
    return c.json(responseHelper.data(draft));
  }

  @Put(":id/reject")
  async reject(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    await this.contentService.reject(id, accountId);
    return c.json(responseHelper.success("Draft rejected"));
  }

  @Put(":id/revise")
  async revise(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    const body = await c.req.json();
    await this.contentService.revise(id, accountId, body.notes ?? "");
    return c.json(responseHelper.success("Draft sent for revision"));
  }

  @Put(":id/caption")
  async updateCaption(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    const body = await c.req.json();
    const draft = await this.contentService.updateCaption(id, accountId, body.caption, body.hashtags);
    return c.json(responseHelper.data(draft));
  }

  @Post(":id/asset")
  async uploadAsset(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);

    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return c.json(responseHelper.error("No file provided", 400), 400);
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const imageExts = ["jpg", "jpeg", "png", "webp", "gif"];
    const videoExts = ["mp4", "mov", "avi", "webm"];
    const assetType = imageExts.includes(ext) ? "image" : videoExts.includes(ext) ? "video" : null;
    if (!assetType) {
      return c.json(responseHelper.error("Unsupported file type", 400), 400);
    }

    const filename = `content/${accountId}/${id}-${Date.now()}.${ext}`;
    const publicUrl = await uploadToSupabase(await file.arrayBuffer(), filename, file.type || `${assetType}/${ext}`);

    const draft = await this.contentService.setAsset(id, accountId, publicUrl, assetType);
    return c.json(responseHelper.data(draft));
  }

  @Post(":id/publish")
  async publish(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    const body = await c.req.json().catch(() => ({}));
    const platforms = Array.isArray(body.platforms) ? body.platforms : undefined;
    const draft = await this.contentService.publish(id, accountId, platforms);
    return c.json(responseHelper.data(draft));
  }

  @Delete(":id")
  async delete(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    await this.contentService.delete(id, accountId);
    return c.json(responseHelper.success("Draft deleted"));
  }
}
