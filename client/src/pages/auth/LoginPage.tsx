import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Navigate, useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useSetup, useSignIn } from "@/hooks/useAuth"
import { getToken } from "@/stores/authStore"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { ROUTES } from "@/lib/constants"

const schema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})
type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
  const { data: setup, isLoading: setupLoading } = useSetup()
  const signIn = useSignIn()

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  // Already logged in → go to dashboard
  if (getToken()) return <Navigate to={ROUTES.DASHBOARD} replace />

  // System not set up → go to setup
  if (!setupLoading && !setup?.initialized) return <Navigate to={ROUTES.SETUP} replace />

  if (setupLoading) return <LoadingSpinner />

  const onSubmit = async (values: FormValues) => {
    try {
      await signIn.mutateAsync(values)
      navigate(ROUTES.DASHBOARD)
    } catch {
      setError("root", { message: "Invalid email or password" })
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Luluna Claw</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
            {errors.root && (
              <p className="text-sm text-destructive">{errors.root.message}</p>
            )}
            <Button type="submit" disabled={signIn.isPending}>
              {signIn.isPending ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
