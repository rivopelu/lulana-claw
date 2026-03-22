import { Navigate, Outlet } from "react-router"
import { useSetup } from "@/hooks/useAuth"
import { getToken } from "@/stores/authStore"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { ROUTES } from "@/lib/constants"

/**
 * Guards all protected routes.
 *
 * Flow:
 *  1. Fetch /api/auth/setup to check if any account exists.
 *  2. If explicitly not initialized (initialized === false) → redirect to /setup.
 *  3. If initialized but no token → redirect to /login.
 *  4. If initialized and token present → render children.
 *
 * NOTE: only redirect to /setup when we have a definitive `false` — never on
 * undefined/error state, to avoid incorrectly bouncing users who already have
 * accounts when the API is slow or temporarily unreachable.
 */
export function AuthGuard() {
  const { data: setup, isLoading, isError } = useSetup()

  if (isLoading) return <LoadingSpinner />

  // Query failed — don't assume not-initialized; let login page handle it
  if (isError) return <Navigate to={ROUTES.LOGIN} replace />

  // Explicit false only
  if (setup?.initialized === false) return <Navigate to={ROUTES.SETUP} replace />

  if (!getToken()) return <Navigate to={ROUTES.LOGIN} replace />

  return <Outlet />
}
