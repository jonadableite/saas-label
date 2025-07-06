CREATE TYPE "public"."activity_status" AS ENUM('success', 'warning', 'error', 'info', 'debug');--> statement-breakpoint
CREATE TYPE "public"."activity_type" AS ENUM('campaign_created', 'campaign_started', 'campaign_completed', 'campaign_paused', 'campaign_cancelled', 'campaign_failed', 'instance_connected', 'instance_disconnected', 'instance_error', 'message_queued', 'message_sent', 'message_delivered', 'message_read', 'message_failed', 'contact_imported', 'contact_validated', 'template_created', 'template_updated', 'limit_reached', 'system_error', 'webhook_received', 'user_created', 'user_updated', 'instance_created', 'group_created', 'contact_created');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('pending', 'queued', 'processing', 'sent', 'delivered', 'read', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."template_type" AS ENUM('text', 'image', 'document', 'video', 'audio', 'sticker', 'location', 'contact', 'list', 'button');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin', 'superadmin');--> statement-breakpoint
CREATE TABLE "accounts_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"campaign_id" text,
	"instance_id" text,
	"contact_id" text,
	"template_id" text,
	"campaign_contact_id" text,
	"type" "activity_type" NOT NULL,
	"status" "activity_status" DEFAULT 'info' NOT NULL,
	"description" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_contacts_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"message_status" "message_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"read_at" timestamp,
	"failed_at" timestamp,
	"failure_reason" text,
	"retries" integer DEFAULT 0 NOT NULL,
	"external_message_id" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "campaign_contacts_unique" UNIQUE("campaign_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "campaigns_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"instance_id" text,
	"name" text NOT NULL,
	"description" text,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"template_id" text,
	"schedule_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"paused_at" timestamp,
	"cancelled_at" timestamp,
	"send_delay" integer DEFAULT 1000 NOT NULL,
	"max_retries_per_message" integer DEFAULT 3 NOT NULL,
	"enable_scheduling" boolean DEFAULT false NOT NULL,
	"send_only_business_hours" boolean DEFAULT false NOT NULL,
	"business_hours_start" text DEFAULT '09:00' NOT NULL,
	"business_hours_end" text DEFAULT '18:00' NOT NULL,
	"target_groups" text[] DEFAULT '{}' NOT NULL,
	"exclude_groups" text[] DEFAULT '{}' NOT NULL,
	"total_contacts" integer DEFAULT 0 NOT NULL,
	"messages_queued" integer DEFAULT 0 NOT NULL,
	"messages_sent" integer DEFAULT 0 NOT NULL,
	"messages_delivered" integer DEFAULT 0 NOT NULL,
	"messages_read" integer DEFAULT 0 NOT NULL,
	"messages_failed" integer DEFAULT 0 NOT NULL,
	"progress_percentage" integer DEFAULT 0 NOT NULL,
	"estimated_cost" integer DEFAULT 0 NOT NULL,
	"actual_cost" integer DEFAULT 0 NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"variables" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "contact_group_members_tables" (
	"contact_id" text NOT NULL,
	"group_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "contact_group_members_tables_contact_id_group_id_pk" PRIMARY KEY("contact_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "contact_groups_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#3b82f6' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_system_group" boolean DEFAULT false NOT NULL,
	"total_contacts" integer DEFAULT 0 NOT NULL,
	"active_contacts" integer DEFAULT 0 NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "contact_groups_user_name_unique" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "contact_imports_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"file_name" text NOT NULL,
	"original_file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_type" text NOT NULL,
	"status" "import_status" DEFAULT 'pending' NOT NULL,
	"total_records" integer DEFAULT 0 NOT NULL,
	"processed_records" integer DEFAULT 0 NOT NULL,
	"successful_records" integer DEFAULT 0 NOT NULL,
	"failed_records" integer DEFAULT 0 NOT NULL,
	"group_ids" text[] DEFAULT '{}' NOT NULL,
	"skip_duplicates" boolean DEFAULT true NOT NULL,
	"validate_numbers" boolean DEFAULT true NOT NULL,
	"field_mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"progress_percentage" integer DEFAULT 0 NOT NULL,
	"estimated_time_remaining" integer,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text,
	"first_name" text,
	"last_name" text,
	"phone_number" text NOT NULL,
	"email" text,
	"company" text,
	"position" text,
	"birth_date" timestamp,
	"notes" text,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"address" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"is_validated" boolean DEFAULT false NOT NULL,
	"validated_at" timestamp,
	"has_opted_out" boolean DEFAULT false NOT NULL,
	"opted_out_at" timestamp,
	"gdpr_consent" boolean DEFAULT false NOT NULL,
	"consent_date" timestamp,
	"total_messages_sent" integer DEFAULT 0 NOT NULL,
	"total_messages_received" integer DEFAULT 0 NOT NULL,
	"last_message_sent_at" timestamp,
	"last_message_received_at" timestamp,
	"source" text,
	"source_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "contacts_user_phone_unique" UNIQUE("user_id","phone_number")
);
--> statement-breakpoint
CREATE TABLE "instances_tables" (
	"instance_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"instance_name" text NOT NULL,
	"integration" text DEFAULT 'WHATSAPP-BAILEYS' NOT NULL,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"owner_jid" text,
	"profile_name" text,
	"profile_pic_url" text,
	"qrcode" boolean DEFAULT true NOT NULL,
	"phone_number" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"total_messages_sent" integer DEFAULT 0 NOT NULL,
	"daily_messages_sent" integer DEFAULT 0 NOT NULL,
	"monthly_messages_sent" integer DEFAULT 0 NOT NULL,
	"last_message_sent_at" timestamp,
	"last_reset_at" timestamp NOT NULL,
	"is_connected" boolean DEFAULT false NOT NULL,
	"last_connected_at" timestamp,
	"disconnected_at" timestamp,
	"webhook_url" text,
	"webhook_enabled" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sessions_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "sessions_tables_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "templates_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "template_type" DEFAULT 'text' NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"content" text NOT NULL,
	"media_url" text,
	"file_name" text,
	"buttons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"list_sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"variables" text[] DEFAULT '{}' NOT NULL,
	"required_variables" text[] DEFAULT '{}' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"search_keywords" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"plan" text DEFAULT 'FREE' NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"daily_message_limit" integer DEFAULT 1000 NOT NULL,
	"monthly_message_limit" integer DEFAULT 10000 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"total_campaigns" integer DEFAULT 0 NOT NULL,
	"total_contacts" integer DEFAULT 0 NOT NULL,
	"total_messages_sent" integer DEFAULT 0 NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_login_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "users_tables_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "accounts_tables" ADD CONSTRAINT "accounts_tables_user_id_users_tables_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities_tables" ADD CONSTRAINT "activities_tables_user_id_users_tables_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities_tables" ADD CONSTRAINT "activities_tables_campaign_id_campaigns_tables_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns_tables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities_tables" ADD CONSTRAINT "activities_tables_instance_id_instances_tables_instance_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."instances_tables"("instance_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities_tables" ADD CONSTRAINT "activities_tables_contact_id_contacts_tables_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts_tables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities_tables" ADD CONSTRAINT "activities_tables_template_id_templates_tables_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates_tables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities_tables" ADD CONSTRAINT "activities_tables_campaign_contact_id_campaign_contacts_tables_id_fk" FOREIGN KEY ("campaign_contact_id") REFERENCES "public"."campaign_contacts_tables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_contacts_tables" ADD CONSTRAINT "campaign_contacts_tables_campaign_id_campaigns_tables_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_contacts_tables" ADD CONSTRAINT "campaign_contacts_tables_contact_id_contacts_tables_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns_tables" ADD CONSTRAINT "campaigns_tables_user_id_users_tables_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns_tables" ADD CONSTRAINT "campaigns_tables_instance_id_instances_tables_instance_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."instances_tables"("instance_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns_tables" ADD CONSTRAINT "campaigns_tables_template_id_templates_tables_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates_tables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_group_members_tables" ADD CONSTRAINT "contact_group_members_tables_contact_id_contacts_tables_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_group_members_tables" ADD CONSTRAINT "contact_group_members_tables_group_id_contact_groups_tables_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."contact_groups_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_groups_tables" ADD CONSTRAINT "contact_groups_tables_user_id_users_tables_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_imports_tables" ADD CONSTRAINT "contact_imports_tables_user_id_users_tables_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts_tables" ADD CONSTRAINT "contacts_tables_user_id_users_tables_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instances_tables" ADD CONSTRAINT "instances_tables_user_id_users_tables_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions_tables" ADD CONSTRAINT "sessions_tables_user_id_users_tables_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates_tables" ADD CONSTRAINT "templates_tables_user_id_users_tables_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_user_id_idx" ON "activities_tables" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activities_type_idx" ON "activities_tables" USING btree ("type");--> statement-breakpoint
CREATE INDEX "activities_status_idx" ON "activities_tables" USING btree ("status");--> statement-breakpoint
CREATE INDEX "activities_created_at_idx" ON "activities_tables" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activities_campaign_id_idx" ON "activities_tables" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "activities_instance_id_idx" ON "activities_tables" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX "activities_contact_id_idx" ON "activities_tables" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "campaign_contacts_campaign_id_idx" ON "campaign_contacts_tables" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "campaign_contacts_contact_id_idx" ON "campaign_contacts_tables" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "campaign_contacts_message_status_idx" ON "campaign_contacts_tables" USING btree ("message_status");--> statement-breakpoint
CREATE INDEX "campaigns_user_id_idx" ON "campaigns_tables" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "campaigns_instance_id_idx" ON "campaigns_tables" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX "campaigns_status_idx" ON "campaigns_tables" USING btree ("status");--> statement-breakpoint
CREATE INDEX "campaigns_schedule_idx" ON "campaigns_tables" USING btree ("schedule_at");--> statement-breakpoint
CREATE INDEX "campaigns_created_at_idx" ON "campaigns_tables" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "campaigns_deleted_idx" ON "campaigns_tables" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "contact_group_members_contact_id_idx" ON "contact_group_members_tables" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "contact_group_members_group_id_idx" ON "contact_group_members_tables" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "contact_groups_user_id_idx" ON "contact_groups_tables" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "contact_groups_name_idx" ON "contact_groups_tables" USING btree ("name");--> statement-breakpoint
CREATE INDEX "contact_groups_default_idx" ON "contact_groups_tables" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX "contact_groups_deleted_idx" ON "contact_groups_tables" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "contact_imports_user_id_idx" ON "contact_imports_tables" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "contact_imports_status_idx" ON "contact_imports_tables" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contact_imports_created_at_idx" ON "contact_imports_tables" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "contacts_user_id_idx" ON "contacts_tables" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "contacts_phone_number_idx" ON "contacts_tables" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "contacts_email_idx" ON "contacts_tables" USING btree ("email");--> statement-breakpoint
CREATE INDEX "contacts_active_idx" ON "contacts_tables" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "contacts_opted_out_idx" ON "contacts_tables" USING btree ("has_opted_out");--> statement-breakpoint
CREATE INDEX "contacts_created_at_idx" ON "contacts_tables" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "contacts_deleted_idx" ON "contacts_tables" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "instances_user_id_idx" ON "instances_tables" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "instances_status_idx" ON "instances_tables" USING btree ("status");--> statement-breakpoint
CREATE INDEX "instances_active_idx" ON "instances_tables" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "instances_phone_idx" ON "instances_tables" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "instances_deleted_idx" ON "instances_tables" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "templates_user_id_idx" ON "templates_tables" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "templates_type_idx" ON "templates_tables" USING btree ("type");--> statement-breakpoint
CREATE INDEX "templates_created_at_idx" ON "templates_tables" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "templates_deleted_idx" ON "templates_tables" USING btree ("deleted_at");