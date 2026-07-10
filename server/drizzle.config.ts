import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/infra/db/schema.ts",
  out: "./src/infra/db/migrations",
  dbCredentials: {
    url: process.env.DB_PATH ?? "./data/app.db",
  },
});
