'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ledgerAPI } from '../../../lib/api';
import LedgerCardTable from '../../../lib/LedgerCardTable';
import { Loading, Alert, Btn, peso, php, periodLabel, dateLabel, useLoad, td, tdNum, th, ENTRY_LABEL } from '../../../lib/ui';

const fullName = (e) => (e ? [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ') : '');

export default function PrintPage() {
  const { loanId } = useParams();
  const [doc, setDoc] = useState('card');
  useEffect(() => { setDoc(new URLSearchParams(window.location.search).get('doc') || 'card'); }, []);
  const { data, error, loading } = useLoad(() => ledgerAPI.loanCard(loanId), [loanId]);
  if (loading) return <Loading />;
  if (error) return <Alert>{error}</Alert>;
  if (!data) return null;
  const { loan, employee, card, settings, as_of } = data;
  const s = card.summary;
  const today = dateLabel(new Date().toISOString());

  return (
    <div className="mx-auto max-w-[1100px] p-6 text-slate-900 print:p-0">
      <div className="mb-4 flex gap-2 print:hidden">
        {['card', 'soa', 'certificate'].map((d) => <Btn key={d} variant={d === doc ? 'primary' : 'outline'} onClick={() => setDoc(d)}>{{ card: 'Ledger card', soa: 'Statement of account', certificate: 'Certificate' }[d]}</Btn>)}
        <Btn variant="success" className="ml-auto" onClick={() => window.print()}>Print</Btn>
      </div>
      <header className="mb-4 text-center">
        <p className="text-xs">Republic of the Philippines</p>
        <p className="text-sm font-semibold">Department of Education</p>
        <p className="text-sm">{settings.office_name}</p>
        <p className="text-xs text-slate-600">{settings.section_name}</p>
      </header>

      {doc === 'card' && (
        <>
          <h1 className="mb-3 text-center text-base font-bold tracking-wide">PROVIDENT LEDGER CARD</h1>
          <div className="mb-3 grid grid-cols-2 gap-x-8 text-sm">
            <p>Name: <b>{fullName(employee)}</b></p>
            <p>School/Office: <b>{employee?.school || ''}</b> {employee?.station ? `(Station ${employee.station})` : ''}</p>
            <p>Employee No.: <b>{loan.employee_number}</b></p>
            <p>As of: <b>{periodLabel(as_of, true)}</b></p>
          </div>
          <LedgerCardTable loan={loan} card={card} showSchedule={false} compact />
        </>
      )}

      {doc === 'soa' && (
        <>
          <h1 className="mb-1 text-center text-base font-bold tracking-wide">STATEMENT OF ACCOUNT</h1>
          <p className="mb-4 text-center text-sm">Provident Fund Loan as of {periodLabel(as_of, true)}</p>
          <table className="mb-4 w-full text-sm">
            <tbody>
              {[
                ['Borrower', `${fullName(employee)} (Employee No. ${loan.employee_number})`],
                ['School / Office', `${employee?.school || ''}${employee?.station ? ` – Station ${employee.station}` : ''}`],
                ['Loan application / check', `${loan.application_no || '—'} / ${loan.check_number || '—'} (${dateLabel(loan.check_date || loan.date_granted)})`],
                ['Loan amount and term', `${php(card.terms.loan_amount)} for ${card.terms.no_of_months} months at 6% per annum (diminishing balance)`],
                ['Monthly amortization', php(card.terms.monthly_amortization)],
                ['First deduction', periodLabel(card.terms.first_deduction, true)],
                ['Months paid / remaining', `${s.months_paid} / ${s.months_left}`],
                ['Principal paid', php(s.principal_paid)],
                ['Interest paid', php(s.interest_paid)],
                ['Outstanding balance', php(s.balance)],
                ['Next deduction', s.status === 'active' ? `${php(s.next_due_amount)} – ${periodLabel(s.next_due_period, true)}` : '—'],
                ['Expected last deduction', periodLabel(s.maturity_period, true)],
                ['Status', s.status === 'active' ? (s.renewal_eligible ? 'Active – qualified for re-loan' : `Active – qualifies for re-loan from ${periodLabel(s.renewal_eligible_from, true)}`) : s.status === 'fully_paid' ? 'Fully paid' : 'Renewed'],
                ...(s.refund_due > 0 ? [['Over-deduction (refund due)', php(s.refund_due)]] : []),
              ].map(([k, v]) => <tr key={k}><td className="w-56 py-1 pr-4 text-slate-600">{k}</td><td className="py-1 font-medium">{v}</td></tr>)}
            </tbody>
          </table>
          <table className="w-full border-collapse text-sm">
            <thead><tr>{['Month', 'Particulars', 'Payment', 'Interest', 'Principal', 'Balance'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {card.rows.filter((r) => !r.projected).map((r, i) => (
                <tr key={i}>
                  <td className={td}>{periodLabel(r.period)}</td>
                  <td className={`${td} text-xs`}>{ENTRY_LABEL[r.type] || r.type}{r.reference && !/^CARD /.test(r.reference) ? ` – ${r.reference}` : ''}</td>
                  <td className={tdNum}>{['moratorium', 'no_deduction'].includes(r.type) ? '' : peso(r.payment)}</td>
                  <td className={tdNum}>{peso(r.interest, { blankZero: true })}</td>
                  <td className={tdNum}>{peso(r.principal, { blankZero: true })}</td>
                  <td className={tdNum}>{peso(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Signatures settings={settings} />
        </>
      )}

      {doc === 'certificate' && (
        <div className="mx-auto max-w-[720px]">
          <h1 className="mb-6 mt-6 text-center text-lg font-bold tracking-wide">CERTIFICATION</h1>
          <p className="mb-4 text-sm leading-7">TO WHOM IT MAY CONCERN:</p>
          {s.status === 'active' ? (
            <p className="mb-4 indent-10 text-sm leading-7">
              This is to certify that <b>{fullName(employee)}</b>, Employee No. {loan.employee_number}{employee?.school ? ` of ${employee.school}` : ''}, has an outstanding
              DepEd Provident Fund loan with a balance of <b>{php(s.balance)}</b> as of {periodLabel(as_of, true)}. The loan of {php(card.terms.loan_amount)} granted
              {loan.check_date || loan.date_granted ? ` on ${dateLabel(loan.check_date || loan.date_granted)}` : ''} is payable at {php(card.terms.monthly_amortization)} a month through payroll deduction;
              {` ${s.months_paid} of ${card.terms.no_of_months} monthly amortizations have been paid, and the last deduction is expected in ${periodLabel(s.maturity_period, true)}.`}
            </p>
          ) : (
            <p className="mb-4 indent-10 text-sm leading-7">
              This is to certify that <b>{fullName(employee)}</b>, Employee No. {loan.employee_number}{employee?.school ? ` of ${employee.school}` : ''}, has <b>fully paid</b> the
              DepEd Provident Fund loan of {php(card.terms.loan_amount)}{s.closed_period || s.maturity_period ? ` as of ${periodLabel(s.closed_period || s.maturity_period, true)}` : ''}{s.status === 'renewed' ? ' through renewal (balance deducted from the new loan)' : ''}.
            </p>
          )}
          <p className="mb-10 indent-10 text-sm leading-7">This certification is issued upon the request of the above-named employee for whatever legal purpose it may serve. Issued this {today}.</p>
          <Signatures settings={settings} single />
        </div>
      )}
      <p className="mt-6 text-[10px] text-slate-400">Generated by the Provident Fund system from the ledger card · {today}</p>
    </div>
  );
}

function Signatures({ settings, single }) {
  return (
    <div className={`mt-12 grid gap-12 text-sm ${single ? 'grid-cols-1 justify-items-end' : 'grid-cols-2'}`}>
      <div className="text-center">
        <p className="text-xs text-slate-500">Prepared by:</p>
        <p className="mt-8 border-t border-slate-800 pt-1 font-semibold uppercase">{settings.signatory_prepared_by || ' '}</p>
        <p className="text-xs">{settings.signatory_prepared_position}</p>
      </div>
      {!single && (
        <div className="text-center">
          <p className="text-xs text-slate-500">Noted by:</p>
          <p className="mt-8 border-t border-slate-800 pt-1 font-semibold uppercase">{settings.signatory_approved_by || ' '}</p>
          <p className="text-xs">{settings.signatory_approved_position}</p>
        </div>
      )}
    </div>
  );
}
