import { Routes, Route, Navigate } from "react-router"
import { AuthGuard } from "@/components/layout/AuthGuard"
import { AppShell } from "@/components/layout/AppShell"
import { SetupPage } from "@/pages/auth/SetupPage"
import { LoginPage } from "@/pages/auth/LoginPage"
import { DashboardPage } from "@/pages/dashboard/DashboardPage"
import { BudgetsPage } from "@/pages/budgets/BudgetsPage"
import { ReportsPage } from "@/pages/reports/ReportsPage"

export default function App() {
  return (
    <Routes>
      {/* Public — first-time setup (only accessible when no account exists) */}
      <Route path="/setup" element={<SetupPage />} />

      {/* Public — login */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected — requires auth, checks setup status first */}
      <Route element={<AuthGuard />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
