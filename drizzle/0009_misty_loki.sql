CREATE TYPE "public"."entity_mode" AS ENUM('single', 'per_session');--> statement-breakpoint
ALTER TABLE "client" ADD COLUMN "entity_mode" "entity_mode" DEFAULT 'per_session' NOT NULL;