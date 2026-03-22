# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Luluna Claw** ("Lula") — a multi-channel AI assistant platform. Supports Telegram (primary), Discord, WhatsApp, HTTP. All configuration is DB-driven: bot tokens, AI models, contexts, sessions, credentials — nothing hardcoded in source.

## Commands

```bash
# Development (Hono :8090 + Vite :5173 concurrently)
bun run dev
bun run dev:server   # backend only (--watch)
bun run dev:client   # frontend only

# Build & Run
bun run build        # build:client then build:server
bun run start        # Production: API + SPA from :8090

# Database (PostgreSQL via Drizzle)
bun run db:generate  # Generate migrations from schema changes
bun run db:migrate   # Run pending migrations

# Quality
bun run typecheck    # tsc --noEmit (run from root)
cd client && bunx tsc --noEmit  # frontend typecheck
bun run lint         # ESLint
bun run lint:fix
bun run format       # Prettier
bun test

# Add shadcn component (must run from client/)
cd client && bunx shadcn@latest add [component-name]
```

## Architecture

### Dual Database Strategy

- **PostgreSQL** (Drizzle ORM) — structured data: accounts, clients, sessions, AI models, tasks, credentials
- **MongoDB** (Mongoose) — chat history (`session_messages`) + behavior contexts (`contexts`)

### PostgreSQL Entities (`src/entities/pg/`)

| Table | Key Fields |
|---|---|
| `account` | `email`, `password`, `name` |
| `client` | `type` (telegram/discord/whatsapp/http), `ai_model_id`, `entity_mode` (single/per_session) |
| `client_credential` | `client_id`, `key`, `value` — key-value credentials per bot (e.g. bot_token) |
| `ai_model` | `account_id`, `name`, `provider` (openai/openrouter/gemini/anthropic), `model_id`, `api_key` |
| `session` | `client_id`, `chat_id` (bigint, negative for groups), `chat_type`, `name`, `ai_model_id` (override) |
| `task` | `account_id`, `client_id`, `chat_id`, `session_id?`, `type` (task/reminder/notes/meeting/deadline), `title`, `description`, `remind_at` (Unix ms), `reminded` (bool), `status` (pending/done/cancelled) |

All tables use soft-delete audit fields from `_base.entity.ts`: `id`, `active`, `created_date/by`, `updated_date/by`, `deleted_date/by`.

### MongoDB Schemas (`src/entities/mongo/`)

- **`session_messages`** — `{ session_id, role: user|assistant|system, content, from_id, from_name, created_at }`
- **`contexts`** — `{ context_id, account_id, name, type: global|client|session, category: identity|personality|rules|knowledge|custom, content, client_id?, session_id?, order, active }`

### Startup Flow (`src/index.ts`)

1. Validate env (Zod) → connect PostgreSQL + MongoDB
2. `ContextService.syncAllToDisk()` — write all active MongoDB contexts to `contexts/{type}_{category}_{id}.md`
3. Register Hono routes (all controllers via `src/routes/_app.routes.ts`)
4. Load all active clients → `BotManager.startActiveBots()`
5. `BotManager.startReminderScheduler()` — polls DB every 30s for due tasks (global singleton, starts once)
6. Listen on `:8090`

### Incoming Telegram Message Flow

```
Grammy update → identify account (by telegram user ID, create if new)
  → find/create Session (keyed: client_id + chat_id)
  → if group: skip unless @mentioned or reply-to-bot
  → strip @mention from text; if empty → return
  → build system prompt: global contexts → client contexts → session contexts (if entity_mode=per_session) + current datetime + TASK_CAPABILITY_PROMPT
  → load last 20 messages from MongoDB
  → per-chat queue (key: clientId:chatId) → sequential, no concurrency
  → call AI with exponential backoff retry (3 attempts: 2s, 6s, 18s)
  → parse [TASK_CREATE:{...}] markers in AI response → create tasks in DB, strip markers from reply
  → save user + assistant messages to MongoDB
  → reply
```

### Model Resolution Hierarchy

`session.ai_model_id` → `client.ai_model_id` → error ("No AI model assigned")

AI calls use the model's `provider` to route to the correct base URL (OpenAI, OpenRouter, Gemini, Anthropic all use OpenAI-compatible SDK with `baseURL`).

### Entity Mode

- **`per_session`** (default) — each chat has its own session context layer (global + client + session contexts)
- **`single`** — all chats share only global + client contexts; session-level contexts are skipped

### Reminder Scheduler

Runs every 30s: queries `task` rows where `status=pending`, `reminded=false`, `remind_at <= now`. For each due task, if the bot is running: sends Telegram message to `chat_id`, sets `reminded=true`.

### Context Auto-Generation (`/updatecontext` command)

Fetches last 200 MongoDB messages → sends to AI with analysis prompt → AI returns a context document → saved/updated as session context with name `auto:{sessionName}`. Written to disk immediately.

### Bot Commands

