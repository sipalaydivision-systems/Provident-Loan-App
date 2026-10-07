const E = require('../services/loanEngine');

const months = (start, count) => Array.from({ length: count }, (_, i) => E.addMonths(start, i));
const ded = (ps, amt) => ps.map((p, i) => ({ id: i + 1, entry_type: 'deduction', period: p, amount_paid: amt }));
const MOR = [{ start_month: '2026-07', end_month: '2026-09' }];

describe('amortization (rounded up to the centavo, matches DepEd tables)', () => {
  test.each([
    [100000, 60, 1933.29], [100000, 36, 3042.20], [40000, 60, 773.32], [50000, 36, 1521.10],
    [20000, 36, 608.44], [60000, 60, 1159.97], [80000, 60, 1546.63], [90000, 60, 1739.96],
    [100000, 24, 4432.07], [100000, 48, 2348.51], [70000, 60, 1353.30], [30000, 36, 912.66],
  ])('%d over %d months = %d', (P, n, A) => expect(E.amortization(P, n)).toBeCloseTo(A, 2));
});

describe('TICKLINGM ledger card (₱100,000 / 36 mos, first deduction Jun 2025)', () => {
  const loan = { loan_amount: 100000, no_of_months: 36, monthly_amortization: 3042.2, effective_date: '2025-06-01' };
  const entries = [...ded(months('2025-06', 13), 3042.2),
    ...['2026-07', '2026-08', '2026-09'].map((p, i) => ({ id: 100 + i, entry_type: 'moratorium', period: p, amount_paid: 0 }))];
  const card = E.buildLedger(loan, entries, { moratoria: MOR, asOf: '2026-09' });

  test('first rows match the card', () => {
    expect(card.rows[0]).toMatchObject({ period: '2025-06', interest: 500, principal: 2542.2, balance: 97457.8 });
    expect(card.rows[1]).toMatchObject({ interest: 487.29, principal: 2554.91, balance: 94902.89 });
  });
  test('balance after 13 deductions is ₱65,941.54 (card L69 = 65941.536)', () => {
    expect(card.summary.balance_raw).toBeCloseTo(65941.536, 3);
    expect(card.summary.balance).toBe(65941.54);
    expect(card.summary.months_paid).toBe(13);
    expect(card.summary.months_left).toBe(23);
  });
  test('moratorium months keep the balance and add no interest', () => {
    const mor = card.rows.filter((r) => r.type === 'moratorium');
    expect(mor.map((r) => r.period)).toEqual(['2026-07', '2026-08', '2026-09']);
    mor.forEach((r) => { expect(r.balance).toBe(65941.54); expect(r.interest).toBe(0); });
  });
  test('loan amount with interest = n × A = ₱109,519.20', () => expect(card.terms.amount_with_interest).toBe(109519.2));
  test('next deduction Oct 2026 = ₱3,042.20; term extended 3 months to Aug 2028', () => {
    expect(card.summary.next_due_period).toBe('2026-10');
    expect(card.summary.next_due_amount).toBe(3042.2);
    expect(card.summary.maturity_period).toBe('2028-08');
  });
  test('last projected payment is reduced so the balance ends at zero', () => {
    const proj = card.rows.filter((r) => r.projected);
    expect(proj).toHaveLength(23);
    expect(proj[proj.length - 1].balance).toBe(0);
    expect(proj[proj.length - 1].payment).toBeLessThanOrEqual(3042.2);
  });
  test('renewal: 30% of payments rule (Accounting practice) — 13 ≥ 10.8', () => {
    expect(card.summary.renewal_eligible).toBe(true);
    expect(card.summary.renewal_eligible_from).toBe('2026-04');
    expect(card.summary.payments_required_for_renewal).toBe(11);
  });
  test('renewal: 30% of principal rule — 34.06% paid → eligible', () => {
    const c2 = E.buildLedger(loan, entries, { moratoria: MOR, asOf: '2026-09', renewalRule: 'principal' });
    expect(c2.summary.renewal_eligible).toBe(true);
    const c3 = E.buildLedger(loan, ded(months('2025-06', 11), 3042.2), { moratoria: MOR, asOf: '2026-04', renewalRule: 'principal' });
    expect(c3.summary.renewal_eligible).toBe(false); // 11 payments ≈ 28.7% of principal
  });
  test('expected payroll deduction is 0 during the moratorium and ₱3,042.20 after', () => {
    expect(E.expectedDeduction(card, '2026-08', MOR)).toBe(0);
    expect(E.expectedDeduction(card, '2026-10', MOR)).toBe(3042.2);
  });
});

describe('over-deduction (BALIBAGOSO: ₱50,000/36, 37 deductions)', () => {
  const loan = { loan_amount: 50000, no_of_months: 36, monthly_amortization: 1521.1, effective_date: '2023-05-01' };
  const card = E.buildLedger(loan, ded(months('2023-05', 37), 1521.1), { asOf: '2026-05' });
  test('loan is fully paid and the extra deduction is a refund due', () => {
    expect(card.summary.status).toBe('fully_paid');
    expect(card.summary.balance).toBe(0);
    expect(card.summary.refund_due).toBeGreaterThan(1521);
    expect(card.summary.refund_due).toBeLessThan(1522);
  });
  test('no further deduction is expected', () => expect(E.expectedDeduction(card, '2026-06', [])).toBe(0));
});

describe('payoff by official receipt, missed months, opening balance, renewal offset', () => {
  const loan = { loan_amount: 100000, no_of_months: 60, monthly_amortization: 1933.29, effective_date: '2023-08-01' };
  test('payoff closes the loan', () => {
    const e = [...ded(months('2023-08', 32), 1933.29), { id: 99, entry_type: 'payoff', period: '2026-04', amount_paid: 50395.81, reference_number: 'OR 0313529' }];
    const c = E.buildLedger(loan, e, { asOf: '2026-09' });
    expect(c.summary.status).toBe('fully_paid');
    expect(c.summary.balance).toBe(0);
    expect(c.rows.filter((r) => r.type === 'no_deduction')).toHaveLength(0);
  });
  test('months without a deduction are flagged and do not accrue interest', () => {
    const ps = months('2024-11', 8).filter((p) => p !== '2025-05' && p !== '2025-06');
    const c = E.buildLedger({ ...loan, effective_date: '2024-11-01' }, ded(ps, 1933.29), { asOf: '2025-06' });
    expect(c.rows.filter((r) => r.type === 'no_deduction').map((r) => r.period)).toEqual(['2025-05', '2025-06']);
    expect(c.summary.months_paid).toBe(6);
  });
  test('opening balance (summary-only import) continues the schedule', () => {
    const c = E.buildLedger({ ...loan, effective_date: '2024-06-01' }, [{ id: 1, entry_type: 'opening', period: '2026-06', amount_paid: 0, balance: 63548.63, paid_months: 24 }], { asOf: '2026-06' });
    expect(c.summary.months_paid).toBe(24);
    expect(c.summary.balance).toBe(63548.63);
    expect(c.summary.next_due_amount).toBe(1933.29);
  });
  test('renewal offset closes the old loan as renewed', () => {
    const c = E.buildLedger(loan, [...ded(months('2023-08', 20), 1933.29), { id: 9, entry_type: 'renewal_offset', period: '2025-04', amount_paid: 0 }], { asOf: '2025-04' });
    expect(c.summary.status).toBe('renewed');
    expect(c.summary.balance).toBe(0);
  });
});
