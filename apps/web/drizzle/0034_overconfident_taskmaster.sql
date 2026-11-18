CREATE TABLE `quota_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`default_monthly_limit_nano_usd` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_quotas` (
	`user_id` text PRIMARY KEY NOT NULL,
	`mode` text DEFAULT 'inherit' NOT NULL,
	`monthly_limit_nano_usd` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
