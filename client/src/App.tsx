import { Routes, Route, Navigate } from "react-router"
import { AppShell } from "@/components/layout/AppShell"
import { DashboardPage } from "@/pages/dashboard/DashboardPage"
import { TransactionsPage } from "@/pages/transactions/TransactionsPage"
import { BudgetsPage } from "@/pages/budgets/BudgetsPage"
import { ReportsPage } from "@/pages/reports/ReportsPage"
import { LoginPage } from "@/pages/auth/LoginPage"

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/budgets" element={<BudgetsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
