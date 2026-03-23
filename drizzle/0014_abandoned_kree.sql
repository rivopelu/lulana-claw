CREATE TYPE "public"."media_asset_type" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TABLE "media_asset" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"filename" varchar(500) NOT NULL,
	"storage_path" varchar(1000) NOT NULL,
	"url" varchar(1000) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size" bigint NOT NULL,
	"asset_type" "media_asset_type" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_date" bigint NOT NULL,
	"created_by" varchar(256) NOT NULL,
	"updated_date" bigint,
	"updated_by" varchar(256),
	"deleted_date" bigint,
	"deleted_by" varchar(256)
);
--> statement-breakpoint
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;