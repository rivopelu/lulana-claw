# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Luluna Claw** ("Lula") — an AI assistant powered by OpenAI GPT, supporting multiple client channels (Telegram first, then Discord, WhatsApp, HTTP). All configuration (bot tokens, contexts, sessions) is DB-driven — nothing is hardcoded in source.

## Commands

```bash
# Development (runs Hono :8090 + Vite :5173 concurrently)
bun run dev

# Individual dev servers
bun run dev:server   # Hono backend only (--watch)
bun run dev:client   # Vite frontend only

# Build
bun run build        # build:client then build:server
bun run build:client # Vite → client/dist/
bun run build:server # Bun build → dist/
bun run start        # Production: serve API + SPA from :8090

# Database (PostgreSQL via Drizzle)
bun run db:generate  # Generate migrations from schema changes
bun run db:migrate   # Run pending migrations

# Quality
bun run typecheck    # tsc --noEmit
bun run lint         # ESLint src + __test__
bun run lint:fix     # ESLint --fix
bun run format       # Prettier --write src + __test__
bun test             # Run unit tests
bun run test:coverage

# Add shadcn component (run from client/)
cd client && bunx shadcn@latest add [component-name]
```

## Architecture

### Dual Database Strategy

- **PostgreSQL** (Drizzle ORM) — structured/relational data: accounts, clients, contexts, sessions metadata
- **MongoDB** (Mongoose) — session chat history only, keeps Postgres lightweight

### Key PostgreSQL Entities (`src/entities/pg/`)

| Table | Purpose |
|---|---|
| `account` | Users — extended with Telegram identity fields (`telegram_id`, `telegram_username`, `telegram_chat_id`) |
| `client` | One row per bot instance. Fields: `type` (telegram/discord/wa/http), `token`, `name`, `active`, `settings` (JSONB) |
| `context` | Context content. `type`: `global` \| `client` \| `user` \| `group` \| `session`. Optional FKs: `client_id`, `account_id` |
| `session` | One session per unique conversation (user↔bot or group↔bot). Stores `model_override`, `active`, refs to `client` and `account`/group |

### MongoDB Collection (`session_messages`)

Stores full chat history per session: `{ session_id, role: user|assistant|system, content, created_at }`. Referenced by `session.id` from Postgres.

### Startup Flow

1. Load all `client` rows from DB → initialize bot instances (e.g., Grammy for Telegram)
2. Download all `context` rows from DB → write to `contexts/` directory as `.md` files (disk cache)
3. Start Hono server + register bot webhook/polling handlers
4. Watch for context changes in DB → re-download affected `.md` files on change

### Session & Context Resolution Flow

When a message arrives (e.g., from Telegram):

```
Incoming message
  → Identify sender (telegram_id → account row, create if new)
  → Resolve chat scope: personal (user↔bot) or group
  → Find or create Session (keyed by client_id + chat_id)
  → Build system prompt by layering contexts in order:
       1. global context(s)
       2. client context(s) (for this client type)
       3. user context (if any for this account)
       4. group context (if group chat)
       5. session context (if any)
  → Load recent chat history from MongoDB (session_messages)
  → Call OpenAI with [system prompt + history + new message]
  → Persist response to MongoDB
  → Reply to user
```

### Module Structure

```
src/
├── clients/          # Bot client initializers (Telegram/Grammy, future: Discord, WA)
├── context/          # ContextService + disk cache manager (contexts/*.md)
├── session/          # Session management (Postgres) + history repo (MongoDB)
├── ai/               # OpenAIService — model selection, prompt assembly, API call
├── entities/
│   ├── pg/           # Drizzle table definitions (account, client, context, session)
│   └── mongo/        # Mongoose schemas (session_messages)
├── controllers/      # HTTP endpoints (existing auth + future management APIs)
├── services/         # Business logic
├── repositories/     # Data access (Postgres via Drizzle, Mongo via Mongoose)
├── middleware/       # Logger, CORS, JWT
├── configs/          # Env validation (Zod), logger, DB connections
└── libs/             # Exceptions, response helpers, i18n
```

