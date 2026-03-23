import { useRef, useState } from "react"
import { Upload, Trash2, ImageIcon, VideoIcon, Copy, Check } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useMediaAssets, useUploadMedia, useDeleteMedia } from "@/hooks/useMedia"
import type { MediaAsset } from "@/types/media"

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function CopyUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      title="Copy URL"
      className="rounded p-1 transition-colors hover:bg-white/20"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5 text-white" />}
    </button>
  )
}

function MediaCard({ asset, onDelete }: { asset: MediaAsset; onDelete: (a: MediaAsset) => void }) {
  const isVideo = asset.asset_type === "video"
  return (
    <div className="group relative overflow-hidden rounded-lg border bg-card">
      {/* Thumbnail */}
      <div className="relative aspect-square bg-muted">
        {isVideo ? (
          <video
            src={asset.url}
            className="h-full w-full object-cover"
            muted
            preload="metadata"
          />
        ) : (
          <img
            src={asset.url}
            alt={asset.filename}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 flex items-start justify-between bg-black/50 p-2 opacity-0 transition-opacity group-hover:opacity-100">
          <Badge
            variant="secondary"
            className="gap-1 bg-black/60 text-white border-0 text-xs"
          >
            {isVideo ? <VideoIcon className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
            {isVideo ? "Video" : "Image"}
          </Badge>
          <div className="flex gap-1">
            <CopyUrlButton url={asset.url} />
            <button
              onClick={() => onDelete(asset)}
              title="Delete"
              className="rounded p-1 transition-colors hover:bg-white/20"
            >
              <Trash2 className="h-3.5 w-3.5 text-red-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5 space-y-0.5">
        <p className="truncate text-xs font-medium" title={asset.filename}>
          {asset.filename}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatBytes(asset.size)} · {formatDate(asset.created_date)}
        </p>
      </div>
    </div>
  )
}

export function MediaPage() {
  const { data: assets = [], isLoading } = useMediaAssets()
  const upload = useUploadMedia()
  const deleteMedia = useDeleteMedia()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null)

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach((file) => upload.mutate(file))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Media Gallery"
        description="Kelola foto dan video Luna — upload sekali, gunakan untuk posting kapan saja."
        action={
          <Button onClick={() => fileInputRef.current?.click()} disabled={upload.isPending}>
            <Upload className="h-4 w-4" />
            {upload.isPending ? "Uploading..." : "Upload"}
          </Button>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => assets.length === 0 && fileInputRef.current?.click()}
        className={`
          rounded-xl border-2 border-dashed transition-colors
          ${dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"}
          ${assets.length === 0 ? "cursor-pointer" : ""}
        `}
      >
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : assets.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2">
            <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Drag & drop atau klik untuk upload foto/video
            </p>
            <p className="text-xs text-muted-foreground/60">
              JPG, PNG, WEBP, GIF, MP4, MOV, WEBM
            </p>
          </div>
        ) : (
          <div className="p-4">
            {dragging && (
              <div className="mb-4 flex h-16 items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/5">
                <p className="text-sm text-primary">Drop di sini untuk upload</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {assets.map((asset) => (
                <MediaCard key={asset.id} asset={asset} onDelete={setDeleteTarget} />
              ))}
            </div>
          </div>
        )}
      </div>

      {upload.error && (
        <p className="text-sm text-destructive">{(upload.error as Error).message}</p>
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus media?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.filename}</strong> akan dihapus dari Supabase Storage secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  deleteMedia.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
                }
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
