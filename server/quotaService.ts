/**
 * Quota Service - KOPSYAH YKK AP Indonesia
 * PRD Section 5: Rasio 10:1
 * Rumus: Jumlah Anggota / 10
 * Aturan pembulatan:
 * - 0,1 – 0,5 → dibulatkan ke bawah
 * - 0,6 – 0,9 → dibulatkan ke atas
 * 
 * Contoh:
 * 5 anggota -> 5 / 10 = 0.5 -> 0 kursi
 * 6 anggota -> 6 / 10 = 0.6 -> 1 kursi
 * 10 anggota -> 10 / 10 = 1.0 -> 1 kursi
 * 15 anggota -> 15 / 10 = 1.5 -> 1 kursi
 * 16 anggota -> 16 / 10 = 1.6 -> 2 kursi
 * 44 anggota -> 44 / 10 = 4.4 -> 4 kursi
 * 45 anggota -> 45 / 10 = 4.5 -> 4 kursi
 * 46 anggota -> 46 / 10 = 4.6 -> 5 kursi
 */

export function calculateQuota(memberCount: number, ratio: number = 10): number {
  if (!memberCount || memberCount <= 0 || ratio <= 0) return 0;
  
  const raw = memberCount / ratio;
  const intPart = Math.floor(raw);
  // Get decimal remainder with single decimal precision
  const remainder = Math.round((raw - intPart) * 10) / 10;
  
  if (remainder >= 0.6) {
    return intPart + 1;
  }
  return intPart;
}

export function testQuotaCalculations() {
  const testCases = [
    { count: 5, expected: 0 },
    { count: 6, expected: 1 },
    { count: 10, expected: 1 },
    { count: 15, expected: 1 },
    { count: 16, expected: 2 },
    { count: 44, expected: 4 },
    { count: 45, expected: 4 },
    { count: 46, expected: 5 },
    { count: 120, expected: 12 },
  ];

  return testCases.map(tc => {
    const actual = calculateQuota(tc.count, 10);
    return {
      count: tc.count,
      expected: tc.expected,
      actual,
      passed: actual === tc.expected
    };
  });
}
