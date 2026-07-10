ALTER TABLE `build_presets` ADD `build_flags` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `firmware_builds` ADD `build_flags` text DEFAULT '' NOT NULL;