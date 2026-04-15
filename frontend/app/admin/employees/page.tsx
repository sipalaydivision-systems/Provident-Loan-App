'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminAPI } from '../../lib/api';

// ── types ──────────────────────────────────────────────────────────────────
interface Employee {
  id: number;
  employee_number: string;
  station: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  position: string;
  department: string;
  email: string | null;
  phone: string | null;
  status: string;
}

// ── helpers ────────────────────────────────────────────────────────────────
const peso = (v: number | string | null | undefined) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  return isNaN(n) ? '—' : '₱ ' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const emptyEmp = {
  employee_number: '', station: '', first_name: '', last_name: '',
  middle_name: '', position: '', department: '', email: '', phone: '', status: 'active',
};

const emptyLoan = {
  loan_amount: '', no_of_months: '', monthly_amortization: '',
  interest_rate: '0', loan_application_date: '', check_number: '',
  check_date: '', effective_date: '', termination_date: '',
  status: 'ACTIVE', remarks: '', notes: '',
};

const STATUSES = [
  'ACTIVE',
  'QUALIFIED FOR RENEWAL',
  'NOT QUALIFIED FOR RENEWAL',
  'NOT QUALIFIED',
  'FULLY PAID',
  'NO LOAN',
  'DECEASED',
  'RESIGNED',
  'RETIRED',
];

function statusColor(s: string) {
  const u = (s || '').toUpperCase();
  if (u === 'ACTIVE') return 'bg-green-100 text-green-700';
  if (u === 'QUALIFIED FOR RENEWAL') return 'bg-blue-100 text-blue-700';
  if (u === 'NOT QUALIFIED FOR RENEWAL' || u === 'NOT QUALIFIED') return 'bg-red-100 text-red-700';
  if (u === 'FULLY PAID') return 'bg-slate-100 text-slate-600';
  if (u === 'NO LOAN') return 'bg-gray-100 text-gray-500';
  if (u === 'DECEASED') return 'bg-gray-800 text-white';
  if (u === 'RESIGNED' || u === 'RETIRED') return 'bg-orange-100 text-orange-700';
  return 'bg-yellow-100 text-yellow-700';
}

