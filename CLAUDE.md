# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
bun run dev          # Start dev server with hot reload
bun run build        # Build to /dist (Bun target)
bun run start        # Build + run

# Database
bun run db:generate  # Generate Drizzle migrations from schema changes
bun run db:migrate   # Run pending migrations

# Linting / Formatting (no npm scripts defined — run directly)
bunx eslint src      # Lint TypeScript source
bunx prettier --write src  # Format source files
```

## Architecture

This is a **Bun + Hono** REST API following a strict layered architecture:

```
Routes → Controllers → Services → Repositories → Drizzle ORM → PostgreSQL
```

**Request flow:**
1. `src/index.ts` bootstraps the Hono app, attaches middleware, registers routes
2. Routes map URL paths to controller methods (via `hono-decorators`: `@Controller`, `@Get`, `@Post`, `@Middleware`)
3. Controllers handle validation (Zod + `@hono/zod-validator`) and delegate to services
4. Services contain business logic (JWT, password hashing via Bun built-ins)
5. Repositories handle all DB queries using Drizzle ORM

**Middleware pipeline** (initialized in `src/middleware/`):
- Logger (Winston) — logs all requests with duration
- CORS
- JWT validation on protected routes

**Error handling:**
- Custom exception classes in `src/libs/exceptions/` (`BadRequest`, `Unauthorized`, `NotFound`, `Forbidden`)
- Consistent API responses via helper in `src/libs/helpers/`
- Error messages are localized via `i18next`

**Database schema** is defined in `src/entities/pg/` using Drizzle table definitions. Run `db:generate` after any schema changes, then `db:migrate`.

## Tech Stack

- **Runtime:** Bun
- **Framework:** Hono 4.x with `hono-decorators` for class-based controllers
- **ORM:** Drizzle ORM (PostgreSQL via `pg` driver)
- **Validation:** Zod + `@hono/zod-validator`
- **Auth:** Hono JWT utilities, Bun password hashing
- **Logging:** Winston + picocolors
- **i18n:** i18next (for error messages)

## Environment Variables

Required in `.env`:

```
PORT=8090
NODE_ENV=development
DB_HOST=
DB_PORT=5432
DB_USER=
DB_PASSWORD=
DB_NAME=
JWT_SECRET=          # min 8 chars
JWT_EXPIRES_IN_DAY=
```

Config is validated at startup with Zod in `src/configs/`.