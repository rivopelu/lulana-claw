CREATE TABLE "app_connection" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"app_type" varchar(50) NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" bigint,
	"scopes" text,
	"email" varchar(255),
	"display_name" varchar(255),
	"active" boolean DEFAULT true NOT NULL,
	"created_date" bigint NOT NULL,
	"created_by" varchar(256) NOT NULL,
	"updated_date" bigint,
	"updated_by" varchar(256),
	"deleted_date" bigint,
	"deleted_by" varchar(256)
);
--> statement-breakpoint
ALTER TABLE "app_connection" ADD CONSTRAINT "app_connection_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;