// ── component ──────────────────────────────────────────────────────────────
export default function AccountManagementPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // ── emp modal ──────────────────────────────────────────────────────────
  const [empModal, setEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [empForm, setEmpForm] = useState({ ...emptyEmp });
  const [empSubmitting, setEmpSubmitting] = useState(false);
  const [empError, setEmpError] = useState('');

  // ── delete emp ─────────────────────────────────────────────────────────
  const [deleteEmpNum, setDeleteEmpNum] = useState<string | null>(null);
  const [deleteEmpSubmitting, setDeleteEmpSubmitting] = useState(false);

  // ── loan modal ─────────────────────────────────────────────────────────
  const [loanModal, setLoanModal] = useState(false);
  const [loanForEmp, setLoanForEmp] = useState<Employee | null>(null);
  const [loanForm, setLoanForm] = useState({ ...emptyLoan });
  const [loanSubmitting, setLoanSubmitting] = useState(false);
  const [loanError, setLoanError] = useState('');

  // ── toast ──────────────────────────────────────────────────────────────
  const [toast, setToast] = useState('');
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    if (!localStorage.getItem('user')) { router.push('/admin/login'); return; }
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.employees.getAll({ page: 1, limit: 500 });
      setEmployees(res.data.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return employees;
    return employees.filter(e =>
      e.employee_number.toLowerCase().includes(q) ||
      e.first_name.toLowerCase().includes(q) ||
      e.last_name.toLowerCase().includes(q) ||
      (e.station || '').toLowerCase().includes(q) ||
      (e.position || '').toLowerCase().includes(q)
    );
  }, [employees, search]);

  // ── employee CRUD ──────────────────────────────────────────────────────
  const openAddEmp = () => {
    setEditingEmp(null);
    setEmpForm({ ...emptyEmp });
    setEmpError('');
    setEmpModal(true);
  };

  const openEditEmp = (emp: Employee) => {
    setEditingEmp(emp);
    setEmpForm({
      employee_number: emp.employee_number,
      station: emp.station || '',
      first_name: emp.first_name,
      last_name: emp.last_name,
      middle_name: emp.middle_name || '',
      position: emp.position || '',
      department: emp.department || '',
      email: emp.email || '',
      phone: emp.phone || '',
      status: emp.status || 'active',
    });
    setEmpError('');
    setEmpModal(true);
  };

  const submitEmp = async () => {
    if (!empForm.employee_number || !empForm.first_name || !empForm.last_name) {
      setEmpError('Employee number, first name, and last name are required.');
      return;
    }
    setEmpSubmitting(true);
    setEmpError('');
    try {
      if (editingEmp) {
        await adminAPI.employees.update(editingEmp.employee_number, empForm);
        showToast('Employee updated.');
      } else {
        await adminAPI.employees.create(empForm);
        showToast('Employee created.');
      }
      setEmpModal(false);
      fetchEmployees();
    } catch (err: any) {
      setEmpError(err.response?.data?.message || 'Failed to save employee.');
    } finally {
      setEmpSubmitting(false);
    }
  };

  const confirmDeleteEmp = async () => {
    if (!deleteEmpNum) return;
    setDeleteEmpSubmitting(true);
    try {
      await adminAPI.employees.delete(deleteEmpNum);
      setDeleteEmpNum(null);
      showToast('Employee deleted.');
      fetchEmployees();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete.');
    } finally {
      setDeleteEmpSubmitting(false);
    }
  };

  // ── loan CRUD ──────────────────────────────────────────────────────────
  const openAddLoan = (emp: Employee) => {
    setLoanForEmp(emp);
    setLoanForm({ ...emptyLoan });
    setLoanError('');
    setLoanModal(true);
  };

  const submitLoan = async () => {
    if (!loanForEmp || !loanForm.loan_amount || !loanForm.no_of_months) {
      setLoanError('Loan amount and number of months are required.');
      return;
    }
    setLoanSubmitting(true);
    setLoanError('');
    try {
      const amt = parseFloat(loanForm.loan_amount);
      const mos = parseInt(loanForm.no_of_months);
      await (adminAPI as any).loans.create({
        employee_number: loanForEmp.employee_number,
        loan_amount: amt,
        no_of_months: mos,
        monthly_amortization: loanForm.monthly_amortization
          ? parseFloat(loanForm.monthly_amortization)
          : parseFloat((amt / mos).toFixed(2)),
        interest_rate: parseFloat(loanForm.interest_rate || '0'),
        loan_application_date: loanForm.loan_application_date || null,
        check_number: loanForm.check_number || null,
        check_date: loanForm.check_date || null,
        effective_date: loanForm.effective_date || null,
        termination_date: loanForm.termination_date || null,
        status: loanForm.status,
        remarks: loanForm.remarks || null,
        notes: loanForm.notes || null,
        loan_balance: amt,
        no_of_months_paid: 0,
      });
      setLoanModal(false);
      showToast(`Loan created for ${loanForEmp.first_name} ${loanForEmp.last_name}.`);
    } catch (err: any) {
      setLoanError(err.response?.data?.message || 'Failed to create loan.');
    } finally {
      setLoanSubmitting(false);
    }
  };

  // ── shared styles ──────────────────────────────────────────────────────
  const inp = 'w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:border-blue-500';
  const lbl = 'block text-[11px] font-medium text-slate-500 mb-0.5';

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100">

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-full px-4 py-3 flex items-center gap-3 flex-wrap">
          <Link href="/admin/dashboard" className="text-slate-500 hover:text-slate-800 text-sm">← Dashboard</Link>
          <span className="text-slate-300">|</span>
          <Link href="/admin/report" className="text-slate-400 hover:text-slate-700 text-sm">Summary Report</Link>
          <div className="flex-1 text-center">
            <h1 className="text-sm font-bold text-slate-800 uppercase tracking-widest">ACCOUNT MANAGEMENT</h1>
            <p className="text-[11px] text-slate-400">Employees &amp; Loans — click an employee row to open their Ledger Card</p>
          </div>
          <input
            type="text"
            placeholder="Search name, emp no, station…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-sm border border-slate-300 rounded px-3 py-1.5 w-52 focus:outline-none focus:border-blue-500"
          />
          <button onClick={openAddEmp}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded shadow transition">
            + Add Employee
          </button>
        </div>
      </header>

      {/* Stats bar */}
      <div className="px-4 pt-4 pb-2 flex gap-3 flex-wrap">
        {[
          { label: 'Total Employees', value: employees.length, color: 'text-slate-700' },
          { label: 'Active', value: employees.filter(e => e.status === 'active').length, color: 'text-green-700' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-lg border border-slate-200 px-4 py-2 shadow-sm min-w-[140px]">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">{c.label}</p>
            <p className={`text-base font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="px-4 pb-8 overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse shadow-sm text-sm">
          <thead>
            <tr className="bg-slate-700 text-white text-[11px] uppercase tracking-wide">
              <th className="px-3 py-2 text-left border border-slate-600">Employee No.</th>
              <th className="px-3 py-2 text-left border border-slate-600">Name</th>
              <th className="px-3 py-2 text-left border border-slate-600">Station</th>
              <th className="px-3 py-2 text-left border border-slate-600">Position</th>
              <th className="px-3 py-2 text-left border border-slate-600">Department</th>
              <th className="px-3 py-2 text-center border border-slate-600">Status</th>
              <th className="px-3 py-2 text-center border border-slate-600 w-48">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-10 text-slate-400 text-sm">
                  {search ? 'No employees match your search.' : 'No employees yet. Click "+ Add Employee" to get started.'}
                </td>
              </tr>
            )}
            {filtered.map((emp, idx) => {
              const fullName = [emp.last_name, emp.first_name, emp.middle_name].filter(Boolean).join(', ');
              return (
                <tr
                  key={emp.employee_number}
                  className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50 transition-colors cursor-pointer`}
                  onClick={() => router.push(`/admin/ledger/${emp.employee_number}`)}
                >
                  <td className="px-3 py-2 font-mono text-blue-700 border border-slate-200 underline underline-offset-2">
                    {emp.employee_number}
                  </td>
                  <td className="px-3 py-2 font-medium border border-slate-200">{fullName}</td>
                  <td className="px-3 py-2 border border-slate-200">{emp.station || '—'}</td>
                  <td className="px-3 py-2 border border-slate-200">{emp.position || '—'}</td>
                  <td className="px-3 py-2 border border-slate-200">{emp.department || '—'}</td>
                  <td className="px-3 py-2 text-center border border-slate-200">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${statusColor(emp.status)}`}>
                      {emp.status || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center border border-slate-200" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1 justify-center flex-wrap">
                      <button
                        onClick={() => router.push(`/admin/ledger/${emp.employee_number}`)}
                        className="px-2 py-0.5 text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded border border-indigo-200 transition"
                      >
                        Ledger
                      </button>
                      <button
                        onClick={() => openAddLoan(emp)}
                        className="px-2 py-0.5 text-[10px] bg-green-50 hover:bg-green-100 text-green-700 rounded border border-green-200 transition"
                      >
                        + Loan
                      </button>
                      <button
                        onClick={() => openEditEmp(emp)}
                        className="px-2 py-0.5 text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteEmpNum(emp.employee_number)}
                        className="px-2 py-0.5 text-[10px] bg-red-50 hover:bg-red-100 text-red-600 rounded border border-red-200 transition"
                      >
                        Del
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Add / Edit Employee Modal ── */}
      {empModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-slate-800">{editingEmp ? 'Edit Employee' : 'Add New Employee'}</h2>
            {empError && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded">{empError}</p>}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Employee Number <span className="text-red-500">*</span></label>
                <input type="text" value={empForm.employee_number} disabled={!!editingEmp}
                  onChange={e => setEmpForm(f => ({ ...f, employee_number: e.target.value }))}
                  className={inp + (editingEmp ? ' bg-slate-100 cursor-not-allowed' : '')} />
              </div>
              <div>
                <label className={lbl}>Last Name <span className="text-red-500">*</span></label>
                <input type="text" value={empForm.last_name}
                  onChange={e => setEmpForm(f => ({ ...f, last_name: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>First Name <span className="text-red-500">*</span></label>
                <input type="text" value={empForm.first_name}
                  onChange={e => setEmpForm(f => ({ ...f, first_name: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Middle Name / Initial</label>
                <input type="text" value={empForm.middle_name}
                  onChange={e => setEmpForm(f => ({ ...f, middle_name: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Station</label>
                <input type="text" value={empForm.station}
                  onChange={e => setEmpForm(f => ({ ...f, station: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Position</label>
                <input type="text" value={empForm.position}
                  onChange={e => setEmpForm(f => ({ ...f, position: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Department</label>
                <input type="text" value={empForm.department}
                  onChange={e => setEmpForm(f => ({ ...f, department: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Email</label>
                <input type="email" value={empForm.email}
                  onChange={e => setEmpForm(f => ({ ...f, email: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Phone</label>
                <input type="text" value={empForm.phone}
                  onChange={e => setEmpForm(f => ({ ...f, phone: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Status</label>
                <select value={empForm.status}
                  onChange={e => setEmpForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEmpModal(false)}
                className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-600 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button onClick={submitEmp} disabled={empSubmitting}
                className="px-5 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold transition flex items-center gap-2">
                {empSubmitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {empSubmitting ? 'Saving…' : editingEmp ? 'Save Changes' : 'Create Employee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Loan Modal ── */}
      {loanModal && loanForEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div>
              <h2 className="text-base font-bold text-slate-800">Add Loan</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {[loanForEmp.last_name, loanForEmp.first_name, loanForEmp.middle_name].filter(Boolean).join(', ')}
                {' '}— #{loanForEmp.employee_number}
              </p>
            </div>
            {loanError && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded">{loanError}</p>}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Loan Amount <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₱</span>
                  <input type="number" step="0.01" value={loanForm.loan_amount}
                    onChange={e => setLoanForm(f => ({ ...f, loan_amount: e.target.value }))}
                    className={inp + ' pl-7'} placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className={lbl}>No. of Months <span className="text-red-500">*</span></label>
                <input type="number" value={loanForm.no_of_months}
                  onChange={e => setLoanForm(f => ({ ...f, no_of_months: e.target.value }))}
                  className={inp} placeholder="60" />
              </div>
              <div>
                <label className={lbl}>Monthly Amortization</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₱</span>
                  <input type="number" step="0.01" value={loanForm.monthly_amortization}
                    onChange={e => setLoanForm(f => ({ ...f, monthly_amortization: e.target.value }))}
                    className={inp + ' pl-7'} placeholder="Auto-calc" />
                </div>
              </div>
              <div>
                <label className={lbl}>Interest Rate (%)</label>
                <input type="number" step="0.01" value={loanForm.interest_rate}
                  onChange={e => setLoanForm(f => ({ ...f, interest_rate: e.target.value }))}
                  className={inp} placeholder="0" />
              </div>
              <div>
                <label className={lbl}>Date Granted</label>
                <input type="date" value={loanForm.loan_application_date}
                  onChange={e => setLoanForm(f => ({ ...f, loan_application_date: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Check Number</label>
                <input type="text" value={loanForm.check_number}
                  onChange={e => setLoanForm(f => ({ ...f, check_number: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Check Date</label>
                <input type="date" value={loanForm.check_date}
                  onChange={e => setLoanForm(f => ({ ...f, check_date: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Effective Date</label>
                <input type="date" value={loanForm.effective_date}
                  onChange={e => setLoanForm(f => ({ ...f, effective_date: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Termination Date</label>
                <input type="date" value={loanForm.termination_date}
                  onChange={e => setLoanForm(f => ({ ...f, termination_date: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Status</label>
                <select value={loanForm.status}
                  onChange={e => setLoanForm(f => ({ ...f, status: e.target.value }))} className={inp}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={lbl}>Remarks</label>
                <input type="text" value={loanForm.remarks}
                  onChange={e => setLoanForm(f => ({ ...f, remarks: e.target.value }))} className={inp} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Notes</label>
                <input type="text" value={loanForm.notes}
                  onChange={e => setLoanForm(f => ({ ...f, notes: e.target.value }))} className={inp} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setLoanModal(false)}
                className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-600 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button onClick={submitLoan} disabled={loanSubmitting}
                className="px-5 py-2 text-sm rounded bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white font-semibold transition flex items-center gap-2">
                {loanSubmitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {loanSubmitting ? 'Creating…' : 'Create Loan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Employee Confirm ── */}
      {deleteEmpNum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-base font-bold text-red-700">Delete Employee</h2>
            <p className="text-sm text-slate-600">
              Are you sure you want to delete this employee? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteEmpNum(null)}
                className="px-4 py-2 text-sm rounded border border-slate-300 text-slate-600 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button onClick={confirmDeleteEmp} disabled={deleteEmpSubmitting}
                className="px-5 py-2 text-sm rounded bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white font-semibold transition flex items-center gap-2">
                {deleteEmpSubmitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {deleteEmpSubmitting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
