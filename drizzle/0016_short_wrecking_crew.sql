CREATE TYPE "public"."budget_session_status" AS ENUM('active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."transaction_category" AS ENUM('food', 'transport', 'entertainment', 'shopping', 'health', 'other');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('expense', 'income');--> statement-breakpoint
CREATE TABLE "budget_session" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"chat_id" bigint NOT NULL,
	"session_id" varchar(255),
	"title" varchar(500) NOT NULL,
	"budget_amount" bigint NOT NULL,
	"currency" varchar(10) DEFAULT 'IDR' NOT NULL,
	"status" "budget_session_status" DEFAULT 'active' NOT NULL,
	"started_at" bigint NOT NULL,
	"ended_at" bigint,
	"active" boolean DEFAULT true NOT NULL,
	"created_date" bigint NOT NULL,
	"created_by" varchar(256) NOT NULL,
	"updated_date" bigint,
	"updated_by" varchar(256),
	"deleted_date" bigint,
	"deleted_by" varchar(256)
);
--> statement-breakpoint
CREATE TABLE "financial_transaction" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"chat_id" bigint NOT NULL,
	"budget_session_id" varchar(255),
	"description" varchar(500) NOT NULL,
	"amount" bigint NOT NULL,
	"category" "transaction_category" DEFAULT 'other' NOT NULL,
	"type" "transaction_type" DEFAULT 'expense' NOT NULL,
	"transaction_date" bigint NOT NULL,
	"note" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_date" bigint NOT NULL,
	"created_by" varchar(256) NOT NULL,
	"updated_date" bigint,
	"updated_by" varchar(256),
	"deleted_date" bigint,
	"deleted_by" varchar(256)
);
--> statement-breakpoint
ALTER TABLE "budget_session" ADD CONSTRAINT "budget_session_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_session" ADD CONSTRAINT "budget_session_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transaction" ADD CONSTRAINT "financial_transaction_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transaction" ADD CONSTRAINT "financial_transaction_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transaction" ADD CONSTRAINT "financial_transaction_budget_session_id_budget_session_id_fk" FOREIGN KEY ("budget_session_id") REFERENCES "public"."budget_session"("id") ON DELETE no action ON UPDATE no action;