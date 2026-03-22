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
 *  2. If not initialized → redirect to /setup (first-time setup).
 *  3. If initialized but no token → redirect to /login.
 *  4. If initialized and token present → render children.
 */
export function AuthGuard() {
  const { data: setup, isLoading } = useSetup()

  if (isLoading) return <LoadingSpinner />

  if (!setup?.initialized) return <Navigate to={ROUTES.SETUP} replace />

  if (!getToken()) return <Navigate to={ROUTES.LOGIN} replace />

  return <Outlet />
}
