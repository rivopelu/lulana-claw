# Lulana Claw 🤖

An open-source AI assistant platform for managing multiple bot clients across different channels (Telegram, Discord, WhatsApp, HTTP). All configuration — bot tokens, AI models, contexts, sessions — is stored in the database. Nothing is hardcoded.

## Features

- **Multi-channel bots** — Telegram first; Discord, WhatsApp, HTTP ready
- **Multi-provider AI** — OpenAI, OpenRouter, Gemini, Anthropic (OpenAI-compatible SDK)
- **Per-session model override** — each conversation can use a different AI model
- **Context system** — layered system prompts (global → client → session), auto-generated from chat history via `/updatecontext`
- **Task & reminder system** — create tasks via natural language ("ingatkan jam 10 untuk makan") or `/task` command; bot delivers reminders at the scheduled time
- **Management dashboard** — React UI to manage clients, sessions, AI models, contexts, and tasks
- **Entity mode** — `per_session` (each chat isolated) or `single` (shared context across all chats)

## Tech Stack

| Layer | Tech |
|---|---|
| Runtime | [Bun](https://bun.sh) |
| Backend | [Hono](https://hono.dev) + `hono-decorators` |
| Frontend | React 19 + Vite + Tailwind v4 + shadcn/ui |
| Telegram | [Grammy](https://grammy.dev) |
| AI | OpenAI SDK (multi-provider via `baseURL`) |
| PostgreSQL | [Drizzle ORM](https://orm.drizzle.team) |
| MongoDB | Mongoose |
| Auth | Hono JWT |

## Prerequisites

- [Bun](https://bun.sh) >= 1.0
- PostgreSQL >= 14
- MongoDB >= 6

## Getting Started

### 1. Clone & install

```bash
git clone https://github.com/your-username/lulana-claw.git
cd lulana-claw
bun install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your database credentials and JWT secret. See [Environment Variables](#environment-variables) for details.

### 3. Run database migrations

```bash
bun run db:migrate
```

### 4. Start development server

```bash
bun run dev
```

- Backend API: `http://localhost:8090`
- Frontend: `http://localhost:5173`

### 5. First-time setup

Open `http://localhost:5173` — you'll be redirected to the setup page to create the first admin account.

## Bot Setup (Telegram)

1. Create a bot via [@BotFather](https://t.me/BotFather) and get the token
2. **Disable privacy mode** in BotFather (`/setprivacy` → `Disable`) so the bot can read group messages
3. In the dashboard: go to **Clients** → create a new client with type `telegram` and paste your token
4. Start the bot from the dashboard
5. In Telegram, send `/setup <name>` to initialize a session in any chat

## Bot Commands

| Command | Description |
|---|---|
| `/setup <name>` | Initialize or rename the session for this chat |
| `/model` | Show, set, or reset the AI model for this session |
| `/task <title> [| time]` | Create a task. Optional time: `30m`, `2h`, `1d`, `14:30`, `25/12 09:00` |
| `/tasks` | List pending tasks for this chat |
| `/donetask <id>` | Mark a task as done |
| `/updatecontext` | Analyze chat history and auto-generate a session context |

**Natural language tasks** also work — just tell the bot naturally:
> "ingatkan jam 10 untuk makan" → bot creates a reminder automatically

## Project Structure

```
├── src/
│   ├── bots/            # BotManager — Grammy handlers, commands, reminder scheduler
│   ├── controllers/     # HTTP endpoints (Hono + hono-decorators)
│   ├── services/        # Business logic
│   ├── repositories/    # Data access (Drizzle for Postgres, Mongoose for MongoDB)
│   ├── entities/
│   │   ├── pg/          # Drizzle table definitions
│   │   └── mongo/       # Mongoose schemas (chat history, contexts)
│   ├── routes/          # Route registration
│   ├── middleware/       # JWT, logger, CORS
│   └── configs/         # Env validation (Zod), DB connections, logger
├── client/              # React frontend (Vite)
│   └── src/
│       ├── pages/       # Dashboard, Clients, Sessions, Tasks, Contexts, AI Models
│       ├── hooks/       # TanStack Query hooks
│       └── types/       # TypeScript types mirroring backend responses
├── drizzle/             # SQL migrations (auto-generated, do not edit)
└── contexts/            # Runtime context cache — auto-generated, gitignored
```

## Development Commands

```bash
bun run dev              # Start backend + frontend concurrently
bun run dev:server       # Backend only
bun run dev:client       # Frontend only
bun run build            # Production build
bun run start            # Serve production build

bun run db:generate      # Generate new migration from schema changes
bun run db:migrate       # Apply pending migrations

bun run typecheck        # TypeScript check (backend)
cd client && bunx tsc --noEmit  # TypeScript check (frontend)
bun run lint
bun run format
bun test
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: `8090`) |
| `NODE_ENV` | No | `development` / `production` |
| `DB_HOST` | Yes | PostgreSQL host |
| `DB_PORT` | No | PostgreSQL port (default: `5432`) |
| `DB_NAME` | Yes | PostgreSQL database name |
| `DB_USER` | Yes | PostgreSQL user |
| `DB_PASSWORD` | Yes | PostgreSQL password |
| `MONGO_HOST` | Yes | MongoDB host |
| `MONGO_PORT` | No | MongoDB port (default: `27017`) |
| `MONGO_NAME` | Yes | MongoDB database name |
| `MONGO_USER` | No | MongoDB user (optional) |
| `MONGO_PASSWORD` | No | MongoDB password (optional) |
| `JWT_SECRET` | Yes | Secret key for JWT signing (min 8 chars) |
| `JWT_EXPIRES_IN_DAY` | Yes | JWT expiry in days (e.g. `30`) |

> AI provider API keys are stored **per AI model in the database**, not in environment variables.

## Contributing

Pull requests are welcome. For major changes, please open an issue first.

## License

MIT
