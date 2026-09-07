import fs from 'fs';
import path from 'path';
import {
  Member,
  Division,
  Candidate,
  ElectionConfig,
  VoteRecord,
  AdminUser,
  AuditLog,
  TieBreakDecision,
  DashboardStats,
  DivisionResult,
  CandidateResult
} from '../src/types';
import { calculateQuota } from './quotaService';
import { loadDbFromFirestore, saveDbToFirestore } from './firestore-adapter';

const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const DB_FILE = path.join(DATA_DIR, 'election_store.json');

// Interface for persistent store
interface DatabaseState {
  config: ElectionConfig;
  divisions: Division[];
  members: Member[];
  candidates: Candidate[];
  votes: VoteRecord[];
  admins: AdminUser[];
  auditLogs: AuditLog[];
  tieBreaks: TieBreakDecision[];
}

let dbState: DatabaseState | null = null;
const votingLocks = new Set<string>(); // Set of member emails currently processing a vote to prevent race conditions

function generateInitialSeed(): DatabaseState {
  const divisionsInit = [
    { bagian_id: 'BAG-01', nama_bagian: 'Produksi', deskripsi: 'Divisi Manufaktur & Operasional Pabrik' },
    { bagian_id: 'BAG-02', nama_bagian: 'Engineering', deskripsi: 'Divisi Teknik, Mesin & Maintenance' },
    { bagian_id: 'BAG-03', nama_bagian: 'HR & GA', deskripsi: 'Divisi Human Resources & General Affairs' },
    { bagian_id: 'BAG-04', nama_bagian: 'Finance & Accounting', deskripsi: 'Divisi Keuangan & Pembukuan' },
    { bagian_id: 'BAG-05', nama_bagian: 'Logistik & Warehouse', deskripsi: 'Divisi Pergudangan & Distribusi' },
    { bagian_id: 'BAG-06', nama_bagian: 'Quality Control', deskripsi: 'Divisi Penjaminan & Pengawasan Mutu' },
  ];

  // Realistic Indonesian sample members with varied divisions and quota scenarios:
  // Bagian Produksi: 46 anggota -> Kuota 5 kursi (sesuai contoh PRD)
  // Bagian Engineering: 16 anggota -> Kuota 2 kursi (sesuai contoh PRD)
  // Bagian HR & GA: 15 anggota -> Kuota 1 kursi (sesuai contoh PRD)
  // Bagian Finance: 6 anggota -> Kuota 1 kursi (sesuai contoh PRD)
  // Bagian Logistik: 5 anggota -> Kuota 0 kursi (sesuai contoh PRD)
  // Bagian QC: 10 anggota -> Kuota 1 kursi

  const members: Member[] = [];
  let memberSeq = 1;

  // Helper to add member
  const addM = (
    nama: string,
    email: string,
    nik: string,
    bagian_id: string,
    nama_bagian: string,
    hak_pilih = true,
    status_memilih: 'BELUM_MEMILIH' | 'SUDAH_MEMILIH' = 'BELUM_MEMILIH',
    tanggal_pensiun = '2036-05-15',
    jabatan = 'Staf Operasional',
    tanggal_lahir?: string
  ) => {
    const nomor_anggota = `AGT-${String(memberSeq++).padStart(4, '0')}`;
    members.push({
      email,
      nik,
      nama,
      nomor_anggota,
      bagian_id,
      nama_bagian,
      status: 'AKTIF',
      hak_pilih,
      status_memilih,
      tanggal_lahir: tanggal_lahir || null,
      tanggal_pensiun,
      jabatan,
      telepon: `0812${Math.floor(10000000 + Math.random() * 90000000)}`,
      created_at: new Date().toISOString()
    });
  };

  // Demo user from metadata: andikadix862@gmail.com (born 1988 -> age 38, pension 2043)
  addM('Andika Pratama', 'andikadix862@gmail.com', 'NIK-1001', 'BAG-01', 'Produksi', true, 'BELUM_MEMILIH', '2043-12-01', 'Supervisor Produksi', '1988-12-01');
  // Sample senior member: born 1973 -> age 53, pension 2028 (sisa < 4 tahun -> trigger warning)
  addM('Budi Santoso', 'budi.santoso@kopsyah-ykk.id', 'NIK-1002', 'BAG-01', 'Produksi', true, 'BELUM_MEMILIH', '2028-08-20', 'Operator Senior', '1973-08-20');
  // Sample member: born 1974 -> age 52, pension 2029 (sisa < 4 tahun -> trigger warning)
  addM('Siti Rahmawati', 'siti.rahmawati@kopsyah-ykk.id', 'NIK-1003', 'BAG-01', 'Produksi', true, 'BELUM_MEMILIH', '2029-03-10', 'Leader Line 1', '1974-03-10');
  // Sample member: born 1985 -> age 41, pension 2040 (aman)
  addM('Agus Setiawan', 'agus.setiawan@kopsyah-ykk.id', 'NIK-1004', 'BAG-01', 'Produksi', true, 'BELUM_MEMILIH', '2040-11-25', 'Operator Mesin', '1985-11-25');
  // Sample member without tanggal_lahir (demonstrates optional field)
  addM('Dewi Lestari', 'dewi.lestari@kopsyah-ykk.id', 'NIK-1005', 'BAG-01', 'Produksi', true, 'BELUM_MEMILIH', '2039-01-14', 'Staf Administrasi Produksi');
  addM('Rizky Ramadhan', 'rizky.ramadhan@kopsyah-ykk.id', 'NIK-1006', 'BAG-01', 'Produksi', true, 'BELUM_MEMILIH', '2036-07-08', 'Operator Line 2', '1981-07-08');
  addM('Eko Prasetyo', 'eko.prasetyo@kopsyah-ykk.id', 'NIK-1007', 'BAG-01', 'Produksi', true, 'SUDAH_MEMILIH', '2035-09-18', 'Staf Maintenance Produksi', '1980-09-18');

  // Fill up Produksi to 46 members total (46 / 10 = 4.6 -> 5 kursi)
  for (let i = 8; i <= 46; i++) {
    addM(
      `Anggota Produksi ${i}`,
      `produksi.${i}@kopsyah-ykk.id`,
      `NIK-10${i < 10 ? '0' + i : i}`,
      'BAG-01',
      'Produksi',
      true,
      i % 4 === 0 ? 'SUDAH_MEMILIH' : 'BELUM_MEMILIH',
      '2036-10-10'
    );
  }

  // Engineering: 16 members (16 / 10 = 1.6 -> 2 kursi)
  addM('Fajar Nugroho', 'fajar.nugroho@kopsyah-ykk.id', 'NIK-2001', 'BAG-02', 'Engineering', true, 'BELUM_MEMILIH', '2034-06-12', 'Electrical Engineer');
  addM('Hendra Kurniawan', 'hendra.kurniawan@kopsyah-ykk.id', 'NIK-2002', 'BAG-02', 'Engineering', true, 'BELUM_MEMILIH', '2033-04-19', 'Mechanical Engineer');
  addM('Irwan Syahputra', 'irwan.syahputra@kopsyah-ykk.id', 'NIK-2003', 'BAG-02', 'Engineering', true, 'BELUM_MEMILIH', '2037-02-15', 'Automation Tech');
  for (let i = 4; i <= 16; i++) {
    addM(`Anggota Engineering ${i}`, `engineering.${i}@kopsyah-ykk.id`, `NIK-20${i < 10 ? '0' + i : i}`, 'BAG-02', 'Engineering', true, i % 3 === 0 ? 'SUDAH_MEMILIH' : 'BELUM_MEMILIH', '2036-10-10');
  }

  // HR & GA: 15 members (15 / 10 = 1.5 -> 1 kursi)
  addM('Maya Indah', 'maya.indah@kopsyah-ykk.id', 'NIK-3001', 'BAG-03', 'HR & GA', true, 'BELUM_MEMILIH', '2038-11-05', 'HR Specialist');
  addM('Dedi Kusuma', 'dedi.kusuma@kopsyah-ykk.id', 'NIK-3002', 'BAG-03', 'HR & GA', true, 'BELUM_MEMILIH', '2035-07-21', 'GA Officer');
  for (let i = 3; i <= 15; i++) {
    addM(`Anggota HR ${i}`, `hr.${i}@kopsyah-ykk.id`, `NIK-30${i < 10 ? '0' + i : i}`, 'BAG-03', 'HR & GA', true, 'BELUM_MEMILIH', '2036-10-10');
  }

  // Finance: 6 members (6 / 10 = 0.6 -> 1 kursi)
  addM('Rina Oktaviani', 'rina.oktaviani@kopsyah-ykk.id', 'NIK-4001', 'BAG-04', 'Finance & Accounting', true, 'BELUM_MEMILIH', '2037-09-30', 'Senior Accountant');
  addM('Ahmad Fauzi', 'ahmad.fauzi@kopsyah-ykk.id', 'NIK-4002', 'BAG-04', 'Finance & Accounting', true, 'BELUM_MEMILIH', '2036-01-12', 'Treasury Staff');
  for (let i = 3; i <= 6; i++) {
    addM(`Anggota Finance ${i}`, `finance.${i}@kopsyah-ykk.id`, `NIK-400${i}`, 'BAG-04', 'Finance & Accounting', true, 'BELUM_MEMILIH', '2036-10-10');
  }

  // Logistik: 5 members (5 / 10 = 0.5 -> 0 kursi - uji coba batas kuota 0)
  for (let i = 1; i <= 5; i++) {
    addM(`Anggota Logistik ${i}`, `logistik.${i}@kopsyah-ykk.id`, `NIK-500${i}`, 'BAG-05', 'Logistik & Warehouse', true, 'BELUM_MEMILIH', '2036-10-10');
  }

  // QC: 10 members (10 / 10 = 1.0 -> 1 kursi)
  addM('Wahyu Hidayat', 'wahyu.hidayat@kopsyah-ykk.id', 'NIK-6001', 'BAG-06', 'Quality Control', true, 'BELUM_MEMILIH', '2035-03-01', 'QC Inspector');
  addM('Nurul Hidayah', 'nurul.hidayah@kopsyah-ykk.id', 'NIK-6002', 'BAG-06', 'Quality Control', true, 'BELUM_MEMILIH', '2036-05-18', 'QC Lab Analyst');
  for (let i = 3; i <= 10; i++) {
    addM(`Anggota QC ${i}`, `qc.${i}@kopsyah-ykk.id`, `NIK-60${i < 10 ? '0' + i : i}`, 'BAG-06', 'Quality Control', true, 'BELUM_MEMILIH', '2036-10-10');
  }

  // Member with no voting right (for testing auth)
  addM('Karyawan Magang (Non Hak Pilih)', 'magang@kopsyah-ykk.id', 'NIK-9999', 'BAG-01', 'Produksi', false, 'BELUM_MEMILIH', '2040-01-01', 'Trainee');

  // Candidates
  const candidates: Candidate[] = [
    // Bagian Produksi (5 kursi tersedia)
    {
      kandidat_id: 'KAND-01',
      nik: 'NIK-1001',
      nomor_anggota: 'AGT-0001',
      nama: 'Andika Pratama',
      bagian_id: 'BAG-01',
      nama_bagian: 'Produksi',
      status_kandidat: 'AKTIF',
      memenuhi_syarat: true,
      alasan_syarat: 'Memenuhi seluruh kualifikasi & masa kerja aman (pensiun > 4 tahun)',
      foto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
      nomor_urut: 1,
      visi_misi: 'Mewujudkan transparansi sisa hasil usaha (SHU), mempercepat digitalisasi layanan simpan pinjam, dan memperjuangkan program kesejahteraan anggota produksi.',
      tanggal_pensiun: '2035-12-01',
      tahun_menuju_pensiun: 9
    },
    {
      kandidat_id: 'KAND-02',
      nik: 'NIK-1002',
      nomor_anggota: 'AGT-0002',
      nama: 'Budi Santoso',
      bagian_id: 'BAG-01',
      nama_bagian: 'Produksi',
      status_kandidat: 'AKTIF',
      memenuhi_syarat: true,
      alasan_syarat: 'Memenuhi seluruh kualifikasi',
      foto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
      nomor_urut: 2,
      visi_misi: 'Meningkatkan plafon pinjaman darurat tanpa bunga dan optimalisasi kemitraan sembako murah untuk anggota koperasi.',
      tanggal_pensiun: '2038-08-20',
      tahun_menuju_pensiun: 12
    },
    {
      kandidat_id: 'KAND-03',
      nik: 'NIK-1003',
      nomor_anggota: 'AGT-0003',
      nama: 'Siti Rahmawati',
      bagian_id: 'BAG-01',
      nama_bagian: 'Produksi',
      status_kandidat: 'AKTIF',
      memenuhi_syarat: true,
      alasan_syarat: 'Memenuhi kualifikasi',
      foto: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
      nomor_urut: 3,
      visi_misi: 'Pemberdayaan ekonomi keluarga anggota melalui pelatihan wirausaha dan tabungan qurban bersubsidi.',
      tanggal_pensiun: '2034-03-10',
      tahun_menuju_pensiun: 8
    },
    {
      kandidat_id: 'KAND-04',
      nik: 'NIK-1004',
      nomor_anggota: 'AGT-0004',
      nama: 'Agus Setiawan',
      bagian_id: 'BAG-01',
      nama_bagian: 'Produksi',
      status_kandidat: 'AKTIF',
      memenuhi_syarat: true,
      alasan_syarat: 'Memenuhi kualifikasi',
      foto: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
      nomor_urut: 4,
      visi_misi: 'Perbaikan sarana toko koperasi di area pabrik dan integrasi kartu anggota digital.',
      tanggal_pensiun: '2037-11-25',
      tahun_menuju_pensiun: 11
    },
    {
      kandidat_id: 'KAND-05',
      nik: 'NIK-1005',
      nomor_anggota: 'AGT-0005',
      nama: 'Dewi Lestari',
      bagian_id: 'BAG-01',
      nama_bagian: 'Produksi',
      status_kandidat: 'AKTIF',
      memenuhi_syarat: true,
      alasan_syarat: 'Memenuhi kualifikasi',
      foto: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300&auto=format&fit=crop&q=80',
      nomor_urut: 5,
      visi_misi: 'Peningkatan bagi hasil simpanan syariah dan pendampingan dana pendidikan anak anggota.',
      tanggal_pensiun: '2039-01-14',
      tahun_menuju_pensiun: 13
    },
    {
      kandidat_id: 'KAND-06',
      nik: 'NIK-1006',
      nomor_anggota: 'AGT-0006',
      nama: 'Rizky Ramadhan',
      bagian_id: 'BAG-01',
      nama_bagian: 'Produksi',
      status_kandidat: 'AKTIF',
      memenuhi_syarat: true,
      alasan_syarat: 'Memenuhi kualifikasi',
      foto: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=300&auto=format&fit=crop&q=80',
      nomor_urut: 6,
      visi_misi: 'Penguatan audit internal dan percepatan klaim dana santunan kematian & kesehatan.',
      tanggal_pensiun: '2036-07-08',
      tahun_menuju_pensiun: 10
    },

    // Bagian Engineering (2 kursi)
    {
      kandidat_id: 'KAND-07',
      nik: 'NIK-2001',
      nomor_anggota: 'AGT-0047',
      nama: 'Fajar Nugroho',
      bagian_id: 'BAG-02',
      nama_bagian: 'Engineering',
      status_kandidat: 'AKTIF',
      memenuhi_syarat: true,
      alasan_syarat: 'Memenuhi kualifikasi',
      foto: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&auto=format&fit=crop&q=80',
      nomor_urut: 1,
      visi_misi: 'Membangun aplikasi mobile monitoring simpanan dan memfasilitasi pinjaman pembelian perkakas kerja mandiri.',
      tanggal_pensiun: '2034-06-12',
      tahun_menuju_pensiun: 8
    },
    {
      kandidat_id: 'KAND-08',
      nik: 'NIK-2002',
      nomor_anggota: 'AGT-0048',
      nama: 'Hendra Kurniawan',
      bagian_id: 'BAG-02',
      nama_bagian: 'Engineering',
      status_kandidat: 'AKTIF',
      memenuhi_syarat: true,
      alasan_syarat: 'Memenuhi kualifikasi',
      foto: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&auto=format&fit=crop&q=80',
      nomor_urut: 2,
      visi_misi: 'Transparansi penuh tata kelola unit usaha koperasi dan perluasan asuransi kecelakaan kerja.',
      tanggal_pensiun: '2033-04-19',
      tahun_menuju_pensiun: 7
    },
    {
      kandidat_id: 'KAND-09',
      nik: 'NIK-2003',
      nomor_anggota: 'AGT-0049',
      nama: 'Irwan Syahputra',
      bagian_id: 'BAG-02',
      nama_bagian: 'Engineering',
      status_kandidat: 'AKTIF',
      memenuhi_syarat: true,
      alasan_syarat: 'Memenuhi kualifikasi',
      foto: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80',
      nomor_urut: 3,
      visi_misi: 'Penyaluran pembiayaan kepemilikan rumah syariah untuk anggota divisi teknik.',
      tanggal_pensiun: '2037-02-15',
      tahun_menuju_pensiun: 11
    },

    // Bagian HR & GA (1 kursi)
    {
      kandidat_id: 'KAND-10',
      nik: 'NIK-3001',
      nomor_anggota: 'AGT-0063',
      nama: 'Maya Indah',
      bagian_id: 'BAG-03',
      nama_bagian: 'HR & GA',
      status_kandidat: 'AKTIF',
      memenuhi_syarat: true,
      alasan_syarat: 'Memenuhi kualifikasi',
      foto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80',
      nomor_urut: 1,
      visi_misi: 'Memperkuat sinergi antara manajemen perusahaan dengan koperasi demi kesejahteraan jangka panjang anggota.',
      tanggal_pensiun: '2038-11-05',
      tahun_menuju_pensiun: 12
    },
    {
      kandidat_id: 'KAND-11',
      nik: 'NIK-3002',
      nomor_anggota: 'AGT-0064',
      nama: 'Dedi Kusuma',
      bagian_id: 'BAG-03',
      nama_bagian: 'HR & GA',
      status_kandidat: 'AKTIF',
      memenuhi_syarat: true,
      alasan_syarat: 'Memenuhi kualifikasi',
      foto: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80',
      nomor_urut: 2,
      visi_misi: 'Mengembangkan unit usaha logistik dan minimarket koperasi yang menjangkau seluruh lini karyawan.',
      tanggal_pensiun: '2035-07-21',
      tahun_menuju_pensiun: 9
    },

    // Bagian Finance (1 kursi)
    {
      kandidat_id: 'KAND-12',
      nik: 'NIK-4001',
      nomor_anggota: 'AGT-0078',
      nama: 'Rina Oktaviani',
      bagian_id: 'BAG-04',
      nama_bagian: 'Finance & Accounting',
      status_kandidat: 'AKTIF',
      memenuhi_syarat: true,
      alasan_syarat: 'Memenuhi kualifikasi',
      foto: 'https://images.unsplash.com/photo-1534751516642-a171edd2521d?w=300&auto=format&fit=crop&q=80',
      nomor_urut: 1,
      visi_misi: 'Akuntabilitas laporan keuangan bulanan real-time via web dan efisiensi biaya operasional.',
      tanggal_pensiun: '2037-09-30',
      tahun_menuju_pensiun: 11
    },
    {
      kandidat_id: 'KAND-13',
      nik: 'NIK-4002',
      nomor_anggota: 'AGT-0079',
      nama: 'Ahmad Fauzi',
      bagian_id: 'BAG-04',
      nama_bagian: 'Finance & Accounting',
      status_kandidat: 'AKTIF',
      memenuhi_syarat: true,
      alasan_syarat: 'Memenuhi kualifikasi',
      foto: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80',
      nomor_urut: 2,
      visi_misi: 'Optimalisasi portofolio investasi syariah dan peningkatan deviden simpanan wajib.',
      tanggal_pensiun: '2036-01-12',
      tahun_menuju_pensiun: 10
    },

    // Bagian QC (1 kursi)
    {
      kandidat_id: 'KAND-14',
      nik: 'NIK-6001',
      nomor_anggota: 'AGT-0089',
      nama: 'Wahyu Hidayat',
      bagian_id: 'BAG-06',
      nama_bagian: 'Quality Control',
      status_kandidat: 'AKTIF',
      memenuhi_syarat: true,
      alasan_syarat: 'Memenuhi kualifikasi',
      foto: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=300&auto=format&fit=crop&q=80',
      nomor_urut: 1,
      visi_misi: 'Pengawasan kualitas barang konsumsi koperasi dan sertifikasi halal untuk seluruh produk mitra.',
      tanggal_pensiun: '2035-03-01',
      tahun_menuju_pensiun: 9
    },
    {
      kandidat_id: 'KAND-15',
      nik: 'NIK-6002',
      nomor_anggota: 'AGT-0090',
      nama: 'Nurul Hidayah',
      bagian_id: 'BAG-06',
      nama_bagian: 'Quality Control',
      status_kandidat: 'AKTIF',
      memenuhi_syarat: true,
      alasan_syarat: 'Memenuhi kualifikasi',
      foto: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=300&auto=format&fit=crop&q=80',
      nomor_urut: 2,
      visi_misi: 'Membangun kanal aduan anggota yang cepat tanggap dan transparan.',
      tanggal_pensiun: '2036-05-18',
      tahun_menuju_pensiun: 10
    }
  ];

  // Config
  const config: ElectionConfig = {
    nama_sistem: 'Sistem Pemilihan Anggota Perwakilan Online KOPSYAH YKK AP Indonesia',
    periode_pemilihan: '2026',
    organisasi: 'KOPSYAH YKK AP Indonesia',
    ratio_anggota_perwakilan: 10,
    batas_tahun_sebelum_pensiun: 4,
    max_vote_per_member_rule: 'SEJUMLAH_KURSI_BAGIAN',
    custom_max_vote: 1,
    voting_start: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    voting_end: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    voting_status: 'AKTIF',
    deskripsi: 'Pemilihan Anggota Perwakilan KOPSYAH YKK AP Indonesia untuk masa bakti 2026-2029 sesuai prinsip Jujur, Adil, Rahasia, dan Bebas.',
    lokasi: 'Cikarang / Sukabumi, Indonesia'
  };

  // Admins
  const admins: AdminUser[] = [
    {
      id: 'ADM-01',
      email: 'admin@kopsyah-ykk.id',
      nama: 'Super Administrator Panitia',
      role: 'SUPER_ADMIN'
    },
    {
      id: 'ADM-02',
      email: 'panitia@kopsyah-ykk.id',
      nama: 'Ketua Panitia Pemilihan',
      role: 'ADMIN_PEMILIHAN'
    },
    {
      id: 'ADM-03',
      email: 'andikadix862@gmail.com',
      nama: 'Andika Pratama (Admin)',
      role: 'SUPER_ADMIN'
    }
  ];

  // Initial votes seed for members marked as SUDAH_MEMILIH
  const votes: VoteRecord[] = [];
  const sudahMemilihMembers = members.filter(m => m.status_memilih === 'SUDAH_MEMILIH');
  sudahMemilihMembers.forEach((mem, idx) => {
    const txId = `TX-${Date.now()}-${idx + 1000}`;
    mem.transaction_id = txId;
    mem.voted_at = new Date(Date.now() - Math.floor(Math.random() * 12 * 3600 * 1000)).toISOString();

    const divisionCandidates = candidates.filter(c => c.bagian_id === mem.bagian_id && c.status_kandidat === 'AKTIF');
    if (divisionCandidates.length > 0) {
      // Vote for 1 or 2 candidates
      const chosen = divisionCandidates[idx % divisionCandidates.length];
      votes.push({
        vote_id: `VOTE-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        election_id: 'ELEC-2026',
        candidate_id: chosen.kandidat_id,
        bagian_id: mem.bagian_id,
        timestamp: mem.voted_at,
        transaction_id: txId,
        status: 'VALID'
      });
    }
  });

  // Calculate division stats
  const divisions: Division[] = divisionsInit.map(d => {
    const count = members.filter(m => m.bagian_id === d.bagian_id).length;
    const kuota = calculateQuota(count, config.ratio_anggota_perwakilan);
    const sudah = members.filter(m => m.bagian_id === d.bagian_id && m.status_memilih === 'SUDAH_MEMILIH').length;
    const belum = count - sudah;
    const partisipasi = count > 0 ? Math.round((sudah / count) * 1000) / 10 : 0;
    return {
      bagian_id: d.bagian_id,
      nama_bagian: d.nama_bagian,
      deskripsi: d.deskripsi,
      total_anggota: count,
      kuota_perwakilan: kuota,
      sudah_memilih: sudah,
      belum_memilih: belum,
      partisipasi_persen: partisipasi
    };
  });

  const auditLogs: AuditLog[] = [
    {
      id: 'LOG-001',
      timestamp: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      user_email: 'admin@kopsyah-ykk.id',
      user_role: 'SUPER_ADMIN',
      activity: 'INISIALISASI_SISTEM',
      details: 'Sistem Pemilihan Anggota Perwakilan 2026 diinisialisasi dengan master data anggota dan kuota otomatis 10:1.',
      status: 'sukses'
    },
    {
      id: 'LOG-002',
      timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      user_email: 'admin@kopsyah-ykk.id',
      user_role: 'SUPER_ADMIN',
      activity: 'AKTIVASI_PEMILIHAN',
      details: 'Status pemilihan diubah menjadi AKTIF. Periode voting dimulai.',
      status: 'sukses'
    }
  ];

  return {
    config,
    divisions,
    members,
    candidates,
    votes,
    admins,
    auditLogs,
    tieBreaks: []
  };
}

export function getDatabase(): DatabaseState {
  if (dbState) {
    return dbState;
  }

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      dbState = JSON.parse(data);
      if (dbState) {
        reEvaluateAllMembersPension();
        return dbState;
      }
    } catch (e) {
      console.warn('Failed to parse database file, re-seeding:', e);
    }
  }

  dbState = generateInitialSeed();
  reEvaluateAllMembersPension();
  return dbState;
}

export function saveDatabaseToFile(): void {
  if (!dbState) return;
  // Save to Firestore (async, fire-and-forget for sync callers)
  saveDbToFirestore(dbState).catch(err =>
    console.error('[db] Firestore save error:', err)
  );
  // Also save local file when filesystem is writable (local dev)
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
  } catch {
    // Vercel filesystem is read-only — silently skip
  }
}

/**
 * Initialize database from Firestore on cold start (async).
 * Must be called once before handling requests on Vercel.
 */
export async function initializeDatabaseAsync(): Promise<void> {
  if (dbState) return; // already loaded in this instance
  try {
    const firestoreData = await loadDbFromFirestore();
    if (firestoreData) {
      dbState = firestoreData as DatabaseState;
      reEvaluateAllMembersPension();
      console.log('[db] Loaded from Firestore.');
      return;
    }
  } catch (err) {
    console.warn('[db] Firestore load failed, falling back to seed:', err);
  }
  // Fall back to local file or seed
  getDatabase();
}

// Synchronize candidates automatically with all registered members
// Sesuai aturan PRD & Arahan User:
// Seluruh anggota yang terdaftar di suatu Bagian (divisi) ditampilkan di Surat Suara / Daftar Calon Perwakilan.
// Anggota dengan sisa masa pensiun < 4 tahun (usia 51+ tahun) ditandai tidak dapat dipilih (Hanya Pemilih)
// dan tombol pemilihannya dinonaktifkan.
export function syncCandidatesWithMembers(): void {
  if (!dbState) return;

  // Index existing candidates to preserve custom edits (e.g. customized foto, visi_misi)
  const existingMap = new Map<string, Candidate>();
  for (const c of dbState.candidates || []) {
    if (c.nik) existingMap.set(c.nik.trim().toUpperCase(), c);
    if (c.nomor_anggota) existingMap.set(c.nomor_anggota.trim().toUpperCase(), c);
    if (c.kandidat_id) existingMap.set(c.kandidat_id.trim().toUpperCase(), c);
  }

  // Group members by division
  const divisionMap = new Map<string, Member[]>();
  for (const m of dbState.members || []) {
    const bagId = m.bagian_id;
    if (!divisionMap.has(bagId)) {
      divisionMap.set(bagId, []);
    }
    divisionMap.get(bagId)!.push(m);
  }

  const newCandidates: Candidate[] = [];

  for (const [bagId, membersInDiv] of divisionMap.entries()) {
    // Sort members neatly within the division (by nomor_anggota or nama)
    membersInDiv.sort((a, b) => {
      if (a.nomor_anggota && b.nomor_anggota) {
        return a.nomor_anggota.localeCompare(b.nomor_anggota, undefined, { numeric: true });
      }
      return a.nama.localeCompare(b.nama);
    });

    const divObj = dbState.divisions.find(d => d.bagian_id === bagId);
    const divName = divObj?.nama_bagian || membersInDiv[0]?.nama_bagian || bagId;

    // Show ALL members of the division (do not filter out)
    membersInDiv.forEach((m, idx) => {
      const refDate = getActiveEvaluationDate(dbState?.config);
      const enriched = enrichMemberPension(m, refDate);
      const cleanNik = (m.nik || '').trim().toUpperCase();
      const cleanNoAgt = (m.nomor_anggota || '').trim().toUpperCase();
      const existing =
        (cleanNik ? existingMap.get(cleanNik) : undefined) ||
        (cleanNoAgt ? existingMap.get(cleanNoAgt) : undefined) ||
        existingMap.get(m.email.toLowerCase());

      const candidateId =
        existing?.kandidat_id ||
        `KAND-${(cleanNoAgt || cleanNik || `DIV${bagId}-${idx + 1}`).replace(/[^A-Z0-9]/g, '')}`;
      const noUrut = idx + 1; // Sequential ballot number within division

      const isPengurusOrBpk = checkPengurusOrBPK(m.jabatan);
      const isEligibleToElect =
        enriched.hak_dipilih !== false &&
        !enriched.is_pensiun_warning &&
        !isPengurusOrBpk.isPengurusBPK &&
        m.status === 'AKTIF';

      let candidateReason = '';
      if (m.status !== 'AKTIF') {
        candidateReason = 'Status anggota tidak aktif';
      } else if (isPengurusOrBpk.isPengurusBPK) {
        candidateReason = `Tidak dapat dipilih (Menjabat sebagai ${isPengurusOrBpk.label}). Sesuai aturan AD/ART, berstatus Hanya Pemilih.`;
      } else if (enriched.is_pensiun_warning) {
        candidateReason = `Tidak dapat dipilih (Sisa masa pensiun ${enriched.sisa_pensiun_text || `${enriched.sisa_pensiun_tahun} thn`} < 4 tahun). Berstatus Hanya Pemilih.`;
      } else {
        candidateReason = existing?.alasan_syarat || 'Memenuhi syarat calon perwakilan (sisa masa pensiun ≥ 4 tahun)';
      }

      const candidate: Candidate = {
        kandidat_id: candidateId,
        nik: m.nik || '',
        nomor_anggota: m.nomor_anggota || '',
        nama: m.nama,
        bagian_id: m.bagian_id,
        nama_bagian: divName,
        status_kandidat: m.status === 'AKTIF' ? 'AKTIF' : 'NONAKTIF',
        memenuhi_syarat: isEligibleToElect,
        alasan_syarat: candidateReason,
        foto:
          existing?.foto ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(m.nama)}&background=1E3A8A&color=fff&size=128&bold=true`,
        nomor_urut: noUrut,
        visi_misi:
          existing?.visi_misi ||
          `Siap mengemban amanah sebagai Perwakilan Anggota KOPSYAH YKK AP Indonesia untuk Bagian ${divName}.`,
        tanggal_lahir: enriched.tanggal_lahir || null,
        tanggal_pensiun: enriched.tanggal_pensiun || null,
        tahun_menuju_pensiun: enriched.sisa_pensiun_tahun,
        sisa_pensiun_tahun: enriched.sisa_pensiun_tahun,
        sisa_pensiun_text: enriched.sisa_pensiun_text,
        is_pensiun_warning: enriched.is_pensiun_warning,
        hak_dipilih: isEligibleToElect,
        usia: enriched.usia,
        jabatan: m.jabatan || 'Anggota',
        is_pengurus_bpk: isPengurusOrBpk.isPengurusBPK,
        tipe_pengurus_bpk: isPengurusOrBpk.roleType
      };

      newCandidates.push(candidate);
    });
  }

  // Calculate real-time valid votes tally per candidate and division (LEFT JOIN equivalent)
  const validVotes = (dbState.votes || []).filter(v => v.status === 'VALID');
  const votesPerCandidate: Record<string, number> = {};
  const votesPerDivision: Record<string, number> = {};

  for (const v of validVotes) {
    votesPerCandidate[v.candidate_id] = (votesPerCandidate[v.candidate_id] || 0) + 1;
    votesPerDivision[v.bagian_id] = (votesPerDivision[v.bagian_id] || 0) + 1;
  }

  for (const c of newCandidates) {
    const totalSuara = votesPerCandidate[c.kandidat_id] || 0;
    const divVotes = votesPerDivision[c.bagian_id] || 0;
    c.total_suara = totalSuara;
    c.persentase_suara = divVotes > 0 ? Math.round((totalSuara / divVotes) * 1000) / 10 : 0;
  }

  dbState.candidates = newCandidates;
}

export function syncDivisionStats(): void {
  if (!dbState) return;
  const ratio = dbState.config.ratio_anggota_perwakilan || 10;
  
  // 1. Gather all valid vote transactions
  const validVotes = (dbState.votes || []).filter(v => v.status === 'VALID');
  const validTxSet = new Set(validVotes.map(v => v.transaction_id).filter(Boolean));

  // 2. Sync member status_memilih with valid vote transactions
  if (dbState.members) {
    for (const m of dbState.members) {
      if (m.transaction_id && validTxSet.has(m.transaction_id)) {
        m.status_memilih = 'SUDAH_MEMILIH';
      }
    }
  }

  // 3. Sync division statistics
  dbState.divisions = (dbState.divisions || []).map(d => {
    const divisionMembers = (dbState!.members || []).filter(m => m.bagian_id === d.bagian_id);
    const count = divisionMembers.length;
    const autoKuota = calculateQuota(count, ratio);
    const hasManualQuota = d.manual_kuota !== undefined && d.manual_kuota !== null && !isNaN(Number(d.manual_kuota));
    const kuota = hasManualQuota ? Math.max(0, Number(d.manual_kuota)) : autoKuota;

    // Div votes transaction count
    const divVotes = validVotes.filter(v => v.bagian_id === d.bagian_id);
    const divTxSet = new Set(divVotes.map(v => v.transaction_id).filter(Boolean));

    const sudahByMembers = divisionMembers.filter(m => m.status_memilih === 'SUDAH_MEMILIH').length;
    const sudah = Math.max(sudahByMembers, divTxSet.size);
    const belum = Math.max(0, count - sudah);
    const partisipasi = count > 0 ? Math.round((sudah / count) * 1000) / 10 : 0;
    
    return {
      ...d,
      total_anggota: count,
      kuota_perwakilan: kuota,
      sudah_memilih: sudah,
      belum_memilih: belum,
      partisipasi_persen: partisipasi
    };
  });
}

// ----------------- PENSION & RETIREMENT UTILITIES -----------------

export const RETIREMENT_AGE = 55;
export const PENSION_WARNING_THRESHOLD_YEARS = 4;

export function parseDateToISO(input: any): string | null {
  if (input === null || input === undefined) return null;

  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    const y = input.getFullYear();
    const m = String(input.getMonth() + 1).padStart(2, '0');
    const d = String(input.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (typeof input === 'number' && !isNaN(input)) {
    if (input > 0 && input < 100000) {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + input * 86400000);
      if (!isNaN(date.getTime())) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }
  }

  const str = String(input).trim();
  if (!str) return null;

  // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // ISO YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 1900 && parsed.getFullYear() <= 2100) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
}

export function getActiveEvaluationDate(config?: any): Date {
  const now = new Date();
  if (config?.voting_start) {
    const vDate = new Date(config.voting_start);
    if (!isNaN(vDate.getTime()) && vDate > now) {
      return vDate;
    }
  }
  return now;
}

export function getExactPensionDiffServer(refDate: Date, pensionDate: Date) {
  if (pensionDate.getTime() <= refDate.getTime()) {
    return {
      years: 0,
      months: 0,
      days: 0,
      isLessThan4Years: true,
      text: 'Pensiun',
      numericYears: 0
    };
  }

  let y = pensionDate.getFullYear() - refDate.getFullYear();
  let m = pensionDate.getMonth() - refDate.getMonth();
  let d = pensionDate.getDate() - refDate.getDate();

  if (d < 0) {
    m -= 1;
    const prevMonthLastDay = new Date(pensionDate.getFullYear(), pensionDate.getMonth(), 0).getDate();
    d += prevMonthLastDay;
  }

  if (m < 0) {
    y -= 1;
    m += 12;
  }

  // Strictly check 4 full years (>= 48 months) from reference date
  const fourYearsRef = new Date(refDate);
  fourYearsRef.setFullYear(fourYearsRef.getFullYear() + PENSION_WARNING_THRESHOLD_YEARS);
  const totalMonths = y * 12 + m;
  const isLessThan4Years = pensionDate.getTime() < fourYearsRef.getTime() || totalMonths < (PENSION_WARNING_THRESHOLD_YEARS * 12);

  const diffMs = pensionDate.getTime() - refDate.getTime();
  const rawDiffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);

  let numericYears = Math.floor(rawDiffYears * 10) / 10;
  if (isLessThan4Years && numericYears >= 4.0) {
    numericYears = 3.9;
  }

  let text = '';
  if (y === 0 && m === 0) {
    text = '< 1 bln lagi';
  } else if (y === 0) {
    text = `${m} bln lagi`;
  } else if (m === 0) {
    text = `${y} thn lagi`;
  } else {
    text = `${y} thn ${m} bln lagi`;
  }

  return {
    years: y,
    months: m,
    days: d,
    isLessThan4Years,
    text,
    numericYears
  };
}

