-- Migration Script for Relational Tables
-- Run this in Supabase SQL Editor

-- 1. Add missing columns to members table
ALTER TABLE members ADD COLUMN IF NOT EXISTS usia INTEGER;
ALTER TABLE members ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- 2. Add missing columns to candidates table
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS nik TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS tanggal_lahir DATE;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS tahun_menuju_pensiun INTEGER;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS usia INTEGER;

-- 3. Create votes table
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

-- 4. Add unique constraint to members.email (if not exists)
-- Note: This requires dropping and recreating the table or using a migration tool
-- For now, we'll use email as the conflict target in upserts

-- 5. Enable Realtime for important tables
ALTER PUBLICATION supabase_realtime ADD TABLE members;
ALTER PUBLICATION supabase_realtime ADD TABLE candidates;
ALTER PUBLICATION supabase_realtime ADD TABLE divisions;
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
