import { defineConfig } from "drizzle-kit";

// Drizzle Kit config (migration generation). `bun run db:generate` diffs
// apps/server/src/schema.ts and writes SQL migrations to apps/server/drizzle,
// which the server applies on startup (see apps/server/src/db.ts).
export default defineConfig({
  dialect: "postgresql",
  schema: "./apps/server/src/schema.ts",
  out: "./apps/server/drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/applem",
  },
});
