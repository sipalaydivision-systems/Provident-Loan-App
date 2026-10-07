'use client';

import { useEffect, useState } from 'react';
import { ledgerAPI } from '../../lib/api';
import { Card, PageTitle, Loading, Alert, Btn, Field, inputCls, periodLabel, useLoad, errMsg, th, td } from '../../lib/ui';

export default function SettingsPage() {
  const { data, error, loading, reload } = useLoad(() => ledgerAPI.settings(), []);
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [mor, setMor] = useState({ name: '', start_month: '', end_month: '', date_occurred: '', reference: '' });
  useEffect(() => { if (data) setF(data.settings); }, [data]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    setErr(''); setMsg('');
    try { await ledgerAPI.saveSettings(f); setMsg('Settings saved. All ledger cards were recomputed.'); reload(); } catch (e) { setErr(errMsg(e)); }
  };
  const addMor = async () => {
    setErr('');
    try { await ledgerAPI.addMoratorium(mor); setMor({ name: '', start_month: '', end_month: '', date_occurred: '', reference: '' }); setMsg('Moratorium added; cards recomputed.'); reload(); } catch (e) { setErr(errMsg(e)); }
  };
  const delMor = async (m) => {
    if (!window.confirm(`Remove the moratorium “${m.name}”? Cards will be recomputed.`)) return;
    try { await ledgerAPI.deleteMoratorium(m.id); reload(); } catch (e) { setErr(errMsg(e)); }
  };

  if (loading && !data) return <Loading />;
  return (
    <div>
      <PageTitle title="Settings" subtitle="Rules applied to every ledger card" actions={<Btn onClick={save} disabled={!f}>Save settings</Btn>} />
      <div className="mb-3 space-y-2"><Alert>{error || err}</Alert>{msg && <Alert tone="green">{msg}</Alert>}</div>
      {f && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Re-loan (renewal) rule">
            <div className="grid gap-3">
              <Field label="Qualified for re-loan when" hint="Accounting’s SUMMARY uses No. of Months × 30% (payments). The 2026 PF application form says 30% of the principal.">
                <select className={inputCls} value={f.renewal_rule} onChange={set('renewal_rule')}>
                  <option value="payments">Payments made ≥ threshold × term (current SUMMARY practice)</option>
                  <option value="principal">Principal paid ≥ threshold × loan amount (application form)</option>
                </select>
              </Field>
              <Field label="Threshold"><input type="number" step="0.05" min="0" max="1" className={inputCls} value={f.renewal_threshold} onChange={set('renewal_threshold')} /></Field>
            </div>
          </Card>
          <Card title="Loan limits and checks">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Interest rate (% per annum)"><input type="number" className={inputCls} value={f.interest_rate} onChange={set('interest_rate')} /></Field>
              <Field label="Minimum net take-home pay (₱)"><input type="number" className={inputCls} value={f.nthp_threshold} onChange={set('nthp_threshold')} /></Field>
              <Field label="Max multi-purpose loan (₱)"><input type="number" className={inputCls} value={f.max_multi_purpose} onChange={set('max_multi_purpose')} /></Field>
              <Field label="Max additional loan (₱)"><input type="number" className={inputCls} value={f.max_additional} onChange={set('max_additional')} /></Field>
              <Field label="Minimum term (months)"><input type="number" className={inputCls} value={f.min_term} onChange={set('min_term')} /></Field>
              <Field label="Maximum term (months)"><input type="number" className={inputCls} value={f.max_term} onChange={set('max_term')} /></Field>
              <Field label="Co-maker: max active loans"><input type="number" className={inputCls} value={f.co_maker_max_loans} onChange={set('co_maker_max_loans')} /></Field>
              <Field label="Mandatory retirement age"><input type="number" className={inputCls} value={f.retirement_age} onChange={set('retirement_age')} /></Field>
            </div>
          </Card>
          <Card title="Office and signatories (printed documents)">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Office name" className="col-span-2"><input className={inputCls} value={f.office_name} onChange={set('office_name')} /></Field>
              <Field label="Section"><input className={inputCls} value={f.section_name} onChange={set('section_name')} /></Field>
              <span />
              <Field label="Prepared by (name)"><input className={inputCls} value={f.signatory_prepared_by} onChange={set('signatory_prepared_by')} /></Field>
              <Field label="Position"><input className={inputCls} value={f.signatory_prepared_position} onChange={set('signatory_prepared_position')} /></Field>
              <Field label="Noted by (name)"><input className={inputCls} value={f.signatory_approved_by} onChange={set('signatory_approved_by')} /></Field>
              <Field label="Position"><input className={inputCls} value={f.signatory_approved_position} onChange={set('signatory_approved_position')} /></Field>
            </div>
          </Card>
          <Card title="Loan moratoria" subtitle="No deduction, no interest, term extended">
            <table className="mb-3 w-full border-collapse">
              <thead><tr>{['Name', 'Months', 'Reference', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {data.moratoria.map((m) => (
                  <tr key={m.id}><td className={`${td} text-xs`}>{m.name}</td><td className={`${td} whitespace-nowrap text-xs`}>{periodLabel(m.start_month)} – {periodLabel(m.end_month)}</td><td className={`${td} text-xs`}>{m.reference}</td><td className={td}><button className="text-xs text-red-700 hover:underline" onClick={() => delMor(m)}>Remove</button></td></tr>
                ))}
              </tbody>
            </table>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Name / reason" className="col-span-2"><input className={inputCls} value={mor.name} onChange={(e) => setMor({ ...mor, name: e.target.value })} /></Field>
              <Field label="First month"><input type="month" className={inputCls} value={mor.start_month} onChange={(e) => setMor({ ...mor, start_month: e.target.value })} /></Field>
              <Field label="Last month"><input type="month" className={inputCls} value={mor.end_month} onChange={(e) => setMor({ ...mor, end_month: e.target.value })} /></Field>
              <Field label="Date occurred"><input type="date" className={inputCls} value={mor.date_occurred} onChange={(e) => setMor({ ...mor, date_occurred: e.target.value })} /></Field>
              <Field label="Memo reference"><input className={inputCls} value={mor.reference} onChange={(e) => setMor({ ...mor, reference: e.target.value })} /></Field>
            </div>
            <Btn className="mt-3" variant="outline" onClick={addMor}>Add moratorium</Btn>
          </Card>
        </div>
      )}
    </div>
  );
}
