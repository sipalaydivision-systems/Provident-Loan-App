'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ledgerAPI, downloadExport } from '../../lib/api';
import { Card, PageTitle, Loading, Alert, Btn, Pill, peso, periodLabel, inputCls, inputInline, th, td, tdNum, errMsg, Empty, addPeriod, currentPeriod } from '../../lib/ui';

const TABS = [
  ['stop-deduction', 'Stop-deduction list', 'Loans whose last deduction falls in the month, plus paid or over-deducted loans still being deducted. Send to payroll.', true],
  ['renewal-eligible', 'Qualified for re-loan', 'Current loans that meet the renewal rule.', false],
  ['maturing', 'Maturing', 'Loans whose final deduction is in the month.', true],
  ['no-deduction', 'Months not deducted', 'Active loans with posted months that have no deduction on the card.', false],
  ['refunds', 'Refunds due', 'Over-deductions after the loan was fully paid.', false],
  ['collections', 'Collections', 'Expected vs posted deductions for the month.', true],
  ['annex-a', 'Moratorium (Annex A)', 'Report to the PF National Board of Trustees.', false],
];

export default function ReportsPage() {
  const [tab, setTab] = useState('stop-deduction');
  const [period, setPeriod] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t) setTab(t);
    ledgerAPI.overview().then((r) => setPeriod(r.data.data.next_period)).catch(() => setPeriod(addPeriod(currentPeriod(), 0)));
  }, []);

  const meta = TABS.find((t) => t[0] === tab);
  useEffect(() => {
    if (!period) return;
    setLoading(true); setError('');
    ledgerAPI.report(tab, meta[3] ? { period } : {}).then((r) => setData(r.data.data)).catch((e) => setError(errMsg(e))).finally(() => setLoading(false));
  }, [tab, period]); // eslint-disable-line

  const exp = () => downloadExport(`/admin/reports/${tab}/export${meta[3] ? `?period=${period}` : ''}`, `PF-${tab}-${meta[3] ? period : 'current'}.xlsx`).catch((e) => setError(errMsg(e)));

  return (
    <div>
      <PageTitle title="Reports" subtitle={meta[2]} actions={<>
        {meta[3] && <input type="month" className={`${inputInline} w-40`} value={period} onChange={(e) => setPeriod(e.target.value)} />}
        <Btn variant="outline" onClick={() => window.print()}>Print</Btn>
        <Btn onClick={exp}>Export to Excel</Btn>
      </>} />
      <div className="mb-4 flex flex-wrap gap-1 print:hidden">
        {TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 text-sm ${tab === k ? 'bg-blue-800 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}>{l}</button>)}
      </div>
      <h2 className="mb-2 hidden text-lg font-semibold print:block">{meta[1]}{meta[3] ? ` – ${periodLabel(period, true)}` : ''}</h2>
      <Alert>{error}</Alert>
      <Card bodyClass="p-0">
        {loading && <Loading />}
        {!loading && data && (tab === 'annex-a' ? <AnnexA data={data} /> : tab === 'collections' ? <Collections data={data} /> : <List tab={tab} rows={data.rows || []} />)}
      </Card>
    </div>
  );
}

function List({ tab, rows }) {
  if (!rows.length) return <Empty>Nothing to report.</Empty>;
  const extra = { 'stop-deduction': ['Action', (r) => r.action], 'renewal-eligible': ['Qualified since', (r) => periodLabel(r.eligible_from)], refunds: ['Refund due', (r) => `₱${peso(r.refund_due)}`], 'no-deduction': ['Months without deduction', (r) => (r.missed_periods || []).map((p) => periodLabel(p)).join(', ')], maturing: ['Last deduction', (r) => periodLabel(r.maturity_period)] }[tab];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse">
        <thead><tr>{['#', 'Stn', 'Employee No.', 'Name', 'Loan Amount', 'Monthly', 'Paid', 'Balance', extra?.[0]].filter(Boolean).map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.loan_id}-${i}`}>
              <td className={`${td} text-slate-500`}>{i + 1}</td>
              <td className={td}>{r.station}</td>
              <td className={`${td} font-mono text-xs`}>{r.employee_number}</td>
              <td className={td}><Link className="text-blue-800 hover:underline" href={`/admin/ledger/${r.employee_number}`}>{r.name}</Link></td>
              <td className={tdNum}>{peso(r.loan_amount)}</td>
              <td className={tdNum}>{peso(r.monthly_amortization)}</td>
              <td className={`${td} text-center`}>{r.months_paid}/{r.no_of_months}</td>
              <td className={tdNum}>{peso(r.balance)}</td>
              {extra && <td className={`${td} max-w-[420px] text-xs`}>{extra[1](r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Collections({ data }) {
  const rows = data.rows || [];
  const unposted = rows.filter((r) => r.state !== 'posted' && r.expected > 0);
  return (
    <div>
      <div className="flex flex-wrap gap-4 border-b border-slate-100 p-3 text-sm">
        <span>Expected: <b>₱{peso(data.totals.expected)}</b></span>
        <span>Posted: <b>₱{peso(data.totals.posted)}</b></span>
        <span>Not yet posted: <b>{unposted.length}</b></span>
        {data.moratorium && <Pill tone="amber">Moratorium month</Pill>}
      </div>
      <List tab="collections" rows={rows.map((r) => ({ ...r, months_paid: '', no_of_months: '' }))} />
    </div>
  );
}

function AnnexA({ data }) {
  return (
    <div className="p-4">
      <h3 className="mb-2 text-center text-sm font-bold">ANNEX A: THREE (3)-MONTH MORATORIUM ON PROVIDENT FUND LOANS</h3>
      <table className="w-full border-collapse">
        <thead><tr>{['Name of Calamity/Emergency', 'Date Occurred', 'No. of PF Borrowers Affected', 'Schedule of Deferment', 'Total Amount of Amortizations Deferred'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>
          {data.moratoria.map((m, i) => (
            <tr key={i}>
              <td className={td}>{m.name_of_calamity}</td>
              <td className={td}>{m.date_occurred}</td>
              <td className={`${td} text-center`}>{m.borrowers_affected}</td>
              <td className={td}>{m.schedule_of_deferment.split(' to ').map((p) => periodLabel(p, true)).join(' to ')}</td>
              <td className={tdNum}>₱{peso(m.total_amortizations_deferred)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-500">{data.moratoria.map((m) => m.reference).join(' · ')}</p>
      <div className="mt-10 w-64 text-center text-sm"><p className="text-xs">Approved by:</p><p className="mt-8 border-t border-slate-800 pt-1 text-xs">Signature over printed name<br />Chairperson, Regional PF Board of Trustees</p></div>
    </div>
  );
}
