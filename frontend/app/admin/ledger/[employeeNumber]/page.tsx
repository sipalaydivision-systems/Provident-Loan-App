'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { adminAPI } from '../../../lib/api';

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
  if (isNaN(dt.getTime())) return d;
  return `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}/${dt.getFullYear()}`;
};

function statusBadge(status: string): string {
  const s = (status || '').toUpperCase();
  if (s.includes('QUALIFIED') && !s.includes('NOT')) return 'bg-green-600 text-white';
  if (s === 'ACTIVE') return 'bg-blue-600 text-white';
  if (s.includes('FULLY') || s.includes('PAID')) return 'bg-slate-500 text-white';
  if (s.includes('NOT')) return 'bg-red-600 text-white';
  return 'bg-yellow-500 text-black';
}

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

  // ── add payment modal ──────────────────────────────────────────────────
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
  const [editForm, setEditForm] = useState({
    amount_paid: '',
    payment_date: '',
    reference_number: '',
    notes: '',
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  // ── delete confirm ─────────────────────────────────────────────────────
  const [deleteEntryId, setDeleteEntryId] = useState<number | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // ── success toast ──────────────────────────────────────────────────────
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

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
      if (lns && lns.length > 0) setActiveLoanId(lns[0].id);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to load ledger');
    } finally {
      setLoading(false);
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
    if (!payLoanId || !payForm.amount_paid) {
      setPayError('Amount is required.');
      return;
    }
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
      showToast('Payment recorded successfully.');
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
      showToast('Payment entry updated.');
      fetchLedger();
    } catch (err: any) {
      setEditError(err.response?.data?.message || 'Failed to update entry.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // ── delete entry ───────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteEntryId) return;
    setDeleteSubmitting(true);
    try {
      await (adminAPI as any).ledger.delete(deleteEntryId);
      setDeleteEntryId(null);
      showToast('Payment entry deleted.');
      fetchLedger();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete entry.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // ── render ─────────────────────────────────────────────────────────────
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

  const activeLoan = loans.find(l => l.id === activeLoanId) ?? loans[0] ?? null;
  const fullName = employee ? [employee.last_name, employee.first_name, employee.middle_name].filter(Boolean).join(', ') : '';

  return (
    <div className="min-h-screen bg-slate-100">

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-full px-4 py-3 flex items-center gap-4 flex-wrap">
          <Link href="/admin/report" className="text-slate-500 hover:text-slate-800 text-sm flex items-center gap-1">
            ← Report
          </Link>
          <Link href="/admin/dashboard" className="text-slate-400 hover:text-slate-700 text-sm">Dashboard</Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-slate-800 uppercase tracking-widest">
              PROVIDENT LOAN FUND — EMPLOYEE LEDGER
            </h1>
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
      )}

      {/* ── Employee Info Card ── */}
      {employee && (
        <div className="mx-4 mt-4 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Name</p>
              <p className="font-bold text-slate-800 text-base">{fullName}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Employee Number</p>
              <p className="font-mono font-semibold text-slate-700">{employee.employee_number}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Station</p>
              <p className="text-slate-700">{employee.station || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Position</p>
              <p className="text-slate-700">{employee.position || '—'}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Loan Tabs ── */}
      {loans.length > 1 && (
        <div className="mx-4 mt-4 flex gap-2 flex-wrap">
          {loans.map((loan, idx) => (
            <button
              key={loan.id}
              onClick={() => setActiveLoanId(loan.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition ${
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

      {/* ── Loan Summary Card ── */}
      {activeLoan && (
        <div className="mx-4 mt-3 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          {/* Header row */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Loan Details</h2>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusBadge(activeLoan.status)}`}>
                {activeLoan.status}
              </span>
            </div>
            <button
              onClick={() => openPayModal(activeLoan.id)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded shadow transition"
            >
              + Record Payment
            </button>
          </div>

          {/* Loan info grid — matches Google Sheet columns */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-3 text-sm border-t border-slate-100 pt-4">
            <div>
              <p className="text-[10px] text-slate-400 uppercase">Date Granted</p>
              <p className="font-mono text-slate-700">{fmtDate(activeLoan.loan_application_date)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase">Loan Amount</p>
              <p className="font-semibold text-slate-800">{peso(activeLoan.loan_amount)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase">No. of Months</p>
              <p className="text-slate-700">{activeLoan.no_of_months}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase">Amount w/ Interest</p>
              <p className="text-slate-700">
                {activeLoan.interest_rate > 0
                  ? peso(activeLoan.loan_amount * (1 + activeLoan.interest_rate / 100))
                  : peso(activeLoan.loan_amount)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase">Effective Date</p>
              <p className="font-mono text-slate-700">{fmtDate(activeLoan.effective_date)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase">Termination Date</p>
              <p className="font-mono text-slate-700">{fmtDate(activeLoan.termination_date)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase">Monthly Amortization</p>
              <p className="font-semibold text-blue-700">{peso(activeLoan.monthly_amortization)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase">Check Number</p>
              <p className="font-mono text-slate-700">{activeLoan.check_number || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase">Check Date</p>
              <p className="font-mono text-slate-700">{fmtDate(activeLoan.check_date)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase">Months Paid</p>
              <p className="text-slate-700">{activeLoan.no_of_months_paid}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase">Remaining Balance</p>
              <p className="font-bold text-orange-600">{peso(activeLoan.loan_balance)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase">Remarks</p>
              <p className="text-slate-500 italic text-xs">{activeLoan.remarks || '—'}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Ledger Table ── */}
      {activeLoan && (
        <div className="mx-4 mt-4 mb-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
              Payment Ledger
              <span className="ml-2 text-[11px] text-slate-400 font-normal normal-case">
                ({activeLoan.ledger_entries.length} entries)
              </span>
            </h3>
          </div>

          {/* Headers match Google Sheet exactly:
              Date of Deduction | Payment w/ Interest | Principal Payments | Months Paid / Balance | Total Payment w/ Interest | Balance */}
          <table className="w-full min-w-[900px] text-xs border-collapse">
            <thead>
              <tr className="bg-slate-700 text-white">
                <th className="px-3 py-2 text-center border border-slate-600 w-6">#</th>
                <th className="px-3 py-2 text-left border border-slate-600">Date of Deduction</th>
                <th className="px-3 py-2 text-right border border-slate-600">Payment w/ Interest</th>
                <th className="px-3 py-2 text-right border border-slate-600">Principal Payments</th>
                <th className="px-3 py-2 text-center border border-slate-600">Paid</th>
                <th className="px-3 py-2 text-center border border-slate-600">Balance (Months)</th>
                <th className="px-3 py-2 text-right border border-slate-600">Monthly Payment</th>
                <th className="px-3 py-2 text-right border border-slate-600">Balance</th>
                <th className="px-3 py-2 text-left border border-slate-600">Reference</th>
                <th className="px-3 py-2 text-left border border-slate-600">Notes</th>
                <th className="px-3 py-2 text-center border border-slate-600 w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeLoan.ledger_entries.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center py-6 text-slate-400">
                    No payment records yet. Click "Record Payment" to add one.
                  </td>
                </tr>
              )}
              {activeLoan.ledger_entries.map((entry, idx) => (
                <tr key={entry.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-3 py-1.5 text-center text-slate-400 border border-slate-200">{idx + 1}</td>
                  <td className="px-3 py-1.5 font-mono border border-slate-200">
                    {fmtDate(entry.date_of_deduction || entry.payment_date)}
                  </td>
                  <td className="px-3 py-1.5 text-right border border-slate-200">
                    {entry.payment_with_interest != null ? peso(entry.payment_with_interest) : peso(entry.amount_paid)}
                  </td>
                  <td className="px-3 py-1.5 text-right border border-slate-200">
                    {entry.principal_payments != null ? peso(entry.principal_payments) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-center border border-slate-200">
                    {entry.paid_months ?? (idx + 1)}
                  </td>
                  <td className="px-3 py-1.5 text-center border border-slate-200 text-slate-500">
                    {activeLoan.no_of_months - (entry.paid_months ?? (idx + 1))}
                  </td>
                  <td className="px-3 py-1.5 text-right border border-slate-200">
                    {entry.monthly_payment_amount != null ? peso(entry.monthly_payment_amount) : peso(entry.amount_paid)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold border border-slate-200 text-orange-700">
                    {entry.balance != null ? peso(entry.balance) : peso(entry.new_balance)}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-slate-500 border border-slate-200">
                    {entry.reference_number || '—'}
                  </td>
                  <td className="px-3 py-1.5 text-slate-500 italic border border-slate-200">
                    {entry.notes || '—'}
                  </td>
                  <td className="px-3 py-1.5 text-center border border-slate-200">
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={() => openEditEntry(entry)}
                        className="px-2 py-0.5 text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteEntryId(entry.id)}
                        className="px-2 py-0.5 text-[10px] bg-red-50 hover:bg-red-100 text-red-600 rounded border border-red-200 transition"
                      >
                        Del
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {activeLoan.ledger_entries.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-700 border-t-2 border-slate-400">
                  <td colSpan={2} className="px-3 py-2 text-right text-xs border border-slate-300 uppercase tracking-wide">Totals</td>
                  <td className="px-3 py-2 text-right text-xs border border-slate-300 text-blue-700">
                    {peso(activeLoan.ledger_entries.reduce((s, e) => s + (e.payment_with_interest ?? e.amount_paid ?? 0), 0))}
                  </td>
                  <td className="px-3 py-2 text-right text-xs border border-slate-300 text-slate-600">
                    {peso(activeLoan.ledger_entries.reduce((s, e) => s + (e.principal_payments ?? 0), 0))}
                  </td>
                  <td colSpan={3} className="border border-slate-300" />
                  <td className="px-3 py-2 text-right text-xs border border-slate-300 text-orange-700">
                    {peso(activeLoan.loan_balance)}
                  </td>
                  <td colSpan={3} className="border border-slate-300" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {loans.length === 0 && !loading && (
        <div className="mx-4 mt-6 text-center text-slate-400 text-sm py-12 bg-white rounded-xl border border-slate-200">
          No loan records found for this employee.
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
                <label className="block text-xs font-medium text-slate-600 mb-1">Amount Paid <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₱</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={payForm.amount_paid}
                    onChange={e => setPayForm(f => ({ ...f, amount_paid: e.target.value }))}
                    className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={payForm.payment_date}
                  onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Reference Number</label>
                <input
                  type="text"
                  value={payForm.reference_number}
                  onChange={e => setPayForm(f => ({ ...f, reference_number: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-blue-500"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <textarea
                  value={payForm.notes}
                  onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setPayModal(false)}
                className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={submitPayment}
                disabled={paySubmitting}
                className="px-5 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold transition flex items-center gap-2"
              >
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
                <label className="block text-xs font-medium text-slate-600 mb-1">Amount Paid</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₱</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editForm.amount_paid}
                    onChange={e => setEditForm(f => ({ ...f, amount_paid: e.target.value }))}
                    className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={editForm.payment_date}
                  onChange={e => setEditForm(f => ({ ...f, payment_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Reference Number</label>
                <input
                  type="text"
                  value={editForm.reference_number}
                  onChange={e => setEditForm(f => ({ ...f, reference_number: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <textarea
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setEditEntry(null)}
                className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={submitEditEntry}
                disabled={editSubmitting}
                className="px-5 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold transition flex items-center gap-2"
              >
                {editSubmitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {editSubmitting ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteEntryId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-base font-bold text-red-700">Delete Payment Entry</h2>
            <p className="text-sm text-slate-600">
              Are you sure you want to delete this payment entry? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setDeleteEntryId(null)}
                className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteSubmitting}
                className="px-5 py-2 text-sm rounded bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white font-semibold transition flex items-center gap-2"
              >
                {deleteSubmitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {deleteSubmitting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
