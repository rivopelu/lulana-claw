import { useRef, useState } from "react"
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Upload,
  Send,
  Trash2,
  Pencil,
  Clock,
  ImageIcon,
  VideoIcon,
  Instagram,
} from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAiModels } from "@/hooks/useAiModels"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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
import {
  useContentDrafts,
  useGenerateDraft, // used inside GenerateDialog
  useApproveDraft,
  useRejectDraft,
  useReviseDraft,
  useUpdateCaption,
  useUploadAsset,
  usePublishDraft,
  useDeleteDraft,
  type PublishPlatform,
} from "@/hooks/useContent"
import type { ContentDraft, ContentDraftStatus } from "@/types/content"

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ContentDraftStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending:   { label: "Pending",   variant: "secondary" },
  approved:  { label: "Approved",  variant: "default" },
  rejected:  { label: "Rejected",  variant: "destructive" },
  revised:   { label: "Needs Revision", variant: "outline" },
  published: { label: "Published", variant: "default" },
}

// ─── Generate dialog ─────────────────────────────────────────────────────────

function GenerateDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { data: models = [] } = useAiModels()
  const generate = useGenerateDraft()
  const [selectedModelId, setSelectedModelId] = useState<string>("__auto__")
  const [customPrompt, setCustomPrompt] = useState("")

  const handleGenerate = () => {
    const aiModelId = selectedModelId === "__auto__" ? undefined : selectedModelId
    generate.mutate({ aiModelId, customPrompt: customPrompt.trim() || undefined }, { onSuccess: onClose })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Generate Content Draft
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Luna will generate a theme, mood, visual concept, caption, and hashtags for your next Instagram post.
          </p>
          <div className="space-y-1.5">
            <Label>AI Model</Label>
            {models.length === 0 ? (
              <p className="text-xs text-destructive">
                No AI models configured. Add one in <strong>AI Models</strong> first.
              </p>
            ) : (
              <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">
                    Auto (use first available)
                  </SelectItem>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        · {m.provider} / {m.model_id}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Instruksi Khusus <span className="text-muted-foreground font-normal">(opsional)</span></Label>
            <Textarea
              placeholder="Contoh: buat konten tentang momen sore hari yang tenang, atau tips produktivitas untuk hari Senin..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Beri arahan spesifik ke Luna — tema, topik, suasana, atau referensi konten.
            </p>
          </div>
          {generate.error && (
            <p className="text-xs text-destructive">
              {(generate.error as Error).message}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={generate.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generate.isPending || models.length === 0}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            {generate.isPending ? "Generating..." : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Approve dialog ──────────────────────────────────────────────────────────

type ApproveMode = "now" | "schedule" | "approve_only"

function PlatformToggle({
  hasAsset,
  value,
  onChange,
}: {
  hasAsset: boolean
  value: PublishPlatform[]
  onChange: (v: PublishPlatform[]) => void
}) {
  const toggle = (p: PublishPlatform) =>
    onChange(value.includes(p) ? value.filter((x) => x !== p) : [...value, p])

  return (
    <div className="space-y-1.5">
      <Label>Platform</Label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => toggle("threads")}
          className={[
            "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
            value.includes("threads")
              ? "border-[#101010] bg-[#101010] text-white"
              : "border-border text-muted-foreground",
          ].join(" ")}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 192 192" fill="currentColor">
            <path d="M141.537 88.988a66.667 66.667 0 0 0-2.518-1.143c-1.482-27.307-16.403-43.038-41.457-43.198h-.368c-14.995 0-27.vissé.57 8.502l8.96 5.928c5.846-7.847 14.579-9.47 20.952-9.47h.252c8.101.051 14.22 2.408 18.196 7.01 2.87 3.348 4.797 7.994 5.756 13.868a94.848 94.848 0 0 0-12.294-1.004c-12.6 0-22.994 3.407-30.214 9.854-8.243 7.28-12.45 17.918-11.955 29.91.842 20.547 17.037 32.966 37.903 32.966 10.582 0 19.774-2.755 26.663-7.97 8.367-6.374 13.024-15.987 13.863-28.574.345-5.098.234-9.883-.325-14.264l-.041-.305Zm-27.165 38.108c-5.4 4.178-12.512 6.308-21.138 6.308-11.876 0-20.126-6.278-20.547-16.188-.28-6.553 2.417-12.146 7.584-15.756 4.995-3.5 11.93-5.273 20.016-5.273 4.474 0 8.898.37 13.176 1.092.44 5.706.138 10.56-1.09 14.817Z"/>
          </svg>
          Threads
        </button>
        <button
          type="button"
          disabled={!hasAsset}
          onClick={() => hasAsset && toggle("instagram")}
          className={[
            "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
            value.includes("instagram")
              ? "border-pink-500 bg-gradient-to-r from-pink-500 to-purple-600 text-white"
              : "border-border text-muted-foreground",
            !hasAsset && "opacity-40 cursor-not-allowed",
          ].join(" ")}
        >
          <Instagram className="h-3.5 w-3.5" />
          Instagram
          {!hasAsset && <span className="ml-1 opacity-70">(butuh asset)</span>}
        </button>
      </div>
    </div>
  )
}

function ApproveDialog({
  draft,
  onClose,
}: {
  draft: ContentDraft | null
  onClose: () => void
}) {
  const approve = useApproveDraft()
  const [mode, setMode] = useState<ApproveMode>("approve_only")
  const [schedDate, setSchedDate] = useState("")
  const [schedTime, setSchedTime] = useState("")
  const hasAsset = !!draft?.asset_url
  const defaultPlatforms: PublishPlatform[] = hasAsset ? ["threads", "instagram"] : ["threads"]
  const [platforms, setPlatforms] = useState<PublishPlatform[]>(defaultPlatforms)

  // Reset platforms when draft changes
  const prevDraftId = draft?.id
  if (draft?.id !== prevDraftId) {
    setPlatforms(hasAsset ? ["threads", "instagram"] : ["threads"])
  }

  const handleApprove = () => {
    if (!draft) return
    if (mode === "now") {
      approve.mutate({ id: draft.id, publish_now: true, platforms }, { onSuccess: onClose })
      return
    }
    let scheduledAt: number | undefined
    if (mode === "schedule" && schedDate) {
      scheduledAt = new Date(`${schedDate}T${schedTime || "00:00"}`).getTime()
    }
    approve.mutate({ id: draft.id, scheduled_at: scheduledAt, platforms }, { onSuccess: onClose })
  }

  const canSubmit =
    mode === "now" ||
    mode === "approve_only" ||
    (mode === "schedule" && !!schedDate)

  const submitLabel = () => {
    if (approve.isPending) return mode === "now" ? "Publishing..." : "Approving..."
    if (mode === "now") return "Approve & Publish Now"
    if (mode === "schedule") return "Approve & Schedule"
    return "Approve"
  }

  return (
    <Dialog open={!!draft} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Approve Draft</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Mode selector */}
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { value: "now",          label: "Post Sekarang",  desc: "Langsung publish ke Instagram" },
                { value: "schedule",     label: "Jadwalkan",      desc: "Pilih tanggal & waktu" },
                { value: "approve_only", label: "Approve Saja",   desc: "Publish manual nanti" },
              ] as { value: ApproveMode; label: string; desc: string }[]
            ).map(({ value, label, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={[
                  "rounded-lg border p-3 text-left text-xs transition-colors",
                  mode === value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50",
                ].join(" ")}
              >
                <p className="font-semibold">{label}</p>
                <p className="mt-0.5 opacity-70">{desc}</p>
              </button>
            ))}
          </div>

          {/* Schedule fields */}
          {mode === "schedule" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Tanggal</Label>
                <Input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Jam</Label>
                <Input type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} />
              </div>
            </div>
          )}

          {/* Platform selector — shown for now + schedule modes */}
          {(mode === "now" || mode === "schedule") && (
            <PlatformToggle hasAsset={hasAsset} value={platforms} onChange={setPlatforms} />
          )}

          {/* Warning: no asset but instagram selected */}
          {mode === "now" && !hasAsset && platforms.includes("instagram") && (
            <p className="rounded bg-orange-50 border border-orange-200 px-3 py-2 text-xs text-orange-700">
              Belum ada asset. Instagram membutuhkan foto/video.
            </p>
          )}

          {approve.error && (
            <p className="text-xs text-destructive">{(approve.error as Error).message}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={approve.isPending}>
            Batal
          </Button>
          <Button
            onClick={handleApprove}
            disabled={
            approve.isPending ||
            !canSubmit ||
            platforms.length === 0 ||
            (platforms.includes("instagram") && !hasAsset)
          }
          >
            {submitLabel()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Revise dialog ───────────────────────────────────────────────────────────

function ReviseDialog({
  draft,
  onClose,
}: {
  draft: ContentDraft | null
  onClose: () => void
}) {
  const revise = useReviseDraft()
  const [notes, setNotes] = useState("")

  const handleRevise = () => {
    if (!draft) return
    revise.mutate({ id: draft.id, notes }, { onSuccess: () => { setNotes(""); onClose() } })
  }

  return (
    <Dialog open={!!draft} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Request Revision</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Revision Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe what needs to be changed..."
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleRevise} disabled={revise.isPending || !notes.trim()}>
            {revise.isPending ? "Sending..." : "Send for Revision"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit caption dialog ─────────────────────────────────────────────────────

function EditCaptionDialog({
  draft,
  onClose,
}: {
  draft: ContentDraft | null
  onClose: () => void
}) {
  const update = useUpdateCaption()
  const [caption, setCaption] = useState(draft?.caption ?? "")
  const [hashtagsRaw, setHashtagsRaw] = useState(draft?.hashtags.join(" ") ?? "")

  // Reset when draft changes
  if (draft && caption === "" && draft.caption) setCaption(draft.caption)

  const handleSave = () => {
    if (!draft) return
    const hashtags = hashtagsRaw
      .split(/[\s,]+/)
      .map((h) => h.replace(/^#/, "").trim())
      .filter(Boolean)
    update.mutate({ id: draft.id, caption, hashtags }, { onSuccess: onClose })
  }

  return (
    <Dialog open={!!draft} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Caption</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Caption</Label>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={6}
              placeholder="Instagram caption..."
            />
            <p className="text-xs text-muted-foreground text-right">{caption.length}/2200</p>
          </div>
          <div className="space-y-1">
            <Label>Hashtags (space or comma separated)</Label>
            <Input
              value={hashtagsRaw}
              onChange={(e) => setHashtagsRaw(e.target.value)}
              placeholder="fashion ootd style..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={update.isPending}>
            {update.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Draft card ───────────────────────────────────────────────────────────────

function DraftCard({
  draft,
  onApprove,
  onReject,
  onRevise,
  onEditCaption,
  onDelete,
}: {
  draft: ContentDraft
  onApprove: (d: ContentDraft) => void
  onReject: (d: ContentDraft) => void
  onRevise: (d: ContentDraft) => void
  onEditCaption: (d: ContentDraft) => void
  onDelete: (d: ContentDraft) => void
}) {
  const uploadAsset = useUploadAsset()
  const publishDraft = usePublishDraft()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const statusCfg = STATUS_CONFIG[draft.status]

  const handleFileDrop = (file: File) => {
    uploadAsset.mutate({ id: draft.id, file })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileDrop(file)
  }

  return (
    <div className="rounded-lg border bg-card flex flex-col overflow-hidden">
      {/* Asset preview / upload zone */}
      <div
        className={`relative h-40 flex items-center justify-center cursor-pointer transition-colors ${
          dragOver
            ? "bg-primary/10 border-primary border-2"
            : "bg-muted/30"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {draft.asset_url ? (
          draft.asset_type === "video" ? (
            <video
              src={draft.asset_url}
              className="h-full w-full object-cover"
              muted
            />
          ) : (
            <img
              src={draft.asset_url}
              alt="Asset"
              className="h-full w-full object-cover"
            />
          )
        ) : (
          <div className="text-center space-y-1 text-muted-foreground">
            {uploadAsset.isPending ? (
              <p className="text-xs">Uploading...</p>
            ) : (
              <>
                <Upload className="h-6 w-6 mx-auto" />
                <p className="text-xs">Drag & drop or click to upload</p>
                <p className="text-xs opacity-60">Photo or video</p>
              </>
            )}
          </div>
        )}
        {draft.asset_url && (
          <div className="absolute top-2 right-2">
            {draft.asset_type === "video" ? (
              <VideoIcon className="h-4 w-4 text-white drop-shadow" />
            ) : (
              <ImageIcon className="h-4 w-4 text-white drop-shadow" />
            )}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,video/*"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileDrop(file)
          }}
        />
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{draft.theme}</p>
            <p className="text-xs text-muted-foreground capitalize">{draft.mood}</p>
          </div>
          <Badge variant={statusCfg.variant} className="flex-shrink-0 text-xs">
            {statusCfg.label}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-3">{draft.caption}</p>

        {draft.hashtags.length > 0 && (
          <p className="text-xs text-blue-500 line-clamp-1">
            {draft.hashtags.slice(0, 5).map((h) => `#${h}`).join(" ")}
            {draft.hashtags.length > 5 && ` +${draft.hashtags.length - 5}`}
          </p>
        )}

        {draft.scheduled_at && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {new Date(draft.scheduled_at).toLocaleString("id-ID")}
          </div>
        )}

        {draft.revision_notes && (
          <div className="rounded bg-orange-50 border border-orange-200 px-2 py-1.5 text-xs text-orange-700">
            <strong>Revision:</strong> {draft.revision_notes}
          </div>
        )}

        {(draft.ig_post_id || draft.threads_post_id) && (
          <div className="flex items-center gap-2 flex-wrap">
            {draft.threads_post_id && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <span className="font-bold">T</span> {draft.threads_post_id.slice(-8)}
              </span>
            )}
            {draft.ig_post_id && (
              <span className="flex items-center gap-1 text-xs text-pink-600">
                <Instagram className="h-3 w-3" /> {draft.ig_post_id.slice(-8)}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-1.5 mt-auto pt-2 border-t">
          {(draft.status === "pending" || draft.status === "revised") && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-green-700 border-green-300"
                onClick={() => onApprove(draft)}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => onRevise(draft)}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Revise
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-destructive border-destructive/30"
                onClick={() => onReject(draft)}
              >
                <XCircle className="h-3 w-3 mr-1" />
                Reject
              </Button>
            </>
          )}

          {draft.status !== "published" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => onEditCaption(draft)}
            >
              <Pencil className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}

          {draft.status === "approved" && (
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                const platforms: PublishPlatform[] = draft.asset_url
                  ? ["threads", "instagram"]
                  : ["threads"]
                publishDraft.mutate({ id: draft.id, platforms })
              }}
              disabled={publishDraft.isPending}
            >
              <Send className="h-3 w-3 mr-1" />
              {publishDraft.isPending
                ? "Publishing..."
                : draft.asset_url
                  ? "Threads + IG"
                  : "Post ke Threads"}
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-destructive ml-auto"
            onClick={() => onDelete(draft)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS: { value: ContentDraftStatus | "all"; label: string }[] = [
  { value: "all",       label: "All" },
  { value: "pending",   label: "Pending" },
  { value: "approved",  label: "Approved" },
  { value: "revised",   label: "Needs Revision" },
  { value: "published", label: "Published" },
  { value: "rejected",  label: "Rejected" },
]

export function ContentPage() {
  const { data: allDrafts = [], isLoading } = useContentDrafts()
  const rejectDraft = useRejectDraft()
  const deleteDraft = useDeleteDraft()

  const [generateOpen, setGenerateOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<ContentDraftStatus | "all">("all")
  const [approveTarget, setApproveTarget] = useState<ContentDraft | null>(null)
  const [reviseTarget, setReviseTarget] = useState<ContentDraft | null>(null)
  const [editTarget, setEditTarget] = useState<ContentDraft | null>(null)
  const [rejectTarget, setRejectTarget] = useState<ContentDraft | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ContentDraft | null>(null)

  const filtered =
    activeTab === "all" ? allDrafts : allDrafts.filter((d) => d.status === activeTab)

  const countBy = (s: ContentDraftStatus) => allDrafts.filter((d) => d.status === s).length

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Content Studio"
        description="Luna generates content concepts — you create assets and approve for Instagram"
        action={
          <Button size="sm" onClick={() => setGenerateOpen(true)}>
            <Sparkles className="h-4 w-4 mr-1.5" />
            Generate Draft
          </Button>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ContentDraftStatus | "all")}>
          <TabsList>
            {TABS.map(({ value, label }) => (
              <TabsTrigger key={value} value={value}>
                {label}
                {value !== "all" && (
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs leading-none">
                    {countBy(value as ContentDraftStatus)}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground space-y-2">
                <Sparkles className="h-8 w-8 opacity-30" />
                <p className="text-sm">
                  {activeTab === "all"
                    ? "No drafts yet. Click \"Generate Draft\" to let Luna create one."
                    : `No ${activeTab} drafts.`}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((d) => (
                  <DraftCard
                    key={d.id}
                    draft={d}
                    onApprove={setApproveTarget}
                    onReject={setRejectTarget}
                    onRevise={setReviseTarget}
                    onEditCaption={setEditTarget}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Generate dialog */}
      <GenerateDialog open={generateOpen} onClose={() => setGenerateOpen(false)} />

      {/* Approve dialog */}
      <ApproveDialog draft={approveTarget} onClose={() => setApproveTarget(null)} />

      {/* Revise dialog */}
      <ReviseDialog draft={reviseTarget} onClose={() => setReviseTarget(null)} />

      {/* Edit caption dialog */}
      {editTarget && (
        <EditCaptionDialog draft={editTarget} onClose={() => setEditTarget(null)} />
      )}

      {/* Reject confirm */}
      <AlertDialog open={!!rejectTarget} onOpenChange={(v) => !v && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Draft</AlertDialogTitle>
            <AlertDialogDescription>
              Mark this draft as rejected? Luna will not republish it automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (rejectTarget)
                  rejectDraft.mutate(rejectTarget.id, { onSuccess: () => setRejectTarget(null) })
              }}
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Draft</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete this draft? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget)
                  deleteDraft.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
