'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { adminAPI, importAPI } from '../../../lib/api';

// ── types ──────────────────────────────────────────────────────────────────
interface Employee {
  id: number;
  employee_number: string;
  station: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  position: string;
  department: string;
  status: string;
}

interface LedgerEntry {
  id: number;
  loan_id: number;
  employee_number: string;
  payment_date: string;
  date_of_deduction: string;
  payment_with_interest: number | null;
  principal_payments: number | null;
  paid_status: boolean | null;
  paid_months: number | null;
  monthly_payment_amount: number | null;
  balance: number | null;
  amount_paid: number;
  previous_balance: number | null;
  new_balance: number | null;
  reference_number: string;
  notes: string;
  recorded_by: string;
  created_at: string;
}

interface Loan {
  id: number;
  employee_number: string;
  loan_amount: number;
  no_of_months: number;
  monthly_amortization: number;
  loan_application_date: string | null;
  check_number: string | null;
  check_date: string | null;
  effective_date: string | null;
  termination_date: string | null;
  loan_balance: number;
  no_of_months_paid: number;
  status: string;
  remarks: string | null;
  notes: string | null;
  interest_rate: number;
  ledger_entries: LedgerEntry[];
}

// ── helpers ────────────────────────────────────────────────────────────────
const peso = (v: number | string | null | undefined): string => {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (isNaN(n)) return '';
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleString('en-PH', { month: 'long', year: 'numeric' });
};

const fmtDateShort = (d: string | null | undefined): string => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return `${String(dt.getMonth() + 1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}/${dt.getFullYear()}`;
};

