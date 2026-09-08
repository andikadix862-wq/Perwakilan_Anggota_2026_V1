-- Production Votes Table Migration
-- SAFE: CREATE TABLE IF NOT EXISTS (idempotent)
-- Run in Supabase SQL Editor

-- Step 1: Create votes table
CREATE TABLE IF NOT EXISTS votes (
  vote_id TEXT PRIMARY KEY,
  member_email TEXT NOT NULL,
  candidate_ids TEXT[] NOT NULL,
  division_id TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT DEFAULT 'VALID',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_email)
);

-- Step 2: Add foreign key constraints (optional, improves data integrity)
-- Note: Enable after verifying foreign key relationships
-- ALTER TABLE votes 
--   ADD CONSTRAINT fk_votes_member_email 
--   FOREIGN KEY (member_email) 
--   REFERENCES members(email);

-- ALTER TABLE votes 
--   ADD CONSTRAINT fk_votes_division_id 
--   FOREIGN KEY (division_id) 
--   REFERENCES divisions(bagian_id);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_votes_member_email ON votes(member_email);
CREATE INDEX IF NOT EXISTS idx_votes_division_id ON votes(division_id);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_votes_status ON votes(status);

-- Step 4: Add comment
COMMENT ON TABLE votes IS 'Stores voting records for election system';
COMMENT ON COLUMN votes.vote_id IS 'Unique vote identifier';
COMMENT ON COLUMN votes.member_email IS 'Email of member who voted (references members.email)';
COMMENT ON COLUMN votes.candidate_ids IS 'Array of candidate IDs selected';
COMMENT ON COLUMN votes.division_id IS 'Division ID (references divisions.bagian_id)';
COMMENT ON COLUMN votes.status IS 'Vote status: VALID, INVALID, TEST';
COMMENT ON COLUMN votes.created_at IS 'Timestamp when vote was submitted';

-- Step 5: Enable Supabase Realtime (only if votes table exists and schema is verified)
-- ALTER PUBLICATION supabase_realtime ADD TABLE votes;
