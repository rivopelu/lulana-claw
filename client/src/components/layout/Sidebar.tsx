import { Link, useLocation, useNavigate } from "react-router"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Bot, Brain, MessageSquare, LogOut, BookText, ListTodo, Puzzle, ImagePlay } from "lucide-react"
import { useMe, useSignOut } from "@/hooks/useAuth"

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Clients", path: "/clients", icon: Bot },
  { label: "Sessions", path: "/sessions", icon: MessageSquare },
  { label: "AI Models", path: "/ai-models", icon: Brain },
  { label: "Contexts", path: "/contexts", icon: BookText },
  { label: "Tasks", path: "/tasks", icon: ListTodo },
  { label: "Content Studio", path: "/content", icon: ImagePlay },
  { label: "Apps", path: "/apps", icon: Puzzle },
]

export function Sidebar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { data: me } = useMe()
  const signOut = useSignOut()

  return (
    <aside
      className="flex w-60 flex-shrink-0 flex-col"
      style={{ backgroundColor: "var(--color-sidebar)", color: "var(--color-sidebar-foreground)" }}
    >
      {/* Brand */}
      <div
        className="flex h-14 items-center gap-2 px-5"
        style={{ borderBottom: "1px solid var(--color-sidebar-border)" }}
      >
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md"
          style={{ backgroundColor: "var(--color-sidebar-active-bg)" }}
        >
          <Bot className="h-4 w-4" style={{ color: "var(--color-sidebar-active-foreground)" }} />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none">Luluna Claw</p>
          <p className="text-xs leading-none" style={{ color: "var(--color-sidebar-muted-foreground)" }}>
            AI Assistant
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
        {navItems.map(({ label, path, icon: Icon }) => {
          const active = pathname === path || pathname.startsWith(path + "/")
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              )}
              style={
                active
                  ? {
                      backgroundColor: "var(--color-sidebar-active-bg)",
                      color: "var(--color-sidebar-active-foreground)",
                    }
                  : { color: "var(--color-sidebar-foreground)" }
              }
              onMouseEnter={(e) => {
                if (!active) {
                  ;(e.currentTarget as HTMLAnchorElement).style.backgroundColor =
                    "var(--color-sidebar-hover-bg)"
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  ;(e.currentTarget as HTMLAnchorElement).style.backgroundColor = ""
                }
              }}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div
        className="px-3 py-4"
        style={{ borderTop: "1px solid var(--color-sidebar-border)" }}
      >
        <div className="flex items-center justify-between gap-2 rounded-md px-2 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{me?.name ?? "User"}</p>
            <p
              className="truncate text-xs"
              style={{ color: "var(--color-sidebar-muted-foreground)" }}
            >
              {me?.email ?? ""}
            </p>
          </div>
          <button
            onClick={() => signOut.mutate(undefined, { onSuccess: () => navigate("/login") })}
            className="flex-shrink-0 rounded-md p-1.5 transition-colors"
            style={{ color: "var(--color-sidebar-muted-foreground)" }}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
