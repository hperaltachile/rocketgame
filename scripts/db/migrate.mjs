// Creates the leaderboard tables (scripts/db/schema.sql). Safe to run again.
//   node scripts/db/migrate.mjs                  # by hand: fails loudly
//   node scripts/db/migrate.mjs --if-configured  # in `npm run build`
// Reads DATABASE_URL_UNPOOLED (direct connection, preferred) or DATABASE_URL
// from the environment or .env.local.
//
// `npm run build` runs it with --if-configured, so every Vercel deployment
// brings its database up to date (Vercel's Neon variables are "sensitive" and
// can't be pulled to a laptop, but builds can read them). Without a database
// it skips; if the database can't be reached it warns and lets the build go on,
// so a database hiccup never blocks a deploy (the boards just stay hidden).
import { readFileSync } from "node:fs";
import pg from "pg";

const optional = process.argv.includes("--if-configured");

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: use the environment as is.
}

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  if (optional) {
    console.log("Leaderboard tables: no DATABASE_URL, skipped.");
    process.exit(0);
  }
  console.error("Set DATABASE_URL (or DATABASE_URL_UNPOOLED).");
  process.exit(1);
}

const sql = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const client = new pg.Client({
  connectionString: url,
  connectionTimeoutMillis: 15_000,
});
try {
  await client.connect();
  await client.query(sql);
  console.log("Leaderboard tables are ready.");
} catch (error) {
  if (!optional) throw error;
  console.warn(
    `WARNING: leaderboard tables not updated (${error.message}). Boards stay hidden until a build can reach the database.`,
  );
} finally {
  await client.end().catch(() => {});
}
