# Fix: Config Persistence - Date Changes Not Saving

## Problem
When admin changes voting dates in the UI and clicks "SIMPAN SEMUA KONFIGURASI", the changes are not saved to Supabase. After closing browser or cold start, dates reset to previous values.

## Root Cause
`updateConfig()` in `server/db.ts` was calling Supabase upsert without `await`, causing:
- Promise fire-and-forget pattern
- Response returned before database write completed
- Race condition with Vercel's serverless cold starts

## Fix Applied
Changed `updateConfig` from sync to async, added proper `await Promise.all()` for all config keys.

### Files Changed
- `server/db.ts` - Made `updateConfig` async with proper await
- `server.ts` - Made `/api/admin/config` PUT handler async

## Deployment
- Commit: d89c42b
- Status: ✅ Deployed & Verified

## Test Results
```
Before fix: voting_start resets after cold start ❌
After fix:  voting_start persists (29/09 → 01/10) ✅
```

## How to Use
1. Login as admin (andikadix862@gmail.com)
2. Go to Pengaturan → Parameter Aturan Bisnis
3. Change dates as needed
4. Click "SIMPAN SEMUA KONFIGURASI"
5. Close browser and reopen - dates should persist ✅

## Default Production Config
- Start: 01/10/2026 00:00 WIB
- End: 31/10/2026 23:59 WIB
