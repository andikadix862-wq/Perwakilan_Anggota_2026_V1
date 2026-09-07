import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock
} from 'lucide-react';
import { api } from '../../services/api';
import { AuditLog } from '../../types';
import { exportToExcel } from '../../utils/exportUtils';

export const AdminAuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.getAuditLogs();
      setLogs(res.logs || []);
    } catch (err: any) {
      alert(err.message || 'Gagal memuat log audit.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchStatus = filterStatus === 'ALL' || log.status === filterStatus;
    const matchSearch =
      search === '' ||
      log.user_email?.toLowerCase().includes(search.toLowerCase()) ||
      log.event_type?.toLowerCase().includes(search.toLowerCase()) ||
      JSON.stringify(log.details || {}).toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const handleExportLogs = () => {
    if (logs.length === 0) return;
    
    const exportData = logs.map(l => ({
      'ID Log': l.id,
      'Waktu (Timestamp)': l.timestamp,
      'Tipe Event': l.event_type,
      'Email User': l.user_email,
      'Role': l.role,
      'Status': l.status,
      'IP Address': l.ip_address,
      'Rincian Detail': JSON.stringify(l.details || {})
    }));

    exportToExcel({
      filename: `Audit_Logs_Pemilihan_${new Date().getFullYear()}.xlsx`,
      sheetName: 'Audit Logs',
      data: exportData
    });
  };

  return (
    <div id="admin-audit-logs-view" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#1E3A8A] border border-blue-200">
              Audit & Keamanan
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
            Jejak Audit & Keamanan Sistem
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Pencatatan mutlak seluruh aktivitas autentikasi, voting elektronik, dan intervensi admin.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-300 text-xs font-bold uppercase tracking-wider text-gray-700 transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan Log</span>
          </button>

          <button
            onClick={handleExportLogs}
            className="px-3.5 py-2 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ekspor Log Excel</span>
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-8 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari event, email pengguna, detail aktivitas..."
            className="w-full h-10 pl-9 pr-3 text-xs rounded-xl border border-gray-300 focus:border-blue-700 outline-hidden font-medium"
          />
        </div>

        <div className="sm:col-span-4">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="w-full h-10 px-3 text-xs rounded-xl border border-gray-300 focus:border-blue-700 outline-hidden bg-white font-medium"
          >
            <option value="ALL">Semua Status Keamanan</option>
            <option value="SUCCESS">SUCCESS (Berhasil Normal)</option>
            <option value="FAILED">FAILED (Gagal / Pelanggaran)</option>
            <option value="WARNING">WARNING (Peringatan)</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3 px-4 sm:px-6">Waktu (WIB)</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Pengguna</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 sm:px-6">Rincian / Parameter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    Memuat log aktivitas...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    Tidak ada log audit yang cocok.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const date = new Date(log.timestamp).toLocaleString('id-ID', {
                    dateStyle: 'short',
                    timeStyle: 'medium'
                  });

                  return (
                    <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-4 sm:px-6 whitespace-nowrap font-mono text-[11px] text-gray-500">
                        {date}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold font-mono text-[#1E3A8A] text-[11px] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                          {log.event_type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900 truncate max-w-[160px]">{log.user_email}</div>
                        <div className="text-[10px] text-gray-400 font-mono">Role: {log.role}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            log.status === 'SUCCESS'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                              : log.status === 'FAILED'
                              ? 'bg-rose-50 text-rose-800 border border-rose-300'
                              : 'bg-amber-50 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {log.status === 'SUCCESS' ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                          )}
                          <span>{log.status}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 sm:px-6 text-[11px] font-mono text-gray-600 max-w-xs break-all">
                        {JSON.stringify(log.details || {})}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