export interface PengurusBPKCheckServerResult {
  isPengurusBPK: boolean;
  roleType: 'PENGURUS' | 'BPK' | null;
  label: string;
}

/**
 * Aturan Bisnis Kualifikasi KOPSYAH YKK AP Indonesia:
 * - Seluruh anggota yang menjabat sebagai Pengurus maupun BPK (Badan Pengawas Koperasi)
 *   HANYA memiliki Hak Memilih (Hak Pilih).
 * - Pengurus dan BPK TIDAK MEMILIKI Hak Dipilih / Hak Perwakilan (Otomatis Tidak Layak Dicalonkan).
 */
export function checkPengurusOrBPK(jabatan?: string | null): PengurusBPKCheckServerResult {
  if (!jabatan) return { isPengurusBPK: false, roleType: null, label: '' };
  const upper = String(jabatan).trim().toUpperCase();

  // BPK: Badan Pengawas Koperasi / Pengawas / BPK
  if (
    upper === 'BPK' ||
    upper.includes('BPK') ||
    upper.includes('PENGAWAS') ||
    upper.includes('BADAN PENGAWAS')
  ) {
    return {
      isPengurusBPK: true,
      roleType: 'BPK',
      label: 'BPK (Badan Pengawas Koperasi)'
    };
  }

  // Pengurus Koperasi
  if (
    upper === 'PENGURUS' ||
    upper.includes('PENGURUS')
  ) {
    return {
      isPengurusBPK: true,
      roleType: 'PENGURUS',
      label: 'Pengurus Koperasi'
    };
  }

  return { isPengurusBPK: false, roleType: null, label: '' };
}

