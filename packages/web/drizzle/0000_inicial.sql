CREATE TABLE `activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`date` text NOT NULL,
	`time` text,
	`status` text DEFAULT 'Concluída' NOT NULL,
	`agency_id` integer,
	`manager_id` integer,
	`product_id` integer,
	`person_name` text,
	`broker_name` text,
	`participants` integer DEFAULT 1 NOT NULL,
	`channel` text,
	`notes` text,
	`next_action` text,
	`next_date` text,
	`origin` text DEFAULT 'acao' NOT NULL,
	`lead_days` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`manager_id`) REFERENCES `managers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `agencies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`manager_id` integer,
	`stage` text DEFAULT 'Captação' NOT NULL,
	`brokers` integer DEFAULT 0 NOT NULL,
	`city` text,
	`contact_name` text,
	`phone` text,
	`email` text,
	`creci` text,
	`notes` text,
	`focus` text,
	`standards` text,
	`focus_cities` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`manager_id`) REFERENCES `managers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `agency_exits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`agency_id` integer NOT NULL,
	`manager_id` integer,
	`requested_by` text NOT NULL,
	`reason` text,
	`note` text,
	`status` text DEFAULT 'pendente' NOT NULL,
	`decided_by` text,
	`decision_note` text,
	`to_manager_id` integer,
	`created_at` integer NOT NULL,
	`decided_at` integer,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`manager_id`) REFERENCES `managers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_manager_id`) REFERENCES `managers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `goal_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`month` text NOT NULL,
	`manager_id` integer,
	`metric` text NOT NULL,
	`old_target` integer,
	`new_target` integer NOT NULL,
	`changed_by` text NOT NULL,
	`changed_at` integer NOT NULL,
	FOREIGN KEY (`manager_id`) REFERENCES `managers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`manager_id` integer,
	`metric` text NOT NULL,
	`target` integer NOT NULL,
	`month` text,
	`updated_by` text,
	`updated_at` integer,
	FOREIGN KEY (`manager_id`) REFERENCES `managers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `managers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`color` text DEFAULT '#5FAE3A' NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client` text NOT NULL,
	`agency_id` integer,
	`broker_name` text,
	`product_id` integer,
	`manager_id` integer,
	`unit` text,
	`stage` text DEFAULT 'Em negociação' NOT NULL,
	`temperature` text DEFAULT 'Morno' NOT NULL,
	`value` real DEFAULT 0 NOT NULL,
	`table_value` real,
	`proposal_value` real,
	`contract_value` real,
	`discount` real DEFAULT 0 NOT NULL,
	`decline_reason` text,
	`decline_note` text,
	`date` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`manager_id`) REFERENCES `managers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`neighborhood` text,
	`status` text DEFAULT 'Em obras' NOT NULL,
	`delivery` text,
	`total_units` integer DEFAULT 0 NOT NULL,
	`sold_units` integer DEFAULT 0 NOT NULL,
	`avg_price` real DEFAULT 0 NOT NULL,
	`avg_area` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`role` text DEFAULT 'pendente' NOT NULL,
	`manager_id` integer,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`manager_id`) REFERENCES `managers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);