-- FINAL VOTES TABLE MIGRATION
-- Idempotent: safe to run multiple times
-- PostgreSQL/Supabase compatible

-- ============================================
-- STEP 1: CREATE TABLE IF NOT EXISTS
-- ============================================
CREATE TABLE IF NOT EXISTS votes (
  vote_id      TEXT PRIMARY KEY,
  member_email TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  division_id  TEXT NOT NULL,
  user_agent   TEXT,
  status       TEXT DEFAULT 'VALID',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  
  -- Business rule: 1 member = 1 vote
  CONSTRAINT votes_one_member_one_vote UNIQUE (member_email)
);

-- ============================================
-- STEP 2: CREATE INDEXES IF NOT EXISTS
-- ============================================
CREATE INDEX IF NOT EXISTS idx_votes_member_email ON votes(member_email);
CREATE INDEX IF NOT EXISTS idx_votes_candidate_id ON votes(candidate_id);
CREATE INDEX IF NOT EXISTS idx_votes_division_id ON votes(division_id);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes(created_at DESC);

-- ============================================
-- STEP 3: ADD FOREIGN KEYS (only if not exists)
-- ============================================
-- Check and add FK: votes.member_email → members.email
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_votes_member_email'
    AND table_name = 'votes'
  ) THEN
    ALTER TABLE votes
    ADD CONSTRAINT fk_votes_member_email
    FOREIGN KEY (member_email) REFERENCES members(email);
  END IF;
END $$;

-- Check and add FK: votes.candidate_id → candidates.kandidat_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_votes_candidate_id'
    AND table_name = 'votes'
  ) THEN
    ALTER TABLE votes
    ADD CONSTRAINT fk_votes_candidate_id
    FOREIGN KEY (candidate_id) REFERENCES candidates(kandidat_id);
  END IF;
END $$;

-- Check and add FK: votes.division_id → divisions.bagian_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_votes_division_id'
    AND table_name = 'votes'
  ) THEN
    ALTER TABLE votes
    ADD CONSTRAINT fk_votes_division_id
    FOREIGN KEY (division_id) REFERENCES divisions(bagian_id);
  END IF;
END $$;

-- ============================================
-- STEP 4: ENABLE SUPABASE REALTIME (idempotent)
-- ============================================
-- Add table to realtime publication if not already present
DO $$
BEGIN
  -- Check if table is already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE votes;
  END IF;
END $$;

-- ============================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================
-- Verify table structure
-- \d votes

-- Verify constraints
-- SELECT conname, contype FROM pg_constraint WHERE conrelid = 'votes'::regclass;

-- Verify foreign keys
-- SELECT conname, confrelid::regclass FROM pg_constraint WHERE conrelid = 'votes'::regclass AND contype = 'f';

-- Verify realtime
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'votes';