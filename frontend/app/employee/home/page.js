'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { portalAPI } from '../../lib/api';
import LedgerCardTable from '../../lib/LedgerCardTable';
import { Card, Alert, Btn, Pill, LoanStatus, Field, inputCls, peso, php, periodLabel, dateLabel, Loading, Empty, errMsg, useLoad } from '../../lib/ui';
import Calculator from '../Calculator';

const PURPOSES = ['Educational', 'Hospitalization/Medical', 'Long medication/Rehabilitation', 'House arrears/Equity', 'House repair', 'Payment of loans from private institutions', 'Calamity', 'Others'];
const CHECK_LABEL = { borrower: 'Borrower', term: 'Loan term', amount: 'Loan amount', employment_status: 'Employment status', retirement: 'Retirement age', renewal: 'Existing loan', net_take_home_pay: 'Net take-home pay', co_maker: 'Co-maker' };
const STATUS_TONE = { submitted: 'slate', personnel_verified: 'blue', legal_cleared: 'blue', evaluated: 'blue', recommended: 'violet', approved: 'green', released: 'green', disapproved: 'red', cancelled: 'slate' };

export default function EmployeeHome() {
  const router = useRouter();
  const [tab, setTab] = useState('loan');
  const me = useLoad(() => portalAPI.me(), []);
  useEffect(() => { if (!localStorage.getItem('portal_token')) router.replace('/employee'); }, [router]);
  const signOut = () => { localStorage.removeItem('portal_token'); router.replace('/employee'); };

  const d = me.data;
  const tabs = [['loan', 'My loan'], ['apply', 'Apply / applications'], ['comaker', 'Co-maker requests'], ['notifications', `Notifications${d?.unread_notifications ? ` (${d.unread_notifications})` : ''}`], ['calc', 'Calculator'], ['account', 'Account']];

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-blue-800 text-xs font-bold text-white">PF</span>
          <div className="leading-tight"><p className="text-sm font-semibold">{d?.employee.name || 'Employee Portal'}</p><p className="text-xs text-slate-500">{d ? `Employee No. ${d.employee.employee_number}${d.employee.school ? ` · ${d.employee.school}` : ''}` : 'DepEd Provident Fund'}</p></div>
          <button onClick={signOut} className="ml-auto rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Sign out</button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${tab === k ? 'bg-blue-50 font-medium text-blue-900' : 'text-slate-600 hover:bg-slate-100'}`}>{l}</button>)}
        </nav>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6">
        {me.loading && <Loading />}
        <Alert>{me.error}</Alert>
        {d && tab === 'loan' && <MyLoan d={d} />}
        {d && tab === 'apply' && <Apply d={d} />}
        {d && tab === 'comaker' && <CoMaker />}
        {d && tab === 'notifications' && <Notifications onRead={me.reload} />}
        {d && tab === 'calc' && <Calculator defaultSalary={d.employee.monthly_basic_salary || ''} />}
        {d && tab === 'account' && <Account />}
      </div>
    </main>
  );
}

