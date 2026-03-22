CREATE TYPE "public"."ai_provider" AS ENUM('openai');--> statement-breakpoint
CREATE TABLE "ai_model" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"model_id" varchar(100) NOT NULL,
	"provider" "ai_provider" DEFAULT 'openai' NOT NULL,
	"api_key" varchar(500) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_date" bigint NOT NULL,
	"created_by" varchar(256) NOT NULL,
	"updated_date" bigint,
	"updated_by" varchar(256),
	"deleted_date" bigint,
	"deleted_by" varchar(256)
);
--> statement-breakpoint
ALTER TABLE "client" ADD COLUMN "ai_model_id" varchar(255);--> statement-breakpoint
ALTER TABLE "ai_model" ADD CONSTRAINT "ai_model_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_ai_model_id_ai_model_id_fk" FOREIGN KEY ("ai_model_id") REFERENCES "public"."ai_model"("id") ON DELETE no action ON UPDATE no action;