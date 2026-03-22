CREATE TYPE "public"."client_type" AS ENUM('telegram', 'discord', 'whatsapp', 'http');--> statement-breakpoint
CREATE TABLE "client_credential" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" varchar(1000) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_date" bigint NOT NULL,
	"created_by" varchar(256) NOT NULL,
	"updated_date" bigint,
	"updated_by" varchar(256),
	"deleted_date" bigint,
	"deleted_by" varchar(256)
);
--> statement-breakpoint
CREATE TABLE "client" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "client_type" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_date" bigint NOT NULL,
	"created_by" varchar(256) NOT NULL,
	"updated_date" bigint,
	"updated_by" varchar(256),
	"deleted_date" bigint,
	"deleted_by" varchar(256)
);
--> statement-breakpoint
ALTER TABLE "client_credential" ADD CONSTRAINT "client_credential_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;