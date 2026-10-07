'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { ledgerAPI } from '../../lib/api';
import { Card, PageTitle, Alert, Btn, Pill, Loading, peso, th, td, tdNum, errMsg } from '../../lib/ui';

export default function ImportPage() {
  const ref = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [onlyIssues, setOnlyIssues] = useState(true);

  const pick = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f); setPreview(null); setResult(null); setErr(''); setBusy('Reading workbook…');
    try { setPreview((await ledgerAPI.previewWorkbook(f)).data.data); } catch (x) { setErr(errMsg(x)); } finally { setBusy(''); }
  };
  const run = async () => {
    if (!window.confirm(`Import ${preview.cards.length} ledger cards${replace ? ', replacing loans already in the system for these borrowers' : ''}?`)) return;
    setBusy('Importing and reconciling… (about a minute)'); setErr('');
    try { setResult((await ledgerAPI.importWorkbook(file, replace)).data.data); } catch (x) { setErr(errMsg(x)); } finally { setBusy(''); }
  };
  const rec = result?.reconciliation?.rows || [];

  return (
    <div>
      <PageTitle title="Import the PROVIDENT FUND workbook" subtitle="One-time migration from the Google Sheet: every borrower tab (ledger card) plus the SUMMARY tab" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="1. Download the workbook">
          <p className="text-sm text-slate-700">In Google Sheets open <b>PROVIDENT FUND</b> → File → Download → <b>Microsoft Excel (.xlsx)</b>. The whole workbook is needed, not a single tab.</p>
        </Card>
        <Card title="2. Choose the file">
          <input ref={ref} type="file" accept=".xlsx" className="hidden" onChange={pick} />
          <Btn variant="outline" onClick={() => ref.current?.click()}>Choose .xlsx file</Btn>
          {file && <p className="mt-2 text-xs text-slate-500">{file.name}</p>}
          {preview && <p className="mt-2 text-sm">Found <b>{preview.cards.length}</b> ledger cards, <b>{preview.cards.reduce((t, c) => t + c.deductions, 0)}</b> deductions, SUMMARY tab “{preview.summary_tab}” with {preview.summary_rows} rows.{preview.skipped_tabs.length ? ` Skipped: ${preview.skipped_tabs.join(', ')}.` : ''}</p>}
        </Card>
        <Card title="3. Import">
          <label className="mb-3 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={replace} onChange={(e) => setReplace(e.target.checked)} />Replace loans already in the system for these borrowers (use only to redo the migration; posted payments for them are removed)</label>
          <Btn disabled={!preview || !!busy} onClick={run}>Import ledger cards</Btn>
        </Card>
      </div>
      <div className="mt-4 space-y-3">
        {busy && <Loading label={busy} />}
        <Alert>{err}</Alert>
        {result && (
          <>
            <Alert tone="green">Imported {result.cards} cards: {result.employees_created} employees created, {result.employees_updated} updated, {result.loans_created} loans, {result.entries_created} ledger entries{result.payoffs ? `, ${result.payoffs} payoffs from SUMMARY remarks` : ''}. {result.skipped_existing.length ? `${result.skipped_existing.length} borrowers already had loans and were skipped.` : ''}</Alert>
            {result.errors.length > 0 && <Alert tone="amber">{result.errors.map((e) => `${e.tab || e.employee_number}: ${e.error}`).join(' · ')}</Alert>}
            <Card
              title="Reconciliation with the workbook"
              subtitle={`${result.reconciliation.checked} cards checked · ${result.reconciliation.with_issues} with differences. The system recomputes each card from its deductions; differences are errors in the sheet to review.`}
              actions={<label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} /> Only differences</label>}
              bodyClass="p-0"
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse">
                  <thead><tr>{['Tab', 'Employee No.', 'Name', 'Loans', 'System balance', 'Paid', 'Status', 'Differences'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {rec.filter((r) => !onlyIssues || r.issues.length).map((r) => (
                      <tr key={r.tab} className={r.issues.length ? 'bg-amber-50/50' : ''}>
                        <td className={`${td} font-mono text-xs`}>{r.tab}</td>
                        <td className={`${td} font-mono text-xs`}>{r.employee_number}</td>
                        <td className={td}><Link className="text-blue-800 hover:underline" href={`/admin/ledger/${r.employee_number}`}>{r.name}</Link></td>
                        <td className={`${td} text-center`}>{r.loans}</td>
                        <td className={tdNum}>{peso(r.system_balance)}</td>
                        <td className={`${td} text-center`}>{r.months_paid}</td>
                        <td className={td}><Pill tone={r.status === 'active' ? 'blue' : 'green'}>{r.status.replace('_', ' ')}</Pill></td>
                        <td className={`${td} text-xs`}>{r.issues.join(' · ') || '✓ matches'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
