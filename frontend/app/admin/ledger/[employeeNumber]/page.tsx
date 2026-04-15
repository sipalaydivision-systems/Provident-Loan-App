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
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (isNaN(n)) return '—';
  return '₱ ' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}/${dt.getFullYear()}`;
};

const fmtMonth = (d: string | null | undefined): string => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleString('en-PH', { month: 'long', year: 'numeric' });
};

function statusBadge(status: string): string {
  const s = (status || '').toUpperCase();
  if (s.includes('QUALIFIED') && !s.includes('NOT')) return 'bg-green-600 text-white';
  if (s === 'ACTIVE') return 'bg-blue-600 text-white';
  if (s.includes('FULLY') || s.includes('PAID')) return 'bg-slate-500 text-white';
  if (s.includes('NOT')) return 'bg-red-600 text-white';
  return 'bg-yellow-500 text-black';
}

const STATUSES = [
  'ACTIVE', 'QUALIFIED FOR RENEWAL', 'NOT QUALIFIED', 'FULLY PAID',
  'DECEASED', 'RESIGNED', 'RETIRED',
];

// ── empty form defaults ────────────────────────────────────────────────────
const emptyLoan = {
  loan_amount: '',
  no_of_months: '',
  monthly_amortization: '',
  interest_rate: '',
  loan_application_date: '',
  check_number: '',
  check_date: '',
  effective_date: '',
  termination_date: '',
  status: 'ACTIVE',
  remarks: '',
  notes: '',
};

const emptyEmployee = {
  first_name: '',
  middle_name: '',
  last_name: '',
  station: '',
  position: '',
  department: '',
  email: '',
  phone: '',
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

  // ── selection for bulk delete ──────────────────────────────────────────
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  // ── employee edit modal ────────────────────────────────────────────────
  const [editEmpOpen, setEditEmpOpen] = useState(false);
  const [empForm, setEmpForm] = useState({ ...emptyEmployee });
  const [empSubmitting, setEmpSubmitting] = useState(false);
  const [empError, setEmpError] = useState('');

  // ── loan form (add/edit) ───────────────────────────────────────────────
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [editLoanId, setEditLoanId] = useState<number | null>(null); // null = new loan
  const [loanForm, setLoanForm] = useState({ ...emptyLoan });
  const [loanSubmitting, setLoanSubmitting] = useState(false);
  const [loanError, setLoanError] = useState('');

  // ── delete loan confirm ────────────────────────────────────────────────
  const [deleteLoanId, setDeleteLoanId] = useState<number | null>(null);
  const [deleteLoanSubmitting, setDeleteLoanSubmitting] = useState(false);

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

  // ── xlsx import ────────────────────────────────────────────────────────
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── toast ──────────────────────────────────────────────────────────────
  const [toast, setToast] = useState('');
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // ── load data ──────────────────────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/admin/login'); return; }
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
    ? [employee.last_name, employee.first_name, employee.middle_name].filter(Boolean).join(', ')
    : '';

  // ── employee edit ──────────────────────────────────────────────────────
  const openEditEmployee = () => {
    if (!employee) return;
    setEmpForm({
      first_name: employee.first_name,
      middle_name: employee.middle_name || '',
      last_name: employee.last_name,
      station: employee.station || '',
      position: employee.position || '',
      department: employee.department || '',
      email: (employee as any).email || '',
      phone: (employee as any).phone || '',
    });
    setEmpError('');
    setEditEmpOpen(true);
  };

  const submitEditEmployee = async () => {
    setEmpSubmitting(true);
    setEmpError('');
    try {
      await (adminAPI as any).employees.update(employeeNumber, empForm);
      setEditEmpOpen(false);
      showToast('Employee updated.');
      fetchLedger();
    } catch (err: any) {
      setEmpError(err.response?.data?.message || 'Failed to update employee.');
    } finally {
      setEmpSubmitting(false);
    }
  };

  // ── loan CRUD ──────────────────────────────────────────────────────────
  const openAddLoan = () => {
    setEditLoanId(null);
    setLoanForm({ ...emptyLoan });
    setLoanError('');
    setLoanModalOpen(true);
  };

  const openEditLoan = (loan: Loan) => {
    setEditLoanId(loan.id);
    setLoanForm({
      loan_amount: String(loan.loan_amount),
      no_of_months: String(loan.no_of_months),
      monthly_amortization: String(loan.monthly_amortization),
      interest_rate: String(loan.interest_rate || 0),
      loan_application_date: loan.loan_application_date ? loan.loan_application_date.slice(0, 10) : '',
      check_number: loan.check_number || '',
      check_date: loan.check_date ? loan.check_date.slice(0, 10) : '',
      effective_date: loan.effective_date ? loan.effective_date.slice(0, 10) : '',
      termination_date: loan.termination_date ? loan.termination_date.slice(0, 10) : '',
      status: loan.status || 'ACTIVE',
      remarks: loan.remarks || '',
      notes: loan.notes || '',
    });
    setLoanError('');
    setLoanModalOpen(true);
  };

  const submitLoan = async () => {
    if (!loanForm.loan_amount || !loanForm.no_of_months) {
      setLoanError('Loan amount and number of months are required.');
      return;
    }
    setLoanSubmitting(true);
    setLoanError('');
    try {
      const payload = {
        employee_number: employeeNumber,
        loan_amount: parseFloat(loanForm.loan_amount),
        no_of_months: parseInt(loanForm.no_of_months),
        monthly_amortization: loanForm.monthly_amortization
          ? parseFloat(loanForm.monthly_amortization)
          : parseFloat((parseFloat(loanForm.loan_amount) / parseInt(loanForm.no_of_months)).toFixed(2)),
        interest_rate: parseFloat(loanForm.interest_rate || '0'),
        loan_application_date: loanForm.loan_application_date || null,
        check_number: loanForm.check_number || null,
        check_date: loanForm.check_date || null,
        effective_date: loanForm.effective_date || null,
        termination_date: loanForm.termination_date || null,
        status: loanForm.status,
        remarks: loanForm.remarks || null,
        notes: loanForm.notes || null,
      };
      if (editLoanId) {
        await (adminAPI as any).loans.update(editLoanId, payload);
        showToast('Loan updated.');
      } else {
        await (adminAPI as any).loans.create(payload);
        showToast('Loan created.');
      }
      setLoanModalOpen(false);
      fetchLedger();
    } catch (err: any) {
      setLoanError(err.response?.data?.message || 'Failed to save loan.');
    } finally {
      setLoanSubmitting(false);
    }
  };

  const confirmDeleteLoan = async () => {
    if (!deleteLoanId) return;
    setDeleteLoanSubmitting(true);
    try {
      await (adminAPI as any).loans.delete(deleteLoanId);
      setDeleteLoanId(null);
      showToast('Loan deleted.');
      setActiveLoanId(null);
      fetchLedger();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete loan.');
    } finally {
      setDeleteLoanSubmitting(false);
    }
  };

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

  // ── delete single entry ────────────────────────────────────────────────
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
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!activeLoan) return;
    const ids = activeLoan.ledger_entries.map(e => e.id);
    if (selected.size === ids.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(ids));
    }
  };

  const confirmBulkDelete = async () => {
    if (selected.size === 0) return;
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

  // ── xlsx import ────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await importAPI.importFile(importFile);
      setImportResult({ success: true, ...res.data });
      fetchLedger();
    } catch (err: any) {
      setImportResult({
        success: false,
        message: err.response?.data?.error || err.response?.data?.message || 'Import failed',
      });
    } finally {
      setImporting(false);
    }
  };

  // ── loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading ledger…</p>
        </div>
      </div>
    );
  }

  // ── shared input style ─────────────────────────────────────────────────
  const inp = 'w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:border-blue-500';
  const lbl = 'block text-[11px] font-medium text-slate-500 mb-0.5';

  // ── main render ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100">

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium animate-fade-in">
          {toast}
        </div>
      )}

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-full px-4 py-3 flex items-center gap-3 flex-wrap">
          <Link href="/admin/report" className="text-slate-500 hover:text-slate-800 text-sm">← Report</Link>
          <span className="text-slate-300">|</span>
          <Link href="/admin/dashboard" className="text-slate-400 hover:text-slate-700 text-sm">Dashboard</Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-slate-800 uppercase tracking-widest">
              PROVIDENT LOAN FUND — EMPLOYEE LEDGER
            </h1>
          </div>
          <button
            onClick={() => { setImportOpen(true); setImportFile(null); setImportResult(null); }}
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded transition"
          >
            ↑ Import (.xlsx / .csv / .pdf)
          </button>
        </div>
      </header>

      {error && <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1 — EMPLOYEE INFO
      ════════════════════════════════════════════════════════════════ */}
      <div className="mx-4 mt-4 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-600 uppercase tracking-widest">Employee Information</h2>
          {employee && (
            <button
              onClick={openEditEmployee}
              className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 px-3 py-1 rounded transition"
            >
              Edit Employee
            </button>
          )}
        </div>
        {employee ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-2 text-sm">
            <div className="col-span-2">
              <p className={lbl}>Name</p>
              <p className="font-bold text-slate-800 text-base">{fullName}</p>
            </div>
            <div>
              <p className={lbl}>Employee No.</p>
              <p className="font-mono font-semibold text-slate-700">{employee.employee_number}</p>
            </div>
            <div>
              <p className={lbl}>Station</p>
              <p className="text-slate-700">{employee.station || '—'}</p>
            </div>
            <div>
              <p className={lbl}>Position</p>
              <p className="text-slate-700">{employee.position || '—'}</p>
            </div>
            <div>
              <p className={lbl}>Department</p>
              <p className="text-slate-700">{employee.department || '—'}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Employee not found for #{employeeNumber}</p>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2 — LOAN MANAGEMENT
      ════════════════════════════════════════════════════════════════ */}
      <div className="mx-4 mt-3 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-600 uppercase tracking-widest">Loan Records</h2>
          <button
            onClick={openAddLoan}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded font-semibold transition"
          >
            + Add Loan
          </button>
        </div>

        {/* Loan tabs */}
        {loans.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-3">
            {loans.map((loan, idx) => (
              <button
                key={loan.id}
                onClick={() => { setActiveLoanId(loan.id); setSelected(new Set()); }}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                  activeLoanId === loan.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                }`}
              >
                Loan #{idx + 1} — {peso(loan.loan_amount)}
              </button>
            ))}
          </div>
        )}

        {/* Active loan detail grid — matches Google Sheet header */}
        {activeLoan ? (
          <>
            {/* Row 1: key loan details */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-2 text-sm border border-slate-100 rounded-lg p-3 bg-slate-50">
              <div>
                <p className={lbl}>Date Granted</p>
                <p className="font-mono text-slate-700">{fmtDate(activeLoan.loan_application_date)}</p>
              </div>
              <div>
                <p className={lbl}>Loan Amount</p>
                <p className="font-bold text-slate-800">{peso(activeLoan.loan_amount)}</p>
              </div>
              <div>
                <p className={lbl}>No. of Months</p>
                <p className="text-slate-700">{activeLoan.no_of_months}</p>
              </div>
              <div>
                <p className={lbl}>Amount w/ Interest</p>
                <p className="text-slate-700">
                  {activeLoan.interest_rate > 0
                    ? peso(activeLoan.loan_amount * (1 + activeLoan.interest_rate / 100))
                    : peso(activeLoan.loan_amount)}
                </p>
              </div>
              <div>
                <p className={lbl}>Monthly Amortization</p>
                <p className="font-semibold text-blue-700">{peso(activeLoan.monthly_amortization)}</p>
              </div>
              <div>
                <p className={lbl}>Check Number</p>
                <p className="font-mono text-slate-700">{activeLoan.check_number || '—'}</p>
              </div>
              <div>
                <p className={lbl}>Check Date</p>
                <p className="font-mono text-slate-700">{fmtDate(activeLoan.check_date)}</p>
              </div>
              <div>
                <p className={lbl}>Effective Date</p>
                <p className="font-mono text-slate-700">{fmtDate(activeLoan.effective_date)}</p>
              </div>
              <div>
                <p className={lbl}>Termination Date</p>
                <p className="font-mono text-slate-700">{fmtDate(activeLoan.termination_date)}</p>
              </div>
              <div>
                <p className={lbl}>Months Paid</p>
                <p className="text-slate-700">{activeLoan.no_of_months_paid}</p>
              </div>
              <div>
                <p className={lbl}>Months Balance</p>
                <p className="text-slate-600">{activeLoan.no_of_months > 0 ? activeLoan.no_of_months - activeLoan.no_of_months_paid : '—'}</p>
              </div>
              <div>
                <p className={lbl}>Remaining Balance</p>
                <p className="font-bold text-orange-600">{peso(activeLoan.loan_balance)}</p>
              </div>
              <div>
                <p className={lbl}>Status</p>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${statusBadge(activeLoan.status)}`}>
                  {activeLoan.status}
                </span>
              </div>
              <div>
                <p className={lbl}>Remarks</p>
                <p className="text-slate-500 italic text-xs">{activeLoan.remarks || '—'}</p>
              </div>
              <div>
                <p className={lbl}>Notes</p>
                <p className="text-slate-500 text-xs">{activeLoan.notes || '—'}</p>
              </div>
            </div>

            {/* Loan actions */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => openPayModal(activeLoan.id)}
                className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-4 py-1.5 rounded shadow transition"
              >
                + Record Payment
              </button>
              <button
                onClick={() => openEditLoan(activeLoan)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-4 py-1.5 rounded border border-slate-300 transition"
              >
                Edit Loan
              </button>
              <button
                onClick={() => setDeleteLoanId(activeLoan.id)}
                className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold px-4 py-1.5 rounded border border-red-200 transition ml-auto"
              >
                Delete Loan
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-6 text-slate-400 text-sm">
            No loan records yet.{' '}
            <button onClick={openAddLoan} className="text-blue-600 underline">Add the first loan</button>.
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 3 — PAYMENT LEDGER TABLE
          Columns match the Google Sheet ledger card:
          # | Date of Deduction | Payment w/ Interest | Principal Payments
            | PAID (months) | BAL (months) | Monthly Payment | Balance
            | Reference | Notes | ☑ | Actions
      ════════════════════════════════════════════════════════════════ */}
      {activeLoan && (
        <div className="mx-4 mt-3 mb-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          {/* Ledger toolbar */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">
              Payment Ledger
              <span className="ml-2 text-[11px] text-slate-400 font-normal normal-case">
                ({activeLoan.ledger_entries.length} of {activeLoan.no_of_months} months)
              </span>
            </h3>
            {selected.size > 0 && (
              <button
                onClick={() => setShowBulkConfirm(true)}
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-1.5 rounded transition"
              >
                🗑 Delete Selected ({selected.size})
              </button>
            )}
          </div>

          {/* Ledger table — columns match Google Sheet */}
          <table className="w-full min-w-[1000px] text-xs border-collapse">
            <thead>
              <tr className="bg-slate-700 text-white">
                <th className="px-2 py-2 text-center border border-slate-600 w-6">
                  <input
                    type="checkbox"
                    checked={activeLoan.ledger_entries.length > 0 && selected.size === activeLoan.ledger_entries.length}
                    onChange={toggleSelectAll}
                    className="cursor-pointer"
                  />
                </th>
                <th className="px-2 py-2 text-center border border-slate-600 w-6">#</th>
                <th className="px-3 py-2 text-left border border-slate-600 whitespace-nowrap">Date of Deduction</th>
                <th className="px-3 py-2 text-right border border-slate-600 whitespace-nowrap">Payment w/ Interest</th>
                <th className="px-3 py-2 text-right border border-slate-600 whitespace-nowrap">Principal Payments</th>
                <th className="px-3 py-2 text-center border border-slate-600">PAID</th>
                <th className="px-3 py-2 text-center border border-slate-600">BAL</th>
                <th className="px-3 py-2 text-right border border-slate-600 whitespace-nowrap">Monthly Payment</th>
                <th className="px-3 py-2 text-right border border-slate-600 font-bold">BALANCE</th>
                <th className="px-3 py-2 text-left border border-slate-600">Reference</th>
                <th className="px-3 py-2 text-left border border-slate-600">Notes</th>
                <th className="px-3 py-2 text-center border border-slate-600 w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Filled rows — actual payment entries */}
              {activeLoan.ledger_entries.map((entry, idx) => {
                const paidMonths = entry.paid_months ?? (idx + 1);
                const balMonths = activeLoan.no_of_months - paidMonths;
                const isSelected = selected.has(entry.id);
                return (
                  <tr
                    key={entry.id}
                    className={`${isSelected ? 'bg-red-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50 transition-colors`}
                  >
                    <td className="px-2 py-1.5 text-center border border-slate-200">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(entry.id)}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center text-slate-400 border border-slate-200">{idx + 1}</td>
                    <td className="px-3 py-1.5 font-mono border border-slate-200">
                      {fmtDate(entry.date_of_deduction || entry.payment_date)}
                    </td>
                    <td className="px-3 py-1.5 text-right border border-slate-200">
                      {entry.payment_with_interest != null ? peso(entry.payment_with_interest) : peso(entry.amount_paid)}
                    </td>
                    <td className="px-3 py-1.5 text-right border border-slate-200">
                      {entry.principal_payments != null ? peso(entry.principal_payments) : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-center border border-slate-200 font-semibold text-green-700">{paidMonths}</td>
                    <td className="px-3 py-1.5 text-center border border-slate-200 text-slate-500">{balMonths >= 0 ? balMonths : '—'}</td>
                    <td className="px-3 py-1.5 text-right border border-slate-200">
                      {entry.monthly_payment_amount != null ? peso(entry.monthly_payment_amount) : peso(entry.amount_paid)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-bold border border-slate-200 text-orange-700">
                      {entry.balance != null ? peso(entry.balance) : peso(entry.new_balance)}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-slate-500 border border-slate-200">{entry.reference_number || '—'}</td>
                    <td className="px-3 py-1.5 text-slate-500 italic border border-slate-200">{entry.notes || '—'}</td>
                    <td className="px-3 py-1.5 text-center border border-slate-200">
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => openEditEntry(entry)} className="px-2 py-0.5 text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 transition">Edit</button>
                        <button onClick={() => setDeleteEntryId(entry.id)} className="px-2 py-0.5 text-[10px] bg-red-50 hover:bg-red-100 text-red-600 rounded border border-red-200 transition">Del</button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Empty rows to fill out the full term (like the Google Sheet) */}
              {Array.from({ length: Math.max(0, activeLoan.no_of_months - activeLoan.ledger_entries.length) }).map((_, idx) => {
                const rowNum = activeLoan.ledger_entries.length + idx + 1;
                const balMonths = activeLoan.no_of_months - activeLoan.ledger_entries.length - idx;
                return (
                  <tr key={`empty-${idx}`} className="bg-white border-b border-slate-100">
                    <td className="px-2 py-1.5 border border-slate-100" />
                    <td className="px-2 py-1.5 text-center text-slate-200 border border-slate-100">{rowNum}</td>
                    <td className="border border-slate-100 px-3 py-1.5" />
                    <td className="border border-slate-100 px-3 py-1.5 text-right text-slate-200 text-[10px]">
                      {peso(activeLoan.monthly_amortization)}
                    </td>
                    <td className="border border-slate-100" />
                    <td className="border border-slate-100" />
                    <td className="px-3 py-1.5 text-center text-slate-300 text-[10px] border border-slate-100">{balMonths}</td>
                    <td className="px-3 py-1.5 text-right text-slate-200 text-[10px] border border-slate-100">
                      {peso(activeLoan.monthly_amortization)}
                    </td>
                    <td className="px-3 py-1.5 text-right text-slate-200 text-[10px] border border-slate-100">
                      {peso(activeLoan.loan_balance)}
                    </td>
                    <td className="border border-slate-100" />
                    <td className="border border-slate-100" />
                    <td className="border border-slate-100" />
                  </tr>
                );
              })}

              {activeLoan.ledger_entries.length === 0 && activeLoan.no_of_months === 0 && (
                <tr>
                  <td colSpan={12} className="text-center py-6 text-slate-400">
                    No payment records yet. Click "Record Payment" to add one.
                  </td>
                </tr>
              )}
            </tbody>

            {/* Totals footer */}
            {activeLoan.ledger_entries.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-700 border-t-2 border-slate-400">
                  <td colSpan={3} className="px-3 py-2 text-right text-xs border border-slate-300 uppercase tracking-wide">Totals</td>
                  <td className="px-3 py-2 text-right text-xs border border-slate-300 text-blue-700">
                    {peso(activeLoan.ledger_entries.reduce((s, e) => s + (e.payment_with_interest ?? e.amount_paid ?? 0), 0))}
                  </td>
                  <td className="px-3 py-2 text-right text-xs border border-slate-300 text-slate-600">
                    {peso(activeLoan.ledger_entries.reduce((s, e) => s + (e.principal_payments ?? 0), 0))}
                  </td>
                  <td className="px-3 py-2 text-center text-xs border border-slate-300 text-green-700">{activeLoan.no_of_months_paid}</td>
                  <td className="px-3 py-2 text-center text-xs border border-slate-300 text-slate-500">
                    {activeLoan.no_of_months - activeLoan.no_of_months_paid}
                  </td>
                  <td className="border border-slate-300" />
                  <td className="px-3 py-2 text-right text-xs border border-slate-300 text-orange-700">
                    {peso(activeLoan.loan_balance)}
                  </td>
                  <td colSpan={3} className="border border-slate-300" />
                </tr>
                {/* Net Pay / Payments / Balance summary — matches Google Sheet bottom */}
                <tr className="bg-white text-xs border-t border-slate-200">
                  <td colSpan={3} className="px-3 py-1.5 text-right text-slate-500 border border-slate-200">Net Pay</td>
                  <td colSpan={3} className="border border-slate-200" />
                  <td colSpan={3} className="px-3 py-1.5 text-right text-slate-500 border border-slate-200">Prepared by:</td>
                  <td colSpan={3} className="px-3 py-1.5 text-slate-600 border border-slate-200 font-semibold">ADAS III</td>
                </tr>
                <tr className="bg-white text-xs">
                  <td colSpan={3} className="px-3 py-1 text-right text-slate-500 border border-slate-200">Payments</td>
                  <td className="px-3 py-1 text-right border border-slate-200 text-blue-700">
                    {peso(activeLoan.ledger_entries.reduce((s, e) => s + (e.payment_with_interest ?? e.amount_paid ?? 0), 0))}
                  </td>
                  <td colSpan={2} className="border border-slate-200" />
                  <td className="px-3 py-1 text-center border border-slate-200 text-green-700">{activeLoan.no_of_months_paid}</td>
                  <td className="border border-slate-200" />
                  <td colSpan={4} className="border border-slate-200" />
                </tr>
                <tr className="bg-white text-xs">
                  <td colSpan={3} className="px-3 py-1 text-right text-slate-500 border border-slate-200">Balance</td>
                  <td colSpan={5} className="border border-slate-200" />
                  <td className="px-3 py-1 text-right border border-slate-200 text-orange-700 font-bold">{peso(activeLoan.loan_balance)}</td>
                  <td colSpan={3} className="border border-slate-200" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {loans.length === 0 && !loading && (
        <div className="mx-4 mt-4 mb-8 text-center text-slate-400 text-sm py-12 bg-white rounded-xl border border-slate-200">
          No loan records. Click <button onClick={openAddLoan} className="text-blue-600 underline">+ Add Loan</button> to get started.
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODALS
      ════════════════════════════════════════════════════════════════ */}

      {/* ── Import Modal ── */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
            <h2 className="text-lg font-bold text-slate-800">Import Data</h2>
            <p className="text-sm text-slate-500">Upload a Provident Fund Summary file (.xlsx, .csv, or .pdf). Employee, loan, and payment data will be imported.</p>
            {!importResult ? (
              <>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setImportFile(f); }}
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
                      <p className="text-sm font-medium text-slate-600">Click or drag &amp; drop</p>
                      <p className="text-xs text-slate-400 mt-1">.xlsx, .xls, .csv, or .pdf</p>
                    </div>
                  )}
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
                {importResult.success ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-1">
                    <p className="font-semibold text-green-700">✓ Import successful</p>
                    <ul className="text-sm text-green-700 space-y-0.5">
                      <li>• {importResult.created} employees created</li>
                      <li>• {importResult.updated} employees updated</li>
                      {importResult.loansCreated > 0 && <li>• {importResult.loansCreated} loans created</li>}
                      {importResult.loansUpdated > 0 && <li>• {importResult.loansUpdated} loans updated</li>}
                      {importResult.ledgerCreated > 0 && <li>• {importResult.ledgerCreated} payment records added</li>}
                    </ul>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="font-semibold text-red-700">✗ {importResult.message}</p>
                  </div>
                )}
                <div className="flex justify-end">
                  <button onClick={() => { setImportOpen(false); setImportResult(null); }}
                    className="px-5 py-2 text-sm rounded bg-slate-700 hover:bg-slate-800 text-white font-semibold transition">Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Edit Employee Modal ── */}
      {editEmpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-slate-800">Edit Employee</h2>
            {empError && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded">{empError}</p>}
            <div className="grid grid-cols-2 gap-3">
              {[
                ['First Name', 'first_name'], ['Last Name', 'last_name'],
                ['Middle Name', 'middle_name'], ['Station', 'station'],
                ['Position', 'position'], ['Department', 'department'],
                ['Email', 'email'], ['Phone', 'phone'],
              ].map(([label, key]) => (
                <div key={key}>
                  <label className={lbl}>{label}</label>
                  <input type="text" value={(empForm as any)[key]} onChange={e => setEmpForm(f => ({ ...f, [key]: e.target.value }))} className={inp} />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditEmpOpen(false)} className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-600 hover:bg-slate-50 transition">Cancel</button>
              <button onClick={submitEditEmployee} disabled={empSubmitting}
                className="px-5 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold transition flex items-center gap-2">
                {empSubmitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {empSubmitting ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Loan Modal ── */}
      {loanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-slate-800">{editLoanId ? 'Edit Loan' : 'Add New Loan'}</h2>
            {loanError && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded">{loanError}</p>}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Loan Amount <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₱</span>
                  <input type="number" step="0.01" value={loanForm.loan_amount} onChange={e => setLoanForm(f => ({ ...f, loan_amount: e.target.value }))} className={inp + ' pl-7'} placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className={lbl}>No. of Months <span className="text-red-500">*</span></label>
                <input type="number" value={loanForm.no_of_months} onChange={e => setLoanForm(f => ({ ...f, no_of_months: e.target.value }))} className={inp} placeholder="60" />
              </div>
              <div>
                <label className={lbl}>Monthly Amortization</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₱</span>
                  <input type="number" step="0.01" value={loanForm.monthly_amortization} onChange={e => setLoanForm(f => ({ ...f, monthly_amortization: e.target.value }))} className={inp + ' pl-7'} placeholder="Auto-calculated" />
                </div>
              </div>
              <div>
                <label className={lbl}>Interest Rate (%)</label>
                <input type="number" step="0.01" value={loanForm.interest_rate} onChange={e => setLoanForm(f => ({ ...f, interest_rate: e.target.value }))} className={inp} placeholder="0" />
              </div>
              <div>
                <label className={lbl}>Date Granted</label>
                <input type="date" value={loanForm.loan_application_date} onChange={e => setLoanForm(f => ({ ...f, loan_application_date: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Check Number</label>
                <input type="text" value={loanForm.check_number} onChange={e => setLoanForm(f => ({ ...f, check_number: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Check Date</label>
                <input type="date" value={loanForm.check_date} onChange={e => setLoanForm(f => ({ ...f, check_date: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Effective Date</label>
                <input type="date" value={loanForm.effective_date} onChange={e => setLoanForm(f => ({ ...f, effective_date: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Termination Date</label>
                <input type="date" value={loanForm.termination_date} onChange={e => setLoanForm(f => ({ ...f, termination_date: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Status</label>
                <select value={loanForm.status} onChange={e => setLoanForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={lbl}>Remarks</label>
                <input type="text" value={loanForm.remarks} onChange={e => setLoanForm(f => ({ ...f, remarks: e.target.value }))} className={inp} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Notes</label>
                <input type="text" value={loanForm.notes} onChange={e => setLoanForm(f => ({ ...f, notes: e.target.value }))} className={inp} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setLoanModalOpen(false)} className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-600 hover:bg-slate-50 transition">Cancel</button>
              <button onClick={submitLoan} disabled={loanSubmitting}
                className="px-5 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold transition flex items-center gap-2">
                {loanSubmitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {loanSubmitting ? 'Saving…' : editLoanId ? 'Save Changes' : 'Create Loan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Loan Confirm ── */}
      {deleteLoanId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-base font-bold text-red-700">Delete Loan</h2>
            <p className="text-sm text-slate-600">Are you sure you want to delete this loan and all its payment entries? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteLoanId(null)} className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-600 hover:bg-slate-50 transition">Cancel</button>
              <button onClick={confirmDeleteLoan} disabled={deleteLoanSubmitting}
                className="px-5 py-2 text-sm rounded bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white font-semibold transition flex items-center gap-2">
                {deleteLoanSubmitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {deleteLoanSubmitting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Record Payment Modal ── */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-800">Record Payment</h2>
            {payError && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded">{payError}</p>}
            <div className="space-y-3">
              <div>
                <label className={lbl}>Amount Paid <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₱</span>
                  <input type="number" step="0.01" min="0.01" value={payForm.amount_paid}
                    onChange={e => setPayForm(f => ({ ...f, amount_paid: e.target.value }))}
                    className={inp + ' pl-7'} placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className={lbl}>Date of Deduction</label>
                <input type="date" value={payForm.payment_date} onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Reference Number</label>
                <input type="text" value={payForm.reference_number} onChange={e => setPayForm(f => ({ ...f, reference_number: e.target.value }))} className={inp} placeholder="Optional" />
              </div>
              <div>
                <label className={lbl}>Notes</label>
                <textarea value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={inp + ' resize-none'} placeholder="Optional" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setPayModal(false)} className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-600 hover:bg-slate-50 transition">Cancel</button>
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
                  <input type="number" step="0.01" min="0.01" value={editForm.amount_paid}
                    onChange={e => setEditForm(f => ({ ...f, amount_paid: e.target.value }))} className={inp + ' pl-7'} />
                </div>
              </div>
              <div>
                <label className={lbl}>Payment Date</label>
                <input type="date" value={editForm.payment_date} onChange={e => setEditForm(f => ({ ...f, payment_date: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Reference Number</label>
                <input type="text" value={editForm.reference_number} onChange={e => setEditForm(f => ({ ...f, reference_number: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Notes</label>
                <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={inp + ' resize-none'} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditEntry(null)} className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-600 hover:bg-slate-50 transition">Cancel</button>
              <button onClick={submitEditEntry} disabled={editSubmitting}
                className="px-5 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold transition flex items-center gap-2">
                {editSubmitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {editSubmitting ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Single Entry Confirm ── */}
      {deleteEntryId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-base font-bold text-red-700">Delete Entry</h2>
            <p className="text-sm text-slate-600">Are you sure you want to delete this entry? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteEntryId(null)} className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-600 hover:bg-slate-50 transition">Cancel</button>
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
              <button onClick={() => setShowBulkConfirm(false)} className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-600 hover:bg-slate-50 transition">Cancel</button>
              <button onClick={confirmBulkDelete} disabled={bulkDeleting}
                className="px-5 py-2 text-sm rounded bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white font-semibold transition flex items-center gap-2">
                {bulkDeleting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {bulkDeleting ? 'Deleting…' : `Delete ${selected.size} Entries`}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
