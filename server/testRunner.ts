import {
  getMemberByEmail,
  getCandidates,
  getConfig,
  updateConfig,
  resetMemberVotingStatus,
  getDatabase
} from './db';
import { calculateQuota, testQuotaCalculations } from './quotaService';
import { processVoteSubmission } from './votingService';
import { TestResultItem } from '../src/types';

export async function runAllSystemTests(): Promise<{
  passed_count: number;
  total_count: number;
  all_passed: boolean;
  results: TestResultItem[];
}> {
  const results: TestResultItem[] = [];

  // -------------------------------------------------------------
  // 1. KUOTA CALCULATION TESTS (PRD SECTION 5 & 39)
  // -------------------------------------------------------------
  const quotaCases = [
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

  quotaCases.forEach(tc => {
    const actual = calculateQuota(tc.count, 10);
    const passed = actual === tc.expected;
    results.push({
      id: `QUOTA-${tc.count}`,
      category: 'Quota',
      name: `Uji Kuota: ${tc.count} anggota`,
      description: `Rasio 10:1 dengan aturan 0.1-0.5 round down, 0.6-0.9 round up. ${tc.count} / 10 = ${(tc.count / 10).toFixed(1)}`,
      expected: `${tc.expected} kursi`,
      actual: `${actual} kursi`,
      passed,
      details: passed ? 'Sesuai spesifikasi PRD' : 'Gagal memenuhi aturan pembulatan PRD'
    });
  });

  // -------------------------------------------------------------
  // 2. AUTHENTICATION TESTS (PRD SECTION 9 & 39)
  // -------------------------------------------------------------
  // Test A: Valid Email
  const validMember = getMemberByEmail('andikadix862@gmail.com');
  results.push({
    id: 'AUTH-01',
    category: 'Authentication',
    name: 'Login Email Terdaftar',
    description: 'Pencocokan email anggota valid terhadap Master Data.',
    expected: 'Akses Diterima (Member ditemukan & hak pilih aktif)',
    actual: validMember ? `Diterima (${validMember.nama} - ${validMember.nama_bagian})` : 'Ditolak',
    passed: !!validMember && validMember.hak_pilih === true
  });

  // Test B: Unregistered Email
  const unregMember = getMemberByEmail('tidak.terdaftar.999@random.com');
  results.push({
    id: 'AUTH-02',
    category: 'Authentication',
    name: 'Login Email Tidak Terdaftar',
    description: 'Upaya login dengan email yang tidak tercatat di Master Data.',
    expected: 'Akses Ditolak (User not found)',
    actual: !unregMember ? 'Akses Ditolak (Tidak terdaftar)' : 'Diterima (Cacat Keamanan)',
    passed: !unregMember
  });

  // Test C: Member without voting rights
  const nonVoter = getMemberByEmail('magang@kopsyah-ykk.id');
  results.push({
    id: 'AUTH-03',
    category: 'Authentication',
    name: 'Login Anggota Tanpa Hak Pilih',
    description: 'Anggota terdaftar tetapi status hak_pilih = false.',
    expected: 'Akses Voting Ditolak (Tidak berhak memilih)',
    actual: nonVoter && !nonVoter.hak_pilih ? 'Hak Pilih Ditolak (Sesuai)' : 'Diterima',
    passed: !!nonVoter && nonVoter.hak_pilih === false
  });

  // -------------------------------------------------------------
  // 3. VOTING VALIDATION & SECURITY TESTS (PRD SECTION 14 & 39)
  // -------------------------------------------------------------
  // Setup isolated test members
  const testVoterEmail1 = 'produksi.45@kopsyah-ykk.id'; // Produksi (BAG-01)
  const testVoterEmail2 = 'engineering.15@kopsyah-ykk.id'; // Engineering (BAG-02)

  resetMemberVotingStatus(testVoterEmail1, 'test-runner', 'Persiapan Unit Test');
  resetMemberVotingStatus(testVoterEmail2, 'test-runner', 'Persiapan Unit Test');

  // Test 3.1: Valid vote inside own division
  const produksiCandidates = getCandidates('BAG-01').filter(c => c.status_kandidat === 'AKTIF');
  const validVoteRes = await processVoteSubmission({
    email: testVoterEmail1,
    candidate_ids: [produksiCandidates[0].kandidat_id],
    ip_or_ua: 'Unit-Test-Runner'
  });

  results.push({
    id: 'VOTE-01',
    category: 'Voting',
    name: 'Voting Sah Divisi Sendiri',
    description: 'Anggota Produksi memilih kandidat dari Bagian Produksi dalam kuota yang sah.',
    expected: 'Voting Berhasil (Suara tersimpan, tx id di-generate)',
    actual: validVoteRes.success ? `Berhasil (${validVoteRes.transaction_id})` : `Gagal: ${validVoteRes.message}`,
    passed: validVoteRes.success
  });

  // Test 3.2: Double Voting Prevention (PRD Section 4.1 & 14)
  const doubleVoteRes = await processVoteSubmission({
    email: testVoterEmail1,
    candidate_ids: [produksiCandidates[1].kandidat_id],
    ip_or_ua: 'Unit-Test-Runner'
  });

  results.push({
    id: 'SEC-01',
    category: 'Security',
    name: 'Pencegahan Double Voting',
    description: 'Anggota yang statusnya SUDAH_MEMILIH mencoba mengirim suara kedua kali.',
    expected: 'Ditolak: Anda sudah pernah menggunakan hak suara Anda.',
    actual: !doubleVoteRes.success ? `Ditolak (${doubleVoteRes.message})` : 'Diterima (Cacat Keamanan Kritis)',
    passed: !doubleVoteRes.success
  });

  // Test 3.3: Cross-Division Candidate Selection Prevention (PRD Section 4.2)
  const crossDivRes = await processVoteSubmission({
    email: testVoterEmail2, // Engineering
    candidate_ids: [produksiCandidates[0].kandidat_id], // Candidate from Produksi!
    ip_or_ua: 'Unit-Test-Runner'
  });

  results.push({
    id: 'SEC-02',
    category: 'Security',
    name: 'Pencegahan Pilihan Lintas Bagian',
    description: 'Pemilih Bagian Engineering mencoba memilih kandidat dari Bagian Produksi.',
    expected: 'Ditolak di Server: Anda hanya boleh memilih kandidat dari bagian Anda sendiri.',
    actual: !crossDivRes.success ? `Ditolak (${crossDivRes.message})` : 'Diterima (Cacat Keamanan)',
    passed: !crossDivRes.success
  });

  // Test 3.4: Rejection of Multiple Candidates Selection (1 Anggota = 1 Suara = 1 Kandidat)
  const engCandidates = getCandidates('BAG-02').filter(c => c.status_kandidat === 'AKTIF');
  const multipleCandRes = await processVoteSubmission({
    email: testVoterEmail2,
    candidate_ids: [engCandidates[0].kandidat_id, engCandidates[1].kandidat_id],
    ip_or_ua: 'Unit-Test-Runner'
  });

  results.push({
    id: 'VOTE-02',
    category: 'Voting',
    name: 'Aturan Mutlak 1 Anggota = 1 Kandidat',
    description: 'Pemilih mencoba memilih lebih dari 1 kandidat (2 calon).',
    expected: 'Ditolak: Setiap anggota hanya memiliki 1 hak suara dan wajib memilih tepat 1 kandidat.',
    actual: !multipleCandRes.success ? `Ditolak (${multipleCandRes.message})` : 'Diterima (Cacat Aturan Voting)',
    passed: !multipleCandRes.success
  });

  // Test 3.5: Empty Candidate Selection Prevention
  const emptyCandRes = await processVoteSubmission({
    email: testVoterEmail2,
    candidate_ids: [],
    ip_or_ua: 'Unit-Test-Runner'
  });

  results.push({
    id: 'VOTE-03',
    category: 'Voting',
    name: 'Pencegahan Voting Tanpa Pilihan Kandidat',
    description: 'Pemilih mengirim lembar suara kosong tanpa memilih kandidat.',
    expected: 'Ditolak: Wajib memilih tepat 1 kandidat.',
    actual: !emptyCandRes.success ? `Ditolak (${emptyCandRes.message})` : 'Diterima (Cacat Validasi)',
    passed: !emptyCandRes.success
  });

  // Test 3.6: Voting Period Closed / Not Active
  const originalStatus = getConfig().voting_status;
  updateConfig({ voting_status: 'DITUTUP' }, 'test-runner');

  const closedVoteRes = await processVoteSubmission({
    email: testVoterEmail2,
    candidate_ids: [engCandidates[0].kandidat_id],
    ip_or_ua: 'Unit-Test-Runner'
  });

  results.push({
    id: 'VOTE-04',
    category: 'Voting',
    name: 'Pencegahan Voting saat Periode Ditutup',
    description: 'Pemilih mencoba voting saat status pemilihan bukan AKTIF (DITUTUP/DRAFT).',
    expected: 'Ditolak: Pemilihan saat ini sedang ditutup.',
    actual: !closedVoteRes.success ? `Ditolak (${closedVoteRes.message})` : 'Diterima (Cacat Status)',
    passed: !closedVoteRes.success
  });

  // Restore original election status
  updateConfig({ voting_status: originalStatus }, 'test-runner');

  // Reset test members status back
  resetMemberVotingStatus(testVoterEmail1, 'test-runner', 'Pembersihan pasca unit test');
  resetMemberVotingStatus(testVoterEmail2, 'test-runner', 'Pembersihan pasca unit test');

  const passed_count = results.filter(r => r.passed).length;
  const total_count = results.length;

  return {
    passed_count,
    total_count,
    all_passed: passed_count === total_count,
    results
  };
}
