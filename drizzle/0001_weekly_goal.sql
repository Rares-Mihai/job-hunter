CREATE TABLE "goals" (
	"user_id" text PRIMARY KEY NOT NULL,
	"weekly_target" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;