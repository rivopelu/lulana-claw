export const ROUTES = {
  LOGIN: "/login",
  SETUP: "/setup",
  DASHBOARD: "/dashboard",
  CLIENTS: "/clients",
  SETTINGS: "/settings",
} as const

export const API = {
  AUTH: {
    SETUP: "auth/setup",
    SIGN_IN: "auth/sign-in",
    SIGN_UP: "auth/sign-up",
    ME: "auth/me",
  },
  CLIENT: {
    LIST: "client",
    DETAIL: (id: string) => `client/${id}`,
    CREDENTIAL: (id: string) => `client/${id}/credential`,
    CREDENTIAL_ITEM: (id: string, credId: string) => `client/${id}/credential/${credId}`,
  },
  MASTER: {
    CLIENT_TYPES: "master/client-types",
  },
} as const
