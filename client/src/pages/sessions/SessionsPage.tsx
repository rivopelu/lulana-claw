import { useState } from "react"
import { useNavigate } from "react-router"
import { MessageSquare, ChevronDown, ChevronRight, Brain, Loader2, ExternalLink } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
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
import { useClients } from "@/hooks/useClients"
import { useSessionsByClient, useSetSessionModel } from "@/hooks/useSessions"
import { useAiModels } from "@/hooks/useAiModels"
import { ROUTES } from "@/lib/constants"
import type { Session } from "@/types/session"

// ─── Chat type badge ───────────────────────────────────────────────────────

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

// ─── Assign model dialog ───────────────────────────────────────────────────

function AssignModelDialog({
  session,
  clientId,
  open,
  onClose,
}: {
  session: Session
  clientId: string
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
      clientId,
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

// ─── Client group row ──────────────────────────────────────────────────────

function ClientGroup({
  clientId,
  clientName,
  aiModels,
}: {
  clientId: string
  clientName: string
  aiModels: Record<string, string>
}) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(true)
  const { data: sessions = [], isLoading } = useSessionsByClient(clientId)
  const [assignSession, setAssignSession] = useState<Session | null>(null)

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <button
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <span className="font-medium">{clientName}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {isLoading ? "…" : `${sessions.length} session${sessions.length !== 1 ? "s" : ""}`}
        </span>
      </button>

      {/* Sessions */}
      {expanded && (
        <>
          {isLoading ? (
            <div className="flex items-center justify-center py-6 border-t">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="border-t px-6 py-4 text-sm text-muted-foreground italic">
              No sessions yet — send /setup in this bot's chat to create one.
            </p>
          ) : (
            <table className="w-full text-sm border-t">
              <thead>
                <tr className="bg-muted/40">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Session Name</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Chat ID</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">AI Model</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3">
                      <ChatTypeBadge type={s.chat_type} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {s.chat_id}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setAssignSession(s)}
                      >
                        <Brain className="h-3.5 w-3.5 flex-shrink-0" />
                        {s.ai_model_id && aiModels[s.ai_model_id] ? (
                          <span>{aiModels[s.ai_model_id]}</span>
                        ) : (
                          <span className="italic">Client default</span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => navigate(ROUTES.SESSION_DETAIL(s.id))}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {assignSession && (
        <AssignModelDialog
          session={assignSession}
          clientId={clientId}
          open={!!assignSession}
          onClose={() => setAssignSession(null)}
        />
      )}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────

export function SessionsPage() {
  const { data: clients = [], isLoading } = useClients()
  const { data: aiModels = [] } = useAiModels()
  const aiModelMap = Object.fromEntries(aiModels.map((m) => [m.id, m.name]))

  return (
    <div>
      <PageHeader
        title="Sessions"
        description="Active chat sessions grouped by client bot"
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium">No clients configured</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a client bot first to see its sessions here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {clients.map((client) => (
            <ClientGroup
              key={client.id}
              clientId={client.id}
              clientName={client.name}
              aiModels={aiModelMap}
            />
          ))}
        </div>
      )}
    </div>
  )
}
