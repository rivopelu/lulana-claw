import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, Pencil, Trash2, Globe, Bot, MessageSquare, Loader2 } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  useContexts,
  useCreateContext,
  useUpdateContext,
  useDeleteContext,
} from "@/hooks/useContexts"
import { useClients } from "@/hooks/useClients"
import { useSessionsByClient } from "@/hooks/useSessions"
import type { AppContext, ContextCategory, ContextType } from "@/types/context"

const CATEGORIES: { value: ContextCategory; label: string }[] = [
  { value: "identity", label: "Identity" },
  { value: "personality", label: "Personality" },
  { value: "rules", label: "Rules" },
  { value: "knowledge", label: "Knowledge" },
  { value: "custom", label: "Custom" },
]

const CATEGORY_COLORS: Record<ContextCategory, string> = {
  identity: "bg-purple-100 text-purple-800",
  personality: "bg-blue-100 text-blue-800",
  rules: "bg-orange-100 text-orange-800",
  knowledge: "bg-green-100 text-green-800",
  custom: "bg-gray-100 text-gray-800",
}

// ─── Create / Edit Dialog ──────────────────────────────────────────────────

const contextSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["global", "client", "session"]),
  category: z.enum(["identity", "personality", "rules", "knowledge", "custom"]),
  content: z.string().min(1, "Content is required"),
  client_id: z.string().optional(),
  session_id: z.string().optional(),
  order: z.number(),
})

type ContextForm = z.infer<typeof contextSchema>

function ContextDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing: AppContext | null
}) {
  const { data: clients = [] } = useClients()
  const create = useCreateContext()
  const update = useUpdateContext()
  const [sessionClientId, setSessionClientId] = useState("")
  const { data: sessionsForClient = [], isFetching: fetchingSessions } =
    useSessionsByClient(sessionClientId)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ContextForm, unknown, ContextForm>({
    resolver: zodResolver(contextSchema),
    defaultValues: { type: "global" as const, category: "identity" as const, order: 0 },
  })

  // Reset form whenever the dialog opens or the editing target changes
  useEffect(() => {
    if (open) {
      reset(
        editing
          ? {
              name: editing.name,
              type: editing.type,
              category: editing.category,
              content: editing.content,
              client_id: editing.client_id ?? "",
              session_id: editing.session_id ?? "",
              order: editing.order,
            }
          : { type: "global" as const, category: "identity" as const, order: 0 },
      )
      setSessionClientId("")
    }
  }, [open, editing, reset])

  const type = watch("type")
  const isLoading = create.isPending || update.isPending
  const error = create.error || update.error

  const onSubmit = (data: ContextForm) => {
    if (editing) {
      update.mutate(
        {
          id: editing.id,
          body: {
            name: data.name,
            category: data.category,
            content: data.content,
            order: data.order,
          },
        },
        {
          onSuccess: () => {
            reset()
            onClose()
          },
        },
      )
    } else {
      create.mutate(
        {
          name: data.name,
          type: data.type as ContextType,
          category: data.category as ContextCategory,
          content: data.content,
          client_id: data.client_id || undefined,
          session_id: data.session_id || undefined,
          order: data.order,
        },
        {
          onSuccess: () => {
            reset()
            onClose()
          },
        },
      )
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          reset()
          setSessionClientId("")
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Context" : "Create Context"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input {...register("name")} placeholder="e.g. Assistant Identity" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {!editing && (
            <div className="space-y-1">
              <Label>Type</Label>
              <Select
                value={type}
                onValueChange={(v) => {
                  setValue("type", v as ContextType)
                  setValue("client_id", "")
                  setValue("session_id", "")
                  setSessionClientId("")
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (applies to all clients)</SelectItem>
                  <SelectItem value="client">Client (applies to a specific client)</SelectItem>
                  <SelectItem value="session">Session (applies to a specific session)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {!editing && type === "client" && (
            <div className="space-y-1">
              <Label>Client</Label>
              <Select
                value={watch("client_id") ?? ""}
                onValueChange={(v) => setValue("client_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!editing && type === "session" && (
            <>
              <div className="space-y-1">
                <Label>Client</Label>
                <Select
                  value={sessionClientId}
                  onValueChange={(v) => {
                    setSessionClientId(v)
                    setValue("session_id", "")
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select client first..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {sessionClientId && (
                <div className="space-y-1">
                  <Label>Session</Label>
                  {fetchingSessions ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading sessions...
                    </div>
                  ) : sessionsForClient.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1">
                      No sessions found for this client.
                    </p>
                  ) : (
                    <Select
                      value={watch("session_id") ?? ""}
                      onValueChange={(v) => setValue("session_id", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select session..." />
                      </SelectTrigger>
                      <SelectContent>
                        {sessionsForClient.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            <span className="font-medium">{s.name}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({s.chat_type})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </>
          )}

          <div className="space-y-1">
            <Label>Category</Label>
            <Select
              value={watch("category")}
              onValueChange={(v) => setValue("category", v as ContextCategory)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Content</Label>
            <Textarea
              {...register("content")}
              rows={6}
              placeholder="Write the context content here..."
            />
            {errors.content && <p className="text-xs text-destructive">{errors.content.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>Order</Label>
            <Input type="number" {...register("order", { valueAsNumber: true })} placeholder="0" />
          </div>

          {error && (
            <p className="text-xs text-destructive">
              {(error as Error).message ?? "Something went wrong"}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Context Card ──────────────────────────────────────────────────────────

function ContextCard({
  ctx,
  onEdit,
  onDelete,
}: {
  ctx: AppContext
  onEdit: (c: AppContext) => void
  onDelete: (c: AppContext) => void
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <p className="font-medium truncate">{ctx.name}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[ctx.category]}`}
            >
              {ctx.category}
            </span>
            <span className="text-xs text-muted-foreground">order: {ctx.order}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(ctx)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive"
            onClick={() => onDelete(ctx)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{ctx.content}</p>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export function ContextsPage() {
  const { data: contexts = [], isLoading } = useContexts()
  const { data: clients = [] } = useClients()
  const deleteCtx = useDeleteContext()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AppContext | null>(null)
  const [toDelete, setToDelete] = useState<AppContext | null>(null)

  const globalContexts = contexts.filter((c) => c.type === "global")
  const clientContexts = contexts.filter((c) => c.type === "client")
  const sessionContexts = contexts.filter((c) => c.type === "session")

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (ctx: AppContext) => {
    setEditing(ctx)
    setDialogOpen(true)
  }

  const confirmDelete = () => {
    if (!toDelete) return
    deleteCtx.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Contexts"
        description="Manage global, client, and session context prompts"
        action={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Context
          </Button>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <Tabs defaultValue="global">
          <TabsList>
            <TabsTrigger value="global" className="gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              Global ({globalContexts.length})
            </TabsTrigger>
            <TabsTrigger value="client" className="gap-1.5">
              <Bot className="h-3.5 w-3.5" />
              By Client ({clientContexts.length})
            </TabsTrigger>
            <TabsTrigger value="session" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              By Session ({sessionContexts.length})
            </TabsTrigger>
          </TabsList>

          {/* Global */}
          <TabsContent value="global" className="mt-4">
            {globalContexts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No global contexts yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {globalContexts.map((c) => (
                  <ContextCard key={c.id} ctx={c} onEdit={openEdit} onDelete={setToDelete} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* By Client */}
          <TabsContent value="client" className="mt-4 space-y-6">
            {clients.length === 0 ? (
              <p className="text-sm text-muted-foreground">No clients found.</p>
            ) : (
              clients.map((client) => {
                const items = clientContexts.filter((c) => c.client_id === client.id)
                return (
                  <div key={client.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{client.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {client.type}
                      </Badge>
                    </div>
                    {items.length === 0 ? (
                      <p className="text-xs text-muted-foreground pl-6">No contexts for this client.</p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pl-6">
                        {items.map((c) => (
                          <ContextCard key={c.id} ctx={c} onEdit={openEdit} onDelete={setToDelete} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </TabsContent>

          {/* By Session */}
          <TabsContent value="session" className="mt-4">
            {sessionContexts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No session contexts yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sessionContexts.map((c) => (
                  <ContextCard key={c.id} ctx={c} onEdit={openEdit} onDelete={setToDelete} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <ContextDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false)
          setEditing(null)
        }}
        editing={editing}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Context</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{toDelete?.name}&quot;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
