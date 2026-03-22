CREATE TYPE "public"."task_status" AS ENUM('pending', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."task_type" AS ENUM('task', 'reminder', 'notes', 'meeting', 'deadline');--> statement-breakpoint
CREATE TABLE "task" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"chat_id" bigint NOT NULL,
	"session_id" varchar(255),
	"type" "task_type" DEFAULT 'task' NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"remind_at" bigint,
	"reminded" boolean DEFAULT false NOT NULL,
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_date" bigint NOT NULL,
	"created_by" varchar(256) NOT NULL,
	"updated_date" bigint,
	"updated_by" varchar(256),
	"deleted_date" bigint,
	"deleted_by" varchar(256)
);
--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;