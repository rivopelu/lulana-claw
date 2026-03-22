import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Navigate, useNavigate } from "react-router"
import { Bot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useSetup, useSetupAccount } from "@/hooks/useAuth"
import { getToken } from "@/stores/authStore"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { queryClient } from "@/lib/queryClient"
import { ROUTES } from "@/lib/constants"

const schema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type FormValues = z.infer<typeof schema>

export function SetupPage() {
  const navigate = useNavigate()
  const { data: setupStatus, isLoading: setupLoading } = useSetup()
  const setup = useSetupAccount()

  // Already logged in → dashboard
  if (getToken()) return <Navigate to={ROUTES.DASHBOARD} replace />

  // Already initialized → login
  if (!setupLoading && setupStatus?.initialized === true)
    return <Navigate to={ROUTES.LOGIN} replace />

  if (setupLoading) return <LoadingSpinner />

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    await setup.mutateAsync({
      name: values.name,
      email: values.email,
      password: values.password,
    })
    await queryClient.invalidateQueries({ queryKey: ["auth", "setup"] })
    navigate("/login")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold">Welcome to Luluna Claw</h1>
            <p className="text-sm text-muted-foreground">Create the first admin account</p>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register("password")} />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input id="confirmPassword" type="password" {...register("confirmPassword")} />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>
            {setup.error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {(setup.error as Error).message || "Setup failed. Please try again."}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={setup.isPending}>
              {setup.isPending ? "Creating account..." : "Create Account"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
