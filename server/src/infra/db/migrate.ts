import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./client.js";

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "migrations");

migrate(db, { migrationsFolder });
console.log("Migrations applied.");
