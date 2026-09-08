-- Migration SQL for votes table
CREATE TABLE IF NOT EXISTS votes (
  id SERIAL PRIMARY KEY,
  vote_id TEXT UNIQUE NOT NULL,
  member_email TEXT NOT NULL,
  candidate_ids TEXT[] NOT NULL,
  division_id TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT DEFAULT 'VALID',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_email)
);
