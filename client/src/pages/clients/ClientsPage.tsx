import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, Trash2, KeyRound, ChevronRight, X } from "lucide-react"
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
import {
  useClients,
  useClient,
  useCreateClient,
  useDeleteClient,
  useAddCredential,
  useUpdateCredential,
  useDeleteCredential,
} from "@/hooks/useClients"
import type { ClientType } from "@/types/client"

// ─── Create client form ────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["telegram", "discord", "whatsapp", "http"] as const),
})
type CreateForm = z.infer<typeof createSchema>

function CreateClientDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createClient = useCreateClient()
  const [credentials, setCredentials] = useState<{ key: string; value: string }[]>([])
  const [credKey, setCredKey] = useState("")
  const [credValue, setCredValue] = useState("")

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateForm>({ resolver: zodResolver(createSchema) })

  const selectedType = watch("type")

  const addCred = () => {
    if (!credKey.trim() || !credValue.trim()) return
    setCredentials((prev) => [...prev, { key: credKey.trim(), value: credValue.trim() }])
    setCredKey("")
    setCredValue("")
  }

  const removeCred = (idx: number) => setCredentials((prev) => prev.filter((_, i) => i !== idx))

  const onSubmit = async (values: CreateForm) => {
    await createClient.mutateAsync({ ...values, credentials })
    reset()
    setCredentials([])
    onClose()
  }

  const handleClose = () => {
    reset()
    setCredentials([])
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input placeholder="My Telegram Bot" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Type</Label>
            <Select onValueChange={(v) => setValue("type", v as ClientType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="telegram">Telegram</SelectItem>
                <SelectItem value="discord">Discord</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="http">HTTP</SelectItem>
              </SelectContent>
            </Select>
            {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
          </div>

          {/* Credentials */}
          {selectedType && (
            <div className="flex flex-col gap-2">
              <Label>Credentials</Label>
              {credentials.length > 0 && (
                <ul className="rounded-md border divide-y text-sm">
                  {credentials.map((c, i) => (
                    <li key={i} className="flex items-center justify-between px-3 py-2">
                      <span className="font-mono text-xs">
                        <span className="font-semibold">{c.key}</span>:{" "}
                        <span className="text-muted-foreground">{c.value}</span>
                      </span>
                      <button type="button" onClick={() => removeCred(i)}>
                        <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="key"
                  value={credKey}
                  onChange={(e) => setCredKey(e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="value"
                  value={credValue}
                  onChange={(e) => setCredValue(e.target.value)}
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="icon" onClick={addCred}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {createClient.error && (
            <p className="text-sm text-destructive">
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

// ─── Credential management dialog ─────────────────────────────────────────

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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Credentials — {clientName}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="py-4 text-sm text-muted-foreground text-center">Loading...</p>
        ) : (
          <div className="flex flex-col gap-3">
            {client?.credentials && client.credentials.length > 0 ? (
              <ul className="rounded-md border divide-y text-sm">
                {client.credentials.map((c) => (
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
                          {c.value}
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
                        <button onClick={() => handleDelete(c.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">No credentials yet</p>
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
              <Button variant="outline" size="icon" onClick={handleAdd} disabled={addCred.isPending}>
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

// ─── Main page ─────────────────────────────────────────────────────────────

export function ClientsPage() {
  const { data: clients = [], isLoading } = useClients()
  const deleteClient = useDeleteClient()

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [credentialsClient, setCredentialsClient] = useState<{ id: string; name: string } | null>(
    null,
  )

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
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <div className="mb-3 rounded-full bg-muted p-3">
            <ChevronRight className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium">No clients yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a client to connect an AI channel
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
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{client.name}</td>
                  <td className="px-4 py-3">
                    <TypeBadge type={client.type} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={client.active ? "default" : "secondary"}>
                      {client.active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCredentialsClient({ id: client.id, name: client.name })}
                      >
                        <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                        Credentials
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteId(client.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create dialog */}
      <CreateClientDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* Credentials dialog */}
      {credentialsClient && (
        <CredentialsDialog
          clientId={credentialsClient.id}
          clientName={credentialsClient.name}
          open={!!credentialsClient}
          onClose={() => setCredentialsClient(null)}
        />
      )}

      {/* Delete confirmation */}
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
