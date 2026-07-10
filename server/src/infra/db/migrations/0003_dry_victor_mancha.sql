CREATE TABLE `build_presets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`base_version` text NOT NULL,
	`env` text NOT NULL,
	`overrides` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `build_presets_name_unique` ON `build_presets` (`name`);--> statement-breakpoint
CREATE TABLE `firmware_builds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`base_version` text NOT NULL,
	`env` text NOT NULL,
	`overrides` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`error_message` text,
	`binary_filename` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`completed_at` text
);
