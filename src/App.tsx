import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Award,
  Building2,
  Settings,
  ShieldCheck,
  FileText,
  Play,
  RotateCcw,
  Vote,
  LogOut,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Activity
} from 'lucide-react';

import { Navbar } from './components/Navbar';
import { LoginPage } from './components/LoginPage';
import { VoterDashboard } from './components/VoterDashboard';
import { VotingPage } from './components/VotingPage';
import { VotingSuccessPage } from './components/VotingSuccessPage';

import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminMembers } from './components/admin/AdminMembers';
import { AdminMemberImport } from './components/admin/AdminMemberImport';
import { AdminCandidates } from './components/admin/AdminCandidates';
import { AdminDivisions } from './components/admin/AdminDivisions';
import { AdminElectionConfig } from './components/admin/AdminElectionConfig';
import { AdminMonitoring } from './components/admin/AdminMonitoring';
import { AdminResults } from './components/admin/AdminResults';
import { AdminReportsExport } from './components/admin/AdminReportsExport';
import { AdminAuditLogs } from './components/admin/AdminAuditLogs';
import { AdminTestRunner } from './components/admin/AdminTestRunner';

import { api, SubmitVoteResponse, setStoredAdminAuth } from './services/api';
import { Member, AdminUser, ElectionConfig } from './types';
import { testFirestoreConnection } from './lib/firebase';

const DEFAULT_ELECTION_CONFIG: ElectionConfig = {
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
  deskripsi: 'Pemilihan Anggota Perwakilan KOPSYAH YKK AP Indonesia untuk masa bakti 2026-2029 sesuai prinsip LUBER & JURDIL.',
  lokasi: 'Cikarang / Sukabumi, Indonesia'
};

