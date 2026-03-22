import { PageHeader } from "@/components/layout/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { useClients } from "@/hooks/useClients"

export function DashboardPage() {
  const { data: clients = [] } = useClients()
  const activeClients = clients.filter((c) => c.active)

  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of your Luluna Claw setup" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Total Clients" value={clients.length} />
        <StatCard title="Active Clients" value={activeClients.length} />
        <StatCard
          title="Telegram Clients"
          value={clients.filter((c) => c.type === "telegram").length}
        />
      </div>
    </div>
  )
}
