'use client';

import { th, td, tdNum, peso, periodLabel, dateLabel, ENTRY_LABEL } from './ui';

/** Ledger card in the Accounting Section's layout (DATE GRANTED … BALANCE | REMARKS). */
export default function LedgerCardTable({ loan, card, showSchedule, onDelete, compact = false }) {
  const rows = card.rows.filter((r) => showSchedule || !r.projected);
  const actual = card.rows.filter((r) => !r.projected);
  const totInterest = actual.reduce((t, r) => t + (r.interest || 0), 0);
  const totPrincipal = actual.reduce((t, r) => t + (r.principal || 0), 0);
  const c = compact ? 'px-1.5 py-1 text-[11px]' : '';
  const cellL = `${td} ${c}`;
  const cellR = `${tdNum} ${c}`;
  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse ${compact ? "min-w-[820px]" : "min-w-[1080px]"}`}>
        <thead>
          <tr>
            {['Date Granted', 'Loan Amount', 'Net Proceeds', 'No. of Months', 'Total Payables', 'Date Paid', 'Interest', 'Principal', 'Mo. Paid', 'Remaining', 'Monthly Amort.', 'Balance', 'Remarks'].map((h) => (
              <th key={h} className={`${th} ${c}`}>{h}</th>
            ))}
            {onDelete && <th className={`${th} print:hidden`} />}
          </tr>
        </thead>
        <tbody>
          <tr className="bg-slate-50/60">
            <td className={cellL}>{dateLabel(loan.date_granted || loan.check_date)}</td>
            <td className={`${cellR} font-semibold`}>{peso(card.terms.loan_amount)}</td>
            <td className={cellR}>{peso(loan.net_proceeds)}</td>
            <td className={`${cellL} text-center`}>{card.terms.no_of_months}</td>
            <td className={cellR}>{peso(card.terms.amount_with_interest)}</td>
            <td className={cellL} /><td className={cellL} /><td className={cellL} /><td className={cellL} />
            <td className={`${cellL} text-center`}>{card.terms.no_of_months}</td>
            <td className={cellR}>{peso(card.terms.monthly_amortization)}</td>
            <td className={`${cellR} font-semibold`}>{peso(card.terms.loan_amount)}</td>
            <td className={`${cellL} text-xs text-slate-500`}>{loan.application_no ? `App. ${loan.application_no}` : ''}{loan.check_number ? ` · Check ${loan.check_number}` : ''}</td>
            {onDelete && <td className={`${td} print:hidden`} />}
          </tr>
          {rows.map((r, i) => {
            const special = !['deduction', 'projected'].includes(r.type);
            const tone = r.projected ? 'text-slate-400' : r.type === 'moratorium' ? 'bg-amber-50/60' : r.type === 'no_deduction' ? 'bg-red-50/50' : '';
            const paidCount = ['deduction', 'or_payment', 'projected'].includes(r.type) ? (r.months_covered || 1) : '';
            return (
              <tr key={`${r.period}-${r.type}-${i}`} className={tone}>
                <td className={cellL} /><td className={cellL} /><td className={cellL} /><td className={cellL} /><td className={cellL} />
                <td className={`${cellL} whitespace-nowrap`}>{periodLabel(r.period)}</td>
                <td className={cellR}>{r.type === 'moratorium' || r.type === 'no_deduction' ? '' : peso(r.interest, { blankZero: r.type !== 'deduction' && r.type !== 'projected' })}</td>
                <td className={cellR}>{r.type === 'moratorium' || r.type === 'no_deduction' ? '' : peso(r.principal)}</td>
                <td className={`${cellL} text-center`}>{paidCount}</td>
                <td className={`${cellL} text-center`}>{r.months_left}</td>
                <td className={cellR}>{['moratorium', 'no_deduction', 'adjustment', 'refund', 'opening'].includes(r.type) ? '' : peso(r.payment)}</td>
                <td className={`${cellR} font-medium`}>{peso(r.balance)}</td>
                <td className={`${cellL} text-xs`}>
                  {r.type === 'moratorium' && <span className="font-semibold text-amber-800">MORATORIUM</span>}
                  {r.type === 'no_deduction' && <span className="font-semibold text-red-700">NO DEDUCTION</span>}
                  {r.projected && r.type === 'projected' && <span>scheduled</span>}
                  {special && !['moratorium', 'no_deduction'].includes(r.type) && <span className="font-medium">{ENTRY_LABEL[r.type]}</span>}
                  {r.months_covered > 1 && <span> ({r.months_covered} months)</span>}
                  {r.overpayment > 0 && <span className="ml-1 text-red-700">over ₱{peso(r.overpayment)}</span>}
                  {(() => {
                    const extra = [r.reference && !/^CARD /.test(r.reference) ? r.reference : null, r.notes && !/^moratorium$/i.test(r.notes) ? r.notes : null].filter(Boolean).join(' · ');
                    return extra ? <span className="ml-1 text-slate-500">{extra}</span> : null;
                  })()}
                </td>
                {onDelete && (
                  <td className={`${td} print:hidden`}>
                    {r.entry_id && <button title="Remove this entry" aria-label="Remove entry" className="rounded px-1.5 text-xs text-slate-400 hover:bg-red-50 hover:text-red-700" onClick={() => onDelete(r)}>✕</button>}
                  </td>
                )}
              </tr>
            );
          })}
          <tr className="bg-slate-100 font-semibold">
            <td className={cellL}>Total</td><td className={cellL} /><td className={cellL} /><td className={cellL} /><td className={cellL} /><td className={cellL} />
            <td className={cellR}>{peso(totInterest)}</td>
            <td className={cellR}>{peso(totPrincipal)}</td>
            <td className={`${cellL} text-center`}>{card.summary.months_paid}</td>
            <td className={`${cellL} text-center`}>{card.summary.months_left}</td>
            <td className={cellL} />
            <td className={cellR}>{peso(card.summary.balance)}</td>
            <td className={cellL} />
            {onDelete && <td className={`${td} print:hidden`} />}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

