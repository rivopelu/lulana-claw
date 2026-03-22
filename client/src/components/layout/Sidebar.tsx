import { Link, useLocation } from "react-router"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Bot, Settings } from "lucide-react"

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Clients", path: "/clients", icon: Bot },
  { label: "Settings", path: "/settings", icon: Settings },
]

export function Sidebar() {
  const { pathname } = useLocation()

  return (
    <aside className="flex w-60 flex-col border-r bg-card px-3 py-4">
      <div className="mb-6 px-3">
        <h1 className="text-lg font-semibold">Luluna Claw</h1>
        <p className="text-xs text-muted-foreground">AI Assistant</p>
      </div>
      <nav className="flex flex-col gap-1">
        {navItems.map(({ label, path, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === path
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
