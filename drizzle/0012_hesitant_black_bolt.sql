CREATE TYPE "public"."content_draft_asset_type" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TYPE "public"."content_draft_status" AS ENUM('pending', 'approved', 'rejected', 'revised', 'published');--> statement-breakpoint
CREATE TABLE "content_draft" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"theme" varchar(500) NOT NULL,
	"mood" varchar(255) NOT NULL,
	"visual_concept" text NOT NULL,
	"caption" text NOT NULL,
	"hashtags" jsonb DEFAULT '[]'::jsonb,
	"scheduled_at" bigint,
	"status" "content_draft_status" DEFAULT 'pending' NOT NULL,
	"asset_url" varchar(1000),
	"asset_type" "content_draft_asset_type",
	"revision_notes" text,
	"ig_post_id" varchar(255),
	"published_at" bigint,
	"active" boolean DEFAULT true NOT NULL,
	"created_date" bigint NOT NULL,
	"created_by" varchar(256) NOT NULL,
	"updated_date" bigint,
	"updated_by" varchar(256),
	"deleted_date" bigint,
	"deleted_by" varchar(256)
);
--> statement-breakpoint
ALTER TABLE "content_draft" ADD CONSTRAINT "content_draft_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;