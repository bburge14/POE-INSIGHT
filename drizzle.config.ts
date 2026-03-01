import { defineConfig } from "drizzle-kit";

// Database is optional — app runs with in-memory storage by default.
// Only needed if you want persistent Postgres storage.
export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
});
