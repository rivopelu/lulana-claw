import { useState } from "react"
import { useParams, useNavigate } from "react-router"
import {
  ArrowLeft,
  Brain,
  RefreshCw,
  Loader2,
  MessageSquare,
  User,
  Bot,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSession, useSessionMessages, useSetSessionModel } from "@/hooks/useSessions"
import { useAiModels } from "@/hooks/useAiModels"
import { ROUTES } from "@/lib/constants"
import type { Session } from "@/types/session"
import type { SessionMessage } from "@/hooks/useSessions"

// ─── Chat type badge ────────────────────────────────────────────────────────

const chatTypeColors: Record<string, string> = {
  private: "bg-blue-100 text-blue-700",
  group: "bg-purple-100 text-purple-700",
  supergroup: "bg-purple-100 text-purple-700",
  channel: "bg-orange-100 text-orange-700",
}

function ChatTypeBadge({ type }: { type: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${chatTypeColors[type] ?? "bg-slate-100 text-slate-700"}`}
    >
      {type}
    </span>
  )
}

// ─── Assign model dialog ────────────────────────────────────────────────────

function AssignModelDialog({
  session,
  open,
  onClose,
}: {
  session: Session
  open: boolean
  onClose: () => void
}) {
  const { data: models = [] } = useAiModels()
  const setModel = useSetSessionModel()
  const [selected, setSelected] = useState<string>(session.ai_model_id ?? "__none__")

  const handleSave = async () => {
    await setModel.mutateAsync({
      sessionId: session.id,
      aiModelId: selected === "__none__" ? null : selected,
      clientId: session.client_id,
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>AI Model — {session.name}</DialogTitle>
          <DialogDescription>
            Override the AI model for this session. Leave empty to use the client default.
          </DialogDescription>
        </DialogHeader>

        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger>
            <SelectValue placeholder="Client default" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">
              <span className="text-muted-foreground italic">Client default</span>
            </SelectItem>
            {models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                <span className="font-medium">{m.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">({m.model_id})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={setModel.isPending}>
            {setModel.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Message bubble ─────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: SessionMessage }) {
  const isUser = message.role === "user"
  const isSystem = message.role === "system"

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {message.content}
        </span>
      </div>
    )
  }

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white ${isUser ? "bg-primary" : "bg-slate-500"}`}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>

      {/* Bubble */}
      <div className={`flex max-w-[70%] flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        {message.from_name && (
          <span className="text-xs text-muted-foreground">{message.from_name}</span>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted text-foreground rounded-tl-sm"
          }`}
        >
          {message.content}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  )
}

// ─── Main page ──────────────────────────────────────────────────────────────

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [modelDialogOpen, setModelDialogOpen] = useState(false)

  const { data: session, isLoading: sessionLoading } = useSession(id!)
  const {
    data: messages = [],
    isLoading: messagesLoading,
    refetch,
    isFetching,
  } = useSessionMessages(id!)
  const { data: aiModels = [] } = useAiModels()

  const currentModel = session?.ai_model_id
    ? aiModels.find((m) => m.id === session.ai_model_id)
    : null

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground/50" />
        <p className="font-medium">Session not found</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate(ROUTES.SESSIONS)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <h1 className="text-xl font-semibold truncate">{session.name}</h1>
          <ChatTypeBadge type={session.chat_type} />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Info card */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <div>
            <span className="text-muted-foreground">Chat ID</span>
            <p className="font-mono font-medium">{session.chat_id}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Type</span>
            <p className="capitalize font-medium">{session.chat_type}</p>
          </div>
          <div>
            <span className="text-muted-foreground">AI Model</span>
            <button
              className="flex items-center gap-1.5 font-medium hover:text-primary transition-colors"
              onClick={() => setModelDialogOpen(true)}
            >
              <Brain className="h-3.5 w-3.5" />
              {currentModel ? (
                <span>{currentModel.name}</span>
              ) : (
                <span className="italic text-muted-foreground">Client default</span>
              )}
            </button>
          </div>
          <div>
            <span className="text-muted-foreground">Messages</span>
            <p className="font-medium">{messages.length}</p>
          </div>
        </div>
      </div>

      {/* Chat log */}
      <div className="rounded-lg border bg-card flex flex-col" style={{ minHeight: "500px" }}>
        <div className="border-b px-4 py-3 text-sm font-medium text-muted-foreground">
          Chat History
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {messagesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No messages yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((msg) => (
                <MessageBubble key={msg._id} message={msg} />
              ))}
            </div>
          )}
        </div>
      </div>

      {session && (
        <AssignModelDialog
          session={session}
          open={modelDialogOpen}
          onClose={() => setModelDialogOpen(false)}
        />
      )}
    </div>
  )
}
