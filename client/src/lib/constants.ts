export const ROUTES = {
  LOGIN: "/login",
  SETUP: "/setup",
  DASHBOARD: "/dashboard",
  CLIENTS: "/clients",
  AI_MODELS: "/ai-models",
  OPENROUTER_CALLBACK: "/ai-models/openrouter/callback",
  SESSIONS: "/sessions",
  SESSION_DETAIL: (id: string) => `/sessions/${id}`,
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
    SET_MODEL: (id: string) => `client/${id}/model`,
    CREDENTIAL: (id: string) => `client/${id}/credential`,
    CREDENTIAL_ITEM: (id: string, credId: string) => `client/${id}/credential/${credId}`,
  },
  MASTER: {
    CLIENT_TYPES: "master/client-types",
    AI_MODELS: "master/ai-models",
  },
  AI_MODEL: {
    LIST: "ai-model",
    DETAIL: (id: string) => `ai-model/${id}`,
    OAUTH_OPENROUTER: "ai-model/oauth/openrouter",
  },
  SESSION: {
    BY_CLIENT: (clientId: string) => `session/client/${clientId}`,
    DETAIL: (id: string) => `session/${id}`,
    SET_MODEL: (id: string) => `session/${id}/model`,
  },
  BOT: {
    STATUSES: "bot/statuses",
    STATUS: (id: string) => `bot/${id}/status`,
    START: (id: string) => `bot/${id}/start`,
    STOP: (id: string) => `bot/${id}/stop`,
    RESTART: (id: string) => `bot/${id}/restart`,
  },
} as const
