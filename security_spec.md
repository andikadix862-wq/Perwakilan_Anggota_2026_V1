# Security Specification for Firestore Security Rules

## Data Invariants
1. `members`: Read access for authenticated members (own doc) or admins/election monitors. Write operations restricted to admins. Updating `status_memilih` is allowed when placing a valid vote.
2. `divisions`: Read access for all authenticated users. Writes restricted to admins.
3. `candidates`: Read access for all authenticated users. Writes restricted to admins.
4. `votes`: Write allowed when user casts a vote matching their active member record, during active voting window, and hasn't voted yet. Read allowed for admins or voter for verification.
5. `admins`: Read & write restricted strictly to authenticated admins.
6. `config`: Read access for all users. Writes restricted to super admins.
7. `auditLogs`: Read & create allowed for authenticated operational activities and admins.
8. `tieBreaks`: Read access for authenticated users. Writes restricted to super admins.

## The Dirty Dozen Payloads
1. Attempting to update `status_memilih` without casting a vote.
2. Attempting to insert a vote for a candidate in a different division than member's division.
3. Attempting to insert multiple votes when `status_memilih` is already 'SUDAH_MEMILIH'.
4. Attempting to write to `config` as a regular member.
5. Attempting to create a user in `admins` as an unauthenticated or non-admin user.
6. Attempting to tamper with vote `timestamp` or `transaction_id`.
7. Attempting to modify `candidates` as a regular voter.
8. Attempting to delete `auditLogs`.
9. Attempting to modify `divisions` manually as a voter.
10. Injecting oversized string (> 128 chars) into `vote_id`.
11. Injecting spoofed `voter_email` into `votes`.
12. Attempting to change `hak_pilih` or `hak_dipilih` of a member document as a non-admin.