export function checkPegawai(jabatan?: string | null): boolean {
  if (!jabatan) return false;
  const upper = String(jabatan).trim().toUpperCase();
  return (
    upper === 'PEGAWAI' ||
    upper === 'KARYAWAN' ||
    upper.includes('PEGAWAI') ||
    upper.includes('KARYAWAN') ||
    upper.includes('STAF') ||
    upper.includes('STAFF')
  );
}

export function enrichMemberPension(member: Member, refDateInput?: string | Date): Member {
  const refDate = refDateInput ? new Date(refDateInput) : new Date();
  const validRefDate = isNaN(refDate.getTime()) ? new Date() : refDate;

  let tanggal_lahir = parseDateToISO(member.tanggal_lahir);
  let tanggal_pensiun = parseDateToISO(member.tanggal_pensiun);
  let usia: number | null = null;
  let sisa_pensiun_tahun: number | null = null;
  let sisa_pensiun_text: string | undefined = undefined;
  let is_pensiun_warning = false;

  if (tanggal_lahir) {
    const dob = new Date(`${tanggal_lahir}T00:00:00`);
    if (!isNaN(dob.getTime())) {
      const pYear = dob.getFullYear() + RETIREMENT_AGE;
      const pMonth = String(dob.getMonth() + 1).padStart(2, '0');
      const pDay = String(dob.getDate()).padStart(2, '0');
      tanggal_pensiun = `${pYear}-${pMonth}-${pDay}`;

      const pDate = new Date(`${tanggal_pensiun}T00:00:00`);
      const diff = getExactPensionDiffServer(validRefDate, pDate);

      sisa_pensiun_tahun = diff.numericYears;
      sisa_pensiun_text = diff.text;
      is_pensiun_warning = diff.isLessThan4Years;

      let age = validRefDate.getFullYear() - dob.getFullYear();
      const monthDiff = validRefDate.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && validRefDate.getDate() < dob.getDate())) {
        age--;
      }
      usia = age >= 0 ? age : null;
    }
  } else if (tanggal_pensiun) {
    const pDate = new Date(`${tanggal_pensiun}T00:00:00`);
    if (!isNaN(pDate.getTime())) {
      const diff = getExactPensionDiffServer(validRefDate, pDate);
      sisa_pensiun_tahun = diff.numericYears;
      sisa_pensiun_text = diff.text;
      is_pensiun_warning = diff.isLessThan4Years;
    }
  }

  // ATURAN KUALIFIKASI BARU: PENGURUS, BPK & PEGAWAI
  // - Pengurus, BPK, dan Pegawai/Karyawan HANYA memiliki Hak Memilih (Hak Pilih), tidak memiliki Hak Dipilih.
  const pengurusCheck = checkPengurusOrBPK(member.jabatan);
  const isPegawai = checkPegawai(member.jabatan);

  // Hak Memilih (Hak Pilih): AKTIF untuk Pegawai, Pengurus, BPK, dan Anggota Aktif
  const hak_pilih = member.status === 'AKTIF' ? (member.hak_pilih !== false) : false;

  // Hak Dipilih: NONAKTIF jika Pegawai/Karyawan, Pengurus/BPK, atau sisa masa pensiun < 4 tahun
  const hak_dipilih = member.status === 'AKTIF' && !isPegawai && !pengurusCheck.isPengurusBPK && !is_pensiun_warning;

  let alasan_hak_dipilih = '';
  if (member.status !== 'AKTIF') {
    alasan_hak_dipilih = 'Status keanggotaan tidak aktif.';
  } else if (isPegawai) {
    alasan_hak_dipilih = 'Terdaftar sebagai Pegawai/Karyawan KOPSYAH YKK. Berdasarkan aturan kualifikasi AD/ART, Pegawai/Karyawan hanya memiliki Hak Memilih (Hak Pilih) dan tidak memiliki Hak Dipilih sebagai Perwakilan Anggota (Hanya Pemilih).';
  } else if (pengurusCheck.isPengurusBPK) {
    alasan_hak_dipilih = `Menjabat sebagai ${pengurusCheck.label}. Berdasarkan aturan kualifikasi AD/ART, Pengurus dan BPK hanya memiliki Hak Memilih (Hak Pilih) dan tidak memiliki Hak Dipilih sebagai Perwakilan Anggota (Hanya Pemilih).`;
  } else if (is_pensiun_warning) {
    alasan_hak_dipilih = `Tidak memenuhi syarat dicalonkan karena sisa masa pensiun ${sisa_pensiun_text || `${sisa_pensiun_tahun} tahun`} (< 4 tahun menuju pensiun usia 55). Anggota berstatus Hanya Pemilih.`;
  } else {
    alasan_hak_dipilih = 'Memenuhi syarat dicalonkan sebagai calon perwakilan (sisa masa pensiun ≥ 4 tahun).';
  }

  return {
    ...member,
    tanggal_lahir,
    tanggal_pensiun,
    usia,
    sisa_pensiun_tahun,
    sisa_pensiun_text,
    is_pensiun_warning,
    hak_pilih,
    hak_dipilih,
    alasan_hak_dipilih,
    is_pengurus_bpk: pengurusCheck.isPengurusBPK,
    is_pegawai: isPegawai,
    tipe_pengurus_bpk: pengurusCheck.roleType
  };
}

