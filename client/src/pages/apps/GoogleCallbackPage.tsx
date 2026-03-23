import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useConnectGoogle } from "@/hooks/useApps"
import { getToken } from "@/stores/authStore"
import { ROUTES } from "@/lib/constants"

export function GoogleCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const connect = useConnectGoogle()
  const [error, setError] = useState<string | null>(null)
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const code = searchParams.get("code")
    if (!code) {
      setError("No authorization code received from Google.")
      return
    }

    if (!getToken()) {
      navigate(
        `${ROUTES.LOGIN}?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`,
        { replace: true },
      )
      return
    }

    connect
      .mutateAsync(code)
      .then(() => navigate(ROUTES.APPS, { replace: true }))
      .catch((err: Error) => setError(err.message || "Failed to connect Google account."))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <XCircle className="h-12 w-12 text-destructive" />
          <div>
            <p className="font-semibold text-lg">Connection Failed</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
          <Button onClick={() => navigate(ROUTES.APPS)}>Back to Apps</Button>
        </div>
      </div>
    )
  }

  if (connect.isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <CheckCircle className="h-12 w-12 text-green-500" />
          <p className="font-semibold text-lg">Google Connected!</p>
          <p className="text-sm text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <div>
          <p className="font-semibold text-lg">Connecting Google...</p>
          <p className="mt-1 text-sm text-muted-foreground">Exchanging authorization code.</p>
        </div>
      </div>
    </div>
  )
}
