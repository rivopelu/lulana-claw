import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, CheckCircle2, XCircle, Trash2, Clock, Bell } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  useTasks,
  useCreateTask,
  useMarkTaskDone,
  useCancelTask,
  useDeleteTask,
} from "@/hooks/useTasks"
import { useClients } from "@/hooks/useClients"
import { useSessionsByClient } from "@/hooks/useSessions"
import type { Task, TaskStatus, TaskType } from "@/types/task"

// ─── Constants ─────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<TaskType, { label: string; emoji: string; color: string }> = {
  task: { label: "Task", emoji: "📋", color: "bg-blue-100 text-blue-800" },
  reminder: { label: "Reminder", emoji: "⏰", color: "bg-yellow-100 text-yellow-800" },
  notes: { label: "Notes", emoji: "📝", color: "bg-gray-100 text-gray-800" },
  meeting: { label: "Meeting", emoji: "🤝", color: "bg-purple-100 text-purple-800" },
  deadline: { label: "Deadline", emoji: "🚨", color: "bg-red-100 text-red-800" },
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-orange-100 text-orange-800" },
  done: { label: "Done", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-600" },
}

// ─── Create Dialog ──────────────────────────────────────────────────────────

const taskSchema = z.object({
  type: z.enum(["task", "reminder", "notes", "meeting", "deadline"]),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  client_id: z.string().min(1, "Client is required"),
  session_id: z.string().optional(),
  remind_date: z.string().optional(),
  remind_time: z.string().optional(),
})

type TaskForm = z.infer<typeof taskSchema>

function CreateTaskDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: clients = [] } = useClients()
  const create = useCreateTask()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<TaskForm, unknown, TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: { type: "task" },
  })

  const clientId = watch("client_id") ?? ""
  const { data: sessions = [] } = useSessionsByClient(clientId)

  const onSubmit = (data: TaskForm) => {
    let remindAt: number | undefined
    if (data.remind_date && data.remind_time) {
      remindAt = new Date(`${data.remind_date}T${data.remind_time}`).getTime()
    } else if (data.remind_date) {
      remindAt = new Date(`${data.remind_date}T00:00`).getTime()
    }

    const chatId = sessions.find((s) => s.id === data.session_id)?.chat_id

    create.mutate(
      {
        type: data.type,
        title: data.title,
        description: data.description || undefined,
        client_id: data.client_id,
        chat_id: chatId ?? 0,
        session_id: data.session_id || undefined,
        remind_at: remindAt,
      },
      {
        onSuccess: () => {
          reset()
          onClose()
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>Type</Label>
            <Select
              value={watch("type")}
              onValueChange={(v) => setValue("type", v as TaskType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_CONFIG).map(([val, cfg]) => (
                  <SelectItem key={val} value={val}>
                    {cfg.emoji} {cfg.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Title</Label>
            <Input {...register("title")} placeholder="e.g. Beli kopi" />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>Description (optional)</Label>
            <Textarea {...register("description")} rows={2} placeholder="Detail..." />
          </div>

          <div className="space-y-1">
            <Label>Client</Label>
            <Select
              value={clientId}
              onValueChange={(v) => {
                setValue("client_id", v)
                setValue("session_id", "")
              }}
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
            {errors.client_id && (
              <p className="text-xs text-destructive">{errors.client_id.message}</p>
            )}
          </div>

          {clientId && sessions.length > 0 && (
            <div className="space-y-1">
              <Label>Session (for reminder delivery)</Label>
              <Select
                value={watch("session_id") ?? ""}
                onValueChange={(v) => setValue("session_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select session..." />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      <span className="ml-2 text-xs text-muted-foreground">({s.chat_type})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Reminder Date</Label>
              <Input type="date" {...register("remind_date")} />
            </div>
            <div className="space-y-1">
              <Label>Time</Label>
              <Input type="time" {...register("remind_time")} />
            </div>
          </div>

          {create.error && (
            <p className="text-xs text-destructive">
              {(create.error as Error).message ?? "Something went wrong"}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Saving..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Task Card ──────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onDone,
  onCancel,
  onDelete,
}: {
  task: Task
  onDone?: (t: Task) => void
  onCancel?: (t: Task) => void
  onDelete: (t: Task) => void
}) {
  const cfg = TYPE_CONFIG[task.type]
  const statusCfg = STATUS_CONFIG[task.status]

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base">{cfg.emoji}</span>
            <p className="font-medium truncate">{task.title}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${cfg.color}`}>
              {cfg.label}
            </span>
            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
            {task.reminded && (
              <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                <Bell className="h-3 w-3" /> Sent
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {task.status === "pending" && onDone && (
            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => onDone(task)}>
              <CheckCircle2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {task.status === "pending" && onCancel && (
            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => onCancel(task)}>
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(task)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {task.description && (
        <p className="text-sm text-muted-foreground">{task.description}</p>
      )}

      {task.remind_at && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {new Date(task.remind_at).toLocaleString("id-ID")}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export function TasksPage() {
  const { data: allTasks = [], isLoading } = useTasks()
  const markDone = useMarkTaskDone()
  const cancel = useCancelTask()
  const del = useDeleteTask()

  const [createOpen, setCreateOpen] = useState(false)
  const [toDelete, setToDelete] = useState<Task | null>(null)

  const pending = allTasks.filter((t) => t.status === "pending")
  const done = allTasks.filter((t) => t.status === "done")
  const cancelled = allTasks.filter((t) => t.status === "cancelled")

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Tasks"
        description="Manage tasks, reminders, notes, and deadlines"
        action={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Task
          </Button>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
            <TabsTrigger value="done">Done ({done.length})</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled ({cancelled.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending tasks.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pending.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    onDone={(task) => markDone.mutate(task.id)}
                    onCancel={(task) => cancel.mutate(task.id)}
                    onDelete={setToDelete}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="done" className="mt-4">
            {done.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed tasks.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {done.map((t) => (
                  <TaskCard key={t.id} task={t} onDelete={setToDelete} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="cancelled" className="mt-4">
            {cancelled.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cancelled tasks.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cancelled.map((t) => (
                  <TaskCard key={t.id} task={t} onDelete={setToDelete} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <CreateTaskDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{toDelete?.title}&quot;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDelete) del.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })
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