// ----------------- ABSTRACTION LAYER -----------------

export function reEvaluateAllMembersPension(): { total: number; warnings: number; eligible: number; pengurus_bpk: number } {
  if (!dbState) {
    getDatabase();
  }
  if (!dbState || !dbState.members) {
    return { total: 0, warnings: 0, eligible: 0, pengurus_bpk: 0 };
  }

  const refDate = getActiveEvaluationDate(dbState.config);
  let warnings = 0;
  let eligible = 0;
  let pengurus_bpk = 0;

  dbState.members = dbState.members.map(m => {
    const enriched = enrichMemberPension(m, refDate);
    const isP = checkPengurusOrBPK(m.jabatan).isPengurusBPK;
    if (isP) pengurus_bpk++;
    if (enriched.is_pensiun_warning) warnings++;
    if (enriched.hak_dipilih) eligible++;
    return enriched;
  });

  syncCandidatesWithMembers();
  syncDivisionStats();
  saveDatabaseToFile();

  return {
    total: dbState.members.length,
    warnings,
    eligible,
    pengurus_bpk
  };
}

export function getMembers(): Member[] {
  const db = getDatabase();
  const refDate = getActiveEvaluationDate(db.config);
  return db.members.map(m => enrichMemberPension(m, refDate));
}

export function getMemberByEmail(email: string): Member | undefined {
  const db = getDatabase();
  const cleanEmail = email.trim().toLowerCase();
  const m = db.members.find(m => m.email.trim().toLowerCase() === cleanEmail);
  if (!m) return undefined;
  const refDate = getActiveEvaluationDate(db.config);
  return enrichMemberPension(m, refDate);
}

