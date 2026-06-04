// One-shot visitor-log housekeeping for a scheduled run. Calls the SAME cleanup
// the HTTP route uses (dedupe + prune stale visitors), then exits — so it can be
// the start command of a Railway cron service. Needs DATABASE_URL.
//
//   bun run cron:cleanup        # or: bun run scripts/cron-cleanup.ts
import { cleanupWidgetVisitors, dbEnabled } from "../apps/server/src/db";

if (!dbEnabled()) {
  console.error("DATABASE_URL is not set — nothing to clean up.");
  process.exit(1);
}

const { duplicatesRemoved, stalePruned } = await cleanupWidgetVisitors();
console.log(`✓ visitor-log cleanup done — duplicatesRemoved=${duplicatesRemoved} stalePruned=${stalePruned}`);
process.exit(0);
