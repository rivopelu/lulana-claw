export interface AppConnection {
  id: string
  app_type: "google"
  email?: string
  display_name?: string
  scopes?: string
  connected_at: number
}
