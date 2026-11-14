// Look after the leaderboards: list a board, or remove a fake score.
//   node scripts/db/admin.mjs list <slug>
//   node scripts/db/admin.mjs delete <slug> "<Name>"     (removes every row with that name)
// Reads DATABASE_URL from the environment or .env.local.
import pg from "pg";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: use the environment as is.
}

const [command, slug, name] = process.argv.slice(2);
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url || !slug || !["list", "delete"].includes(command)) {
  console.error(
    'Usage: node scripts/db/admin.mjs list <slug> | delete <slug> "<Name>"  (needs DATABASE_URL)',
  );
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  if (command === "list") {
    const { rows } = await client.query(
      `select name, score, updated_at, player_id from scores
       where game = $1 order by score desc, updated_at asc limit 50`,
      [slug],
    );
    console.table(rows);
    console.log(
      "(Sorted high to low; low-is-better games rank the other way.)",
    );
  } else {
    if (!name) throw new Error("Give the name to delete, in quotes.");
    const { rowCount } = await client.query(
      `delete from scores where game = $1 and name = $2`,
      [slug, name],
    );
    console.log(`Deleted ${rowCount} row(s).`);
  }
} finally {
  await client.end();
}
