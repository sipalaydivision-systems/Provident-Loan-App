'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminAPI, importAPI } from '../../lib/api';

// ── types ──────────────────────────────────────────────────────────────────
interface ReportRow {
  station: string;
  employee_number: string;
  name: string;
  loan_application_date: string;
  check_number: string;
  check_date: string;
  effective_date: string;
  loan_amount: number | string;
  no_of_months: number | string;
  monthly_amortization: number | string;
  termination_date: string;
  no_of_months_paid: number;
  loan_balance: number | string;
  status: string;
  remarks: string;
  notes: string;
}

// ── helpers ────────────────────────────────────────────────────────────────
const peso = (v: number | string) =>
  v === '' || v === null || v === undefined
    ? '—'
    : Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function statusStyle(status: string): string {
  const s = (status || '').toUpperCase();
  if (s.includes('QUALIFIED')) return 'bg-green-600 text-white';
  if (s === 'ACTIVE') return 'bg-green-500 text-white';
  if (s.includes('FULLY') || s.includes('PAID')) return 'bg-blue-600 text-white';
  if (s.includes('RENEW')) return 'bg-yellow-500 text-black';
  if (s === 'NO LOAN') return 'bg-gray-400 text-white';
  return 'bg-red-600 text-white';
}

// ── component ──────────────────────────────────────────────────────────────
export default function LoanSummaryReport() {
  const router = useRouter();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [token, setToken] = useState('');

  // Import state
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/admin/login'); return; }
    const t = localStorage.getItem('token') || '';
    setToken(t);
    fetchReport();
  }, [router]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.report.getLoanSummary();
      setRows(res.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  // ── filter ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.employee_number.includes(q) ||
        r.station.includes(q) ||
        (r.status || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  // ── split into sections ─────────────────────────────────────────────────
  const activeRows = filtered.filter(
    (r) =>
      r.status &&
      !r.status.toUpperCase().includes('FULLY') &&
      r.status !== 'NO LOAN'
  );
  const dischargedRows = filtered.filter(
    (r) =>
      !r.status ||
      r.status.toUpperCase().includes('FULLY') ||
      r.status === 'NO LOAN'
  );

  // ── totals ──────────────────────────────────────────────────────────────
  const totalLoanAmount = activeRows.reduce((s, r) => s + (Number(r.loan_amount) || 0), 0);
  const totalBalance    = activeRows.reduce((s, r) => s + (Number(r.loan_balance) || 0), 0);
  const totalMonthly    = activeRows.reduce((s, r) => s + (Number(r.monthly_amortization) || 0), 0);

  // ── CSV download (direct link with token in header via fetch+blob) ───────
  const handleCsvDownload = async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const res = await fetch(`${baseUrl}/admin/report/loan-summary/csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `provident-loan-summary-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('CSV export failed. Please try again.');
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await importAPI.importFile(importFile);
      setImportResult({ success: true, ...res.data });
      fetchReport(); // refresh the table with newly imported data
    } catch (err: any) {
      setImportResult({
        success: false,
        message: err.response?.data?.error || err.response?.data?.message || 'Import failed',
        errors: err.response?.data?.errors || [],
      });
    } finally {
      setImporting(false);
    }
  };

  const closeImport = () => {
    setImportOpen(false);
    setImportFile(null);
    setImportResult(null);
  };

  // ── render ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading report…</p>
        </div>
      </div>
    );
  }

  const COL_WIDTHS = [
    'w-8',   // #
    'w-14',  // Station
    'w-24',  // Emp No
    'w-44',  // Name
    'w-24',  // App Date
    'w-20',  // Check No
    'w-20',  // Check Date
    'w-24',  // Effective Date
    'w-28',  // Loan Amount
    'w-12',  // Months
    'w-28',  // Monthly Amor
    'w-24',  // Termination
    'w-12',  // Months Paid
    'w-28',  // Balance
    'w-40',  // Status
    'w-28',  // Remarks
    'w-24',  // Notes
  ];

  const TH = ({ children, cls = '' }: { children: React.ReactNode; cls?: string }) => (
    <th className={`px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide border border-slate-300 bg-slate-700 text-white whitespace-nowrap ${cls}`}>
      {children}
    </th>
  );

  const TD = ({ children, cls = '', right = false }: { children: React.ReactNode; cls?: string; right?: boolean }) => (
    <td className={`px-2 py-1 text-[11px] border border-slate-200 ${right ? 'text-right' : 'text-left'} ${cls}`}>
      {children}
    </td>
  );

  const renderRows = (list: ReportRow[], offset = 0) =>
    list.map((r, i) => (
      <tr key={r.employee_number + i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
        <TD cls="text-center text-slate-400">{offset + i + 1}</TD>
        <TD cls="text-center font-mono">{r.station}</TD>
        <TD cls="font-mono">{r.employee_number}</TD>
        <TD cls="font-medium">{r.name}</TD>
        <TD>{r.loan_application_date}</TD>
        <TD cls="font-mono">{r.check_number}</TD>
        <TD>{r.check_date}</TD>
        <TD>{r.effective_date}</TD>
        <TD right>{r.loan_amount !== '' ? peso(r.loan_amount) : '—'}</TD>
        <TD cls="text-center">{r.no_of_months !== '' ? r.no_of_months : '—'}</TD>
        <TD right>{r.monthly_amortization !== '' ? peso(r.monthly_amortization) : '—'}</TD>
        <TD>{r.termination_date}</TD>
        <TD cls="text-center">{r.no_of_months_paid}</TD>
        <TD right cls="font-semibold">{r.loan_balance !== '' ? peso(r.loan_balance) : '—'}</TD>
        <TD>
          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${statusStyle(r.status)}`}>
            {r.status || '—'}
          </span>
        </TD>
        <TD cls="text-slate-500 italic">{r.remarks}</TD>
        <TD cls="text-slate-500">{r.notes}</TD>
      </tr>
    ));

  return (
    <div className="min-h-screen bg-slate-100">
      {/* ── top bar ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-full px-4 py-3 flex items-center gap-4">
          <Link href="/admin/dashboard" className="text-slate-500 hover:text-slate-800 text-sm flex items-center gap-1">
            ← Dashboard
          </Link>

          <div className="flex-1 text-center">
            <h1 className="text-base font-bold text-slate-800 uppercase tracking-widest">
              PROVIDENT LOAN FUND
            </h1>
            <p className="text-[11px] text-slate-500">Loan Summary Report</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search name, emp no, status…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm border border-slate-300 rounded px-3 py-1.5 w-56 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleCsvDownload}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-1.5 rounded shadow transition"
            >
              ↓ Export CSV
            </button>
            <button
              onClick={() => { setImportOpen(true); setImportFile(null); setImportResult(null); }}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded shadow transition"
            >
              ↑ Import Summary
            </button>
          </div>
        </div>
      </header>

      {/* ── Import Modal ── */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Import Provident Fund Summary</h2>
              <p className="text-sm text-slate-500 mt-1">
                Upload your PDF or CSV summary file. All employees and loan data will be imported and immediately reflected in Employee Management, Loan Management, and Payments.
              </p>
            </div>

            {!importResult ? (
              <>
                {/* Drop zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setImportFile(f); }}
                  className="border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-lg p-8 text-center cursor-pointer transition"
                >
                  <div className="text-3xl mb-2">📄</div>
                  {importFile ? (
                    <div>
                      <p className="font-semibold text-slate-700 text-sm">{importFile.name}</p>
                      <p className="text-xs text-slate-400 mt-1">{(importFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-slate-600">Click or drag & drop your file here</p>
                      <p className="text-xs text-slate-400 mt-1">PDF or CSV — Provident Fund Summary format</p>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept=".pdf,.csv" className="hidden"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
                </div>

                <div className="flex justify-end gap-2">
                  <button onClick={closeImport} className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-600 hover:bg-slate-50 transition">
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={!importFile || importing}
                    className="px-5 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold transition flex items-center gap-2"
                  >
                    {importing && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {importing ? 'Importing…' : 'Import'}
                  </button>
                </div>
              </>
            ) : (
              <>
                {importResult.success ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                    <p className="font-semibold text-green-700">✓ Import successful</p>
                    <ul className="text-sm text-green-700 space-y-0.5">
                      <li>• {importResult.created} employees created</li>
                      <li>• {importResult.updated} employees updated</li>
                      {importResult.loansCreated > 0 && (
                        <li>• {importResult.loansCreated} loans created</li>
                      )}
                      {importResult.loansUpdated > 0 && (
                        <li>• {importResult.loansUpdated} loans updated</li>
                      )}
                      {importResult.ledgerCreated > 0 && (
                        <li>• {importResult.ledgerCreated} payment records added</li>
                      )}
                    </ul>
                    <p className="text-xs text-green-600 mt-1">
                      Data is now available in Employee Management, Loan Management, and Payments.
                    </p>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="font-semibold text-red-700">✗ {importResult.message}</p>
                  </div>
                )}

                {importResult.errors?.length > 0 && (
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    <p className="text-xs font-medium text-slate-500">Row errors ({importResult.errors.length}):</p>
                    {importResult.errors.map((e: any, i: number) => (
                      <p key={i} className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                        Row {e.row} ({e.employee}): {e.error}
                      </p>
                    ))}
                  </div>
                )}

                <div className="flex justify-end">
                  <button onClick={closeImport} className="px-5 py-2 text-sm rounded bg-slate-700 hover:bg-slate-800 text-white font-semibold transition">
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
      )}

      {/* ── summary cards ── */}
      <div className="px-4 pt-4 pb-2 flex gap-3 flex-wrap">
        {[
          { label: 'Active Borrowers', value: activeRows.length, color: 'text-blue-700' },
          { label: 'Total Loan Amount', value: `₱ ${totalLoanAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, color: 'text-green-700' },
          { label: 'Total Remaining Balance', value: `₱ ${totalBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, color: 'text-orange-600' },
          { label: 'Total Monthly Amortization', value: `₱ ${totalMonthly.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, color: 'text-purple-700' },
          { label: 'Discharged / No Loan', value: dischargedRows.length, color: 'text-slate-500' },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-lg border border-slate-200 px-4 py-2 shadow-sm min-w-[180px]">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">{c.label}</p>
            <p className={`text-sm font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* ── table ── */}
      <div className="px-4 pb-8 overflow-x-auto">
        <table className="border-collapse text-left w-full min-w-[1400px] shadow-sm">
          <thead>
            <tr>
              <TH>#</TH>
              <TH>Station</TH>
              <TH>Employee Number</TH>
              <TH>Name of Employee</TH>
              <TH>Loan Application Date</TH>
              <TH>Check No.</TH>
              <TH>Check Date</TH>
              <TH>Effective Date</TH>
              <TH>Loan Amount</TH>
              <TH>No. of Months</TH>
              <TH>Monthly Amortization</TH>
              <TH>Termination Date</TH>
              <TH>No. of Months Paid</TH>
              <TH>Loan Balance</TH>
              <TH>Status</TH>
              <TH>Remarks</TH>
              <TH>Notes</TH>
            </tr>
          </thead>

          <tbody>
            {activeRows.length === 0 && dischargedRows.length === 0 && (
              <tr>
                <td colSpan={17} className="text-center py-8 text-slate-400 text-sm">
                  No records found.
                </td>
              </tr>
            )}

            {/* active / qualified section */}
            {renderRows(activeRows, 0)}

            {/* totals row */}
            {activeRows.length > 0 && (
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                <td colSpan={8} className="px-2 py-1.5 text-[11px] border border-slate-300 text-right text-slate-600 uppercase tracking-wide">
                  Totals
                </td>
                <td className="px-2 py-1 text-[11px] text-right border border-slate-300 text-green-700">
                  {peso(totalLoanAmount)}
                </td>
                <td className="border border-slate-300" />
                <td className="px-2 py-1 text-[11px] text-right border border-slate-300 text-purple-700">
                  {peso(totalMonthly)}
                </td>
                <td className="border border-slate-300" />
                <td className="border border-slate-300" />
                <td className="px-2 py-1 text-[11px] text-right border border-slate-300 text-orange-600">
                  {peso(totalBalance)}
                </td>
                <td colSpan={3} className="border border-slate-300" />
              </tr>
            )}

            {/* discharges section header */}
            {dischargedRows.length > 0 && (
              <>
                <tr>
                  <td
                    colSpan={17}
                    className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest bg-red-600 text-white border border-red-700"
                  >
                    DISCHARGES
                  </td>
                </tr>
                {renderRows(dischargedRows, activeRows.length)}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
