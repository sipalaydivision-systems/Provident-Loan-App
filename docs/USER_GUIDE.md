# Provident Fund System – User Guide (Accounting Section, SDO Sipalay City)

## How balances are computed
Every ledger card is **computed from the loan terms and posted events**, exactly like the Excel ledger card:

| Item | Rule |
|---|---|
| Monthly amortization | P × 0.005 ÷ (1 − 1.005⁻ⁿ), rounded **up** to the centavo (₱100,000 / 36 = ₱3,042.20) |
| Interest per deduction | previous balance × 0.005 (0.5% a month = 6% a year, diminishing balance) |
| Principal per deduction | deduction − interest |
| Balance | previous balance − principal |
| Total payables | n × monthly amortization |
| Moratorium month | no deduction, no interest, balance unchanged, term extended one month |
| Final deduction | reduced to the exact remaining balance (no over-deduction) |
| Re-loan | Settings: 30% of **payments made** (SUMMARY practice) or 30% of **principal paid** (2026 application form) |

Nothing is typed into a balance. To correct a card, remove the wrong entry (✕ on the row) and record the right one.

## One-time migration
1. Google Sheets → PROVIDENT FUND → File → Download → Microsoft Excel (.xlsx).
2. **Import** page → choose the file → **Import ledger cards**.
3. Review the reconciliation table: every card is recomputed and compared with the card's balance and the SUMMARY tab. Differences are errors in the sheet (e.g. SUMMARY pointing at an old loan block, a mistyped amortization, over-deductions).

The import reads each borrower tab (both card layouts), every loan block on a tab (renewals), MORATORIUM rows, rows covering several months, lump payoffs, and "FULLY PAID … OR#" remarks in SUMMARY.

## Every payroll month
1. **Monthly posting** → pick the month → check the list (or **Upload payroll list**: CSV/Excel with employee number and amount) → untick anyone not deducted → **Post**.
2. **Reports → Stop-deduction list** → send to payroll (final deductions this month, fully paid loans, over-deductions).
3. **Reports → Months not deducted** and **Refunds due** → follow up.

## Applications (Personnel → Legal → PF Secretariat → Recommendation → SDS → Check release)
- **Applications → New application** (paper form) or employees apply in the portal.
- **Check eligibility** shows the monthly amortization, net proceeds (new loan − existing balance), net take-home pay (≥ ₱5,000), co-maker limits, renewal rule and retirement age. "?" items need the employee details (birth date, appointment, salary, date hired) — set them on the ledger card → **Employee details**.
- Each step is a button. **Release check & book loan** asks for the check number, check date and first deduction month; it closes the old loan (balance deducted from the new loan) and opens the new ledger card.

## Ledger card actions
- **Record entry**: payroll deduction, payment at the cashier (OR), partial payment, pay in full, refund, adjustment, moratorium month.
- **Print card**, **Statement of account**, **Certificate** (balance or fully paid). Signatories are set in **Settings**.

## Employee portal
1. Ledger card → **Issue portal code** → give the printed slip to the employee.
2. Employee opens the system → Employee Portal → **Activate account** (employee number, last name, code, new password).
3. Employees see their own card, balance, next deduction and re-loan date; use the calculator; apply; give co-maker consent; get notifications at each approval step.
4. Forgotten password → issue a new code.

## Settings
Re-loan rule, interest rate, loan limits, minimum net take-home pay, co-maker limit, retirement age, office name and signatories, and loan moratoria (the July–September 2026 moratorium under the DepEd Memorandum of 24 June 2026 is pre-loaded). Saving recomputes every card.