| Command | Behavior |
|---|---|
| `/setup <name>` | Create or rename the session for this chat |
| `/model` | Show/set/reset the AI model for this session |
| `/task <title> [| time]` | Create task via command; optional type prefix `reminder:`, `notes:`, etc.; time: `30m`, `2h`, `1d`, `HH:MM`, `DD/MM HH:MM` |
| Natural language | "ingatkan jam 10 untuk makan" → AI appends `[TASK_CREATE:{...}]` → bot creates task automatically |
| `/tasks` | List pending tasks for this chat |
| `/donetask <id>` | Mark task as done |
| `/updatecontext` | Analyze chat history and auto-generate/update session context |

### Core Bot File

`src/bots/bot-manager.ts` — singleton, ~700 lines. Owns: Grammy bot instances, per-chat message queues, command handlers, reminder scheduler, bot lifecycle (start/stop/restart/getStatus).

## Tech Stack

| Layer | Tech |
|---|---|
| Runtime | Bun |
| Backend | Hono 4.x + `hono-decorators` |
| Telegram | Grammy |
| AI | OpenAI SDK (multi-provider via `baseURL`) |
| Postgres ORM | Drizzle ORM |
| MongoDB | Mongoose |
| Validation | Zod + `@hono/zod-validator` |
| Auth | Hono JWT + Bun password hashing |
| Logging | Winston + picocolors |

## Environment Variables

```
PORT=8090
NODE_ENV=development

# PostgreSQL
DB_HOST=  DB_PORT=5432  DB_USER=  DB_PASSWORD=  DB_NAME=

# MongoDB
MONGO_HOST=  MONGO_PORT=27017  MONGO_USER=  MONGO_PASSWORD=  MONGO_NAME=

# JWT
JWT_SECRET=  JWT_EXPIRES_IN_DAY=

# OpenAI (default fallback)
OPENAI_API_KEY=  OPENAI_DEFAULT_MODEL=gpt-4o-mini
```

All validated at startup via Zod in `src/configs/env.ts`.

## Backend Conventions

- **Request flow**: Routes → Controllers (`hono-decorators`) → Services → Repositories → DB
- **Error handling**: Custom exceptions in `src/libs/exceptions/` (`BadRequest`, `Unauthorized`, `NotFound`, `Forbidden`); messages via `i18next`
- **Response helpers**: `src/libs/response-helper.ts` — all controllers use these for consistent shape
- **Auth context**: `src/libs/utils.ts:extractAccountId()` pulls `account_id` from JWT in all protected routes

## Frontend (client/)

- **Stack**: React 19 + Vite 8 + Tailwind v4 + shadcn/ui
- **Tailwind config**: `@theme` block in `client/src/index.css` — no `tailwind.config.ts`, no `postcss.config.js`
- **Path alias**: `@/*` → `client/src/*`
- **HTTP client**: `ky` in `client/src/lib/api.ts` — prefix `/api`, auto-attaches JWT from `localStorage`
- **Server state**: TanStack Query v5; hooks in `client/src/hooks/use[Resource].ts`
- **Routing**: React Router v7; routes in `client/src/App.tsx`

### Key Frontend Files

| File | Purpose |
|---|---|
| `hooks/useAuth.ts` | Setup check, sign in/up, current user, sign out |
| `hooks/useClients.ts` | Client CRUD, bot start/stop/restart, status polling (3s), credentials, entity mode, AI model |
| `hooks/useSessions.ts` | Sessions by client, detail, chat history (5s refetch), set model |
| `hooks/useAiModels.ts` | AI model CRUD, master list by provider, OpenRouter OAuth |
| `hooks/useContexts.ts` | Context CRUD |
| `hooks/useTasks.ts` | Task CRUD, status filter; auto-refetch every 30s |
| `lib/constants.ts` | All `ROUTES.*` and `API.*` endpoint strings — always update here first |
| `types/` | Mirror backend response shapes exactly |

### Frontend Conventions

- Never use `fetch`/`axios` — always use `client/src/lib/api.ts`
- `useForm<T, unknown, T>` with `zodResolver` for all forms; use `useEffect(() => { if (open) reset(...) }, [open, editing, reset])` to re-populate edit dialogs
- Radix Select cannot use empty string as value — use `"__none__"` sentinel when needed
- `components/ui/` is shadcn-generated — never edit manually
- In production, Hono serves the SPA from `client/dist/`; all non-`/api` routes fall back to `index.html`

## Important Conventions

- **No hardcoded tokens or context content** — everything from DB at runtime
- **Context disk cache** (`contexts/*.md`) is auto-managed by `ContextService.syncAllToDisk()` — never edit files manually
- **One session = one conversation** — private chat and group chat are always separate sessions even for the same user
- **Postgres schema changes**: always `db:generate` → `db:migrate`; never edit migration SQL files manually
- **API keys** masked in responses — only last 6 chars shown (`ai-model.service.ts`)
- **Bot privacy mode**: Telegram bots must have privacy mode **DISABLED** in BotFather to receive group messages without being admin