### Request Flow (existing pattern)

```
Routes → Controllers → Services → Repositories → DB (Postgres or MongoDB)
```

Controllers use `hono-decorators` (`@Controller`, `@Get`, `@Post`, `@Middleware`). All routes registered in `src/routes/`.

### Error Handling

Custom exception classes in `src/libs/exceptions/`: `BadRequest`, `Unauthorized`, `NotFound`, `Forbidden`. Error messages localized via `i18next`.

## Tech Stack

| Layer | Tech |
|---|---|
| Runtime | Bun |
| Web Framework | Hono 4.x + `hono-decorators` |
| Telegram | Grammy |
| AI | OpenAI SDK (GPT-4o-mini default, configurable per session) |
| Postgres ORM | Drizzle ORM |
| MongoDB | Mongoose |
| Validation | Zod + `@hono/zod-validator` |
| Auth | Hono JWT + Bun password hashing |
| Logging | Winston + picocolors |
| i18n | i18next |

## Environment Variables

```
PORT=8090
NODE_ENV=development

# PostgreSQL
DB_HOST=
DB_PORT=5432
DB_USER=
DB_PASSWORD=
DB_NAME=

# MongoDB
MONGO_HOST=
MONGO_PORT=27017
MONGO_USER=
MONGO_PASSWORD=
MONGO_NAME=

# JWT
JWT_SECRET=
JWT_EXPIRES_IN_DAY=

# OpenAI
OPENAI_API_KEY=
OPENAI_DEFAULT_MODEL=gpt-4o-mini
```

All validated at startup via Zod in `src/configs/`.

## Frontend (client/)

- **Stack**: React 19 + Vite 8 + Tailwind v4 + shadcn/ui (latest)
- **Tailwind config**: via `@theme` block in `client/src/index.css` — no `tailwind.config.ts`, no `postcss.config.js`
- **Path alias**: `@/*` → `client/src/*`
- **shadcn config**: `client/components.json`
- **HTTP client**: `ky` instance in `client/src/lib/api.ts` — prefix `/api`, auto-attaches JWT from `localStorage`
- **Server state**: TanStack Query v5 — all data fetching via custom hooks in `client/src/hooks/`
- **Routing**: React Router v7

### Frontend structure

```
client/src/
├── components/layout/   # AppShell, Sidebar, Topbar, PageHeader
├── components/shared/   # DataTable, StatCard, EmptyState, LoadingSpinner
├── components/ui/       # shadcn generated — do not edit manually
├── hooks/               # useAuth.ts, useClients.ts — react-query hooks
├── lib/                 # api.ts, queryClient.ts, utils.ts, constants.ts
├── pages/               # [feature]/[Name]Page.tsx
├── stores/              # authStore.ts — token helpers
└── types/               # api.ts, user.ts, client.ts
```

### Frontend conventions

- All API calls go through `client/src/lib/api.ts` — never use `fetch`/`axios` directly
- All react-query hooks in `client/src/hooks/use[Resource].ts`
- Page components: `client/src/pages/[feature]/[Name]Page.tsx`
- Shared UI: `client/src/components/shared/`
- Types mirroring backend responses: `client/src/types/`
- In production, Hono serves the Vite SPA from `client/dist/` — all non-API routes fall back to `index.html`

## Important Conventions

- **No hardcoded context or bot tokens** — everything loaded from DB at runtime
- **Context cache** lives in `contexts/` directory as `.md` files — never edit manually, always update via DB
- **One session = one conversation** — a user chatting privately and the same user in a group are different sessions
- **Model is configurable per session** — default from env, can be overridden in `session.model_override`
- Postgres schema changes: always run `db:generate` then `db:migrate`