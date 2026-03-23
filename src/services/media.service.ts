import MediaAssetRepository from "../repositories/media-asset.repository";
import type { MediaAsset } from "../entities/pg/media-asset.entity";
import { NotFoundException } from "../libs/exception";
import { generateId } from "../libs/string-utils";
import { uploadToSupabase, deleteFromSupabase } from "../libs/supabase-storage";

export interface ResponseMediaAsset {
  id: string;
  account_id: string;
  filename: string;
  url: string;
  mime_type: string;
  size: number;
  asset_type: "image" | "video";
  created_date: number;
}

function toResponse(m: MediaAsset): ResponseMediaAsset {
  return {
    id: m.id,
    account_id: m.account_id,
    filename: m.filename,
    url: m.url,
    mime_type: m.mime_type,
    size: m.size,
    asset_type: m.asset_type as "image" | "video",
    created_date: m.created_date,
  };
}

export default class MediaService {
  private repository = new MediaAssetRepository();

  async upload(
    accountId: string,
    file: File,
  ): Promise<ResponseMediaAsset> {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const imageExts = ["jpg", "jpeg", "png", "webp", "gif"];
    const videoExts = ["mp4", "mov", "avi", "webm"];
    const assetType = imageExts.includes(ext) ? "image" : videoExts.includes(ext) ? "video" : null;
    if (!assetType) {
      throw new Error("Unsupported file type. Allowed: jpg, jpeg, png, webp, gif, mp4, mov, avi, webm");
    }

    const id = generateId();
    const storagePath = `media/${accountId}/${id}.${ext}`;
    const mimeType = file.type || `${assetType}/${ext}`;
    const buffer = await file.arrayBuffer();

    const url = await uploadToSupabase(buffer, storagePath, mimeType);

    await this.repository.save({
      id,
      account_id: accountId,
      filename: file.name,
      storage_path: storagePath,
      url,
      mime_type: mimeType,
      size: file.size,
      asset_type: assetType,
      created_by: accountId,
    });

    const saved = await this.repository.findById(id);
    return toResponse(saved!);
  }

  async getAll(accountId: string): Promise<ResponseMediaAsset[]> {
    const list = await this.repository.findAllByAccountId(accountId);
    return list.map(toResponse);
  }

  async getById(id: string, accountId: string): Promise<ResponseMediaAsset> {
    const asset = await this.repository.findByIdAndAccountId(id, accountId);
    if (!asset) throw new NotFoundException("Media asset not found");
    return toResponse(asset);
  }

  async delete(id: string, accountId: string): Promise<void> {
    const asset = await this.repository.findByIdAndAccountId(id, accountId);
    if (!asset) throw new NotFoundException("Media asset not found");
    await deleteFromSupabase(asset.storage_path);
    await this.repository.softDelete(id, accountId);
  }
}