// ── component ──────────────────────────────────────────────────────────────
export default function EmployeeLedgerPage() {
  const router = useRouter();
  const params = useParams();
  const employeeNumber = params?.employeeNumber as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeLoanId, setActiveLoanId] = useState<number | null>(null);

  // ── bulk selection ─────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  // ── record payment modal ───────────────────────────────────────────────
  const [payModal, setPayModal] = useState(false);
  const [payLoanId, setPayLoanId] = useState<number | null>(null);
  const [payForm, setPayForm] = useState({
    amount_paid: '',
    payment_date: new Date().toISOString().slice(0, 10),
    reference_number: '',
    notes: '',
  });
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState('');

  // ── edit ledger entry modal ────────────────────────────────────────────
  const [editEntry, setEditEntry] = useState<LedgerEntry | null>(null);
  const [editForm, setEditForm] = useState({ amount_paid: '', payment_date: '', reference_number: '', notes: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  // ── delete single entry ────────────────────────────────────────────────
  const [deleteEntryId, setDeleteEntryId] = useState<number | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // ── import ─────────────────────────────────────────────────────────────
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── toast ──────────────────────────────────────────────────────────────
  const [toast, setToast] = useState('');
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    if (!localStorage.getItem('user')) { router.push('/admin/login'); return; }
    if (employeeNumber) fetchLedger();
  }, [employeeNumber]);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await (adminAPI as any).employeeLedger.get(employeeNumber);
      const { employee: emp, loans: lns } = res.data.data;
      setEmployee(emp);
      setLoans(lns || []);
      if (lns && lns.length > 0) setActiveLoanId(prev => prev ?? lns[0].id);
      setSelected(new Set());
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  };

  const activeLoan = loans.find(l => l.id === activeLoanId) ?? loans[0] ?? null;
  const fullName = employee
    ? [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(' ')
    : '';
  const fullNameDisplay = employee
    ? `${employee.last_name}, ${employee.first_name}${employee.middle_name ? ' ' + employee.middle_name : ''}`
    : '';

  // ── record payment ─────────────────────────────────────────────────────
  const openPayModal = (loanId: number) => {
    setPayLoanId(loanId);
    setPayForm({ amount_paid: '', payment_date: new Date().toISOString().slice(0, 10), reference_number: '', notes: '' });
    setPayError('');
    setPayModal(true);
  };

  const submitPayment = async () => {
    if (!payLoanId || !payForm.amount_paid) { setPayError('Amount is required.'); return; }
    setPaySubmitting(true);
    setPayError('');
    try {
      await (adminAPI as any).ledger.recordPayment({
        employee_number: employeeNumber,
        loan_id: payLoanId,
        amount_paid: parseFloat(payForm.amount_paid),
        payment_date: payForm.payment_date,
        reference_number: payForm.reference_number,
        notes: payForm.notes,
      });
      setPayModal(false);
      showToast('Payment recorded.');
      fetchLedger();
    } catch (err: any) {
      setPayError(err.response?.data?.message || 'Failed to record payment.');
    } finally {
      setPaySubmitting(false);
    }
  };

  // ── edit entry ─────────────────────────────────────────────────────────
  const openEditEntry = (entry: LedgerEntry) => {
    setEditEntry(entry);
    setEditForm({
      amount_paid: String(entry.amount_paid),
      payment_date: entry.payment_date ? entry.payment_date.slice(0, 10) : '',
      reference_number: entry.reference_number || '',
      notes: entry.notes || '',
    });
    setEditError('');
  };

  const submitEditEntry = async () => {
    if (!editEntry) return;
    setEditSubmitting(true);
    setEditError('');
    try {
      await (adminAPI as any).ledger.update(editEntry.id, {
        amount_paid: parseFloat(editForm.amount_paid),
        payment_date: editForm.payment_date,
        reference_number: editForm.reference_number,
        notes: editForm.notes,
      });
      setEditEntry(null);
      showToast('Entry updated.');
      fetchLedger();
    } catch (err: any) {
      setEditError(err.response?.data?.message || 'Failed to update entry.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // ── delete single ──────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteEntryId) return;
    setDeleteSubmitting(true);
    try {
      await (adminAPI as any).ledger.delete(deleteEntryId);
      setDeleteEntryId(null);
      showToast('Entry deleted.');
      fetchLedger();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete entry.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // ── bulk selection ─────────────────────────────────────────────────────
  const toggleSelect = (id: number) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleSelectAll = () => {
    if (!activeLoan) return;
    const ids = activeLoan.ledger_entries.map(e => e.id);
    setSelected(prev => prev.size === ids.length ? new Set() : new Set(ids));
  };
  const confirmBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      await (adminAPI as any).ledger.bulkDelete(Array.from(selected));
      setSelected(new Set());
      setShowBulkConfirm(false);
      showToast(`${selected.size} entries deleted.`);
      fetchLedger();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Bulk delete failed.');
    } finally {
      setBulkDeleting(false);
    }
  };

  // ── import ─────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await importAPI.importFile(importFile);
      setImportResult({ success: true, ...res.data });
      fetchLedger();
    } catch (err: any) {
      setImportResult({ success: false, message: err.response?.data?.error || err.response?.data?.message || 'Import failed' });
    } finally {
      setImporting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ── shared input style ─────────────────────────────────────────────────
  const inp = 'w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:border-blue-500';
  const lbl = 'block text-[11px] font-medium text-slate-500 mb-0.5';

  // Column widths matching the Google Sheet layout
  const TH = ({ children, right = false, w = '' }: { children: React.ReactNode; right?: boolean; w?: string }) => (
    <th className={`px-2 py-1.5 text-[10px] font-bold uppercase border border-slate-400 bg-slate-200 text-slate-700 whitespace-nowrap ${right ? 'text-right' : 'text-center'} ${w}`}>
      {children}
    </th>
  );

  return (
    <div className="min-h-screen bg-slate-100">

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm print:hidden">
        <div className="max-w-full px-4 py-3 flex items-center gap-3 flex-wrap">
          <Link href="/admin/employees" className="text-slate-500 hover:text-slate-800 text-sm">← Accounts</Link>
          <span className="text-slate-300">|</span>
          <Link href="/admin/report" className="text-slate-400 hover:text-slate-700 text-sm">Report</Link>
          <span className="text-slate-300">|</span>
          <Link href="/admin/dashboard" className="text-slate-400 hover:text-slate-700 text-sm">Dashboard</Link>
          <div className="flex-1 text-center">
            <h1 className="text-sm font-bold text-slate-800 uppercase tracking-widest">PROVIDENT LEDGER CARD</h1>
          </div>
          <div className="flex gap-2">
            {activeLoan && (
              <button onClick={() => openPayModal(activeLoan.id)}
                className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-4 py-1.5 rounded shadow transition">
                + Record Payment
              </button>
            )}
            {selected.size > 0 && (
              <button onClick={() => setShowBulkConfirm(true)}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded transition">
                🗑 Delete ({selected.size})
              </button>
            )}
            <button onClick={() => { setImportOpen(true); setImportFile(null); setImportResult(null); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded transition">
              ↑ Import
            </button>
          </div>
        </div>
      </header>

      {error && <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

      {/* Loan tabs (if multiple loans) */}
      {loans.length > 1 && (
        <div className="mx-4 mt-3 flex gap-2 flex-wrap print:hidden">
          {loans.map((loan, idx) => (
            <button key={loan.id}
              onClick={() => { setActiveLoanId(loan.id); setSelected(new Set()); }}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                activeLoanId === loan.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
              }`}>
              Loan #{idx + 1} — ₱ {peso(loan.loan_amount)}
            </button>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          PROVIDENT LEDGER CARD — exact Google Sheet layout
      ════════════════════════════════════════════════════════════════ */}
      <div className="mx-4 mt-3 mb-8 bg-white border border-slate-400 shadow-md overflow-x-auto">

        {/* ── PAYSLIP row ── */}
        <div className="flex items-center justify-between px-3 py-1 border-b border-slate-300 text-[10px] text-slate-600">
          <span className="font-semibold">PAYSLIP:</span>
          <span className="font-bold text-slate-800 tracking-widest text-xs text-center flex-1">PROVIDENT LEDGER CARD</span>
          <span>Date: {new Date().toLocaleDateString('en-PH')}</span>
        </div>

        {/* ── Employee header — matches Google Sheet ── */}
        <div className="grid grid-cols-2 border-b border-slate-300 text-[11px]">
          <div className="px-3 py-1.5 border-r border-slate-300">
            <span className="text-slate-500">Name:&nbsp;</span>
            <span className="font-bold text-slate-800 uppercase">{fullNameDisplay || '—'}</span>
            <span className="ml-4 text-slate-500">
              {employee?.position ? employee.position.toUpperCase() : ''}
            </span>
          </div>
          <div className="px-3 py-1.5 flex gap-4">
            <span className="text-slate-500">Station:&nbsp;</span>
            <span className="font-bold text-slate-800 uppercase">
              {employee ? `${employee.station || '—'} - ${employee.department || ''}` : '—'}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 border-b border-slate-300 text-[11px]">
          <div className="px-3 py-1.5 border-r border-slate-300">
            <span className="text-slate-500">EMPLOYEE NO:&nbsp;</span>
            <span className="font-bold font-mono text-slate-800">{employee?.employee_number || '—'}</span>
            {activeLoan && (
              <>
                <span className="ml-4 text-slate-400">A=K3*.005</span>
                <span className="ml-3 text-slate-400">B=J10-F10</span>
              </>
            )}
          </div>
          <div className="px-3 py-1.5 flex gap-4">
            {activeLoan && (
              <>
                <span className="text-slate-400">C</span>
                <span className="text-slate-400">D=K3-G10</span>
              </>
            )}
          </div>
        </div>

        {activeLoan ? (
          <>
            {/* ── Column Headers — exact Google Sheet order ── */}
            <table className="w-full min-w-[1100px] border-collapse text-[10px]">
              <thead>
                <tr>
                  {/* Checkbox column */}
                  <th className="border border-slate-400 bg-slate-200 px-1 py-1 w-6">
                    <input type="checkbox"
                      checked={activeLoan.ledger_entries.length > 0 && selected.size === activeLoan.ledger_entries.length}
                      onChange={toggleSelectAll} className="cursor-pointer" />
                  </th>
                  <TH w="w-20">Date Granted</TH>
                  <TH w="w-24" right>Loan Amount</TH>
                  <TH w="w-16">No. of Months</TH>
                  <TH w="w-28" right>Amount w/ Int</TH>
                  <TH w="w-28">Date of Deduction</TH>
                  <TH w="w-28" right>Payment w/ Interest</TH>
                  <TH w="w-28" right>Principal Payments</TH>
                  {/* Months sub-header */}
                  <TH w="w-12">PAID</TH>
                  <TH w="w-12">BAL</TH>
                  <TH w="w-28" right># Payment w/ Int</TH>
                  <TH w="w-28" right>BALANCE</TH>
                  <TH w="w-20">Actions</TH>
                </tr>
              </thead>
              <tbody>
                {/* ── Row 1: loan header data (static) ── */}
                <tr className="bg-white">
                  <td className="border border-slate-300 px-1" />
                  <td className="border border-slate-300 px-2 py-1 font-mono text-center text-[10px]">
                    {fmtDateShort(activeLoan.loan_application_date)}
                  </td>
                  <td className="border border-slate-300 px-2 py-1 text-right font-bold">
                    {peso(activeLoan.loan_amount)}
                  </td>
                  <td className="border border-slate-300 px-2 py-1 text-center">
                    {activeLoan.no_of_months}
                  </td>
                  <td className="border border-slate-300 px-2 py-1 text-right">
                    {activeLoan.interest_rate > 0
                      ? peso(activeLoan.loan_amount * (1 + activeLoan.interest_rate / 100))
                      : peso(activeLoan.loan_amount)}
                  </td>
                  {/* Date of deduction, payments, months, balance — empty on header row */}
                  <td className="border border-slate-300" />
                  <td className="border border-slate-300" />
                  <td className="border border-slate-300" />
                  <td className="border border-slate-300 px-2 py-1 text-center text-slate-400">
                    {activeLoan.no_of_months_paid > 0 ? '' : activeLoan.no_of_months}
                  </td>
                  <td className="border border-slate-300" />
                  <td className="border border-slate-300 px-2 py-1 text-right text-slate-400">
                    {peso(activeLoan.monthly_amortization)}
                  </td>
                  <td className="border border-slate-300 px-2 py-1 text-right font-bold text-orange-700">
                    {peso(activeLoan.loan_amount)}
                  </td>
                  <td className="border border-slate-300" />
                </tr>

                {/* ── Payment rows (filled entries) ── */}
                {activeLoan.ledger_entries.map((entry, idx) => {
                  const paidMonths = entry.paid_months ?? (idx + 1);
                  const balMonths = activeLoan.no_of_months - paidMonths;
                  const isSelected = selected.has(entry.id);
                  return (
                    <tr key={entry.id}
                      className={`${isSelected ? 'bg-red-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50 transition-colors`}>
                      <td className="border border-slate-300 px-1 text-center">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(entry.id)} className="cursor-pointer" />
                      </td>
                      {/* Date Granted — empty for payment rows */}
                      <td className="border border-slate-300" />
                      {/* Loan Amount — empty for payment rows */}
                      <td className="border border-slate-300" />
                      {/* No. of Months — empty */}
                      <td className="border border-slate-300" />
                      {/* Amount w/ Int — empty */}
                      <td className="border border-slate-300" />
                      {/* Date of Deduction */}
                      <td className="border border-slate-300 px-2 py-1 font-mono text-center">
                        {fmtDate(entry.date_of_deduction || entry.payment_date)}
                      </td>
                      {/* Payment w/ Interest */}
                      <td className="border border-slate-300 px-2 py-1 text-right">
                        {entry.payment_with_interest != null ? peso(entry.payment_with_interest) : peso(entry.amount_paid)}
                      </td>
                      {/* Principal Payments */}
                      <td className="border border-slate-300 px-2 py-1 text-right">
                        {entry.principal_payments != null ? peso(entry.principal_payments) : ''}
                      </td>
                      {/* PAID months */}
                      <td className="border border-slate-300 px-2 py-1 text-center font-semibold text-green-700">
                        {paidMonths}
                      </td>
                      {/* BAL months */}
                      <td className="border border-slate-300 px-2 py-1 text-center text-slate-600">
                        {balMonths >= 0 ? balMonths : ''}
                      </td>
                      {/* # Payment w/ Int (monthly amount) */}
                      <td className="border border-slate-300 px-2 py-1 text-right">
                        {entry.monthly_payment_amount != null ? peso(entry.monthly_payment_amount) : peso(entry.amount_paid)}
                      </td>
                      {/* BALANCE */}
                      <td className="border border-slate-300 px-2 py-1 text-right font-bold text-orange-700">
                        {entry.balance != null ? peso(entry.balance) : peso(entry.new_balance)}
                      </td>
                      {/* Actions */}
                      <td className="border border-slate-300 px-1 py-1 text-center print:hidden">
                        <div className="flex gap-0.5 justify-center">
                          <button onClick={() => openEditEntry(entry)}
                            className="px-1.5 py-0.5 text-[9px] bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 transition">
                            Edit
                          </button>
                          <button onClick={() => setDeleteEntryId(entry.id)}
                            className="px-1.5 py-0.5 text-[9px] bg-red-50 hover:bg-red-100 text-red-600 rounded border border-red-200 transition">
                            Del
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* ── Empty rows to fill out the full term ── */}
                {Array.from({ length: Math.max(0, activeLoan.no_of_months - activeLoan.ledger_entries.length) }).map((_, idx) => {
                  const balMonths = activeLoan.no_of_months - activeLoan.ledger_entries.length - idx;
                  return (
                    <tr key={`empty-${idx}`} className="bg-white">
                      <td className="border border-slate-200 h-5" />
                      <td className="border border-slate-200" />
                      <td className="border border-slate-200" />
                      <td className="border border-slate-200" />
                      <td className="border border-slate-200" />
                      <td className="border border-slate-200" />
                      <td className="border border-slate-200" />
                      <td className="border border-slate-200" />
                      <td className="border border-slate-200" />
                      <td className="border border-slate-200 px-2 text-center text-slate-200 text-[9px]">{balMonths}</td>
                      <td className="border border-slate-200 px-2 text-right text-slate-200 text-[9px]">{peso(activeLoan.monthly_amortization)}</td>
                      <td className="border border-slate-200 px-2 text-right text-slate-200 text-[9px]">{peso(activeLoan.loan_balance)}</td>
                      <td className="border border-slate-200" />
                    </tr>
                  );
                })}

                {/* ── Total row ── */}
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                  <td className="border border-slate-400 px-2 py-1.5 text-right text-[10px] text-slate-600" colSpan={2}>Total</td>
                  <td className="border border-slate-400 px-2 py-1.5 text-right text-[10px]">
                    {peso(activeLoan.loan_amount)}
                  </td>
                  <td className="border border-slate-400" />
                  <td className="border border-slate-400" />
                  <td className="border border-slate-400" />
                  <td className="border border-slate-400 px-2 py-1.5 text-right text-[10px] text-blue-700">
                    {peso(activeLoan.ledger_entries.reduce((s, e) => s + (e.payment_with_interest ?? e.amount_paid ?? 0), 0))}
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-right text-[10px] text-slate-600">
                    {peso(activeLoan.ledger_entries.reduce((s, e) => s + (e.principal_payments ?? 0), 0))}
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-center text-[10px] text-green-700">
                    {activeLoan.no_of_months_paid}
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-center text-[10px] text-slate-600">
                    {activeLoan.no_of_months - activeLoan.no_of_months_paid}
                  </td>
                  <td className="border border-slate-400" />
                  <td className="border border-slate-400 px-2 py-1.5 text-right text-[10px] text-orange-700">
                    {peso(activeLoan.loan_balance)}
                  </td>
                  <td className="border border-slate-400 print:hidden" />
                </tr>
              </tbody>
            </table>

            {/* ── Bottom summary — matches Google Sheet ── */}
            <div className="grid grid-cols-3 border-t border-slate-400 text-[10px]">
              <div className="border-r border-slate-300">
                <div className="flex border-b border-slate-200">
                  <span className="px-3 py-1 text-slate-500 w-24">Net Pay</span>
                  <span className="px-3 py-1 border-l border-slate-200 flex-1" />
                </div>
                <div className="flex border-b border-slate-200">
                  <span className="px-3 py-1 text-slate-500 w-24">Payments</span>
                  <span className="px-3 py-1 border-l border-slate-200 flex-1 text-right font-semibold text-blue-700">
                    {peso(activeLoan.ledger_entries.reduce((s, e) => s + (e.payment_with_interest ?? e.amount_paid ?? 0), 0))}
                  </span>
                </div>
                <div className="flex">
                  <span className="px-3 py-1 text-slate-500 w-24">Balance</span>
                  <span className="px-3 py-1 border-l border-slate-200 flex-1 text-right font-bold text-orange-700">
                    {peso(activeLoan.loan_balance)}
                  </span>
                </div>
              </div>
              <div className="border-r border-slate-300 px-3 py-1">
                <span className="text-slate-500">Remarks:&nbsp;</span>
                <span>{activeLoan.remarks || ''}</span>
              </div>
              <div className="px-3 py-1 flex flex-col">
                <span className="text-slate-500">Prepared by:</span>
                <span className="font-bold text-slate-700 mt-1">CHARIE G. CORDEVILLA</span>
                <span className="text-slate-600">ADAS III</span>
              </div>
            </div>
          </>
        ) : (
          <div className="px-4 py-10 text-center text-slate-400 text-sm">
            No loan on record for this employee.
            <br />
            <Link href="/admin/employees" className="text-blue-600 underline mt-2 inline-block">
              Go to Account Management to add a loan.
            </Link>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          MODALS
      ════════════════════════════════════════════════════════════════ */}

      {/* ── Record Payment Modal ── */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-800">Record Monthly Payment</h2>
            {activeLoan && (
              <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 space-y-0.5">
                <p>Monthly amortization: <strong>₱ {peso(activeLoan.monthly_amortization)}</strong></p>
                <p>Remaining balance: <strong>₱ {peso(activeLoan.loan_balance)}</strong></p>
                <p>Months paid: <strong>{activeLoan.no_of_months_paid} of {activeLoan.no_of_months}</strong></p>
              </div>
            )}
            {payError && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded">{payError}</p>}
            <div className="space-y-3">
              <div>
                <label className={lbl}>Amount Paid <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₱</span>
                  <input type="number" step="0.01" min="0.01" value={payForm.amount_paid}
                    onChange={e => setPayForm(f => ({ ...f, amount_paid: e.target.value }))}
                    className={inp + ' pl-7'} placeholder={peso(activeLoan?.monthly_amortization)} />
                </div>
              </div>
              <div>
                <label className={lbl}>Date of Deduction</label>
                <input type="date" value={payForm.payment_date}
                  onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Reference Number</label>
                <input type="text" value={payForm.reference_number}
                  onChange={e => setPayForm(f => ({ ...f, reference_number: e.target.value }))}
                  className={inp} placeholder="Optional" />
              </div>
              <div>
                <label className={lbl}>Notes</label>
                <textarea value={payForm.notes}
                  onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className={inp + ' resize-none'} placeholder="Optional" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setPayModal(false)}
                className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-600 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button onClick={submitPayment} disabled={paySubmitting}
                className="px-5 py-2 text-sm rounded bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white font-semibold transition flex items-center gap-2">
                {paySubmitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {paySubmitting ? 'Recording…' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Ledger Entry Modal ── */}
      {editEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-800">Edit Payment Entry</h2>
            {editError && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded">{editError}</p>}
            <div className="space-y-3">
              <div>
                <label className={lbl}>Amount Paid</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₱</span>
                  <input type="number" step="0.01" value={editForm.amount_paid}
                    onChange={e => setEditForm(f => ({ ...f, amount_paid: e.target.value }))}
                    className={inp + ' pl-7'} />
                </div>
              </div>
              <div>
                <label className={lbl}>Date of Deduction</label>
                <input type="date" value={editForm.payment_date}
                  onChange={e => setEditForm(f => ({ ...f, payment_date: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Reference Number</label>
                <input type="text" value={editForm.reference_number}
                  onChange={e => setEditForm(f => ({ ...f, reference_number: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Notes</label>
                <textarea value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className={inp + ' resize-none'} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditEntry(null)}
                className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-600 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button onClick={submitEditEntry} disabled={editSubmitting}
                className="px-5 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold transition flex items-center gap-2">
                {editSubmitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {editSubmitting ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Single Entry ── */}
      {deleteEntryId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-base font-bold text-red-700">Delete Entry</h2>
            <p className="text-sm text-slate-600">Are you sure you want to delete this entry? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteEntryId(null)}
                className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-600 hover:bg-slate-50 transition">Cancel</button>
              <button onClick={confirmDelete} disabled={deleteSubmitting}
                className="px-5 py-2 text-sm rounded bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white font-semibold transition flex items-center gap-2">
                {deleteSubmitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {deleteSubmitting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Delete Confirm ── */}
      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-base font-bold text-red-700">Delete {selected.size} Entries</h2>
            <p className="text-sm text-slate-600">Are you sure you want to delete {selected.size} selected entries? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowBulkConfirm(false)}
                className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-600 hover:bg-slate-50 transition">Cancel</button>
              <button onClick={confirmBulkDelete} disabled={bulkDeleting}
                className="px-5 py-2 text-sm rounded bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white font-semibold transition flex items-center gap-2">
                {bulkDeleting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {bulkDeleting ? 'Deleting…' : `Delete ${selected.size} Entries`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import Modal ── */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
            <h2 className="text-lg font-bold text-slate-800">Import Data</h2>
            <p className="text-sm text-slate-500">Upload a Provident Fund Summary (.xlsx, .csv, or .pdf).</p>
            {!importResult ? (
              <>
                <div onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setImportFile(f); }}
                  className="border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-lg p-8 text-center cursor-pointer transition">
                  <div className="text-3xl mb-2">📄</div>
                  {importFile
                    ? <p className="font-semibold text-slate-700 text-sm">{importFile.name}</p>
                    : <><p className="text-sm font-medium text-slate-600">Click or drag &amp; drop</p>
                      <p className="text-xs text-slate-400 mt-1">.xlsx, .xls, .csv, .pdf</p></>}
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden"
                    onChange={e => setImportFile(e.target.files?.[0] || null)} />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setImportOpen(false)} className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-600 hover:bg-slate-50 transition">Cancel</button>
                  <button onClick={handleImport} disabled={!importFile || importing}
                    className="px-5 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold transition flex items-center gap-2">
                    {importing && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {importing ? 'Importing…' : 'Import'}
                  </button>
                </div>
              </>
            ) : (
              <>
                {importResult.success
                  ? <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="font-semibold text-green-700">✓ Import successful</p>
                      <ul className="text-sm text-green-700 mt-1 space-y-0.5">
                        <li>• {importResult.created} employees created</li>
                        <li>• {importResult.updated} employees updated</li>
                        {importResult.loansCreated > 0 && <li>• {importResult.loansCreated} loans created</li>}
                        {importResult.loansUpdated > 0 && <li>• {importResult.loansUpdated} loans updated</li>}
                        {importResult.ledgerCreated > 0 && <li>• {importResult.ledgerCreated} payment records added</li>}
                      </ul>
                    </div>
                  : <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="font-semibold text-red-700">✗ {importResult.message}</p>
                    </div>}
                <div className="flex justify-end">
                  <button onClick={() => { setImportOpen(false); setImportResult(null); }}
                    className="px-5 py-2 text-sm rounded bg-slate-700 hover:bg-slate-800 text-white font-semibold transition">Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
