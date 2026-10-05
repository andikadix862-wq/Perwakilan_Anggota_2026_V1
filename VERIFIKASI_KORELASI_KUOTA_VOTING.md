# Verifikasi Korelasi Kuota vs Voting

## Aturan yang Berlaku

1. **1 Anggota = 1 Suara = 1 Kandidat** (hardcoded di server.ts line 404)
2. **Rasio 10:1** untuk menghitung **KUOTA** (jumlah kursi perwakilan), bukan untuk voting
3. **BAG-13 (PLAN 4)** = Penyesuaian Manual = 1 kursi (kecualian aturan)

## Data Korelasi (Setelah Edit Manual BAG-13)

| Division | Anggota | Kuota | Kandidat | Status |
|----------|---------|-------|----------|--------|
| BAG-01 | 63 | 6 | 63 | ✅ OK |
| BAG-02 | 18 | 2 | 18 | ✅ OK |
| BAG-03 | 9 | 1 | 9 | ✅ OK |
| BAG-04 | 7 | 1 | 7 | ✅ OK |
| BAG-05 | 39 | 4 | 39 | ✅ OK |
| BAG-06 | 24 | 2 | 24 | ✅ OK |
| BAG-07 | 33 | 3 | 33 | ✅ OK |
| BAG-08 | 35 | 3 | 35 | ✅ OK |
| BAG-09 | 27 | 3 | 27 | ✅ OK |
| BAG-10 | 30 | 3 | 30 | ✅ OK |
| BAG-11 | 81 | 8 | 81 | ✅ OK |
| BAG-12 | 10 | 1 | 10 | ✅ OK |
| **BAG-13** | **5** | **1** | **5** | ✅ **MANUAL OVERRIDE** |
| BAG-14 | 24 | 2 | 24 | ✅ OK |
| BAG-15 | 26 | 3 | 26 | ✅ OK |
| BAG-16 | 9 | 1 | 9 | ✅ OK |
| **TOTAL** | **440** | **44** | **440** | |

## Penjelasan

### Quota Calculation (10:1 Rasio)
```typescript
// quotaService.ts
export function calculateQuota(memberCount: number, ratio: number = 10): number {
  const raw = memberCount / ratio;
  const intPart = Math.floor(raw);
  const remainder = Math.round((raw - intPart) * 10) / 10;
  
  if (remainder >= 0.6) return intPart + 1;  // Bulat ke atas
  return intPart;  // Bulat ke bawah
}
```

**Contoh:**
- 5 anggota → 5/10 = 0.5 → 0.5 dibulatkan ke bawah → **0** (tapi minimal 1 jika ada anggota)
- 6 anggota → 6/10 = 0.6 → 0.6 dibulatkan ke atas → **1**
- 10 anggota → 10/10 = 1.0 → **1**
- 16 anggota → 16/10 = 1.6 → 1.6 dibulatkan ke atas → **2**

### BAG-13 (PLAN 4) - Manual Override
- **Anggota:** 5
- **Auto quota:** 0 (karena 5/10 = 0.5 < 0.6)
- **Manual quota:** 1 (keputusan pengurus)
- **Status:** ✅ Pengecualian aturan berhasil diterapkan

### Voting Behavior
- Setiap anggota hanya bisa memilih **1 kandidat** dari bagiannya
- Tidak bisa memilih lebih dari 1 meski bagiannya punya banyak kursi
- Kursi digunakan untuk menentukan **berapa banyak perwakilan** yang terpilih, bukan berapa banyak yang bisa dipilih

## API Endpoints

| Endpoint | Fungsi |
|----------|--------|
| `/api/admin/divisions` | Get/Edit divisi & kuota |
| `/api/voter/dashboard` | Info kuota & max_pilihan (hardcode 1) |
| `/api/voter/candidates` | List kandidat per divisi |
| `/api/voter/submit-vote` | Submit 1 suara per anggota |

## Status Deployment
- URL: https://perwakilan-anggota-2026.vercel.app
- Commit terakhir: 1cb4a41 (fix modal button)
- Status: ✅ LIVE
