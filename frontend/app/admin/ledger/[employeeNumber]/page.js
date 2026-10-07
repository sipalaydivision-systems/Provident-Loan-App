'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ledgerAPI, adminAPI } from '../../../lib/api';
import LedgerCardTable from '../../../lib/LedgerCardTable';
import {
  Card, PageTitle, Loading, Alert, Btn, Pill, LoanStatus, Modal, Field, inputCls, peso, php, periodLabel, dateLabel,
  th, td, tdNum, useLoad, errMsg, ENTRY_LABEL, currentPeriod,
} from '../../../lib/ui';

const ENTRY_TYPES = [
  ['deduction', 'Payroll deduction for a month'],
  ['or_payment', 'Monthly payment at the cashier (OR)'],
  ['prepayment', 'Partial payment on principal (OR)'],
  ['payoff', 'Pay the balance in full (OR)'],
  ['refund', 'Refund of over-deduction'],
  ['adjustment', 'Adjustment to balance (+/−)'],
  ['moratorium', 'Moratorium month (no deduction)'],
];

export default function LedgerCardPage() {
  const { employeeNumber } = useParams();
  const { data, error, loading, reload } = useLoad(() => ledgerAPI.card(employeeNumber), [employeeNumber]);
  const [loanIdx, setLoanIdx] = useState(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [empOpen, setEmpOpen] = useState(false);
  const [code, setCode] = useState(null);
  const [msg, setMsg] = useState('');

  const loans = data?.loans || [];
  const idx = loanIdx ?? Math.max(loans.length - 1, 0);
  const cur = loans[idx];

  useEffect(() => { setLoanIdx(null); }, [employeeNumber]);

  const del = async (row) => {
    if (!window.confirm(`Remove the ${ENTRY_LABEL[row.type] || row.type} entry for ${periodLabel(row.period)}? The card will be recomputed.`)) return;
    try { await ledgerAPI.deleteEntry(row.entry_id); setMsg('Entry removed; card recomputed.'); reload(); } catch (e) { setMsg(errMsg(e)); }
  };

  const issueCode = async () => {
    if (!window.confirm('Issue a new portal activation code for this employee? Any earlier unused code stops working.')) return;
    try { const r = await ledgerAPI.portalCode(employeeNumber); setCode(r.data.data); reload(); } catch (e) { setMsg(errMsg(e)); }
  };

  if (loading && !data) return <Loading />;
  if (error) return <Alert>{error}</Alert>;
  if (!data) return null;
  const e = data.employee;
  const s = cur?.card.summary;

  return (
    <div>
      <PageTitle
        title={`${[e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ')}`}
        subtitle={`Employee No. ${e.employee_number} · ${[e.school, e.station ? `Station ${e.station}` : null, e.position].filter(Boolean).join(' · ')}`}
        actions={<>
          <Link href="/admin/summary"><Btn variant="ghost">← Summary</Btn></Link>
          <Btn variant="outline" onClick={() => setEmpOpen(true)}>Employee details</Btn>
          <Btn variant="outline" onClick={issueCode}>{data.portal_account?.activated ? 'Reset portal access' : 'Issue portal code'}</Btn>
          {cur && <>
            <Link href={`/admin/print/${cur.loan.id}?doc=card`} target="_blank"><Btn variant="outline">Print card</Btn></Link>
            <Link href={`/admin/print/${cur.loan.id}?doc=soa`} target="_blank"><Btn variant="outline">Statement of account</Btn></Link>
            <Link href={`/admin/print/${cur.loan.id}?doc=certificate`} target="_blank"><Btn variant="outline">Certificate</Btn></Link>
            <Btn onClick={() => setEntryOpen(true)}>Record entry</Btn>
          </>}
        </>}
      />
      {msg && <div className="mb-3"><Alert tone="blue">{msg}</Alert></div>}

      {!loans.length && <Card><p className="text-sm text-slate-600">No Provident Fund loan on record. Create one through <Link className="text-blue-800 underline" href={`/admin/applications?new=1&employee=${employeeNumber}`}>a new application</Link>.</p></Card>}

      {loans.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2 print:hidden">
          {loans.map((l, i) => (
            <button key={l.loan.id} onClick={() => setLoanIdx(i)} className={`rounded-md border px-3 py-1.5 text-left text-xs ${i === idx ? 'border-blue-800 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
              <span className="block font-semibold">Loan {i + 1}: ₱{peso(l.card.terms.loan_amount)} / {l.card.terms.no_of_months} mos</span>
              <span className="text-slate-500">{periodLabel(l.card.terms.first_deduction)} · {l.card.summary.status === 'active' ? `bal ₱${peso(l.card.summary.balance)}` : l.card.summary.status.replace('_', ' ')}</span>
            </button>
          ))}
        </div>
      )}

      {cur && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <Mini label="Balance" value={php(s.balance)} strong />
            <Mini label="Months paid / left" value={`${s.months_paid} / ${s.months_left}`} />
            <Mini label="Next deduction" value={s.status === 'active' ? `${php(s.next_due_amount)} · ${periodLabel(s.next_due_period)}` : '—'} />
            <Mini label="Last deduction (maturity)" value={periodLabel(s.maturity_period)} />
            <Mini label="Re-loan" value={<LoanStatus status={s.status} eligible={s.renewal_eligible} />} hint={s.status === 'active' ? (s.renewal_eligible ? `since ${periodLabel(s.renewal_eligible_from)}` : `from ${periodLabel(s.renewal_eligible_from)} (${s.payments_required_for_renewal} payments)`) : ''} />
            <Mini label="Interest paid" value={php(s.interest_paid)} hint={s.refund_due > 0 ? <span className="font-medium text-red-700">Refund due ₱{peso(s.refund_due)}</span> : ''} />
          </div>
          {cur.card.rows.some((r) => r.type === 'no_deduction') && (
            <Alert tone="amber">Months without a deduction on this card: {cur.card.rows.filter((r) => r.type === 'no_deduction').map((r) => periodLabel(r.period)).join(', ')}. Check against the payroll register; post any that were actually deducted.</Alert>
          )}
          {Math.abs(cur.card.terms.monthly_amortization - cur.card.terms.expected_amortization) > 0.011 && (
            <Alert tone="amber">Monthly amortization on record ₱{peso(cur.card.terms.monthly_amortization)} differs from the 6% table amount ₱{peso(cur.card.terms.expected_amortization)}.</Alert>
          )}
          <Card
            title="PROVIDENT LEDGER CARD"
            subtitle={`${cur.loan.loan_type === 'additional' ? 'Additional loan' : 'Multi-purpose loan'} · 6% per annum, diminishing balance · posted through ${periodLabel(data.as_of, true)}`}
            actions={<label className="flex items-center gap-1.5 text-sm text-slate-600 print:hidden"><input type="checkbox" checked={showSchedule} onChange={(ev) => setShowSchedule(ev.target.checked)} /> Show remaining schedule</label>}
            bodyClass="p-0"
          >
            <LedgerCardTable loan={cur.loan} card={cur.card} showSchedule={showSchedule} onDelete={del} />
          </Card>
          {(cur.loan.remarks || cur.loan.notes) && <p className="text-xs text-slate-500">Notes: {[cur.loan.notes, cur.loan.remarks].filter(Boolean).join(' · ')}</p>}
        </div>
      )}

      {cur && <EntryModal open={entryOpen} onClose={() => setEntryOpen(false)} loan={cur.loan} card={cur.card} onSaved={(m) => { setMsg(m); setEntryOpen(false); reload(); }} />}
      <EmployeeModal open={empOpen} onClose={() => setEmpOpen(false)} employee={e} onSaved={() => { setEmpOpen(false); setMsg('Employee details saved.'); reload(); }} />
      <Modal open={!!code} title="Portal activation code" onClose={() => setCode(null)} footer={<Btn onClick={() => window.print()}>Print slip</Btn>}>
        {code && (
          <div className="space-y-3 text-sm">
            <p>Give this slip to <b>{code.name}</b>. They sign in at the Employee Portal, choose <b>Activate account</b>, and enter:</p>
            <div className="rounded-md border border-slate-300 p-3 font-mono">
              <div>Employee No.: <b>{code.employee_number}</b></div>
              <div>Activation code: <b className="text-lg tracking-widest">{code.code}</b></div>
              <div className="text-xs text-slate-500">Valid until {dateLabel(code.expires)} · single use</div>
            </div>
            <p className="text-xs text-slate-500">The code is shown only once. Issuing a new code replaces it.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Mini({ label, value, hint, strong }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <div className={`mt-0.5 ${strong ? 'text-lg font-semibold text-blue-900' : 'text-sm font-medium text-slate-900'} tabular-nums`}>{value}</div>
      {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

function EntryModal({ open, onClose, loan, card, onSaved }) {
  const [f, setF] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setF({ entry_type: 'deduction', period: card.summary.next_due_period || currentPeriod(), amount: card.summary.next_due_amount || card.terms.monthly_amortization, reference_number: '', notes: '' });
    setErr('');
  }, [open, card]);
  const set = (k) => (ev) => setF({ ...f, [k]: ev.target.value });
  const onType = (ev) => {
    const t = ev.target.value;
    const amount = t === 'payoff' ? card.summary.balance : ['deduction', 'or_payment'].includes(t) ? (card.summary.next_due_amount || card.terms.monthly_amortization) : t === 'refund' ? card.summary.refund_due : '';
    setF({ ...f, entry_type: t, amount });
  };
  const save = async () => {
    setBusy(true); setErr('');
    try {
      await ledgerAPI.addEntry(loan.id, { ...f, amount: f.amount === '' ? null : Number(f.amount) });
      onSaved(`${ENTRY_LABEL[f.entry_type]} for ${periodLabel(f.period)} recorded; card recomputed.`);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} title="Record ledger entry" onClose={onClose} footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save entry'}</Btn></>}>
      <div className="grid gap-3">
        <Field label="Type of entry">
          <select className={inputCls} value={f.entry_type || ''} onChange={onType}>{ENTRY_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Payroll month"><input type="month" className={inputCls} value={f.period || ''} onChange={set('period')} /></Field>
          {f.entry_type !== 'moratorium' && (
            <Field label={f.entry_type === 'adjustment' ? 'Amount (+ adds to balance, − reduces)' : 'Amount (₱)'} hint={f.entry_type === 'payoff' ? `Outstanding balance ₱${peso(card.summary.balance)}` : f.entry_type === 'deduction' ? `Monthly amortization ₱${peso(card.terms.monthly_amortization)}` : ''}>
              <input type="number" step="0.01" className={inputCls} value={f.amount ?? ''} onChange={set('amount')} />
            </Field>
          )}
        </div>
        <Field label="Reference (OR no., payroll batch, memo)"><input className={inputCls} value={f.reference_number || ''} onChange={set('reference_number')} /></Field>
        <Field label="Remarks"><input className={inputCls} value={f.notes || ''} onChange={set('notes')} /></Field>
        <p className="text-xs text-slate-500">Interest and principal are computed automatically from the balance (0.5% per month). Monthly payroll deductions for all borrowers are faster in <Link className="underline" href="/admin/posting">Monthly posting</Link>.</p>
        <Alert>{err}</Alert>
      </div>
    </Modal>
  );
}

function EmployeeModal({ open, onClose, employee, onSaved }) {
  const [f, setF] = useState({});
  const [err, setErr] = useState('');
  useEffect(() => {
    if (open && employee) setF({
      station: employee.station || '', school: employee.school || '', position: employee.position || '',
      appointment_status: employee.appointment_status || 'permanent', birth_date: employee.birth_date || '',
      date_hired: employee.date_hired ? String(employee.date_hired).slice(0, 10) : '', monthly_basic_salary: employee.monthly_basic_salary ?? '',
      email: employee.email || '', phone: employee.phone || '',
    });
  }, [open, employee]);
  const set = (k) => (ev) => setF({ ...f, [k]: ev.target.value });
  const save = async () => {
    try {
      await adminAPI.employees.update(employee.employee_number, { ...f, monthly_basic_salary: f.monthly_basic_salary === '' ? null : Number(f.monthly_basic_salary), birth_date: f.birth_date || null, date_hired: f.date_hired || null });
      onSaved();
    } catch (e) { setErr(errMsg(e)); }
  };
  return (
    <Modal open={open} title="Employee details (used for eligibility checks)" onClose={onClose} footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn onClick={save}>Save</Btn></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Station"><input className={inputCls} value={f.station || ''} onChange={set('station')} /></Field>
        <Field label="School / office"><input className={inputCls} value={f.school || ''} onChange={set('school')} /></Field>
        <Field label="Position"><input className={inputCls} value={f.position || ''} onChange={set('position')} /></Field>
        <Field label="Appointment status">
          <select className={inputCls} value={f.appointment_status || ''} onChange={set('appointment_status')}>
            {['permanent', 'regular', 'co-terminus', 'casual', 'contractual'].map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="Birth date" hint="For the mandatory-retirement check"><input type="date" className={inputCls} value={f.birth_date || ''} onChange={set('birth_date')} /></Field>
        <Field label="Date hired" hint="For co-maker years of service"><input type="date" className={inputCls} value={f.date_hired || ''} onChange={set('date_hired')} /></Field>
        <Field label="Monthly basic salary (₱)"><input type="number" className={inputCls} value={f.monthly_basic_salary ?? ''} onChange={set('monthly_basic_salary')} /></Field>
        <Field label="DepEd email"><input className={inputCls} value={f.email || ''} onChange={set('email')} /></Field>
      </div>
      <div className="mt-3"><Alert>{err}</Alert></div>
    </Modal>
  );
}
