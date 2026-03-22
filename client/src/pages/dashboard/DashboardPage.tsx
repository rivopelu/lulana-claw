import { Link } from "react-router"
import { Bot, Activity, Cpu } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { useClients } from "@/hooks/useClients"
import { useMe } from "@/hooks/useAuth"

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="rounded-md bg-primary/10 p-2">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

export function DashboardPage() {
  const { data: clients = [] } = useClients()
  const { data: me } = useMe()

  const activeClients = clients.filter((c) => c.active)
  const telegramClients = clients.filter((c) => c.type === "telegram")

  return (
    <div>
      <PageHeader
        title={me ? `Hello, ${me.name.split(" ")[0]}` : "Dashboard"}
        description="Overview of your Luluna Claw setup"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Bot} label="Total Clients" value={clients.length} />
        <StatCard
          icon={Activity}
          label="Active Clients"
          value={activeClients.length}
          sub={`${clients.length - activeClients.length} inactive`}
        />
        <StatCard
          icon={Cpu}
          label="Telegram Bots"
          value={telegramClients.length}
          sub="Active channel"
        />
      </div>

      {clients.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed p-8 text-center">
          <Bot className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium">No clients configured</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Set up your first bot client to get started
          </p>
          <Link
            to="/clients"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Bot className="h-4 w-4" />
            Go to Clients
          </Link>
        </div>
      )}
    </div>
  )
}
