'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ledgerAPI, downloadExport } from '../../lib/api';
import { Card, PageTitle, Loading, Alert, Btn, Pill, LoanStatus, peso, periodLabel, inputCls, inputInline, th, td, tdNum, useLoad, Empty, errMsg } from '../../lib/ui';

export default function SummaryPage() {
  const [all, setAll] = useState(false);
  const { data, error, loading } = useLoad(() => ledgerAPI.summary(all ? { all: 1 } : {}), [all]);
  const [q, setQ] = useState('');
  const [station, setStation] = useState('');
  const [status, setStatus] = useState('');
  const [exporting, setExporting] = useState('');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('q')) setQ(p.get('q'));
  }, []);

  const rows = useMemo(() => {
    const list = data?.rows || [];
    const qq = q.trim().toUpperCase();
    return list.filter((r) =>
      (!qq || r.name.toUpperCase().includes(qq) || r.employee_number.includes(qq) || (r.school || '').toUpperCase().includes(qq))
      && (!station || r.station === station)
      && (!status || (status === 'eligible' ? r.status === 'active' && r.renewal_eligible : status === 'not_eligible' ? r.status === 'active' && !r.renewal_eligible : r.status === status)));
  }, [data, q, station, status]);
  const stations = useMemo(() => [...new Set((data?.rows || []).map((r) => r.station).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [data]);
  const totals = rows.reduce((t, r) => ({ amount: t.amount + (r.status === 'active' ? r.loan_amount : 0), bal: t.bal + r.balance, amort: t.amort + (r.status === 'active' ? r.monthly_amortization : 0) }), { amount: 0, bal: 0, amort: 0 });

  const exportXlsx = async () => {
    setExporting('Preparing…');
    try { await downloadExport(`/admin/summary/export${all ? '?all=1' : ''}`, `PF-SUMMARY-${data?.as_of || ''}.xlsx`); setExporting(''); } catch (e) { setExporting(errMsg(e)); }
  };

  return (
    <div>
      <PageTitle
        title="Summary of Provident Fund loans"
        subtitle={data ? `As of ${periodLabel(data.as_of, true)} · renewal rule: 30% of ${data.renewal_rule === 'principal' ? 'principal paid' : 'payments made'}` : ''}
        actions={<>
          <Btn variant="outline" onClick={() => window.print()}>Print</Btn>
          <Btn onClick={exportXlsx} disabled={!!exporting}>{exporting || 'Export to Excel'}</Btn>
        </>}
      />
      <Card bodyClass="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3 print:hidden">
          <input className={`${inputInline} w-64`} placeholder="Search name, employee no., school" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={`${inputInline} w-36`} value={station} onChange={(e) => setStation(e.target.value)}>
            <option value="">All stations</option>
            {stations.map((s) => <option key={s} value={s}>Station {s}</option>)}
          </select>
          <select className={`${inputInline} w-52`} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="eligible">Qualified for re-loan</option>
            <option value="not_eligible">Not yet qualified</option>
            <option value="fully_paid">Fully paid</option>
            <option value="renewed">Renewed</option>
          </select>
          <label className="ml-1 flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Include previous loans</label>
          <span className="ml-auto text-xs text-slate-500">{rows.length} loans · balance ₱{peso(totals.bal)} · monthly ₱{peso(totals.amort)}</span>
        </div>
        {loading && <Loading />}
        <div className="p-3"><Alert>{error}</Alert></div>
        {data && (rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1300px] border-collapse">
              <thead>
                <tr>
                  {['No.', 'Stn', 'Employee No.', 'Name of Employee', 'Loan App. No.', 'Check No.', 'Loan Amount', 'Mos.', 'Monthly Amort.', 'Effective', 'Termination', 'Paid', 'Bal. mos.', 'Loan Balance', 'Re-loan at', 'Status', 'Remarks'].map((h) => <th key={h} className={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.loan_id} className="hover:bg-blue-50/40">
                    <td className={`${td} text-slate-500`}>{r.no}</td>
                    <td className={td}>{r.station}</td>
                    <td className={`${td} font-mono text-xs`}>{r.employee_number}</td>
                    <td className={td}><Link className="font-medium text-blue-800 hover:underline" href={`/admin/ledger/${r.employee_number}`}>{r.name}</Link><div className="text-[11px] text-slate-500">{r.school}</div></td>
                    <td className={`${td} text-xs`}>{r.application_no}</td>
                    <td className={`${td} text-xs`}>{r.check_number}</td>
                    <td className={tdNum}>{peso(r.loan_amount)}</td>
                    <td className={`${td} text-center`}>{r.no_of_months}</td>
                    <td className={tdNum}>{peso(r.monthly_amortization)}</td>
                    <td className={`${td} whitespace-nowrap text-xs`}>{periodLabel(r.effective_period)}</td>
                    <td className={`${td} whitespace-nowrap text-xs`}>{periodLabel(r.termination_period)}</td>
                    <td className={`${td} text-center`}>{r.months_paid}</td>
                    <td className={`${td} text-center`}>{r.months_left}</td>
                    <td className={`${tdNum} font-semibold`}>{peso(r.balance)}</td>
                    <td className={`${td} text-center text-xs`}>{r.status === 'active' ? `${r.payments_required_for_renewal} pmts` : ''}</td>
                    <td className={td}>
                      <LoanStatus status={r.status} eligible={r.renewal_eligible} />
                      {r.refund_due > 0 && <Pill tone="red" className="ml-1">Refund ₱{peso(r.refund_due)}</Pill>}
                    </td>
                    <td className={`${td} max-w-[260px] text-xs text-slate-600`}>{[r.notes, r.remarks].filter(Boolean).join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No loans match these filters.</Empty>)}
      </Card>
    </div>
  );
}
