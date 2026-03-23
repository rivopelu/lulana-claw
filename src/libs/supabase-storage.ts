import { createClient } from "@supabase/supabase-js";
import { env } from "../configs/env";
import { BadRequestException } from "./exception";

function getClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new BadRequestException(
      "Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env",
    );
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Upload a file buffer to Supabase Storage and return its public URL.
 */
export async function uploadToSupabase(
  buffer: ArrayBuffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const client = getClient();
  const bucket = env.SUPABASE_STORAGE_BUCKET;

  const { error } = await client.storage
    .from(bucket)
    .upload(filename, buffer, { contentType: mimeType, upsert: true });

  if (error) {
    throw new BadRequestException(`Supabase upload failed: ${error.message}`);
  }

  const { data } = client.storage.from(bucket).getPublicUrl(filename);
  return data.publicUrl;
}

/**
 * Delete a file from Supabase Storage by its storage path.
 */
export async function deleteFromSupabase(storagePath: string): Promise<void> {
  const client = getClient();
  const { error } = await client.storage.from(env.SUPABASE_STORAGE_BUCKET).remove([storagePath]);
  if (error) {
    throw new BadRequestException(`Supabase delete failed: ${error.message}`);
  }
}
