-- SQL Migration for Votes Table
-- Run this in Supabase SQL Editor

-- Step 1: Create votes table
CREATE TABLE IF NOT EXISTS votes (
  vote_id TEXT UNIQUE NOT NULL,
  member_email TEXT NOT NULL,
  candidate_ids TEXT[] NOT NULL,
  division_id TEXT NOT NULL,
  user_agent TEXT,
  status TEXT DEFAULT 'VALID',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_email)
);

-- Step 2: Add comment
COMMENT ON TABLE votes IS 'Stores voting records for election system';

-- Step 3: Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_votes_member_email ON votes(member_email);
CREATE INDEX IF NOT EXISTS idx_votes_division_id ON votes(division_id);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes(created_at DESC);

-- Step 4: Enable Realtime (optional)
-- ALTER PUBLICATION supabase_realtime ADD TABLE votes;