export function getMemberByNik(nik: string): Member | undefined {
  const db = getDatabase();
  const m = db.members.find(m => m.nik.trim().toUpperCase() === nik.trim().toUpperCase());
  if (!m) return undefined;
  const refDate = getActiveEvaluationDate(db.config);
  return enrichMemberPension(m, refDate);
}

export function getDivisions(): Division[] {
  const db = getDatabase();
  syncDivisionStats();
  return db.divisions;
}

export function getDivisionById(id: string): Division | undefined {
  const db = getDatabase();
  syncDivisionStats();
  return db.divisions.find(d => d.bagian_id === id);
}

export interface UpsertDivisionInput {
  bagian_id: string;
  nama_bagian: string;
  deskripsi?: string;
  manual_kuota?: number | null;
  alasan_manual_kuota?: string;
  old_bagian_id?: string;
}

export function upsertDivision(
  data: UpsertDivisionInput,
  adminEmail = 'admin@kopsyah-ykk.id'
): { success: boolean; division: Division; message: string } {
  const db = getDatabase();
  const cleanId = data.bagian_id ? data.bagian_id.trim().toUpperCase() : '';
  const cleanNama = data.nama_bagian ? data.nama_bagian.trim() : '';
  const oldId = data.old_bagian_id ? data.old_bagian_id.trim().toUpperCase() : undefined;

  if (!cleanId || !cleanNama) {
    throw new Error('Kode bagian dan nama bagian wajib diisi.');
  }

  const manualKuotaVal =
    data.manual_kuota !== undefined && data.manual_kuota !== null && !isNaN(Number(data.manual_kuota))
      ? Math.max(0, Number(data.manual_kuota))
      : null;

  let existingIndex = -1;
  if (oldId) {
    existingIndex = db.divisions.findIndex(d => d.bagian_id.toUpperCase() === oldId);
  } else {
    existingIndex = db.divisions.findIndex(d => d.bagian_id.toUpperCase() === cleanId);
  }

  if (existingIndex >= 0) {
    // Updating existing division
    const existing = db.divisions[existingIndex];
    const prevId = existing.bagian_id;

    // Check if new cleanId conflicts with another division
    if (prevId.toUpperCase() !== cleanId) {
      const conflict = db.divisions.some((d, idx) => idx !== existingIndex && d.bagian_id.toUpperCase() === cleanId);
      if (conflict) {
        throw new Error(`Kode bagian "${cleanId}" sudah digunakan oleh bagian lain.`);
      }
    }

    // Cascade update members if ID or Name changed
    if (prevId !== cleanId || existing.nama_bagian !== cleanNama) {
      db.members.forEach(m => {
        if (m.bagian_id === prevId) {
          m.bagian_id = cleanId;
          m.nama_bagian = cleanNama;
        }
      });
      // Cascade update candidates
      db.candidates.forEach(c => {
        if (c.bagian_id === prevId) {
          c.bagian_id = cleanId;
          c.nama_bagian = cleanNama;
        }
      });
      // Cascade update votes
      db.votes.forEach(v => {
        if (v.bagian_id === prevId) {
          v.bagian_id = cleanId;
        }
      });
      // Cascade update tieBreaks
      db.tieBreaks.forEach(tb => {
        if (tb.bagian_id === prevId) {
          tb.bagian_id = cleanId;
        }
      });
    }

    const divisionMembers = db.members.filter(m => m.bagian_id === cleanId);
    const count = divisionMembers.length;
    const ratio = db.config.ratio_anggota_perwakilan || 10;
    const autoKuota = calculateQuota(count, ratio);
    const kuota = manualKuotaVal !== null ? manualKuotaVal : autoKuota;
    const sudah = divisionMembers.filter(m => m.status_memilih === 'SUDAH_MEMILIH').length;
    const belum = count - sudah;
    const partisipasi = count > 0 ? Math.round((sudah / count) * 1000) / 10 : 0;

    const updatedDivision: Division = {
      ...existing,
      bagian_id: cleanId,
      nama_bagian: cleanNama,
      deskripsi: data.deskripsi || '',
      manual_kuota: manualKuotaVal,
      alasan_manual_kuota: data.alasan_manual_kuota || '',
      total_anggota: count,
      kuota_perwakilan: kuota,
      sudah_memilih: sudah,
      belum_memilih: belum,
      partisipasi_persen: partisipasi
    };

    db.divisions[existingIndex] = updatedDivision;
    syncDivisionStats();
    saveDatabaseToFile();

    addAuditLog({
      user_email: adminEmail,
      user_role: 'ADMIN',
      activity: 'UBAH_BAGIAN',
      details: `Bagian "${cleanNama}" (${cleanId}) berhasil diperbarui.${
        manualKuotaVal !== null ? ` Kuota manual: ${manualKuotaVal} kursi.` : ' Kuota dihitung otomatis.'
      }`,
      status: 'sukses'
    });

    return {
      success: true,
      division: updatedDivision,
      message: `Data bagian "${cleanNama}" (${cleanId}) berhasil diperbarui.`
    };
  } else {
    // New division
    const exists = db.divisions.some(d => d.bagian_id.toUpperCase() === cleanId);
    if (exists) {
      throw new Error(`Kode bagian "${cleanId}" sudah terdaftar.`);
    }

    const divisionMembers = db.members.filter(m => m.bagian_id === cleanId);
    const count = divisionMembers.length;
    const ratio = db.config.ratio_anggota_perwakilan || 10;
    const autoKuota = calculateQuota(count, ratio);
    const kuota = manualKuotaVal !== null ? manualKuotaVal : autoKuota;

    const newDiv: Division = {
      bagian_id: cleanId,
      nama_bagian: cleanNama,
      deskripsi: data.deskripsi || '',
      manual_kuota: manualKuotaVal,
      alasan_manual_kuota: data.alasan_manual_kuota || '',
      total_anggota: count,
      kuota_perwakilan: kuota,
      sudah_memilih: 0,
      belum_memilih: count,
      partisipasi_persen: 0
    };

    db.divisions.push(newDiv);
    syncDivisionStats();
    saveDatabaseToFile();

    addAuditLog({
      user_email: adminEmail,
      user_role: 'ADMIN',
      activity: 'TAMBAH_BAGIAN',
      details: `Bagian baru "${cleanNama}" (${cleanId}) berhasil didaftarkan.${
        manualKuotaVal !== null ? ` Kuota manual: ${manualKuotaVal} kursi.` : ''
      }`,
      status: 'sukses'
    });

    return {
      success: true,
      division: newDiv,
      message: `Bagian "${cleanNama}" (${cleanId}) berhasil ditambahkan.`
    };
  }
}

export function deleteDivision(
  bagianId: string,
  adminEmail = 'admin@kopsyah-ykk.id'
): { success: boolean; message: string } {
  const db = getDatabase();
  const cleanId = bagianId.trim().toUpperCase();
  const idx = db.divisions.findIndex(d => d.bagian_id.toUpperCase() === cleanId);
  if (idx === -1) {
    throw new Error(`Bagian dengan kode "${cleanId}" tidak ditemukan.`);
  }

  const memberCount = db.members.filter(m => m.bagian_id === cleanId).length;
  if (memberCount > 0) {
    throw new Error(
      `Tidak dapat menghapus bagian "${cleanId}" karena masih memiliki ${memberCount} anggota terdaftar. Harap pindahkan atau perbarui data anggota terlebih dahulu.`
    );
  }

  const candidateCount = db.candidates.filter(c => c.bagian_id === cleanId).length;
  if (candidateCount > 0) {
    throw new Error(
      `Tidak dapat menghapus bagian "${cleanId}" karena masih memiliki ${candidateCount} kandidat terdaftar.`
    );
  }

  const removed = db.divisions.splice(idx, 1)[0];
  syncDivisionStats();
  saveDatabaseToFile();

  addAuditLog({
    user_email: adminEmail,
    user_role: 'ADMIN',
    activity: 'HAPUS_BAGIAN',
    details: `Bagian "${removed.nama_bagian}" (${cleanId}) berhasil dihapus.`,
    status: 'sukses'
  });

  return {
    success: true,
    message: `Bagian "${removed.nama_bagian}" (${cleanId}) berhasil dihapus.`
  };
}

