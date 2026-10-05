# Fix: Edit Division Manual Quota Not Saving

## Problem
When admin edits a division (e.g., PLAN 4 / BAG-04) and selects "Penyesuaian Manual (Pengecualian Aturan)" to set a custom seat quota, clicking "SIMPAN PERUBAHAN" does not save the changes. After browser reload or cold start, the quota resets.

## Root Causes

### 1. Wrong API Method Call
- **Frontend** (`AdminDivisions.tsx`) called `api.saveDivision()` 
- **Backend API** (`api.ts`) only has `api.upsertDivision()`
- **Result**: Function doesn't exist, request fails silently

### 2. Missing Supabase Persistence
- `upsertDivision()` in `db.ts` only updates in-memory `db.divisions`
- Calls `saveDatabaseToFile()` which saves to `system_state` JSON blob
- **Does NOT persist to relational `divisions` table** in Supabase
- On cold start, `relational-init.ts` loads from `divisions` table (empty/stale)
- Manual quota values are lost

### 3. Sync Division Stats Overwrites Manual Value
- `syncDivisionStats()` recalculates all quotas using 10:1 ratio
- This overwrites `manual_kuota` with auto-calculated value
- **Fix needed**: Preserve manual quota when syncing

## Fixes Applied

### Fix 1: Correct API Method (AdminDivisions.tsx)
```typescript
// BEFORE (wrong):
const res = await api.saveDivision(payload, adminEmail);

// AFTER (correct):
const res = await api.upsertDivision(payload, adminEmail);
```

### Fix 2: Async Division Upsert with Supabase Persistence (db.ts)
```typescript
// Made upsertDivision async
export async function upsertDivision(...) {
  // ... existing logic ...
  
  // Added Supabase persistence
  await sb.from('divisions').upsert({
    bagian_id: cleanId,
    nama_bagian: cleanNama,
    manual_kuota: manualKuotaVal,
    alasan_manual_kuota: data.alasan_manual_kuota || '',
    // ... other fields ...
  }, { onConflict: 'bagian_id' });
}
```

### Fix 3: Async Server Endpoints (server.ts)
```typescript
// Changed from sync to async
app.post('/api/admin/divisions', async (req, res) => {
  const result = await upsertDivision(...);
  res.json(result);
});
```

## Test Results

| Test | Before Fix | After Fix |
|------|------------|-----------|
| Update manual quota | ❌ Failed silently | ✅ Success |
| Verify after 10s | ❌ Reset to auto | ✅ Persists |
| Verify after 60s cold start | ❌ Reset to auto | ✅ PERSIST |
| Supabase direct check | ❌ null | ✅ Saved |

## How to Use (After Fix)

1. **Login as admin** → Menu "Data Bagian"
2. **Click edit** on division (e.g., BAG-04)
3. **Select radio**: "Penyesuaian Manual (Pengecualian Aturan)"
4. **Fill fields**:
   - Jumlah Kuota Kursi Manual: `5` (example)
   - Alasan Pengecualian Aturan: `Kesepakatan pengurus koperasi`
5. **Click "SIMPAN PERUBAHAN"**
6. **Verify**: Quota persists after browser reload ✅

## Default Production State
- All divisions use **auto-calculate 10:1 ratio** (manual_kuota = null)
- Only use manual override when there's special agreement/exception

## Deployment Status
- Commit: 02371d7
- Status: ✅ DEPLOYED & VERIFIED
- URL: https://perwakilan-anggota-2026.vercel.app
