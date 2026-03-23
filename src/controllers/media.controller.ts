import type { Context } from "hono";
import { Controller, Delete, Get, Middleware, Post } from "hono-decorators";
import { responseHelper } from "../libs/response-helper";
import JwtMiddleware from "../middleware/jwt-middleware";
import { getAccountId } from "../libs/utils";
import MediaService from "../services/media.service";

@Controller("media")
@Middleware([JwtMiddleware])
export class MediaController {
  private mediaService = new MediaService();

  @Get("")
  async getAll(c: Context) {
    const accountId = getAccountId(c);
    const assets = await this.mediaService.getAll(accountId);
    return c.json(responseHelper.data(assets));
  }

  @Post("")
  async upload(c: Context) {
    const accountId = getAccountId(c);
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return c.json(responseHelper.error("No file provided", 400), 400);
    }
    const asset = await this.mediaService.upload(accountId, file);
    return c.json(responseHelper.data(asset), 201);
  }

  @Delete(":id")
  async delete(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    await this.mediaService.delete(id, accountId);
    return c.json(responseHelper.success("Media deleted"));
  }
}