export function getCandidates(bagian_id?: string): Candidate[] {
  const db = getDatabase();
  syncCandidatesWithMembers();
  let list = db.candidates;
  if (bagian_id && bagian_id !== 'ALL') {
    list = list.filter(c => c.bagian_id === bagian_id);
  }

  // Calculate real-time valid votes tally per candidate and division (strictly secret, aggregate only)
  const validVotes = (db.votes || []).filter(v => v.status === 'VALID');
  const votesPerCandidate: Record<string, number> = {};
  const votesPerDivision: Record<string, number> = {};

  for (const v of validVotes) {
    votesPerCandidate[v.candidate_id] = (votesPerCandidate[v.candidate_id] || 0) + 1;
    votesPerDivision[v.bagian_id] = (votesPerDivision[v.bagian_id] || 0) + 1;
  }

  return list.map(c => {
    const totalSuara = votesPerCandidate[c.kandidat_id] || 0;
    const divVotes = votesPerDivision[c.bagian_id] || 0;
    const persentase = divVotes > 0 ? Math.round((totalSuara / divVotes) * 1000) / 10 : 0;
    return {
      ...c,
      total_suara: totalSuara,
      persentase_suara: persentase
    };
  });
}

export function getCandidateById(id: string): Candidate | undefined {
  const db = getDatabase();
  syncCandidatesWithMembers();
  const clean = id.trim().toLowerCase();
  return db.candidates.find(
    c => c.kandidat_id.toLowerCase() === clean ||
         c.nik.toLowerCase() === clean ||
         c.nomor_anggota.toLowerCase() === clean
  );
}

export function getConfig(): ElectionConfig {
  const db = getDatabase();
  return db.config;
}

export function updateConfig(newConfig: Partial<ElectionConfig>, adminEmail = 'admin'): ElectionConfig {
  const db = getDatabase();
  db.config = { ...db.config, ...newConfig };
  syncDivisionStats();
  saveDatabaseToFile();

  addAuditLog({
    user_email: adminEmail,
    user_role: 'SUPER_ADMIN',
    activity: 'UBAH_KONFIGURASI',
    details: `Konfigurasi sistem diperbarui: ${JSON.stringify(newConfig)}`,
    status: 'sukses'
  });

  return db.config;
}

export function getAdmins(): AdminUser[] {
  const db = getDatabase();
  return db.admins;
}

export function getAdminByEmail(email: string): AdminUser | undefined {
  const db = getDatabase();
  const clean = email.trim().toLowerCase();
  return db.admins.find(a => a.email.trim().toLowerCase() === clean);
}

export function getAuditLogs(): AuditLog[] {
  const db = getDatabase();
  return [...db.auditLogs].reverse();
}

export function addAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
  const db = getDatabase();
  const newLog: AuditLog = {
    id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...log
  };
  db.auditLogs.push(newLog);
  saveDatabaseToFile();
  return newLog;
}

export function getVotes(bagian_id?: string): VoteRecord[] {
  const db = getDatabase();
  if (bagian_id && bagian_id !== 'ALL') {
    return db.votes.filter(v => v.bagian_id === bagian_id);
  }
  return db.votes;
}

export function getTieBreaks(): TieBreakDecision[] {
  const db = getDatabase();
  return db.tieBreaks;
}

