-- RocketGame leaderboards. Safe to run more than once.
-- Run with: node scripts/db/migrate.mjs  (uses DATABASE_URL_UNPOOLED, else DATABASE_URL)

-- One row per player per game, holding that player's best score.
create table if not exists scores (
  game text not null,
  player_id uuid not null,      -- random id kept in the player's browser; not personal
  name text not null,           -- built from the name lists in lib/leaderboard/names.ts
  score integer not null,
  updated_at timestamptz not null default now(),
  primary key (game, player_id)
);

create index if not exists scores_game_score on scores (game, score, updated_at);

-- Recent saves, for rate limiting. Only a salted hash of the IP is kept, for a day.
create table if not exists submits (
  ip_hash text not null,
  at timestamptz not null default now()
);

create index if not exists submits_ip_at on submits (ip_hash, at);
