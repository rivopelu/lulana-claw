export type ContentDraftStatus = "pending" | "approved" | "rejected" | "revised" | "published"
export type ContentAssetType = "image" | "video"

export interface ContentDraft {
  id: string
  account_id: string
  theme: string
  mood: string
  visual_concept: string
  caption: string
  hashtags: string[]
  scheduled_at: number | null
  status: ContentDraftStatus
  asset_url: string | null
  asset_type: ContentAssetType | null
  revision_notes: string | null
  ig_post_id: string | null
  threads_post_id: string | null
  published_at: number | null
  created_date: number
}
