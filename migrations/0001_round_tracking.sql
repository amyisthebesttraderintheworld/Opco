CREATE TABLE IF NOT EXISTS rounds (
  id TEXT PRIMARY KEY,
  contract_address TEXT NOT NULL,
  round_id INTEGER NOT NULL,
  stake_type TEXT NOT NULL DEFAULT 'free' CHECK (stake_type = 'free'),
  starts_at INTEGER NOT NULL,
  commit_ends_at INTEGER NOT NULL,
  reveal_ends_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'committing',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS rounds_status_idx ON rounds(status);
CREATE INDEX IF NOT EXISTS rounds_starts_at_idx ON rounds(starts_at);