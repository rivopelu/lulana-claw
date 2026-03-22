import { Routes, Route, Navigate } from "react-router"
import { AuthGuard } from "@/components/layout/AuthGuard"
import { AppShell } from "@/components/layout/AppShell"
import { SetupPage } from "@/pages/auth/SetupPage"
import { LoginPage } from "@/pages/auth/LoginPage"
import { DashboardPage } from "@/pages/dashboard/DashboardPage"
import { ClientsPage } from "@/pages/clients/ClientsPage"
import { AiModelsPage } from "@/pages/ai-models/AiModelsPage"
import { SessionsPage } from "@/pages/sessions/SessionsPage"
import { SessionDetailPage } from "@/pages/sessions/SessionDetailPage"
import { OpenRouterCallbackPage } from "@/pages/ai-models/OpenRouterCallbackPage"
import { ContextsPage } from "@/pages/contexts/ContextsPage"

export default function App() {
  return (
    <Routes>
      {/* Public — first-time setup (only accessible when no account exists) */}
      <Route path="/setup" element={<SetupPage />} />

      {/* Public — login */}
      <Route path="/login" element={<LoginPage />} />

      {/* Public — OpenRouter OAuth callback */}
      <Route path="/ai-models/openrouter/callback" element={<OpenRouterCallbackPage />} />

      {/* Protected — requires auth, checks setup status first */}
      <Route element={<AuthGuard />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/sessions/:id" element={<SessionDetailPage />} />
          <Route path="/ai-models" element={<AiModelsPage />} />
          <Route path="/contexts" element={<ContextsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
