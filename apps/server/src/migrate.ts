import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { fileURLToPath } from "node:url";

// Apply pending migrations to whatever DATABASE_URL points at, using the SAME
// bun-sql migrator the server runs on startup (drizzle-kit's CLI can't connect
// via Bun's SQL driver). Run with `bun run db:migrate`.
//
// Against Railway prod: use the database's PUBLIC connection URL (the private
// *.railway.internal host only resolves inside Railway):
//   $env:DATABASE_URL="postgres://...public..."; bun run db:migrate

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Point it at the target database and re-run.");
  process.exit(1);
}

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));
const safe = url.replace(/\/\/[^@]*@/, "//***@"); // redact credentials in logs

console.log(`Applying migrations from ${migrationsFolder}`);
console.log(`Target: ${safe}`);

const db = drizzle(url);
await migrate(db, { migrationsFolder });

console.log("✓ Migrations applied");
process.exit(0);
