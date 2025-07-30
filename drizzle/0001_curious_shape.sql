CREATE TABLE `vault_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`encrypted_data` text NOT NULL,
	`iv` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `vault_items` (`user_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `password_salt` text NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `authentication_hash` text NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `kdf_iterations` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `created_at` text DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `users` ADD `updated_at` text DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE INDEX `username_idx` ON `users` (`username`);