CREATE TABLE `leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT 'Cafe' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`whatsapp` text DEFAULT '' NOT NULL,
	`website` text DEFAULT '' NOT NULL,
	`instagram` text DEFAULT '' NOT NULL,
	`source_url` text DEFAULT '' NOT NULL,
	`source_id` text DEFAULT '' NOT NULL,
	`rating` real,
	`has_site` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`last_contacted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_leads_source_id` ON `leads` (`source_id`) WHERE `source_id` != '';
--> statement-breakpoint
CREATE INDEX `idx_leads_status_city` ON `leads` (`status`,`city`);
--> statement-breakpoint
CREATE INDEX `idx_leads_phone` ON `leads` (`phone`) WHERE `phone` != '';
