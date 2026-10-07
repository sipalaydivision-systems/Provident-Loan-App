'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ledgerAPI, adminAPI } from '../../lib/api';
import { Card, PageTitle, Loading, Alert, Btn, Pill, Modal, Field, inputCls, inputInline, peso, php, periodLabel, dateLabel, th, td, tdNum, useLoad, errMsg, Empty, addPeriod, currentPeriod } from '../../lib/ui';

const STATUS_TONE = { submitted: 'slate', personnel_verified: 'blue', legal_cleared: 'blue', evaluated: 'blue', recommended: 'violet', approved: 'green', released: 'green', disapproved: 'red', cancelled: 'slate' };
const CHECK_LABEL = { borrower: 'Borrower', term: 'Loan term', amount: 'Loan amount', employment_status: 'Employment status', retirement: 'Retirement age', renewal: 'Renewal (existing loan)', net_take_home_pay: 'Net take-home pay', co_maker: 'Co-maker' };
const ACTION_LABEL = { verify_personnel: 'Personnel verified ✓', clear_legal: 'Legal cleared ✓', evaluate: 'Evaluated by PF Secretariat ✓', recommend: 'Recommend ✓', approve: 'Approve (SDS) ✓', release_check: 'Release check & book loan' };
const PURPOSES = ['Educational', 'Hospitalization/Medical', 'Long medication/Rehabilitation', 'House arrears/Equity', 'House repair', 'Payment of loans from private institutions', 'Calamity', 'Others'];

