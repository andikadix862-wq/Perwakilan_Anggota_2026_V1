-- Migration: Create votes table
-- Run this in Supabase SQL Editor or pgAdmin

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

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
ALTER PUBLICATION supabase_realtime ADD TABLE members;
ALTER PUBLICATION supabase_realtime ADD TABLE candidates;
ALTER PUBLICATION supabase_realtime ADD TABLE divisions;
