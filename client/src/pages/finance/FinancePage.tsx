import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  TrendingDown,
  TrendingUp,
  Wallet,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
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
  useBudgetSessions,
  useCreateBudgetSession,
  useCompleteBudgetSession,
  useCancelBudgetSession,
  useDeleteBudgetSession,
  useSessionTransactions,
  useCreateTransaction,
  useDeleteTransaction,
} from "@/hooks/useFinance"
import { useClients } from "@/hooks/useClients"
import { useSessionsByClient } from "@/hooks/useSessions"
import type { BudgetSession, FinancialTransaction, TransactionCategory, TransactionType } from "@/types/finance"

// ─── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<TransactionCategory, { label: string; emoji: string; color: string }> = {
  food: { label: "Makan & Minum", emoji: "🍜", color: "bg-orange-100 text-orange-800" },
  transport: { label: "Transport", emoji: "🚗", color: "bg-blue-100 text-blue-800" },
  entertainment: { label: "Hiburan", emoji: "🎮", color: "bg-purple-100 text-purple-800" },
  shopping: { label: "Belanja", emoji: "🛍️", color: "bg-pink-100 text-pink-800" },
  health: { label: "Kesehatan", emoji: "💊", color: "bg-green-100 text-green-800" },
  other: { label: "Lainnya", emoji: "📦", color: "bg-gray-100 text-gray-800" },
}

const STATUS_CONFIG: Record<BudgetSession["status"], { label: string; color: string }> = {
  active: { label: "Aktif", color: "bg-green-100 text-green-800" },
  completed: { label: "Selesai", color: "bg-blue-100 text-blue-800" },
  cancelled: { label: "Dibatalkan", color: "bg-gray-100 text-gray-600" },
}

function fmt(n: number, currency = "IDR") {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: 0 }).format(n)
}

// ─── Create Budget Session Dialog ──────────────────────────────────────────────

const sessionSchema = z.object({
  title: z.string().min(1, "Nama kegiatan wajib diisi"),
  budget_amount: z.string().min(1, "Budget wajib diisi"),
  currency: z.string().default("IDR").optional(),
  client_id: z.string().min(1, "Client wajib dipilih"),
  session_id: z.string().optional(),
})
type SessionForm = z.infer<typeof sessionSchema>

function CreateSessionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: clients = [] } = useClients()
  const create = useCreateBudgetSession()

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } =
    useForm<SessionForm, unknown, SessionForm>({
      resolver: zodResolver(sessionSchema),
      defaultValues: { currency: "IDR" },
    })

  const clientId = watch("client_id") ?? ""
  const { data: sessions = [] } = useSessionsByClient(clientId)

  const onSubmit = (data: SessionForm) => {
    const chatId = sessions.find((s) => s.id === data.session_id)?.chat_id ?? 0
    create.mutate(
      {
        title: data.title,
        budget_amount: Number(data.budget_amount.replace(/[^0-9]/g, "")),
        currency: data.currency,
        client_id: data.client_id,
        chat_id: chatId,
        session_id: data.session_id || undefined,
      },
      { onSuccess: () => { reset(); onClose() } },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sesi Budget Baru</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>Nama Kegiatan</Label>
            <Input {...register("title")} placeholder="cth: Jalan-jalan ke mall" />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>Budget (Rp)</Label>
            <Input {...register("budget_amount")} placeholder="cth: 1000000" type="number" min="0" />
            {errors.budget_amount && <p className="text-xs text-destructive">{errors.budget_amount.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={(v) => { setValue("client_id", v); setValue("session_id", "") }}>
              <SelectTrigger><SelectValue placeholder="Pilih client..." /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.client_id && <p className="text-xs text-destructive">{errors.client_id.message}</p>}
          </div>

          {clientId && sessions.length > 0 && (
            <div className="space-y-1">
              <Label>Session (opsional)</Label>
              <Select value={watch("session_id") ?? ""} onValueChange={(v) => setValue("session_id", v)}>
                <SelectTrigger><SelectValue placeholder="Pilih session..." /></SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {create.error && <p className="text-xs text-destructive">{(create.error as Error).message}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Menyimpan..." : "Buat Sesi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Add Transaction Dialog ─────────────────────────────────────────────────────

const txSchema = z.object({
  description: z.string().min(1, "Deskripsi wajib diisi"),
  amount: z.string().min(1, "Jumlah wajib diisi"),
  category: z.enum(["food", "transport", "entertainment", "shopping", "health", "other"]),
  type: z.enum(["expense", "income"]),
  note: z.string().optional(),
})
type TxForm = z.infer<typeof txSchema>

function AddTransactionDialog({
  open,
  onClose,
  session,
}: {
  open: boolean
  onClose: () => void
  session: BudgetSession
}) {
  const create = useCreateTransaction()

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } =
    useForm<TxForm, unknown, TxForm>({
      resolver: zodResolver(txSchema),
      defaultValues: { category: "other", type: "expense" },
    })

  const onSubmit = (data: TxForm) => {
    create.mutate(
      {
        client_id: session.id, // placeholder — we pass budget_session_id instead
        chat_id: 0,
        budget_session_id: session.id,
        description: data.description,
        amount: Number(data.amount),
        category: data.category,
        type: data.type,
        note: data.note || undefined,
      },
      { onSuccess: () => { reset(); onClose() } },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Catat Transaksi — {session.title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipe</Label>
              <Select value={watch("type")} onValueChange={(v) => setValue("type", v as TransactionType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">💸 Pengeluaran</SelectItem>
                  <SelectItem value="income">💵 Pemasukan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Kategori</Label>
              <Select value={watch("category")} onValueChange={(v) => setValue("category", v as TransactionCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(CATEGORY_CONFIG) as [TransactionCategory, { label: string; emoji: string }][]).map(([val, cfg]) => (
                    <SelectItem key={val} value={val}>{cfg.emoji} {cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Deskripsi</Label>
            <Input {...register("description")} placeholder="cth: Makan siang di warung padang" />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>Jumlah (Rp)</Label>
            <Input {...register("amount")} type="number" min="0" placeholder="cth: 45000" />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>Catatan (opsional)</Label>
            <Textarea {...register("note")} rows={2} placeholder="Detail tambahan..." />
          </div>

          {create.error && <p className="text-xs text-destructive">{(create.error as Error).message}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Menyimpan..." : "Catat"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Transaction List ───────────────────────────────────────────────────────────

function TransactionList({ sessionId }: { sessionId: string }) {
  const { data: transactions = [], isLoading } = useSessionTransactions(sessionId)
  const del = useDeleteTransaction()
  const [toDelete, setToDelete] = useState<FinancialTransaction | null>(null)

  if (isLoading) return <p className="text-xs text-muted-foreground py-2">Memuat...</p>
  if (transactions.length === 0) return <p className="text-xs text-muted-foreground py-2">Belum ada transaksi.</p>

  return (
    <div className="space-y-1.5 mt-3">
      {transactions.map((tx) => {
        const cat = CATEGORY_CONFIG[tx.category]
        return (
          <div key={tx.id} className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base flex-shrink-0">{cat.emoji}</span>
              <div className="min-w-0">
                <p className="truncate font-medium">{tx.description}</p>
                <p className="text-xs text-muted-foreground">
                  {cat.label} · {new Date(tx.transaction_date).toLocaleString("id-ID")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              <span className={`font-semibold ${tx.type === "expense" ? "text-red-600" : "text-green-600"}`}>
                {tx.type === "expense" ? "−" : "+"}
                {fmt(tx.amount)}
              </span>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => setToDelete(tx)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )
      })}

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Transaksi</AlertDialogTitle>
            <AlertDialogDescription>
              Hapus &quot;{toDelete?.description}&quot;? Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (toDelete) del.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })
            }}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Budget Session Card ────────────────────────────────────────────────────────

function BudgetSessionCard({
  session,
  onComplete,
  onCancel,
  onDelete,
}: {
  session: BudgetSession
  onComplete?: (s: BudgetSession) => void
  onCancel?: (s: BudgetSession) => void
  onDelete: (s: BudgetSession) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [addTxOpen, setAddTxOpen] = useState(false)
  const statusCfg = STATUS_CONFIG[session.status]
  const pct = session.budget_amount > 0 ? Math.min((session.total_spent / session.budget_amount) * 100, 100) : 0
  const isOver = session.total_spent > session.budget_amount

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <button className="flex items-center gap-2 text-left min-w-0 flex-1" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
          <div className="min-w-0">
            <p className="font-semibold truncate">{session.title}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <Badge className={`text-xs ${statusCfg.color}`}>{statusCfg.label}</Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(session.started_at).toLocaleDateString("id-ID")}
                {session.ended_at ? ` – ${new Date(session.ended_at).toLocaleDateString("id-ID")}` : ""}
              </span>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-1 flex-shrink-0">
          {session.status === "active" && (
            <>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAddTxOpen(true)}>
                <Plus className="h-3 w-3" /> Catat
              </Button>
              {onComplete && (
                <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" title="Selesaikan sesi" onClick={() => onComplete(session)}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </Button>
              )}
              {onCancel && (
                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" title="Batalkan sesi" onClick={() => onCancel(session)}>
                  <XCircle className="h-3.5 w-3.5" />
                </Button>
              )}
            </>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(session)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Budget bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Terpakai</span>
          <span className={`font-medium ${isOver ? "text-red-600" : ""}`}>{fmt(session.total_spent)}</span>
        </div>
        <Progress value={pct} className={isOver ? "[&>div]:bg-red-500" : ""} />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Budget: {fmt(session.budget_amount)}</span>
          <span className={isOver ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
            {isOver ? `Lebih ${fmt(session.total_spent - session.budget_amount)}` : `Sisa ${fmt(session.remaining)}`}
          </span>
        </div>
      </div>

      {/* Transaction list (expandable) */}
      {expanded && <TransactionList sessionId={session.id} />}

      {addTxOpen && (
        <AddTransactionDialog open={addTxOpen} onClose={() => setAddTxOpen(false)} session={session} />
      )}
    </div>
  )
}

// ─── Summary Stats ──────────────────────────────────────────────────────────────

function FinanceSummary({ sessions }: { sessions: BudgetSession[] }) {
  const active = sessions.filter((s) => s.status === "active")
  const totalBudget = active.reduce((a, s) => a + s.budget_amount, 0)
  const totalSpent = active.reduce((a, s) => a + s.total_spent, 0)
  const totalRemaining = active.reduce((a, s) => a + s.remaining, 0)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">Total Budget Aktif</p>
          <div className="rounded-md bg-primary/10 p-2"><Wallet className="h-4 w-4 text-primary" /></div>
        </div>
        <p className="mt-3 text-2xl font-bold">{fmt(totalBudget)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{active.length} sesi aktif</p>
      </div>
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">Total Terpakai</p>
          <div className="rounded-md bg-red-500/10 p-2"><TrendingDown className="h-4 w-4 text-red-500" /></div>
        </div>
        <p className="mt-3 text-2xl font-bold text-red-600">{fmt(totalSpent)}</p>
        <p className="mt-1 text-xs text-muted-foreground">dari semua sesi aktif</p>
      </div>
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">Total Sisa</p>
          <div className="rounded-md bg-green-500/10 p-2"><TrendingUp className="h-4 w-4 text-green-500" /></div>
        </div>
        <p className="mt-3 text-2xl font-bold text-green-600">{fmt(totalRemaining)}</p>
        <p className="mt-1 text-xs text-muted-foreground">sisa budget aktif</p>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export function FinancePage() {
  const { data: allSessions = [], isLoading } = useBudgetSessions()
  const complete = useCompleteBudgetSession()
  const cancel = useCancelBudgetSession()
  const del = useDeleteBudgetSession()

  const [createOpen, setCreateOpen] = useState(false)
  const [toDelete, setToDelete] = useState<BudgetSession | null>(null)

  const active = allSessions.filter((s) => s.status === "active")
  const completed = allSessions.filter((s) => s.status === "completed")
  const cancelled = allSessions.filter((s) => s.status === "cancelled")

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Keuangan & Budgeting"
        description="Pantau anggaran dan catatan transaksi Anda"
        action={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Sesi Budget Baru
          </Button>
        }
      />

      <FinanceSummary sessions={allSessions} />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : (
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Aktif ({active.length})</TabsTrigger>
            <TabsTrigger value="completed">Selesai ({completed.length})</TabsTrigger>
            <TabsTrigger value="cancelled">Dibatalkan ({cancelled.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            {active.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <Wallet className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="font-medium">Tidak ada sesi budget aktif</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Buat sesi baru atau minta Luna: &quot;hari ini mau jalan-jalan dengan budget 1 juta&quot;
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {active.map((s) => (
                  <BudgetSessionCard
                    key={s.id}
                    session={s}
                    onComplete={(sess) => complete.mutate(sess.id)}
                    onCancel={(sess) => cancel.mutate(sess.id)}
                    onDelete={setToDelete}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-4">
            {completed.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada sesi yang selesai.</p>
            ) : (
              <div className="space-y-3">
                {completed.map((s) => (
                  <BudgetSessionCard key={s.id} session={s} onDelete={setToDelete} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="cancelled" className="mt-4">
            {cancelled.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada sesi yang dibatalkan.</p>
            ) : (
              <div className="space-y-3">
                {cancelled.map((s) => (
                  <BudgetSessionCard key={s.id} session={s} onDelete={setToDelete} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <CreateSessionDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Sesi Budget</AlertDialogTitle>
            <AlertDialogDescription>
              Hapus sesi &quot;{toDelete?.title}&quot; beserta semua transaksinya? Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDelete) del.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })
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