export default function ApplicationsPage() {
  const [filter, setFilter] = useState('open');
  const { data, error, loading, reload } = useLoad(() => ledgerAPI.applications({ status: filter === 'all' ? undefined : filter }), [filter]);
  const [openNew, setOpenNew] = useState(false);
  const [presetEmp, setPresetEmp] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('new')) { setPresetEmp(p.get('employee') || ''); setOpenNew(true); }
  }, []);

  return (
    <div>
      <PageTitle
        title="Loan applications"
        subtitle="Personnel → Legal → PF Secretariat → Recommendation → SDS approval → Check release"
        actions={<>
          <select className={`${inputInline} w-44`} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="open">In process</option><option value="released">Released</option><option value="disapproved">Disapproved</option><option value="all">All</option>
          </select>
          <Btn onClick={() => { setPresetEmp(''); setOpenNew(true); }}>New application</Btn>
        </>}
      />
      <Alert>{error}</Alert>
      <Card bodyClass="p-0">
        {loading && <Loading />}
        {data && (data.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] border-collapse">
              <thead><tr>{['App. No.', 'Date', 'Borrower', 'Type / purpose', 'Amount', 'Term', 'Monthly', 'Co-maker', 'Checks', 'Status', 'Source'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {data.map((a) => {
                  const failed = Object.values(a.checks || {}).filter((c) => c.ok === false).length;
                  const unknown = Object.values(a.checks || {}).filter((c) => c.ok === null).length;
                  return (
                    <tr key={a.id} className="cursor-pointer hover:bg-blue-50/40" onClick={() => setSelected(a.id)}>
                      <td className={`${td} font-mono text-xs`}>{a.application_no}</td>
                      <td className={`${td} text-xs`}>{dateLabel(a.created_at || a.createdAt)}</td>
                      <td className={td}><span className="font-medium">{a.borrower_name}</span><div className="text-[11px] text-slate-500">{a.employee_number}</div></td>
                      <td className={`${td} text-xs`}>{a.loan_type === 'additional' ? 'Additional' : 'Multi-purpose'}<div className="text-slate-500">{a.purpose}</div></td>
                      <td className={tdNum}>{peso(a.amount)}</td>
                      <td className={`${td} text-center`}>{a.months}</td>
                      <td className={tdNum}>{peso(a.computation?.monthly_amortization)}</td>
                      <td className={`${td} text-xs`}>{a.co_maker_name || '—'}<div><Pill tone={a.co_maker_consent === 'given' ? 'green' : a.co_maker_consent === 'declined' ? 'red' : 'amber'}>{a.co_maker_consent}</Pill></div></td>
                      <td className={td}>{failed ? <Pill tone="red">{failed} failed</Pill> : unknown ? <Pill tone="amber">{unknown} to verify</Pill> : <Pill tone="green">OK</Pill>}</td>
                      <td className={td}><Pill tone={STATUS_TONE[a.status]}>{a.status_label}</Pill></td>
                      <td className={`${td} text-xs text-slate-500`}>{a.submitted_by === 'employee' ? 'Portal' : 'Accounting'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty>No applications here.</Empty>)}
      </Card>
      <NewApplication open={openNew} preset={presetEmp} onClose={() => setOpenNew(false)} onCreated={(a) => { setOpenNew(false); reload(); setSelected(a.id); }} />
      {selected && <Detail id={selected} onClose={() => setSelected(null)} onChanged={reload} />}
    </div>
  );
}

function useEmployees() {
  const [list, setList] = useState([]);
  useEffect(() => { adminAPI.employees.getAll({ page: 1, limit: 2000 }).then((r) => setList(r.data.data || [])).catch(() => {}); }, []);
  return list;
}

function Checks({ checks }) {
  return (
    <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 text-sm">
      {Object.entries(checks || {}).map(([k, c]) => (
        <li key={k} className="flex gap-2 px-3 py-1.5">
          <span className={`w-5 font-bold ${c.ok === true ? 'text-emerald-700' : c.ok === false ? 'text-red-700' : 'text-amber-700'}`}>{c.ok === true ? '✓' : c.ok === false ? '✗' : '?'}</span>
          <span className="w-44 shrink-0 text-slate-600">{CHECK_LABEL[k] || k}</span>
          <span className="text-slate-900">{c.detail}</span>
        </li>
      ))}
    </ul>
  );
}

function Computation({ c }) {
  if (!c) return null;
  return (
    <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
      {[['Monthly amortization', php(c.monthly_amortization)], ['Total payables', php(c.amount_with_interest)], ['Total interest', php(c.total_interest)],
        ['Existing loan balance', php(c.outstanding_balance)], ['Net proceeds', php(c.net_proceeds)], ['Net take-home pay', c.net_take_home_pay == null ? '—' : php(c.net_take_home_pay)]].map(([k, v]) => (
        <div key={k} className="rounded-md bg-slate-50 px-3 py-2"><p className="text-[11px] uppercase text-slate-500">{k}</p><p className="font-semibold tabular-nums">{v}</p></div>
      ))}
    </div>
  );
}

function NewApplication({ open, preset, onClose, onCreated }) {
  const employees = useEmployees();
  const blank = { employee_number: '', loan_type: 'multi_purpose', purpose: 'Educational', purpose_details: '', amount: 100000, months: 60, co_maker_employee_number: '', co_maker_consent: 'given', monthly_basic_salary: '', other_deductions: '', remarks: '' };
  const [f, setF] = useState(blank);
  const [ev, setEv] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { if (open) { setF({ ...blank, employee_number: preset || '' }); setEv(null); setErr(''); } }, [open, preset]); // eslint-disable-line
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const payload = () => ({ ...f, amount: Number(f.amount), months: Number(f.months), monthly_basic_salary: f.monthly_basic_salary === '' ? null : Number(f.monthly_basic_salary), other_deductions: f.other_deductions === '' ? null : Number(f.other_deductions) });
  const evaluate = async () => { setErr(''); try { setEv((await ledgerAPI.evaluateApplication(payload())).data.data); } catch (e) { setErr(errMsg(e)); } };
  const create = async () => { setErr(''); try { onCreated((await ledgerAPI.createApplication(payload())).data.data); } catch (e) { setErr(errMsg(e)); } };
  const name = (no) => { const e = employees.find((x) => x.employee_number === no); return e ? `${e.first_name} ${e.last_name}` : ''; };
  return (
    <Modal open={open} wide title="New loan application (encoded by Accounting)" onClose={onClose} footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="outline" onClick={evaluate}>Check eligibility</Btn><Btn onClick={create} disabled={!f.employee_number}>Submit application</Btn></>}>
      <datalist id="emp-list">{employees.map((e) => <option key={e.employee_number} value={e.employee_number}>{`${e.last_name}, ${e.first_name}`}</option>)}</datalist>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Field label="Borrower (employee no.)" hint={name(f.employee_number)}><input list="emp-list" className={inputCls} value={f.employee_number} onChange={set('employee_number')} /></Field>
        <Field label="Type of loan"><select className={inputCls} value={f.loan_type} onChange={set('loan_type')}><option value="multi_purpose">Multi-purpose (max ₱100,000)</option><option value="additional">Additional – extreme cases (max ₱200,000)</option></select></Field>
        <Field label="Purpose"><select className={inputCls} value={f.purpose} onChange={set('purpose')}>{PURPOSES.map((p) => <option key={p}>{p}</option>)}</select></Field>
        <Field label="Amount (₱)"><input type="number" className={inputCls} value={f.amount} onChange={set('amount')} /></Field>
        <Field label="Term (months)"><select className={inputCls} value={f.months} onChange={set('months')}>{[12, 24, 36, 48, 60].map((m) => <option key={m} value={m}>{m}</option>)}</select></Field>
        <Field label="Co-maker (employee no.)" hint={name(f.co_maker_employee_number)}><input list="emp-list" className={inputCls} value={f.co_maker_employee_number} onChange={set('co_maker_employee_number')} /></Field>
        <Field label="Monthly basic salary (latest payslip)"><input type="number" className={inputCls} value={f.monthly_basic_salary} onChange={set('monthly_basic_salary')} /></Field>
        <Field label="Current total deductions (payslip)" hint="Including the existing PF amortization"><input type="number" className={inputCls} value={f.other_deductions} onChange={set('other_deductions')} /></Field>
        <Field label="Co-maker consent"><select className={inputCls} value={f.co_maker_consent} onChange={set('co_maker_consent')}><option value="given">Signed on the paper form</option><option value="pending">Pending</option></select></Field>
        <Field label="Details / remarks" className="md:col-span-3"><input className={inputCls} value={f.remarks} onChange={set('remarks')} /></Field>
      </div>
      {ev && <div className="mt-4 space-y-3"><Computation c={ev.computation} /><Checks checks={ev.checks} /></div>}
      <div className="mt-3"><Alert>{err}</Alert></div>
    </Modal>
  );
}

function Detail({ id, onClose, onChanged }) {
  const { data: a, error, loading, reload } = useLoad(() => ledgerAPI.application(id), [id]);
  const [remarks, setRemarks] = useState('');
  const [rel, setRel] = useState({ check_number: '', check_date: new Date().toISOString().slice(0, 10), first_deduction_month: addPeriod(currentPeriod(), 1) });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const next = useMemo(() => a?.steps?.find((s) => s.from.includes(a.status)), [a]);
  const act = async (action, extra = {}) => {
    setBusy(true); setErr('');
    try { await ledgerAPI.applicationAction(id, { action, remarks, ...extra }); setRemarks(''); await reload(); onChanged(); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const open = a && !['released', 'disapproved', 'cancelled'].includes(a.status);
  return (
    <Modal open wide title={a ? `Application ${a.application_no} — ${a.borrower_name}` : 'Application'} onClose={onClose}>
      {loading && !a && <Loading />}
      <Alert>{error}</Alert>
      {a && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Pill tone={STATUS_TONE[a.status]}>{a.status_label}</Pill>
            <span>{a.loan_type === 'additional' ? 'Additional' : 'Multi-purpose'} · {a.purpose} · {php(a.amount)} for {a.months} months</span>
            <Link className="ml-auto text-blue-800 underline" href={`/admin/ledger/${a.employee_number}`}>Borrower ledger card</Link>
          </div>
          <Computation c={a.computation} />
          <Checks checks={a.checks} />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-600">Co-maker: <b>{a.co_maker_name || '—'}</b> ({a.co_maker_employee_number || 'none'}) — consent <Pill tone={a.co_maker_consent === 'given' ? 'green' : a.co_maker_consent === 'declined' ? 'red' : 'amber'}>{a.co_maker_consent}</Pill></span>
            {open && a.co_maker_consent !== 'given' && <Btn size="sm" variant="outline" onClick={() => act('co_maker_consent', { decision: 'given' })}>Record signed consent</Btn>}
            {open && <Btn size="sm" variant="ghost" onClick={() => act('reevaluate')}>Re-check eligibility</Btn>}
          </div>
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase text-slate-500">History</h4>
            <ol className="space-y-1 text-sm">
              {(a.history || []).map((h, i) => <li key={i} className="flex gap-2"><span className="w-36 shrink-0 text-xs text-slate-500">{dateLabel(h.at)}</span><span>{h.label}{h.by ? ` — ${h.by}` : ''}{h.remarks ? <span className="text-slate-500"> · {h.remarks}</span> : null}</span></li>)}
            </ol>
          </div>
          {open && (
            <div className="space-y-3 rounded-md border border-slate-200 p-3">
              <Field label="Remarks for this step (optional)"><input className={inputCls} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
              {next?.action === 'release_check' && (
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Check no."><input className={inputCls} value={rel.check_number} onChange={(e) => setRel({ ...rel, check_number: e.target.value })} /></Field>
                  <Field label="Check date"><input type="date" className={inputCls} value={rel.check_date} onChange={(e) => setRel({ ...rel, check_date: e.target.value })} /></Field>
                  <Field label="First payroll deduction"><input type="month" className={inputCls} value={rel.first_deduction_month} onChange={(e) => setRel({ ...rel, first_deduction_month: e.target.value })} /></Field>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {next && <Btn variant="success" disabled={busy} onClick={() => act(next.action, next.action === 'release_check' ? rel : {})}>{ACTION_LABEL[next.action]}</Btn>}
                <Btn variant="danger" disabled={busy} onClick={() => window.confirm('Disapprove this application?') && act('disapprove')}>Disapprove</Btn>
                <Btn variant="outline" disabled={busy} onClick={() => window.confirm('Cancel this application?') && act('cancel')}>Cancel application</Btn>
              </div>
              {next && <p className="text-xs text-slate-500">Next step: {next.label}</p>}
            </div>
          )}
          {a.status === 'released' && <Alert tone="green">Check {a.check_number} released {dateLabel(a.check_date)}; first deduction {periodLabel(a.first_deduction_month, true)}. The loan is on the borrower’s ledger card.</Alert>}
          <Alert>{err}</Alert>
        </div>
      )}
    </Modal>
  );
}
