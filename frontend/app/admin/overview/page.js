'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ledgerAPI } from '../../lib/api';
import { Card, PageTitle, Stat, Loading, Alert, Btn, php, periodLabel, inputCls, inputInline, useLoad } from '../../lib/ui';

export default function Overview() {
  const router = useRouter();
  const { data, error, loading } = useLoad(() => ledgerAPI.overview(), []);
  const [q, setQ] = useState('');

  const go = (e) => {
    e.preventDefault();
    const v = q.trim();
    if (/^\d{4,10}$/.test(v)) router.push(`/admin/ledger/${v}`);
    else router.push(`/admin/summary?q=${encodeURIComponent(v)}`);
  };

  return (
    <div>
      <PageTitle
        title="Provident Fund overview"
        subtitle={data ? `Ledger posted through ${periodLabel(data.as_of, true)}` : 'Accounting Section'}
        actions={
          <form onSubmit={go} className="flex gap-2">
            <input className={`${inputInline} w-64`} placeholder="Employee no. or name → ledger card" value={q} onChange={(e) => setQ(e.target.value)} />
            <Btn type="submit">Open</Btn>
          </form>
        }
      />
      {loading && <Loading />}
      <Alert>{error}</Alert>
      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Loans receivable" value={php(data.receivable)} hint={`${data.active_loans} active loans · ${data.borrowers} borrowers`} tone="blue" />
            <Stat label={`Expected deductions ${periodLabel(data.next_period)}`} value={php(data.expected_next_month)} hint="From every active ledger card" />
            <Stat label="Qualified for re-loan" value={data.renewal_eligible} hint="Current loans meeting the renewal rule" tone="green" />
            <Stat label="Needs attention" value={data.refunds_due + data.with_missed_deductions} hint={`${data.refunds_due} refunds due · ${data.with_missed_deductions} with months not deducted`} tone={data.refunds_due + data.with_missed_deductions ? 'amber' : 'slate'} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Monthly routine" subtitle="What Accounting does each payroll month">
              <ol className="space-y-3 text-sm text-slate-700">
                <li><b>1. Post deductions</b> — confirm or upload the payroll deduction list for {periodLabel(data.next_period)}. Every ledger card updates. <Link className="text-blue-800 underline" href={`/admin/posting?period=${data.next_period}`}>Open posting</Link></li>
                <li><b>2. Send the stop-deduction list</b> to payroll for loans whose last deduction falls this month. <Link className="text-blue-800 underline" href="/admin/reports?tab=stop-deduction">Open list</Link></li>
                <li><b>3. Review exceptions</b> — months without deductions and over-deductions to refund. <Link className="text-blue-800 underline" href="/admin/reports?tab=no-deduction">Open</Link></li>
              </ol>
            </Card>
            <Card title="Applications" subtitle="Loan requests in process">
              <p className="text-sm text-slate-700">Track each request from Personnel and Legal through the PF Secretariat and SDS approval to check release. Releasing the check books the loan and opens its ledger card automatically.</p>
              <div className="mt-3 flex gap-2"><Link href="/admin/applications"><Btn variant="outline">View applications</Btn></Link><Link href="/admin/applications?new=1"><Btn>New application</Btn></Link></div>
            </Card>
            <Card title="Reports" subtitle="Printable and exportable to Excel">
              <ul className="space-y-1.5 text-sm">
                {[['summary', 'Summary of loans (SUMMARY sheet)', '/admin/summary'], ['renewal', 'Qualified for re-loan', '/admin/reports?tab=renewal-eligible'], ['maturing', 'Loans maturing this month', '/admin/reports?tab=maturing'], ['annex', 'Moratorium Annex A (PF NBT)', '/admin/reports?tab=annex-a'], ['collections', 'Expected vs posted collections', '/admin/reports?tab=collections']].map(([k, l, h]) => (
                  <li key={k}><Link className="text-blue-800 hover:underline" href={h}>{l}</Link></li>
                ))}
              </ul>
            </Card>
          </div>
          <p className="text-xs text-slate-500">{data.fully_paid} loans fully paid. Balances are recomputed from each ledger card (6% per annum, diminishing balance); nothing is typed in.</p>
        </div>
      )}
    </div>
  );
}
