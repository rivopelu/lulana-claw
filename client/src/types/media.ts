export type MediaAssetType = "image" | "video"

export interface MediaAsset {
  id: string
  account_id: string
  filename: string
  url: string
  mime_type: string
  size: number
  asset_type: MediaAssetType
  created_date: number
}