export function saveTieBreakDecision(decision: Omit<TieBreakDecision, 'id' | 'timestamp'>): TieBreakDecision {
  const db = getDatabase();
  const newDecision: TieBreakDecision = {
    id: `TIE-${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...decision
  };
  // Remove any previous decision for this division
  db.tieBreaks = db.tieBreaks.filter(t => t.bagian_id !== decision.bagian_id);
  db.tieBreaks.push(newDecision);
  saveDatabaseToFile();

  addAuditLog({
    user_email: decision.resolved_by,
    user_role: 'SUPER_ADMIN',
    activity: 'RESOLVE_TIE',
    details: `Keputusan Tie Break untuk Bagian ${decision.bagian_id}: Pemenang [${decision.winner_ids.join(', ')}]. Catatan: ${decision.catatan_keputusan}`,
    status: 'sukses'
  });

  return newDecision;
}

// Check Candidate Retirement Eligibility (< 4 years before retirement rule from PRD)
export function validateCandidatePensionEligibility(
  tanggal_pensiun?: string | null,
  batas_tahun: number = 4
): { eligible: boolean; yearsRemaining: number | null; reason: string } {
  if (!tanggal_pensiun) {
    return {
      eligible: true,
      yearsRemaining: null,
      reason: 'Tanggal pensiun tidak ditentukan (verifikasi manual panitia)'
    };
  }

  const pensionDate = new Date(tanggal_pensiun);
  if (isNaN(pensionDate.getTime())) {
    return {
      eligible: true,
      yearsRemaining: null,
      reason: 'Format tanggal pensiun tidak valid'
    };
  }

  const now = new Date();
  const diff = getExactPensionDiffServer(now, pensionDate);

  if (diff.isLessThan4Years) {
    return {
      eligible: false,
      yearsRemaining: diff.numericYears,
      reason: `Tidak memenuhi syarat: Waktu pensiun tersisa ${diff.text} (< ${batas_tahun} tahun menuju pensiun)`
    };
  }

  return {
    eligible: true,
    yearsRemaining: diff.numericYears,
    reason: `Memenuhi syarat: Waktu pensiun tersisa ${diff.text} (aman ≥ ${batas_tahun} tahun)`
  };
}

// Member Upsert & Bulk Import
export function upsertMembers(
  incomingMembers: Partial<Member>[],
  adminEmail: string = 'admin'
): { added: number; updated: number; errors: string[]; newDivisionsCreated?: string[] } {
  const db = getDatabase();
  let added = 0;
  let updated = 0;
  const errors: string[] = [];
  const newlyCreatedDivisions: string[] = [];

  incomingMembers.forEach((item, index) => {
    const rawNomorAnggota = (item.nomor_anggota || '').trim();
    const rawNama = (item.nama || '').trim();
    const rawEmail = (item.email || '').trim().toLowerCase();
    const rawBagian = (item.bagian_id || '').trim();
    const rawNik = (item.nik || '').trim().toUpperCase();

    if (!rawEmail || !rawNomorAnggota || !rawNama || !rawBagian) {
      errors.push(`Baris ${index + 1}: Data tidak lengkap (Nomor Anggota, Nama, Email, dan Bagian wajib diisi).`);
      return;
    }

    const emailClean = rawEmail;
    const nomorAnggotaClean = rawNomorAnggota.toUpperCase();

    const existingIndex = db.members.findIndex(
      m =>
        m.email.toLowerCase() === emailClean ||
        (m.nomor_anggota && m.nomor_anggota.toUpperCase() === nomorAnggotaClean) ||
        (rawNik && m.nik && m.nik.toUpperCase() === rawNik)
    );

    const inputBagianId = rawBagian;
    const inputNamaBagian = (item.nama_bagian || inputBagianId).trim();

    // Find division by ID or Name
    let div = db.divisions.find(
      d =>
        d.bagian_id.toLowerCase() === inputBagianId.toLowerCase() ||
        d.nama_bagian.toLowerCase() === inputBagianId.toLowerCase() ||
        `bagian ${d.nama_bagian.toLowerCase()}` === inputBagianId.toLowerCase() ||
        (item.nama_bagian && d.nama_bagian.toLowerCase() === item.nama_bagian.trim().toLowerCase()) ||
        (item.nama_bagian && `bagian ${d.nama_bagian.toLowerCase()}` === item.nama_bagian.trim().toLowerCase())
    );

    // Auto-create division in master data if not registered yet
    if (!div) {
      let maxBagianNum = 0;
      db.divisions.forEach(d => {
        const match = d.bagian_id.match(/^BAG-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxBagianNum) maxBagianNum = num;
        }
      });
      if (maxBagianNum === 0) {
        maxBagianNum = db.divisions.length;
      }

      const isBagCode = /^BAG-\d+$/i.test(inputBagianId);
      const isBagCodeTaken = db.divisions.some(d => d.bagian_id.toUpperCase() === inputBagianId.toUpperCase());

      const newBagianId = isBagCode && !isBagCodeTaken
        ? inputBagianId.toUpperCase()
        : `BAG-${String(maxBagianNum + 1).padStart(2, '0')}`;

      const newNamaBagian = inputNamaBagian || inputBagianId || newBagianId;

      const newDivision: Division = {
        bagian_id: newBagianId,
        nama_bagian: newNamaBagian,
        deskripsi: `Bagian terdaftar otomatis dari Import Master Anggota`,
        total_anggota: 0,
        kuota_perwakilan: 0,
        sudah_memilih: 0,
        belum_memilih: 0,
        partisipasi_persen: 0,
        manual_kuota: null,
        alasan_manual_kuota: ''
      };

      db.divisions.push(newDivision);
      div = newDivision;

      const divLabel = `${newNamaBagian} (${newBagianId})`;
      if (!newlyCreatedDivisions.includes(divLabel)) {
        newlyCreatedDivisions.push(divLabel);
      }
    }

    const resolvedBagianId = div.bagian_id;
    const resolvedNamaBagian = div.nama_bagian;

    if (existingIndex >= 0) {
      // Update
      const old = db.members[existingIndex];
      let tglLahir = item.tanggal_lahir !== undefined ? (item.tanggal_lahir ? parseDateToISO(item.tanggal_lahir) : null) : (old.tanggal_lahir ? parseDateToISO(old.tanggal_lahir) : null);
      let tglPensiun = item.tanggal_pensiun !== undefined ? (item.tanggal_pensiun ? parseDateToISO(item.tanggal_pensiun) : null) : (old.tanggal_pensiun ? parseDateToISO(old.tanggal_pensiun) : null);

      if (tglLahir) {
        const dob = new Date(`${tglLahir}T00:00:00`);
        if (!isNaN(dob.getTime())) {
          const pYear = dob.getFullYear() + RETIREMENT_AGE;
          const pMonth = String(dob.getMonth() + 1).padStart(2, '0');
          const pDay = String(dob.getDate()).padStart(2, '0');
          tglPensiun = `${pYear}-${pMonth}-${pDay}`;
        }
      }

      db.members[existingIndex] = {
        ...old,
        ...item,
        email: emailClean,
        nomor_anggota: nomorAnggotaClean,
        nik: item.nik !== undefined ? (item.nik ? item.nik.trim().toUpperCase() : '') : old.nik,
        nama: rawNama,
        bagian_id: resolvedBagianId,
        nama_bagian: resolvedNamaBagian,
        tanggal_lahir: tglLahir || null,
        tanggal_pensiun: tglPensiun || old.tanggal_pensiun || '2036-01-01',
        // Keep voting status unless explicitly provided
        status_memilih: item.status_memilih || old.status_memilih,
        hak_pilih: item.hak_pilih !== undefined ? item.hak_pilih : old.hak_pilih,
      };
      updated++;
    } else {
      // Insert
      const nomor_anggota = nomorAnggotaClean;
      let tglLahir = item.tanggal_lahir ? parseDateToISO(item.tanggal_lahir) : null;
      let tglPensiun = item.tanggal_pensiun ? parseDateToISO(item.tanggal_pensiun) : null;

      if (tglLahir) {
        const dob = new Date(`${tglLahir}T00:00:00`);
        if (!isNaN(dob.getTime())) {
          const pYear = dob.getFullYear() + RETIREMENT_AGE;
          const pMonth = String(dob.getMonth() + 1).padStart(2, '0');
          const pDay = String(dob.getDate()).padStart(2, '0');
          tglPensiun = `${pYear}-${pMonth}-${pDay}`;
        }
      }

      db.members.push({
        email: emailClean,
        nomor_anggota,
        nik: item.nik ? item.nik.trim().toUpperCase() : '',
        nama: rawNama,
        bagian_id: resolvedBagianId,
        nama_bagian: resolvedNamaBagian,
        status: item.status || 'AKTIF',
        hak_pilih: item.hak_pilih !== undefined ? item.hak_pilih : true,
        status_memilih: 'BELUM_MEMILIH',
        tanggal_lahir: tglLahir || null,
        tanggal_pensiun: tglPensiun || '2036-01-01',
        jabatan: item.jabatan || 'Anggota',
        telepon: item.telepon || '',
        created_at: new Date().toISOString()
      });
      added++;
    }
  });

  reEvaluateAllMembersPension();

  const divDetails = newlyCreatedDivisions.length > 0
    ? ` Bagian baru dibuat otomatis: ${newlyCreatedDivisions.join(', ')}.`
    : '';

  addAuditLog({
    user_email: adminEmail,
    user_role: 'SUPER_ADMIN',
    activity: 'IMPORT_ANGGOTA',
    details: `Import/Upsert anggota: ${added} ditambahkan, ${updated} diperbarui.${divDetails} Kesalahan: ${errors.length}`,
    status: errors.length > 0 && added === 0 && updated === 0 ? 'gagal' : 'sukses'
  });

  return { added, updated, errors, newDivisionsCreated: newlyCreatedDivisions };
}

// Candidate CRUD
export function upsertCandidate(candData: Partial<Candidate>, adminEmail = 'admin'): Candidate {
  const db = getDatabase();
  const config = db.config;
  const batas_tahun = config.batas_tahun_sebelum_pensiun || 4;

  const pengurusCheck = checkPengurusOrBPK(candData.jabatan);
  if (pengurusCheck.isPengurusBPK) {
    throw new Error(`Anggota tidak dapat dicalonkan karena menjabat sebagai ${pengurusCheck.label}. Sesuai aturan AD/ART, Pengurus dan BPK hanya memiliki Hak Memilih (Hak Pilih) dan tidak memiliki Hak Dipilih sebagai Perwakilan Anggota (Hanya Pemilih).`);
  }

  const validation = validateCandidatePensionEligibility(candData.tanggal_pensiun, batas_tahun);
  if (!validation.eligible) {
    throw new Error(`Anggota tidak dapat dicalonkan karena sisa masa pensiun kurang dari ${batas_tahun} tahun (usia 51 tahun ke atas). Sesuai aturan, anggota hanya memiliki Hak Memilih, bukan Hak Dipilih.`);
  }
  const memenuhi = candData.memenuhi_syarat !== undefined ? candData.memenuhi_syarat : validation.eligible;

  let cand: Candidate;
  const existingIdx = db.candidates.findIndex(c => c.kandidat_id === candData.kandidat_id);

  if (existingIdx >= 0) {
    cand = {
      ...db.candidates[existingIdx],
      ...candData,
      memenuhi_syarat: memenuhi,
      alasan_syarat: candData.alasan_syarat || validation.reason,
      tahun_menuju_pensiun: validation.yearsRemaining
    } as Candidate;
    db.candidates[existingIdx] = cand;
  } else {
    const nextId = `KAND-${String(db.candidates.length + 1).padStart(2, '0')}`;
    const div = db.divisions.find(d => d.bagian_id === candData.bagian_id);
    const maxNoUrut = db.candidates
      .filter(c => c.bagian_id === candData.bagian_id)
      .reduce((max, c) => Math.max(max, c.nomor_urut || 0), 0);

    cand = {
      kandidat_id: nextId,
      nik: candData.nik || '',
      nomor_anggota: candData.nomor_anggota || '',
      nama: candData.nama || '',
      bagian_id: candData.bagian_id || '',
      nama_bagian: div?.nama_bagian || candData.nama_bagian || '',
      status_kandidat: candData.status_kandidat || 'AKTIF',
      memenuhi_syarat: memenuhi,
      alasan_syarat: validation.reason,
      foto: candData.foto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
      nomor_urut: candData.nomor_urut || (maxNoUrut + 1),
      visi_misi: candData.visi_misi || '',
      tanggal_pensiun: candData.tanggal_pensiun || null,
      tahun_menuju_pensiun: validation.yearsRemaining
    };
    db.candidates.push(cand);
  }

  saveDatabaseToFile();

  addAuditLog({
    user_email: adminEmail,
    user_role: 'SUPER_ADMIN',
    activity: existingIdx >= 0 ? 'UBAH_KANDIDAT' : 'TAMBAH_KANDIDAT',
    details: `Kandidat ${cand.nama} (${cand.kandidat_id}) pada bagian ${cand.nama_bagian} disimpan. Status syarat: ${cand.memenuhi_syarat ? 'Ya' : 'Tidak'}`,
    status: 'sukses'
  });

  return cand;
}

export function deleteCandidate(kandidat_id: string, adminEmail = 'admin'): boolean {
  const db = getDatabase();
  const index = db.candidates.findIndex(c => c.kandidat_id === kandidat_id);
  if (index < 0) return false;
  const deleted = db.candidates.splice(index, 1)[0];
  saveDatabaseToFile();

  addAuditLog({
    user_email: adminEmail,
    user_role: 'SUPER_ADMIN',
    activity: 'HAPUS_KANDIDAT',
    details: `Kandidat ${deleted.nama} (${deleted.kandidat_id}) dihapus.`,
    status: 'sukses'
  });
  return true;
}

// Reset member voting status (Admin emergency/testing function with audit trail)
export function resetMemberVotingStatus(identifier: string, adminEmail = 'admin', reason = 'Testing / Reset manual'): { success: boolean; message?: string; memberName?: string } {
  const db = getDatabase();
  if (!identifier) return { success: false, message: 'Identifier anggota diperlukan.' };

  const clean = identifier.trim().toLowerCase();

  // Find member by email, NIK, nomor_anggota, or transaction_id
  let member = db.members.find(
    m => (m.email && m.email.trim().toLowerCase() === clean) ||
         (m.nik && m.nik.trim().toLowerCase() === clean) ||
         (m.nomor_anggota && m.nomor_anggota.trim().toLowerCase() === clean) ||
         (m.transaction_id && m.transaction_id.trim().toLowerCase() === clean)
  );

  if (!member) {
    // If not found directly on member, check db.votes by transaction_id or vote_id
    const matchedVote = db.votes.find(v => (v.transaction_id && v.transaction_id.toLowerCase() === clean) || (v.vote_id && v.vote_id.toLowerCase() === clean));
    if (matchedVote) {
      member = db.members.find(m => m.transaction_id === matchedVote.transaction_id);
    }
  }

  if (!member) {
    return { success: false, message: 'Anggota atau transaksi suara tidak ditemukan.' };
  }

  const oldTx = member.transaction_id;
  const memberEmail = member.email;
  const memberNik = member.nik;

  // Reset voting status to BELUM_MEMILIH
  member.status_memilih = 'BELUM_MEMILIH';
  member.voted_at = null;
  member.transaction_id = null;

  // Filter out/annul the vote transactions
  if (oldTx) {
    db.votes = db.votes.filter(v => v.transaction_id !== oldTx);
  }
  db.votes = db.votes.filter(v => 
    (!v.voter_email || v.voter_email.toLowerCase() !== memberEmail.toLowerCase()) &&
    (!v.voter_nik || v.voter_nik.toUpperCase() !== memberNik.toUpperCase())
  );

  syncDivisionStats();
  syncCandidatesWithMembers();
  saveDatabaseToFile();

  addAuditLog({
    user_email: adminEmail,
    user_role: 'SUPER_ADMIN',
    activity: 'RESET_STATUS_MEMILIH',
    details: `Status memilih untuk anggota ${member.nama} (NIK: ${member.nik || '-'}, Email: ${member.email}, Bagian: ${member.nama_bagian || member.bagian_id}) direset ke BELUM_MEMILIH. Transaksi [${oldTx || '-'}] dibatalkan. Alasan: ${reason}`,
    status: 'sukses'
  });

  return { success: true, memberName: member.nama, message: `Status memilih untuk ${member.nama} berhasil direset ke BELUM_MEMILIH.` };
}

// Reset ALL votes in the database (clear votes table & reset member status to BELUM_MEMILIH)
export function resetAllVotes(adminEmail = 'admin@kopsyah-ykk.id'): {
  success: boolean;
  totalVotesReset: number;
  totalMembersReset: number;
  message: string;
} {
  const db = getDatabase();
  const totalVotesReset = db.votes.length;
  let totalMembersReset = 0;

  // 1. Clear all vote records and locks
  db.votes = [];
  votingLocks.clear();

  // 2. Reset voting status for all members to BELUM_MEMILIH
  for (const m of db.members) {
    if (m.status_memilih === 'SUDAH_MEMILIH' || m.transaction_id || m.voted_at) {
      totalMembersReset++;
    }
    m.status_memilih = 'BELUM_MEMILIH';
    m.transaction_id = null;
    m.voted_at = null;
  }

  // 3. Clear tie-breaks and reset candidate vote accumulations
  db.tieBreaks = [];
  for (const c of db.candidates) {
    c.total_suara = 0;
    c.persentase_suara = 0;
  }

  // 4. Sync division stats and candidates
  syncDivisionStats();
  syncCandidatesWithMembers();
  saveDatabaseToFile();

  addAuditLog({
    user_email: adminEmail,
    user_role: 'SUPER_ADMIN',
    activity: 'RESET_SEMUA_SUARA',
    details: `Reset seluruh data suara berhasil: ${totalVotesReset} transaksi suara dihapus, status ${totalMembersReset} pemilih direset ke BELUM_MEMILIH, perolehan suara seluruh kandidat dikembalikan ke 0.`,
    status: 'sukses'
  });

  return {
    success: true,
    totalVotesReset,
    totalMembersReset,
    message: `Seluruh data suara dan hasil pemilihan berhasil di-reset.`
  };
}

// Verify Admin Password
export function verifyAdminPassword(password?: string): boolean {
  if (!password || typeof password !== 'string') return false;
  const clean = password.trim();
  if (!clean) return false;

  const validPasswords = [
    'admin',
    'admin123',
    'admin2026',
    'kopsyah123',
    'kopsyah2026',
    'panitia2026',
    'ykk2026',
    '123456',
    'password',
    'pass123',
    process.env.ADMIN_PASSWORD
  ].filter(Boolean) as string[];

  return validPasswords.some(p => p.toLowerCase() === clean.toLowerCase());
}

// Reset entire database to default seed
export function resetDatabaseToSeed(adminEmail = 'admin'): void {
  dbState = generateInitialSeed();
  saveDatabaseToFile();
  addAuditLog({
    user_email: adminEmail,
    user_role: 'SUPER_ADMIN',
    activity: 'RESET_DATABASE_SEED',
    details: 'Database telah direset ke data awal pengujian (seed data default).',
    status: 'sukses'
  });
}

// Clear all dummy data (members, candidates, votes, divisions) to prepare clean database for real inputs
export function clearDummyData(adminEmail = 'admin@kopsyah-ykk.id'): {
  success: boolean;
  message: string;
  cleared: {
    members: number;
    candidates: number;
    votes: number;
    divisions: number;
  };
} {
  const db = getDatabase();
  const cleared = {
    members: db.members.length,
    candidates: db.candidates.length,
    votes: db.votes.length,
    divisions: db.divisions.length
  };

  // 1. Clear sample members
  db.members = [];

  // 2. Clear sample candidates
  db.candidates = [];

  // 3. Clear votes and voting locks
  db.votes = [];
  votingLocks.clear();

  // 4. Clear sample divisions (will be auto-created during member import)
  db.divisions = [];

  // 5. Clear tie breaks
  db.tieBreaks = [];

  // 6. Ensure Super Admin / Committee accounts are preserved
  const defaultAdmins: AdminUser[] = [
    {
      id: 'ADM-01',
      email: 'admin@kopsyah-ykk.id',
      nama: 'Super Administrator Panitia',
      role: 'SUPER_ADMIN'
    },
    {
      id: 'ADM-02',
      email: 'panitia@kopsyah-ykk.id',
      nama: 'Ketua Panitia Pemilihan',
      role: 'ADMIN_PEMILIHAN'
    },
    {
      id: 'ADM-03',
      email: 'andikadix862@gmail.com',
      nama: 'Andika Pratama (Admin)',
      role: 'SUPER_ADMIN'
    }
  ];

  const adminMap = new Map<string, AdminUser>();
  defaultAdmins.forEach(a => adminMap.set(a.email.toLowerCase(), a));
  if (db.admins) {
    db.admins.forEach(a => adminMap.set(a.email.toLowerCase(), a));
  }
  db.admins = Array.from(adminMap.values());

  // 7. Reset Audit Log to a single clean initial audit log
  db.auditLogs = [
    {
      id: 'LOG-001',
      timestamp: new Date().toISOString(),
      user_email: adminEmail,
      user_role: 'SUPER_ADMIN',
      activity: 'PEMBERSIHAN_DATABASE',
      details: `Pembersihan database berhasil: ${cleared.members} anggota, ${cleared.candidates} kandidat, ${cleared.votes} suara, dan ${cleared.divisions} bagian telah dikosongkan. Database dalam kondisi bersih (0 data) dan siap untuk penginputan/import data baru.`,
      status: 'sukses'
    }
  ];

  saveDatabaseToFile();

  return {
    success: true,
    message: 'Database berhasil dikosongkan. Seluruh data anggota, kandidat, suara, dan bagian dummy telah dihapus. Akun Super Administrator tetap dipertahankan.',
    cleared
  };
}

// Get Dashboard Statistics
export function getDashboardStats(): DashboardStats {
  const db = getDatabase();
  syncDivisionStats();

  const total_anggota = db.members.length;
  const total_berhak_memilih = db.members.filter(m => m.hak_pilih).length;

  const validVotes = (db.votes || []).filter(v => v.status === 'VALID');
  const validTxSet = new Set(validVotes.map(v => v.transaction_id).filter(Boolean));

  for (const m of db.members) {
    if (m.transaction_id && validTxSet.has(m.transaction_id)) {
      m.status_memilih = 'SUDAH_MEMILIH';
    }
  }

  const sudahByMembers = db.members.filter(m => m.status_memilih === 'SUDAH_MEMILIH').length;
  const sudah_memilih = Math.max(sudahByMembers, validTxSet.size);

  const baseTotal = total_berhak_memilih > 0 ? total_berhak_memilih : total_anggota;
  const belum_memilih = Math.max(0, baseTotal - sudah_memilih);
  const partisipasi_persen = baseTotal > 0 ? Math.round((sudah_memilih / baseTotal) * 1000) / 10 : 0;

  const total_kandidat = db.candidates.filter(c => c.status_kandidat === 'AKTIF').length;
  const total_bagian = db.divisions.length;
  const total_kursi = db.divisions.reduce((sum, d) => sum + d.kuota_perwakilan, 0);

  return {
    total_anggota,
    total_berhak_memilih,
    sudah_memilih,
    belum_memilih,
    partisipasi_persen,
    total_kandidat,
    total_bagian,
    total_kursi,
    voting_status: db.config.voting_status,
    divisions_summary: db.divisions
  };
}

// Get Full Election Results by Division with Tie Detection & Resolution
export function calculateResults(): DivisionResult[] {
  const db = getDatabase();
  syncDivisionStats();
  syncCandidatesWithMembers();

  const results: DivisionResult[] = [];

  for (const div of db.divisions) {
    const candidatesInDiv = db.candidates.filter(c => c.bagian_id === div.bagian_id && c.status_kandidat === 'AKTIF');
    const votesInDiv = db.votes.filter(v => v.bagian_id === div.bagian_id && v.status === 'VALID');
    const totalVotesInDiv = votesInDiv.length;

    // Count votes per candidate
    const candidateResults: CandidateResult[] = candidatesInDiv.map(c => {
      const voteCount = votesInDiv.filter(v => v.candidate_id === c.kandidat_id).length;
      const percentage = totalVotesInDiv > 0 ? Math.round((voteCount / totalVotesInDiv) * 1000) / 10 : 0;
      return {
        kandidat_id: c.kandidat_id,
        nomor_urut: c.nomor_urut,
        nama: c.nama,
        nomor_anggota: c.nomor_anggota,
        bagian_id: c.bagian_id,
        nama_bagian: c.nama_bagian,
        foto: c.foto,
        total_suara: voteCount,
        persentase_suara: percentage,
        rank: 0,
        status_terpilih: 'TIDAK_TERPILIH',
        status_kursi: 'TIDAK_TERPILIH'
      };
    });

    // Sort by votes descending, then by candidate number ascending
    candidateResults.sort((a, b) => {
      if (b.total_suara !== a.total_suara) {
        return b.total_suara - a.total_suara;
      }
      return a.nomor_urut - b.nomor_urut;
    });

    // Assign rank (1, 2, 3, ...)
    candidateResults.forEach((c, idx) => {
      c.rank = idx + 1;
    });

    const kuota = div.kuota_perwakilan;
    let hasTie = false;
    const tieCandidates: Candidate[] = [];

    // Check tie at cutoff boundary
    // If kuota is K, we examine candidate at index K-1 vs K
    if (kuota > 0 && candidateResults.length > kuota && totalVotesInDiv > 0) {
      const cutoffCandidate = candidateResults[kuota - 1];
      const nextCandidate = candidateResults[kuota];

      if (cutoffCandidate.total_suara > 0 && cutoffCandidate.total_suara === nextCandidate.total_suara) {
        // TIE DETECTED
        hasTie = true;
        const tieVoteCount = cutoffCandidate.total_suara;
        const tiedResults = candidateResults.filter(c => c.total_suara === tieVoteCount);
        
        tiedResults.forEach(tr => {
          const original = db.candidates.find(c => c.kandidat_id === tr.kandidat_id);
          if (original) tieCandidates.push(original);
        });
      }
    }

    // Check if there is an official admin tie-break decision
    const tieDecision = db.tieBreaks.find(t => t.bagian_id === div.bagian_id);

    candidateResults.forEach((c, idx) => {
      // RULE: Kuota must be > 0, division must have votes, and candidate MUST have at least 1 vote (total_suara > 0)
      if (kuota <= 0 || totalVotesInDiv === 0 || c.total_suara <= 0) {
        c.status_terpilih = 'TIDAK_TERPILIH';
        c.status_kursi = 'TIDAK_TERPILIH';
        return;
      }

      if (hasTie) {
        const isTied = tieCandidates.some(tc => tc.kandidat_id === c.kandidat_id);
        if (isTied) {
          if (tieDecision && tieDecision.winner_ids.includes(c.kandidat_id)) {
            c.status_terpilih = 'TERPILIH';
            c.status_kursi = 'TERPILIH';
          } else if (tieDecision && !tieDecision.winner_ids.includes(c.kandidat_id)) {
            c.status_terpilih = 'TIDAK_TERPILIH';
            c.status_kursi = 'TIDAK_TERPILIH';
          } else {
            c.status_terpilih = 'TIE'; // PERLU KEPUTUSAN ADMIN
            c.status_kursi = 'TIE';
          }
        } else {
          const isElected = idx < kuota && c.total_suara > 0;
          c.status_terpilih = isElected ? 'TERPILIH' : 'TIDAK_TERPILIH';
          c.status_kursi = isElected ? 'TERPILIH' : 'TIDAK_TERPILIH';
        }
      } else {
        const isElected = idx < kuota && c.total_suara > 0;
        c.status_terpilih = isElected ? 'TERPILIH' : 'TIDAK_TERPILIH';
        c.status_kursi = isElected ? 'TERPILIH' : 'TIDAK_TERPILIH';
      }
    });

    results.push({
      bagian_id: div.bagian_id,
      nama_bagian: div.nama_bagian,
      total_anggota: div.total_anggota,
      kuota_kursi: div.kuota_perwakilan,
      total_suara_masuk: totalVotesInDiv,
      partisipasi_persen: div.partisipasi_persen,
      has_tie: hasTie && !tieDecision,
      has_tie_break: hasTie && !tieDecision,
      tie_candidates: tieCandidates,
      candidates: candidateResults
    });
  }

  return results;
}

export { votingLocks };
