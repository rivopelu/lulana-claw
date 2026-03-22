import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, Trash2, KeyRound, ChevronRight, Play, Square, RotateCcw, Loader2, Brain, Users } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  useClients,
  useClient,
  useCreateClient,
  useDeleteClient,
  useSetClientModel,
  useSetEntityMode,
  useAddCredential,
  useUpdateCredential,
  useDeleteCredential,
  useBotStatuses,
  useStartBot,
  useStopBot,
  useRestartBot,
} from "@/hooks/useClients"
import { useAiModels } from "@/hooks/useAiModels"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BotStatus, ClientType } from "@/types/client"

// ─── Bot status indicator ──────────────────────────────────────────────────

const statusDot: Record<BotStatus, string> = {
  running: "bg-green-500",
  starting: "bg-yellow-400 animate-pulse",
  stopping: "bg-yellow-400 animate-pulse",
  stopped: "bg-slate-300",
  error: "bg-red-500",
}

const statusLabel: Record<BotStatus, string> = {
  running: "Running",
  starting: "Starting…",
  stopping: "Stopping…",
  stopped: "Stopped",
  error: "Error",
}

function BotStatusBadge({ status, error }: { status: BotStatus; error?: string }) {
  const label = statusLabel[status]
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`h-2 w-2 rounded-full flex-shrink-0 ${statusDot[status]}`} />
            {label}
          </span>
        </TooltipTrigger>
        {error && (
          <TooltipContent side="top" className="max-w-xs text-xs">
            {error}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  )
}

// ─── Bot control buttons ───────────────────────────────────────────────────

function BotControls({ clientId, status }: { clientId: string; status: BotStatus }) {
  const start = useStartBot()
  const stop = useStopBot()
  const restart = useRestartBot()

  const busy =
    status === "starting" ||
    status === "stopping" ||
    start.isPending ||
    stop.isPending ||
    restart.isPending

  if (status === "running") {
    return (
      <div className="flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-yellow-600"
                disabled={busy}
                onClick={() => restart.mutate(clientId)}
              >
                {restart.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Restart</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-red-600"
                disabled={busy}
                onClick={() => stop.mutate(clientId)}
              >
                {stop.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Stop</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    )
  }

  // stopped | error
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-green-600"
            disabled={busy}
            onClick={() => start.mutate(clientId)}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Start</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ─── Create client (Telegram / Discord) ───────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["telegram", "discord"]),
  bot_token: z.string().min(1, "Bot token is required"),
})
type CreateForm = z.infer<typeof createSchema>

const botTokenMeta: Record<"telegram" | "discord", { placeholder: string; hint: string }> = {
  telegram: {
    placeholder: "123456789:AABBccDDeeFFggHH...",
    hint: "Get your token from @BotFather on Telegram.",
  },
  discord: {
    placeholder: "MTExxx.xxx.xxx",
    hint: "Get your token from the Discord Developer Portal → Bot → Reset Token.",
  },
}

function CreateClientDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createClient = useCreateClient()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateForm>({ resolver: zodResolver(createSchema), defaultValues: { type: "telegram" } })

  const selectedType = watch("type")

  const onSubmit = async (values: CreateForm) => {
    await createClient.mutateAsync({
      name: values.name,
      type: values.type,
      credentials: [{ key: "bot_token", value: values.bot_token }],
    })
    reset()
    onClose()
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const meta = botTokenMeta[selectedType]

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Client</DialogTitle>
          <DialogDescription>
            Connect a bot by selecting its platform and entering the bot token.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Platform</Label>
            <Select
              value={selectedType}
              onValueChange={(v) => setValue("type", v as "telegram" | "discord")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="telegram">Telegram</SelectItem>
                <SelectItem value="discord">Discord</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Client Name</Label>
            <Input
              placeholder={selectedType === "telegram" ? "My Telegram Bot" : "My Discord Bot"}
              {...register("name")}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Bot Token</Label>
            <Input
              placeholder={meta.placeholder}
              {...register("bot_token")}
              autoComplete="off"
            />
            {errors.bot_token && (
              <p className="text-xs text-destructive">{errors.bot_token.message}</p>
            )}
            <p className="text-xs text-muted-foreground">{meta.hint}</p>
          </div>

          {createClient.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {(createClient.error as Error).message || "Failed to create client"}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createClient.isPending}>
              {createClient.isPending ? "Creating..." : "Create Client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Credentials dialog ────────────────────────────────────────────────────

const HIDDEN_KEYS = new Set(["bot_token"])

function CredentialsDialog({
  clientId,
  clientName,
  open,
  onClose,
}: {
  clientId: string
  clientName: string
  open: boolean
  onClose: () => void
}) {
  const { data: client, isLoading } = useClient(clientId)
  const addCred = useAddCredential()
  const updateCred = useUpdateCredential()
  const deleteCred = useDeleteCredential()
  const [key, setKey] = useState("")
  const [value, setValue] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")

  const handleAdd = async () => {
    if (!key.trim() || !value.trim()) return
    await addCred.mutateAsync({ clientId, body: { key: key.trim(), value: value.trim() } })
    setKey("")
    setValue("")
  }

  const handleUpdate = async (credId: string) => {
    await updateCred.mutateAsync({ clientId, credId, body: { value: editValue } })
    setEditingId(null)
  }

  const handleDelete = async (credId: string) => {
    await deleteCred.mutateAsync({ clientId, credId })
  }

  const credentials = client?.credentials ?? []

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Credentials — {clientName}</DialogTitle>
          <DialogDescription>Manage credential key-value pairs for this client.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="py-4 text-sm text-muted-foreground text-center">Loading...</p>
        ) : (
          <div className="flex flex-col gap-3">
            {credentials.length > 0 ? (
              <ul className="rounded-md border divide-y text-sm">
                {credentials.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="w-28 flex-shrink-0 font-mono text-xs font-semibold truncate">
                      {c.key}
                    </span>
                    {editingId === c.id ? (
                      <>
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-7 flex-1 text-xs"
                        />
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleUpdate(c.id)}
                          disabled={updateCred.isPending}
                        >
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 truncate text-xs text-muted-foreground font-mono">
                          {HIDDEN_KEYS.has(c.key) ? "••••••••••••••••" : c.value}
                        </span>
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setEditingId(c.id)
                            setEditValue(c.value)
                          }}
                        >
                          Edit
                        </button>
                        {!HIDDEN_KEYS.has(c.key) && (
                          <button onClick={() => handleDelete(c.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </button>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">No credentials</p>
            )}

            <div className="flex gap-2">
              <Input
                placeholder="key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleAdd}
                disabled={addCred.isPending}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Type badge ────────────────────────────────────────────────────────────

const typeColors: Record<ClientType, string> = {
  telegram: "bg-blue-100 text-blue-700",
  discord: "bg-indigo-100 text-indigo-700",
  whatsapp: "bg-green-100 text-green-700",
  http: "bg-slate-100 text-slate-700",
}

function TypeBadge({ type }: { type: ClientType }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${typeColors[type]}`}
    >
      {type}
    </span>
  )
}

// ─── Assign AI model dialog ────────────────────────────────────────────────

function AssignModelDialog({
  clientId,
  clientName,
  currentModelId,
  open,
  onClose,
}: {
  clientId: string
  clientName: string
  currentModelId: string | null
  open: boolean
  onClose: () => void
}) {
  const { data: models = [] } = useAiModels()
  const setModel = useSetClientModel()
  const [selected, setSelected] = useState<string>(currentModelId ?? "__none__")

  const handleSave = async () => {
    await setModel.mutateAsync({ id: clientId, aiModelId: selected === "__none__" ? null : selected })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Assign AI Model</DialogTitle>
          <DialogDescription>
            Select which AI model <span className="font-medium text-foreground">{clientName}</span>{" "}
            will use.
          </DialogDescription>
        </DialogHeader>

        {models.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No AI models configured yet. Add one in the{" "}
            <span className="font-medium text-foreground">AI Models</span> page first.
          </p>
        ) : (
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger>
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">
                <span className="text-muted-foreground">None</span>
              </SelectItem>
              {models.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <span className="font-medium">{m.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">({m.model_id})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

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

// ─── Entity mode dialog ────────────────────────────────────────────────────

function EntityModeDialog({
  clientId,
  clientName,
  currentMode,
  open,
  onClose,
}: {
  clientId: string
  clientName: string
  currentMode: "single" | "per_session"
  open: boolean
  onClose: () => void
}) {
  const setMode = useSetEntityMode()
  const [selected, setSelected] = useState<"single" | "per_session">(currentMode)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Entity Mode</DialogTitle>
          <DialogDescription>
            Controls how the bot handles identity for{" "}
            <span className="font-medium text-foreground">{clientName}</span>.
          </DialogDescription>
        </DialogHeader>

        <Select value={selected} onValueChange={(v) => setSelected(v as "single" | "per_session")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="per_session">Per Session — each session has its own identity</SelectItem>
            <SelectItem value="single">Single Entity — one identity for all sessions</SelectItem>
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              await setMode.mutateAsync({ id: clientId, entityMode: selected })
              onClose()
            }}
            disabled={setMode.isPending}
          >
            {setMode.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────

export function ClientsPage() {
  const { data: clients = [], isLoading } = useClients()
  const { data: botStatuses = {} } = useBotStatuses()
  const deleteClient = useDeleteClient()

  const { data: aiModels = [] } = useAiModels()
  const aiModelMap = Object.fromEntries(aiModels.map((m) => [m.id, m]))

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [credentialsClient, setCredentialsClient] = useState<{ id: string; name: string } | null>(null)
  const [assignModelClient, setAssignModelClient] = useState<{
    id: string
    name: string
    ai_model_id: string | null
  } | null>(null)
  const [entityModeClient, setEntityModeClient] = useState<{
    id: string
    name: string
    entity_mode: "single" | "per_session"
  } | null>(null)

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Manage your AI assistant channels"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Client
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <div className="mb-3 rounded-full bg-muted p-3">
            <ChevronRight className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium">No clients yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect your first Telegram or Discord bot to get started
          </p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Client
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">AI Model</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Entity Mode</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Bot Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Controls</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {clients.map((client) => {
                const botEntry = botStatuses[client.id]
                const botStatus: BotStatus = botEntry?.status ?? "stopped"
                return (
                  <tr key={client.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{client.name}</td>
                    <td className="px-4 py-3">
                      <TypeBadge type={client.type} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() =>
                          setAssignModelClient({
                            id: client.id,
                            name: client.name,
                            ai_model_id: client.ai_model_id,
                          })
                        }
                      >
                        <Brain className="h-3.5 w-3.5 flex-shrink-0" />
                        {client.ai_model_id && aiModelMap[client.ai_model_id] ? (
                          <span>{aiModelMap[client.ai_model_id].name}</span>
                        ) : (
                          <span className="italic">Assign model</span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() =>
                          setEntityModeClient({
                            id: client.id,
                            name: client.name,
                            entity_mode: client.entity_mode ?? "per_session",
                          })
                        }
                      >
                        <Users className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="capitalize">
                          {client.entity_mode === "single" ? "Single" : "Per Session"}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <BotStatusBadge status={botStatus} error={botEntry?.error} />
                    </td>
                    <td className="px-4 py-3">
                      {(client.type === "telegram" || client.type === "discord") && (
                        <BotControls clientId={client.id} status={botStatus} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setCredentialsClient({ id: client.id, name: client.name })
                          }
                        >
                          <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                          Credentials
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteId(client.id)}
                          disabled={botStatus === "running"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateClientDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      {assignModelClient && (
        <AssignModelDialog
          clientId={assignModelClient.id}
          clientName={assignModelClient.name}
          currentModelId={assignModelClient.ai_model_id}
          open={!!assignModelClient}
          onClose={() => setAssignModelClient(null)}
        />
      )}

      {credentialsClient && (
        <CredentialsDialog
          clientId={credentialsClient.id}
          clientName={credentialsClient.name}
          open={!!credentialsClient}
          onClose={() => setCredentialsClient(null)}
        />
      )}

      {entityModeClient && (
        <EntityModeDialog
          clientId={entityModeClient.id}
          clientName={entityModeClient.name}
          currentMode={entityModeClient.entity_mode}
          open={!!entityModeClient}
          onClose={() => setEntityModeClient(null)}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the client and all its credentials. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteId) {
                  await deleteClient.mutateAsync(deleteId)
                  setDeleteId(null)
                }
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
