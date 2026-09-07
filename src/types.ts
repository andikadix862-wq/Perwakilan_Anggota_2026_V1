export type VotingStatus = 'DRAFT' | 'AKTIF' | 'SELESAI' | 'DITUTUP';
export type MemberStatus = 'AKTIF' | 'NONAKTIF' | 'NON_AKTIF' | 'PENSIUN';
export type VoteChoiceStatus = 'BELUM_MEMILIH' | 'SUDAH_MEMILIH';
export type CandidateStatus = 'AKTIF' | 'NONAKTIF';
export type AdminRole = 'SUPER_ADMIN' | 'ADMIN_PEMILIHAN' | 'ADMIN';
export type MaxVoteRule = 'SEJUMLAH_KURSI_BAGIAN' | 'TEPAT_SATU' | 'CUSTOM';

export interface Member {
  email: string;
  nik: string;
  nama: string;
  nomor_anggota: string;
  bagian_id: string;
  nama_bagian: string;
  status: MemberStatus;
  hak_pilih: boolean; // Hak Memilih (tetap aktif jika anggota berhak suara)
  hak_dipilih?: boolean; // Hak Dipilih (layak dicalonkan: true jika sisa masa pensiun >= 4 tahun / usia < 51 tahun)
  alasan_hak_dipilih?: string;
  status_memilih: VoteChoiceStatus;
  voted_at?: string | null;
  transaction_id?: string | null;
  tanggal_lahir?: string | null; // YYYY-MM-DD (opsional)
  tanggal_pensiun?: string | null; // YYYY-MM-DD (otomatis dihitung 55 thn dari tgl lahir atau manual)
  sisa_pensiun_tahun?: number | null; // Sisa masa pensiun dalam tahun
  sisa_pensiun_text?: string; // Teks presisi selisih sisa pensiun (misal "3 thn 11 bln lagi")
  is_pensiun_warning?: boolean; // True jika sisa masa pensiun < 4 tahun (usia 51 tahun ke atas)
  usia?: number | null; // Usia saat ini dalam tahun
  jabatan?: string;
  is_pengurus_bpk?: boolean; // True jika menjabat sebagai Pengurus atau BPK (Badan Pengawas Koperasi)
  is_pegawai?: boolean; // True jika Pegawai / Karyawan (tidak memiliki Hak Memilih & Dipilih)
  tipe_pengurus_bpk?: 'PENGURUS' | 'BPK' | null;
  telepon?: string;
  created_at?: string;
}

export interface Division {
  bagian_id: string;
  nama_bagian: string;
  deskripsi?: string;
  total_anggota: number;
  kuota_perwakilan: number;
  manual_kuota?: number | null;
  alasan_manual_kuota?: string;
  sudah_memilih: number;
  belum_memilih: number;
  partisipasi_persen: number;
}

export interface Candidate {
  kandidat_id: string;
  nik: string;
  nomor_anggota: string;
  nama: string;
  bagian_id: string;
  nama_bagian: string;
  status_kandidat: CandidateStatus;
  memenuhi_syarat: boolean;
  alasan_syarat?: string;
  foto?: string;
  nomor_urut: number;
  visi_misi?: string;
  tanggal_lahir?: string | null;
  tanggal_pensiun?: string | null;
  tahun_menuju_pensiun?: number | null;
  sisa_pensiun_tahun?: number | null;
  sisa_pensiun_text?: string;
  is_pensiun_warning?: boolean;
  hak_dipilih?: boolean;
  usia?: number | null;
  jabatan?: string;
  is_pengurus_bpk?: boolean;
  tipe_pengurus_bpk?: 'PENGURUS' | 'BPK' | null;
  total_suara?: number;
  persentase_suara?: number;
  rank?: number;
  status_terpilih?: 'TERPILIH' | 'TIDAK_TERPILIH' | 'TIE';
}

export interface ElectionConfig {
  nama_sistem: string;
  periode_pemilihan: string;
  organisasi: string;
  ratio_anggota_perwakilan: number;
  batas_tahun_sebelum_pensiun: number;
  max_vote_per_member_rule: MaxVoteRule;
  custom_max_vote: number;
  voting_start: string; // ISO string
  voting_end: string; // ISO string
  voting_status: VotingStatus;
  deskripsi?: string;
  lokasi?: string;
}

export interface VoteRecord {
  vote_id: string;
  election_id: string;
  candidate_id: string;
  bagian_id: string;
  timestamp: string;
  transaction_id: string;
  status: 'VALID' | 'INVALID';
  voter_email?: string;
  voter_nik?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  nama: string;
  role: AdminRole;
  password?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user_email: string;
  user_role?: string;
  role?: string;
  activity?: string;
  event_type?: string;
  details: any;
  ip_or_ua?: string;
  ip_address?: string;
  status: 'sukses' | 'gagal' | 'SUCCESS' | 'FAILED' | 'WARNING';
}

export interface TieBreakDecision {
  id: string;
  bagian_id: string;
  election_id?: string;
  candidate_ids: string[];
  winner_ids: string[];
  catatan_keputusan: string;
  resolved_by: string;
  timestamp?: string;
}

export interface AuthSession {
  type: 'member' | 'admin';
  user: Member | AdminUser;
  token: string;
}

export interface DivisionResult {
  bagian_id: string;
  nama_bagian: string;
  total_anggota: number;
  kuota_kursi: number;
  total_suara_masuk: number;
  partisipasi_persen: number;
  has_tie?: boolean;
  has_tie_break?: boolean;
  tie_candidates?: Candidate[];
  candidates: CandidateResult[];
}

export interface CandidateResult {
  kandidat_id: string;
  nomor_urut: number;
  nama: string;
  nomor_anggota: string;
  bagian_id: string;
  nama_bagian: string;
  foto?: string;
  total_suara: number;
  persentase_suara?: number;
  rank: number;
  status_terpilih?: 'TERPILIH' | 'TIDAK_TERPILIH' | 'TIE' | 'TERPILIH_MANUAL';
  status_kursi?: 'TERPILIH' | 'TIDAK_TERPILIH' | 'TIE' | 'TERPILIH_MANUAL';
}

export interface DashboardStats {
  total_anggota: number;
  total_berhak_memilih: number;
  sudah_memilih: number;
  belum_memilih: number;
  partisipasi_persen: number;
  total_kandidat: number;
  total_bagian: number;
  total_kursi: number;
  voting_status: VotingStatus;
  divisions_summary: Division[];
}

export interface TestResultItem {
  id: string;
  category: 'Authentication' | 'Voting' | 'Quota' | 'Security';
  name: string;
  description: string;
  expected: string;
  actual: string;
  passed: boolean;
  details?: string;
}

export interface VotingReceiptData {
  transaction_id: string;
  voted_at: string;
  nama: string;
  nomor_anggota: string;
  nik: string;
  bagian_id: string;
  nama_bagian: string;
  status_memilih: string;
  organisasi: string;
  periode_pemilihan: string;
  nama_sistem: string;
  verification_code?: string;
  jabatan?: string;
}
