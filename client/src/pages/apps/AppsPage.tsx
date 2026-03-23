import { useState } from "react"
import { ExternalLink, Plug, Trash2, Mail, Calendar, FileText, Chrome } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
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
import { useAppConnections, useDisconnectApp, useGoogleAuthUrl } from "@/hooks/useApps"
import type { AppConnection } from "@/types/app"

// ─── Google App Card ─────────────────────────────────────────────────────────

const GOOGLE_CAPABILITIES = [
  { icon: Calendar, label: "Google Calendar" },
  { icon: Mail, label: "Gmail" },
  { icon: FileText, label: "Google Docs & Drive" },
]

function GoogleAppCard({
  connection,
  onConnect,
  onDisconnect,
  isConnecting,
}: {
  connection?: AppConnection
  onConnect: () => void
  onDisconnect: (conn: AppConnection) => void
  isConnecting: boolean
}) {
  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white border shadow-sm">
          <Chrome className="h-6 w-6 text-[#4285F4]" />
        </div>
        <div>
          <p className="font-semibold">Google Workspace</p>
          <p className="text-xs text-muted-foreground">Calendar, Gmail, Docs & Drive</p>
        </div>
        {connection && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Connected
          </span>
        )}
      </div>

      {/* Capabilities */}
      <div className="grid grid-cols-3 gap-2">
        {GOOGLE_CAPABILITIES.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1.5 rounded-lg border bg-muted/40 p-3"
          >
            <Icon className="h-5 w-5 text-muted-foreground" />
            <p className="text-xs text-center text-muted-foreground leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* Connected account info */}
      {connection ? (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
          <p className="text-sm font-medium">{connection.display_name ?? "Google Account"}</p>
          {connection.email && (
            <p className="text-xs text-muted-foreground">{connection.email}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Connected {new Date(connection.connected_at).toLocaleDateString("id-ID")}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Hubungkan Google Account untuk memberi Luna akses ke Calendar, Gmail, dan Docs.
        </p>
      )}

      {/* Action */}
      <div className="flex items-center gap-2">
        {connection ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => onDisconnect(connection)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Disconnect
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 ml-auto"
              onClick={onConnect}
              disabled={isConnecting}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Re-connect
            </Button>
          </>
        ) : (
          <Button size="sm" className="gap-1.5 w-full" onClick={onConnect} disabled={isConnecting}>
            <Plug className="h-4 w-4" />
            {isConnecting ? "Redirecting..." : "Connect Google"}
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AppsPage() {
  const { data: connections = [], isLoading } = useAppConnections()
  const { refetch: fetchAuthUrl, isFetching: isConnecting } = useGoogleAuthUrl()
  const disconnect = useDisconnectApp()

  const [toDisconnect, setToDisconnect] = useState<AppConnection | null>(null)

  const googleConn = connections.find((c) => c.app_type === "google")

  const handleConnectGoogle = async () => {
    const result = await fetchAuthUrl()
    if (result.data) {
      window.location.href = result.data
    }
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Apps"
        description="Hubungkan Luna ke aplikasi eksternal"
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <GoogleAppCard
            connection={googleConn}
            onConnect={handleConnectGoogle}
            onDisconnect={setToDisconnect}
            isConnecting={isConnecting}
          />
        </div>
      )}

      {/* More apps coming soon */}
      <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center space-y-2">
        <p className="text-sm font-medium text-muted-foreground">More integrations coming soon</p>
        <p className="text-xs text-muted-foreground">Notion, Slack, GitHub, dan lainnya</p>
      </div>

      {/* Disconnect Confirm */}
      <AlertDialog open={!!toDisconnect} onOpenChange={(v) => !v && setToDisconnect(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect App</AlertDialogTitle>
            <AlertDialogDescription>
              Putuskan koneksi{" "}
              <strong>
                {toDisconnect?.app_type === "google" ? "Google" : toDisconnect?.app_type}
              </strong>
              {toDisconnect?.email ? ` (${toDisconnect.email})` : ""}? Luna tidak akan bisa
              mengakses Google Workspace lagi hingga dihubungkan kembali.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (toDisconnect)
                  disconnect.mutate(toDisconnect.id, { onSuccess: () => setToDisconnect(null) })
              }}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