export function App() {
  const [userType, setUserType] = useState<'member' | 'admin' | null>(null);
  const [currentUser, setCurrentUser] = useState<Member | AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // App View routing: 'login' | 'voter-dashboard' | 'voting' | 'voting-success' | 'admin-portal'
  const [currentView, setCurrentView] = useState<string>('login');
  const [adminActiveTab, setAdminActiveTab] = useState<string>('dashboard');

  // Voting Result for Receipt
  const [lastVoteResult, setLastVoteResult] = useState<SubmitVoteResponse | null>(null);

  // Global Election Config with Fallback
  const [electionConfig, setElectionConfig] = useState<ElectionConfig>(DEFAULT_ELECTION_CONFIG);

  const refreshGlobalStats = async () => {
    try {
      const res = await api.getConfig();
      if (res && res.config) {
        setElectionConfig(res.config);
      }
    } catch {
      // ignore
    }
  };

  // Load config on mount & test Firestore connection
  useEffect(() => {
    let isMounted = true;
    testFirestoreConnection();
    const loadConfig = async () => {
      try {
        const res = await api.getConfig();
        if (isMounted && res && res.config) {
          setElectionConfig(res.config);
        }
      } catch (err) {
        console.warn('Gagal memuat konfigurasi server (menggunakan fallback default):', err);
      }
    };
    loadConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {

    // Check stored session and URL routing
    try {
      const savedUser = localStorage.getItem('kopsyah_user');
      const savedType = localStorage.getItem('kopsyah_type') as 'member' | 'admin' | null;
      const savedToken = localStorage.getItem('kopsyah_token');
      if (savedUser && savedType && savedToken) {
        const parsed = JSON.parse(savedUser);
        setCurrentUser(parsed);
        setUserType(savedType);
        setToken(savedToken);
        if (savedType === 'admin') {
          setStoredAdminAuth({
            email: parsed.email || 'admin@kopsyah-ykk.id',
            token: savedToken,
            nama: parsed.nama || 'Administrator',
            role: parsed.role || 'SUPER_ADMIN'
          });
        }
        setCurrentView(savedType === 'admin' ? 'admin-portal' : 'voter-dashboard');
      }
    } catch {
      // ignore
    }

    const handleRouteCheck = () => {
      const path = (window.location.pathname || '').toLowerCase();
      const hash = (window.location.hash || '').toLowerCase();
      const search = (window.location.search || '').toLowerCase();

      const isAdminRoute =
        path === '/admin' ||
        path.startsWith('/admin/') ||
        hash === '#admin' ||
        hash.startsWith('#admin') ||
        search.includes('admin');

      if (isAdminRoute) {
        const savedType = localStorage.getItem('kopsyah_type');
        if (savedType === 'admin') {
          setCurrentView('admin-portal');
        } else {
          setCurrentView('login');
        }
      }
    };

    handleRouteCheck();
    window.addEventListener('popstate', handleRouteCheck);
    window.addEventListener('hashchange', handleRouteCheck);

    return () => {
      window.removeEventListener('popstate', handleRouteCheck);
      window.removeEventListener('hashchange', handleRouteCheck);
    };
  }, []);

  const handleLoginSuccess = (user: any, type: 'member' | 'admin', sessionToken: string) => {
    setCurrentUser(user);
    setUserType(type);
    setToken(sessionToken);
    localStorage.setItem('kopsyah_user', JSON.stringify(user));
    localStorage.setItem('kopsyah_type', type);
    localStorage.setItem('kopsyah_token', sessionToken);

    if (type === 'admin') {
      setStoredAdminAuth({
        email: user.email || 'admin@kopsyah-ykk.id',
        token: sessionToken,
        nama: user.nama || 'Administrator',
        role: user.role || 'SUPER_ADMIN'
      });
      setCurrentView('admin-portal');
      setAdminActiveTab('dashboard');
    } else {
      setCurrentView('voter-dashboard');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setUserType(null);
    setToken(null);
    localStorage.removeItem('kopsyah_user');
    localStorage.removeItem('kopsyah_type');
    localStorage.removeItem('kopsyah_token');
    setStoredAdminAuth(null);
    api.logoutAdmin();
    setCurrentView('login');
  };

  const handleStartVoting = () => {
    if (currentUser && userType === 'member' && (currentUser as Member).status_memilih === 'SUDAH_MEMILIH') {
      setCurrentView('voting-success');
      return;
    }
    setCurrentView('voting');
  };

  const handleVoteSuccess = (result: SubmitVoteResponse) => {
    setLastVoteResult(result);
    // update local member status
    if (currentUser && userType === 'member') {
      const updatedMember = {
        ...(currentUser as Member),
        status_memilih: 'SUDAH_MEMILIH' as const,
        transaction_id: result.transaction_id,
        voted_at: result.timestamp
      };
      setCurrentUser(updatedMember);
      localStorage.setItem('kopsyah_user', JSON.stringify(updatedMember));
    }
    setCurrentView('voting-success');
  };

  const handleViewReceipt = () => {
    setCurrentView('voting-success');
  };

  const handleBackToDashboard = () => {
    setCurrentView('voter-dashboard');
  };

  // 10 MANDATORY ADMIN MENUS (strictly structured as ordered by user)
  const adminTabs = [
    { id: 'dashboard', label: '1. Dashboard Admin', icon: LayoutDashboard },
    { id: 'members', label: '2. Data Anggota', icon: Users },
    { id: 'import', label: '3. Import Anggota', icon: FileSpreadsheet },
    { id: 'divisions', label: '4. Data Bagian', icon: Building2 },
    { id: 'candidates', label: '5. Data Kandidat', icon: Vote },
    { id: 'config', label: '6. Pengaturan Pemilihan', icon: Settings },
    { id: 'monitoring', label: '7. Monitoring Pemilihan', icon: Activity },
    { id: 'results', label: '8. Hasil Pemilihan', icon: Award },
    { id: 'reports', label: '9. Laporan Pemilihan', icon: FileText },
    { id: 'audit', label: '10. Audit Log', icon: ShieldCheck },
    { id: 'tests', label: 'Uji Sistem Otomatis', icon: Play }
  ];

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-gray-800 flex flex-col font-sans selection:bg-[#1E3A8A] selection:text-white">
      {/* Top Navigation */}
      <Navbar
        currentUser={currentUser}
        userType={userType}
        votingStatus={electionConfig?.voting_status || 'AKTIF'}
        onLogout={handleLogout}
        onNavigate={view => {
          if (view === 'admin-dashboard') {
            setCurrentView('admin-portal');
          } else if (view === 'voter-dashboard') {
            setCurrentView('voter-dashboard');
          }
        }}
        currentView={currentView}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {/* VIEW: LOGIN */}
        {currentView === 'login' && (
          <LoginPage onLoginSuccess={handleLoginSuccess} />
        )}

        {/* VIEW: VOTER DASHBOARD */}
        {currentView === 'voter-dashboard' && currentUser && userType === 'member' && (
          <VoterDashboard
            memberEmail={(currentUser as Member).email}
            onStartVoting={handleStartVoting}
            onViewReceipt={handleViewReceipt}
            onLogout={handleLogout}
          />
        )}

        {/* VIEW: VOTING SELECTION */}
        {currentView === 'voting' && currentUser && userType === 'member' && (
          (currentUser as Member).status_memilih === 'SUDAH_MEMILIH' ? (
            <VotingSuccessPage
              member={currentUser as Member}
              voteResult={lastVoteResult}
              onBackToDashboard={handleBackToDashboard}
            />
          ) : (
            <VotingPage
              member={currentUser as Member}
              onBack={handleBackToDashboard}
              onVoteSuccess={handleVoteSuccess}
            />
          )
        )}

        {/* VIEW: VOTING SUCCESS RECEIPT */}
        {currentView === 'voting-success' && currentUser && userType === 'member' && (
          <VotingSuccessPage
            member={currentUser as Member}
            voteResult={lastVoteResult}
            onBackToDashboard={handleBackToDashboard}
          />
        )}

        {/* VIEW: ADMIN PORTAL */}
        {currentView === 'admin-portal' && currentUser && userType === 'admin' && (
          <div className="max-w-7xl mx-auto py-6 sm:py-8 px-4 sm:px-6 lg:px-8 space-y-6">
            {/* Admin Sub-navigation Header Grid (2 rows layout) */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs p-2">
              <nav className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5">
                {adminTabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = adminActiveTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      id={`tab-admin-${tab.id}`}
                      onClick={() => setAdminActiveTab(tab.id)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center text-center gap-1.5 ${
                        isActive
                          ? 'bg-[#1E3A8A] text-white shadow-xs ring-1 ring-[#1E3A8A]'
                          : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100 bg-gray-50/80 border border-gray-200/60'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Admin Tab View Routing */}
            {(() => {
              const currentAdminEmail =
                (currentUser as AdminUser)?.email ||
                (userType === 'admin' ? (currentUser as any)?.email : '') ||
                'admin@kopsyah-ykk.id';

              return (
                <div>
                  {/* 1. Dashboard Admin */}
                  {adminActiveTab === 'dashboard' && (
                    <AdminDashboard
                      adminEmail={currentAdminEmail}
                      onNavigateTab={tab => setAdminActiveTab(tab)}
                    />
                  )}

                  {/* 2. Data Anggota */}
                  {adminActiveTab === 'members' && (
                    <AdminMembers
                      adminEmail={currentAdminEmail}
                      onNavigateToImport={() => setAdminActiveTab('import')}
                      onRefreshData={refreshGlobalStats}
                    />
                  )}

                  {/* 3. Import Anggota */}
                  {adminActiveTab === 'import' && (
                    <AdminMemberImport
                      adminEmail={currentAdminEmail}
                      onNavigateToMembers={() => setAdminActiveTab('members')}
                    />
                  )}

                  {/* 4. Data Bagian */}
                  {adminActiveTab === 'divisions' && (
                    <AdminDivisions adminEmail={currentAdminEmail} />
                  )}

                  {/* 5. Data Kandidat */}
                  {adminActiveTab === 'candidates' && (
                    <AdminCandidates adminEmail={currentAdminEmail} />
                  )}

                  {/* 6. Pengaturan Pemilihan */}
                  {adminActiveTab === 'config' && (
                    <AdminElectionConfig
                      adminEmail={currentAdminEmail}
                      onConfigUpdated={cfg => setElectionConfig(cfg)}
                    />
                  )}

                  {/* 7. Monitoring Pemilihan */}
                  {adminActiveTab === 'monitoring' && (
                    <AdminMonitoring onRefreshData={refreshGlobalStats} />
                  )}

                  {/* 8. Hasil Pemilihan */}
                  {adminActiveTab === 'results' && (
                    <AdminResults
                      adminEmail={currentAdminEmail}
                      onRefreshData={refreshGlobalStats}
                    />
                  )}

                  {/* 9. Laporan Pemilihan */}
                  {adminActiveTab === 'reports' && <AdminReportsExport />}

                  {/* 10. Audit Log */}
                  {adminActiveTab === 'audit' && <AdminAuditLogs />}

                  {/* Uji Sistem Otomatis */}
                  {adminActiveTab === 'tests' && <AdminTestRunner />}
                </div>
              );
            })()}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

