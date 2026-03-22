CREATE TABLE "account" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255),
	"name" varchar(255),
	"profile_picture" varchar(500),
	"active" boolean DEFAULT true NOT NULL,
	"created_date" bigint NOT NULL,
	"created_by" varchar(256) NOT NULL,
	"updated_date" bigint,
	"updated_by" varchar(256),
	"deleted_date" bigint,
	"deleted_by" varchar(256),
	CONSTRAINT "account_email_unique" UNIQUE("email")
);
