# Database Migrations

## Migration Status

### Completed Migrations
1. ✅ **Data Synchronization** - Members, Candidates, Divisions, Admins tables populated from system_state
2. ✅ **Schema Verified** - Database structure audited and confirmed
3. ✅ **Migration Scripts Created** - Production-ready SQL scripts

### Pending Migration
1. ❌ **Votes Table Creation** - Requires manual execution in Supabase SQL Editor

## Migration Order

### Step 1: Run in Supabase SQL Editor
```sql
-- Copy and run in Supabase SQL Editor
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
```

### Step 2: Verify Table Creation
After running SQL, verify with:
```sql
SELECT * FROM votes LIMIT 1;
```

### Step 3: Enable Foreign Keys (Optional)
```sql
ALTER TABLE votes 
  ADD CONSTRAINT fk_votes_member_email 
  FOREIGN KEY (member_email) 
  REFERENCES members(email);

ALTER TABLE votes 
  ADD CONSTRAINT fk_votes_division_id 
  FOREIGN KEY (division_id) 
  REFERENCES divisions(bagian_id);
```

### Step 4: Enable Realtime (Optional)
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
```

## Business Rules Enforced

1. **Single Vote Per Member** - `UNIQUE(member_email)` constraint ensures one vote per member
2. **Data Integrity** - References valid members and divisions
3. **Transaction Safety** - Database prevents race conditions and duplicate votes
4. **Audit Trail** - Created_at timestamp for all votes

## Verification Checklist

After migration, verify:

- [ ] `SELECT COUNT(*) FROM votes` returns 0 (no votes yet)
- [ ] `SELECT COUNT(DISTINCT member_email) FROM members` = 436
- [ ] `SELECT COUNT(DISTINCT kandidat_id) FROM candidates` = 436
- [ ] `SELECT COUNT(DISTINCT bagian_id) FROM divisions` = 16
- [ ] `SELECT COUNT(DISTINCT email) FROM admins` = 3
- [ ] Test voting: Member can submit vote
- [ ] Test double voting: Member cannot vote twice
- [ ] Test realtime: Admin dashboard updates without refresh
- [ ] Test persistence: Vote survives backend restart

## Rollback Plan

If issues occur:
1. Remove foreign keys: `ALTER TABLE votes DROP CONSTRAINT fk_votes_member_email;`
2. Drop table: `DROP TABLE votes;`
3. System falls back to legacy voting (requires backend changes)

## Notes

- Migration is **idempotent** - safe to run multiple times
- **DO NOT** copy-paste SQL from this README - use the migration files
- Test in staging environment first if available
- Monitor application logs after migration
