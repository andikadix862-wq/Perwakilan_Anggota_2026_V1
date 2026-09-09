-- ============================================
-- FIX: CLEAN DATA THEN MIGRATE
-- ============================================

-- STEP 0: DELETE TEST/DUMMY DATA FROM votes
DELETE FROM votes WHERE member_email LIKE '%test%' OR member_email LIKE '%example.com' OR vote_id LIKE 'VOTE-%' OR vote_id LIKE 'TEST-%' OR vote_id LIKE 'VERIFY-%' OR vote_id LIKE 'UNIQUETEST-%' OR vote_id LIKE 'MIG-%' OR vote_id LIKE 'FINAL-%';

-- Verify deleted
SELECT 'DELETED TEST DATA' as status, COUNT(*) as rows_deleted FROM votes WHERE member_email LIKE '%test%' OR member_email LIKE '%example.com' OR vote_id LIKE 'VOTE-%' OR vote_id LIKE 'TEST-%' OR vote_id LIKE 'VERIFY-%' OR vote_id LIKE 'UNIQUETEST-%' OR vote_id LIKE 'MIG-%' OR vote_id LIKE 'FINAL-%';

-- STEP 1: Add unique constraint to members.email (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'members_email_key' 
    AND table_name = 'members'
  ) THEN
    ALTER TABLE members ADD CONSTRAINT members_email_key UNIQUE (email);
  END IF;
END $$;

-- STEP 2: CREATE TABLE votes (if not exists)
CREATE TABLE IF NOT EXISTS public.votes (
  vote_id      TEXT PRIMARY KEY,
  member_email TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  division_id  TEXT NOT NULL,
  user_agent   TEXT,
  status       TEXT NOT NULL DEFAULT 'VALID',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT votes_one_member_one_vote UNIQUE (member_email)
);

-- STEP 3: CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_votes_member_email ON public.votes(member_email);
CREATE INDEX IF NOT EXISTS idx_votes_candidate_id ON public.votes(candidate_id);
CREATE INDEX IF NOT EXISTS idx_votes_division_id ON public.votes(division_id);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON public.votes(created_at DESC);

-- STEP 4: ADD FOREIGN KEYS
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

-- STEP 5: ENABLE RLS
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- STEP 6: ADD TO REALTIME
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE votes;
  END IF;
END $$;

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 'MEMBERS EMAIL UNIQUE' as check_type, COUNT(*) as result
FROM information_schema.table_constraints 
WHERE table_schema = 'public' AND table_name = 'members' AND constraint_name = 'members_email_key';

SELECT 'TABLE EXISTS' as check_type, COUNT(*) as result
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'votes';

SELECT 'CONSTRAINTS' as check_type, constraint_name, constraint_type
FROM information_schema.table_constraints 
WHERE table_schema = 'public' AND table_name = 'votes';

SELECT 'INDEXES' as check_type, indexname
FROM pg_indexes 
WHERE tablename = 'votes';

SELECT 'RLS' as check_type, relrowsecurity
FROM pg_class 
WHERE relname = 'votes';

SELECT 'REALTIME' as check_type, 
  CASE WHEN COUNT(*) > 0 THEN 'ACTIVE' ELSE 'INACTIVE' END as status
FROM pg_publication_tables 
WHERE tablename = 'votes';

SELECT 'MIGRATION COMPLETED SUCCESSFULLY' as status;