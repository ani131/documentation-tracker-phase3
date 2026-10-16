CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`event` text NOT NULL,
	`status` text NOT NULL,
	`elapsed_ms` integer NOT NULL,
	`analysis_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `records` (
	`key` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`state` text NOT NULL
);
