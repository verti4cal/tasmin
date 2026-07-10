CREATE TABLE `device_telemetry_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`device_id` integer NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`recorded_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `telemetry_device_key_time_idx` ON `device_telemetry_log` (`device_id`,`key`,`recorded_at`);