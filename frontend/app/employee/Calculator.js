'use client';

import { useState } from 'react';
import { portalAPI } from '../lib/api';
import { Alert, Btn, Field, inputCls, peso, errMsg, th, tdNum, td } from '../lib/ui';

export default function Calculator({ defaultSalary }) {
  const [f, setF] = useState({ amount: 100000, months: 60, monthly_basic_salary: defaultSalary || '', other_deductions: '' });
  const [r, setR] = useState(null);
  const [err, setErr] = useState('');
  const [showSched, setShowSched] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const run = async (e) => {
    e?.preventDefault();
    setErr('');
    try { setR((await portalAPI.calculator(f)).data.data); } catch (x) { setErr(errMsg(x)); }
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <form onSubmit={run} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="Amount (₱)"><input type="number" className={inputCls} value={f.amount} onChange={set('amount')} /></Field>
        <Field label="Term"><select className={inputCls} value={f.months} onChange={set('months')}>{[12, 24, 36, 48, 60].map((m) => <option key={m} value={m}>{m} months</option>)}</select></Field>
        <Field label="Basic salary (optional)"><input type="number" className={inputCls} value={f.monthly_basic_salary} onChange={set('monthly_basic_salary')} /></Field>
        <Field label="Current deductions (optional)" hint="Total from your payslip"><input type="number" className={inputCls} value={f.other_deductions} onChange={set('other_deductions')} /></Field>
        <div className="col-span-2 md:col-span-4"><Btn type="submit">Compute</Btn></div>
      </form>
      <div className="mt-3"><Alert>{err}</Alert></div>
      {r && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[['Monthly amortization', `₱${peso(r.monthly_amortization)}`], ['Total payables', `₱${peso(r.amount_with_interest)}`], ['Total interest', `₱${peso(r.total_interest)}`],
              ['Take-home pay after', r.net_take_home_pay == null ? 'enter salary' : `₱${peso(r.net_take_home_pay)}`]].map(([k, v]) => (
              <div key={k} className="rounded-md bg-slate-50 px-3 py-2"><p className="text-[11px] uppercase text-slate-500">{k}</p><p className="font-semibold tabular-nums">{v}</p></div>
            ))}
          </div>
          {r.nthp_ok === false && <Alert tone="amber">Net take-home pay would fall below the required ₱{peso(r.nthp_threshold)}. Try a smaller amount or a longer term.</Alert>}
          {r.nthp_ok === true && <Alert tone="green">Net take-home pay stays above the required ₱{peso(r.nthp_threshold)}.</Alert>}
          <button className="text-sm text-blue-800 underline" onClick={() => setShowSched(!showSched)}>{showSched ? 'Hide' : 'Show'} payment schedule</button>
          {showSched && (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full border-collapse"><thead><tr>{['#', 'Interest', 'Principal', 'Payment', 'Balance'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody>{r.schedule.map((x) => <tr key={x.no}><td className={td}>{x.no}</td><td className={tdNum}>{peso(x.interest)}</td><td className={tdNum}>{peso(x.principal)}</td><td className={tdNum}>{peso(x.payment)}</td><td className={tdNum}>{peso(x.balance)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
