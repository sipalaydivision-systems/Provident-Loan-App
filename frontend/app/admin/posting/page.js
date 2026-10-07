'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ledgerAPI } from '../../lib/api';
import { Card, PageTitle, Loading, Alert, Btn, Pill, peso, periodLabel, inputCls, inputInline, th, td, tdNum, errMsg, addPeriod } from '../../lib/ui';

const STATE = { due: ['Due', 'blue'], final: ['Final deduction', 'violet'], posted: ['Posted', 'green'], moratorium: ['Moratorium', 'amber'] };

export default function PostingPage() {
  const [period, setPeriod] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [amounts, setAmounts] = useState({});
  const [skip, setSkip] = useState({});
  const [upload, setUpload] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const load = async (p) => {
    setLoading(true); setError(''); setUpload(null);
    try {
      const r = await ledgerAPI.payroll(p);
      const d = r.data.data;
      setData(d);
      setAmounts(Object.fromEntries(d.rows.map((x) => [x.loan_id, Number(x.posted ?? x.expected).toFixed(2)])));
      setSkip({});
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  };

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('period');
    if (q) { setPeriod(q); load(q); return; }
    ledgerAPI.overview().then((r) => { const p = r.data.data.next_period; setPeriod(p); load(p); }).catch((e) => setError(errMsg(e)));
  }, []);

  const pending = useMemo(() => (data?.rows || []).filter((r) => r.state !== 'posted' && r.expected > 0), [data]);
  const toPost = pending.filter((r) => !skip[r.loan_id] && Number(amounts[r.loan_id]) > 0);
  const total = toPost.reduce((t, r) => t + Number(amounts[r.loan_id] || 0), 0);

  const post = async () => {
    if (!toPost.length) return;
    if (!window.confirm(`Post ${toPost.length} payroll deductions totalling ₱${peso(total)} for ${periodLabel(period, true)}? Every ledger card will be updated.`)) return;
    setBusy(true); setMsg(''); setError('');
    try {
      const r = await ledgerAPI.postPayroll(period, { items: toPost.map((x) => ({ loan_id: x.loan_id, amount: Number(amounts[x.loan_id]) })), batch: `PAYROLL-${period}` });
      const d = r.data.data;
      setMsg(`Posted ${d.posted} deductions for ${periodLabel(period, true)}${d.skipped ? `; ${d.skipped} skipped (already posted or zero)` : ''}.`);
      await load(period);
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };

  const onUpload = async (ev) => {
    const f = ev.target.files?.[0];
    if (!f) return;
    setBusy(true); setError('');
    try {
      const r = await ledgerAPI.uploadPayroll(period, f);
      const u = r.data.data;
      setUpload(u);
      const next = { ...amounts };
      const sk = {};
      for (const m of u.matched) next[m.loan_id] = m.uploaded;
      for (const m of u.missing) sk[m.loan_id] = true;
      setAmounts(next);
      setSkip(sk);
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  return (
    <div>
      <PageTitle
        title="Monthly payroll posting"
        subtitle="Post the month's Provident Fund deductions to every ledger card at once"
        actions={<>
          <Btn variant="outline" onClick={() => { const p = addPeriod(period, -1); setPeriod(p); load(p); }}>◀</Btn>
          <input type="month" className={`${inputInline} w-40`} value={period} onChange={(e) => { setPeriod(e.target.value); if (e.target.value) load(e.target.value); }} />
          <Btn variant="outline" onClick={() => { const p = addPeriod(period, 1); setPeriod(p); load(p); }}>▶</Btn>
        </>}
      />
      {msg && <div className="mb-3"><Alert tone="green">{msg}</Alert></div>}
      <div className="mb-3"><Alert>{error}</Alert></div>
      {loading && <Loading />}
      {data && !loading && (
        <div className="space-y-4">
          {data.moratorium && <Alert tone="amber">{periodLabel(period, true)} is within a loan moratorium: no Provident Fund deductions and no interest. Loan terms are extended automatically.</Alert>}
          <div className="grid gap-3 md:grid-cols-4">
            <Box label="Loans due" value={pending.length} />
            <Box label="Expected deductions" value={`₱${peso(data.totals.expected)}`} />
            <Box label="Already posted" value={`₱${peso(data.totals.posted)}`} />
            <Box label="Last posted month" value={periodLabel(data.last_posted, true)} />
          </div>

          <Card
            title={`Deductions for ${periodLabel(period, true)}`}
            subtitle="Amounts default to each card's amortization; the final month is reduced to the exact balance. Untick anyone not deducted this month."
            actions={<>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onUpload} />
              <Btn variant="outline" disabled={busy || data.moratorium} onClick={() => fileRef.current?.click()}>Upload payroll list</Btn>
              <Btn variant="success" disabled={busy || !toPost.length} onClick={post}>{busy ? 'Working…' : `Post ${toPost.length} (₱${peso(total)})`}</Btn>
            </>}
            bodyClass="p-0"
          >
            {upload && (
              <div className="space-y-2 border-b border-slate-100 p-3 text-sm">
                <Alert tone="blue">Payroll file matched {upload.matched.length} borrowers. {upload.matched.filter((m) => Math.abs(m.difference) > 0.009).length} with a different amount (highlighted). {upload.missing.length} due but not in the file were unticked.</Alert>
                {upload.unmatched.length > 0 && <Alert tone="amber">Not found as active PF borrowers: {upload.unmatched.map((u) => `${u.employee_number} (₱${peso(u.amount)})`).join(', ')}</Alert>}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse">
                <thead><tr>{['Post', 'Stn', 'Employee No.', 'Name', 'Balance', 'Amortization', 'Amount to post', 'Status'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.rows.map((r) => {
                    const diff = upload?.matched.find((m) => m.loan_id === r.loan_id && Math.abs(m.difference) > 0.009);
                    const [label, tone] = STATE[r.state] || [r.state, 'slate'];
                    const editable = r.state !== 'posted' && r.expected > 0;
                    return (
                      <tr key={r.loan_id} className={diff ? 'bg-amber-50' : skip[r.loan_id] ? 'bg-slate-50 text-slate-400' : ''}>
                        <td className={td}>{editable && <input type="checkbox" checked={!skip[r.loan_id]} onChange={(e) => setSkip({ ...skip, [r.loan_id]: !e.target.checked })} />}</td>
                        <td className={td}>{r.station}</td>
                        <td className={`${td} font-mono text-xs`}>{r.employee_number}</td>
                        <td className={td}><Link className="text-blue-800 hover:underline" href={`/admin/ledger/${r.employee_number}`}>{r.name}</Link></td>
                        <td className={tdNum}>{peso(r.balance)}</td>
                        <td className={tdNum}>{peso(r.monthly_amortization)}</td>
                        <td className={tdNum}>
                          {editable ? <input type="number" step="0.01" className={`${inputInline} w-32 text-right`} value={amounts[r.loan_id] ?? ''} onChange={(e) => setAmounts({ ...amounts, [r.loan_id]: e.target.value })} />
                            : peso(r.posted ?? r.expected, { blankZero: true })}
                          {diff && <div className="text-[11px] text-amber-800">expected {peso(r.expected)}</div>}
                        </td>
                        <td className={td}><Pill tone={tone}>{label}</Pill></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="text-xs text-slate-500">Payroll file: CSV or Excel with an employee number column and an amount column (e.g. the PF deduction list from the payroll register). To correct a posted month, remove the entry on the borrower’s ledger card and post again.</p>
        </div>
      )}
    </div>
  );
}

function Box({ label, value }) {
  return <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5"><p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p><p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p></div>;
}