function MyLoan({ d }) {
  const [idx, setIdx] = useState(d.loans.length - 1);
  const [sched, setSched] = useState(false);
  if (!d.loans.length) return <Card><Empty>You have no Provident Fund loan on record. You can apply under “Apply / applications”.</Empty></Card>;
  const cur = d.loans[idx];
  const s = cur.card.summary;
  return (
    <div className="space-y-4">
      {d.loans.length > 1 && (
        <div className="flex flex-wrap gap-2 print:hidden">
          {d.loans.map((l, i) => <Btn key={l.loan.id} size="sm" variant={i === idx ? 'primary' : 'outline'} onClick={() => setIdx(i)}>₱{peso(l.card.terms.loan_amount)} · {periodLabel(l.card.terms.first_deduction)}</Btn>)}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Box label="Outstanding balance" value={php(s.balance)} strong />
        <Box label="Months paid / remaining" value={`${s.months_paid} / ${s.months_left}`} />
        <Box label="Next deduction" value={s.status === 'active' ? `${php(s.next_due_amount)}` : '—'} hint={s.status === 'active' ? periodLabel(s.next_due_period, true) : ''} />
        <Box label="Re-loan" value={<LoanStatus status={s.status} eligible={s.renewal_eligible} />} hint={s.status === 'active' ? (s.renewal_eligible ? 'You may apply for a renewal' : `Expected from ${periodLabel(s.renewal_eligible_from, true)}`) : ''} />
      </div>
      <Alert tone="blue">Loan of {php(cur.card.terms.loan_amount)} for {cur.card.terms.no_of_months} months at {php(cur.card.terms.monthly_amortization)} a month (6% per annum, diminishing balance). Last deduction expected {periodLabel(s.maturity_period, true)}. Ledger posted through {periodLabel(d.as_of, true)}.</Alert>
      {s.refund_due > 0 && <Alert tone="amber">An over-deduction of {php(s.refund_due)} is recorded on your loan. Please coordinate with the Accounting Section for the refund.</Alert>}
      <Card title="My ledger card" actions={<><label className="flex items-center gap-1.5 text-sm text-slate-600 print:hidden"><input type="checkbox" checked={sched} onChange={(e) => setSched(e.target.checked)} />Show remaining schedule</label><Btn size="sm" variant="outline" onClick={() => window.print()}>Print</Btn></>} bodyClass="p-0">
        <LedgerCardTable loan={cur.loan} card={cur.card} showSchedule={sched} compact />
      </Card>
    </div>
  );
}

function Box({ label, value, hint, strong }) {
  return <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5"><p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p><div className={`mt-0.5 tabular-nums ${strong ? 'text-xl font-semibold text-blue-900' : 'text-sm font-medium'}`}>{value}</div>{hint && <p className="text-[11px] text-slate-500">{hint}</p>}</div>;
}

function Apply({ d }) {
  const list = useLoad(() => portalAPI.applications(), []);
  const [f, setF] = useState({ loan_type: 'multi_purpose', purpose: 'Educational', purpose_details: '', amount: 100000, months: 60, co_maker_employee_number: '', monthly_basic_salary: d.employee.monthly_basic_salary || '', other_deductions: '' });
  const [ev, setEv] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const payload = () => ({ ...f, amount: Number(f.amount), months: Number(f.months), monthly_basic_salary: f.monthly_basic_salary === '' ? null : Number(f.monthly_basic_salary), other_deductions: f.other_deductions === '' ? null : Number(f.other_deductions) });
  const check = async () => { setErr(''); try { setEv((await portalAPI.previewApplication(payload())).data.data); } catch (x) { setErr(errMsg(x)); } };
  const submit = async () => {
    setErr(''); setMsg('');
    if (!window.confirm('Submit this loan application to the Accounting Section?')) return;
    try { const r = await portalAPI.apply(payload()); setMsg(`Application ${r.data.data.application_no} submitted. Bring the signed application form, latest payslip, DepEd ID and your co-maker’s documents to the Accounting Section.`); setEv(null); list.reload(); } catch (x) { setErr(errMsg(x)); }
  };
  const cancel = async (a) => { if (!window.confirm('Cancel this application?')) return; try { await portalAPI.cancelApplication(a.id); list.reload(); } catch (x) { setErr(errMsg(x)); } };
  const open = (list.data || []).some((a) => !['released', 'disapproved', 'cancelled'].includes(a.status));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Apply for a Provident Fund loan" subtitle="Your request goes to the Accounting Section; approval follows the DepEd PF process">
        {open ? <Alert tone="blue">You have an application in process. You can file a new one after it is completed.</Alert> : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type of loan"><select className={inputCls} value={f.loan_type} onChange={set('loan_type')}><option value="multi_purpose">Multi-purpose</option><option value="additional">Additional (extreme cases)</option></select></Field>
            <Field label="Purpose"><select className={inputCls} value={f.purpose} onChange={set('purpose')}>{PURPOSES.map((p) => <option key={p}>{p}</option>)}</select></Field>
            <Field label="Amount (₱)"><input type="number" className={inputCls} value={f.amount} onChange={set('amount')} /></Field>
            <Field label="Term"><select className={inputCls} value={f.months} onChange={set('months')}>{[12, 24, 36, 48, 60].map((m) => <option key={m} value={m}>{m} months</option>)}</select></Field>
            <Field label="Co-maker’s employee number" hint="Permanent, 1+ year in service, salary not lower than yours"><input className={inputCls} value={f.co_maker_employee_number} onChange={set('co_maker_employee_number')} /></Field>
            <Field label="Monthly basic salary (₱)"><input type="number" className={inputCls} value={f.monthly_basic_salary} onChange={set('monthly_basic_salary')} /></Field>
            <Field label="Total deductions on latest payslip (₱)" className="col-span-2"><input type="number" className={inputCls} value={f.other_deductions} onChange={set('other_deductions')} /></Field>
            <Field label="Details" className="col-span-2"><input className={inputCls} value={f.purpose_details} onChange={set('purpose_details')} /></Field>
            <div className="col-span-2 flex gap-2"><Btn variant="outline" onClick={check}>Check my eligibility</Btn><Btn onClick={submit}>Submit application</Btn></div>
          </div>
        )}
        {ev && (
          <div className="mt-4 space-y-2 text-sm">
            <div className="grid grid-cols-3 gap-2">
              <Box label="Monthly" value={php(ev.computation.monthly_amortization)} />
              <Box label="Existing balance" value={php(ev.computation.outstanding_balance)} />
              <Box label="Net proceeds" value={php(ev.computation.net_proceeds)} />
            </div>
            <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
              {Object.entries(ev.checks).map(([k, c]) => <li key={k} className="flex gap-2 px-3 py-1.5"><span className={`w-4 font-bold ${c.ok === true ? 'text-emerald-700' : c.ok === false ? 'text-red-700' : 'text-amber-700'}`}>{c.ok === true ? '✓' : c.ok === false ? '✗' : '?'}</span><span className="w-36 shrink-0 text-slate-600">{CHECK_LABEL[k] || k}</span><span>{c.detail}</span></li>)}
            </ul>
            <p className="text-xs text-slate-500">“?” items are verified by Personnel and the PF Secretariat.</p>
          </div>
        )}
        <div className="mt-3 space-y-2"><Alert>{err}</Alert>{msg && <Alert tone="green">{msg}</Alert>}</div>
      </Card>
      <Card title="My applications">
        {list.loading && <Loading />}
        {(list.data || []).length === 0 && !list.loading && <Empty>No applications yet.</Empty>}
        <ul className="space-y-3">
          {(list.data || []).map((a) => (
            <li key={a.id} className="rounded-md border border-slate-200 p-3 text-sm">
              <div className="flex items-center justify-between"><b>{a.application_no}</b><Pill tone={STATUS_TONE[a.status]}>{a.status_label}</Pill></div>
              <p className="mt-1 text-slate-600">{php(a.amount)} · {a.months} months · {a.purpose} · co-maker consent: {a.co_maker_consent}</p>
              <ol className="mt-2 space-y-0.5 text-xs text-slate-500">{(a.history || []).map((h, i) => <li key={i}>{dateLabel(h.at)} — {h.label}{h.remarks ? ` (${h.remarks})` : ''}</li>)}</ol>
              {a.status === 'submitted' && <button className="mt-2 text-xs text-red-700 underline" onClick={() => cancel(a)}>Cancel application</button>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function CoMaker() {
  const list = useLoad(() => portalAPI.coMakerRequests(), []);
  const [err, setErr] = useState('');
  const decide = async (a, decision) => {
    if (!window.confirm(decision === 'given' ? `Give consent as co-maker for ${a.borrower_name}'s loan of ₱${peso(a.amount)}? As co-maker you assume the outstanding obligation if the borrower separates from the service.` : 'Decline to be co-maker?')) return;
    try { await portalAPI.coMakerDecision(a.id, decision); list.reload(); } catch (x) { setErr(errMsg(x)); }
  };
  return (
    <Card title="Requests to be a co-maker">
      <Alert>{err}</Alert>
      {list.loading && <Loading />}
      {(list.data || []).length === 0 && !list.loading && <Empty>No co-maker requests.</Empty>}
      <ul className="space-y-3">
        {(list.data || []).map((a) => (
          <li key={a.id} className="rounded-md border border-slate-200 p-3 text-sm">
            <p><b>{a.borrower_name}</b> — {php(a.amount)} for {a.months} months ({a.purpose}) · application {a.application_no}</p>
            <p className="text-slate-600">Status: {a.status_label} · your consent: <b>{a.co_maker_consent}</b></p>
            {a.co_maker_consent === 'pending' && !['released', 'disapproved', 'cancelled'].includes(a.status) && (
              <div className="mt-2 flex gap-2"><Btn size="sm" variant="success" onClick={() => decide(a, 'given')}>Give consent</Btn><Btn size="sm" variant="outline" onClick={() => decide(a, 'declined')}>Decline</Btn></div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Notifications({ onRead }) {
  const list = useLoad(() => portalAPI.notifications(), []);
  useEffect(() => { portalAPI.markRead().then(onRead).catch(() => {}); }, []); // eslint-disable-line
  return (
    <Card title="Notifications">
      {list.loading && <Loading />}
      {(list.data || []).length === 0 && !list.loading && <Empty>No notifications.</Empty>}
      <ul className="divide-y divide-slate-100">
        {(list.data || []).map((n) => <li key={n.id} className="py-2.5 text-sm"><p className="font-medium">{n.title}{!n.read_at && <Pill tone="blue" className="ml-2">new</Pill>}</p><p className="text-slate-600">{n.body}</p><p className="text-xs text-slate-400">{dateLabel(n.created_at || n.createdAt)}</p></li>)}
      </ul>
    </Card>
  );
}

function Account() {
  const [f, setF] = useState({ current_password: '', new_password: '', confirm: '' });
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const save = async () => {
    setErr(''); setMsg('');
    if (f.new_password !== f.confirm) { setErr('Passwords do not match.'); return; }
    try { await portalAPI.changePassword(f); setMsg('Password changed.'); setF({ current_password: '', new_password: '', confirm: '' }); } catch (x) { setErr(errMsg(x)); }
  };
  return (
    <Card title="Change password" className="max-w-md">
      <div className="space-y-3">
        <Field label="Current password"><input type="password" className={inputCls} value={f.current_password} onChange={(e) => setF({ ...f, current_password: e.target.value })} /></Field>
        <Field label="New password" hint="At least 8 characters with letters and numbers"><input type="password" className={inputCls} value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} /></Field>
        <Field label="Confirm new password"><input type="password" className={inputCls} value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
        <Alert>{err}</Alert>{msg && <Alert tone="green">{msg}</Alert>}
        <Btn onClick={save}>Change password</Btn>
      </div>
    </Card>
  );
}
