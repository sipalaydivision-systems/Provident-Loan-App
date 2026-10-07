/**
 * Import the Accounting Section's PROVIDENT FUND workbook (.xlsx):
 *   - one tab per borrower = ledger card (may contain several loan blocks after renewals)
 *   - SUMMARY tab = station, application/check numbers, remarks (e.g. "FULLY PAID … OR# …")
 * Each card becomes loans + monthly ledger entries (deductions and MORATORIUM months), so the
 * system's ledger card is rebuilt from the same events instead of copying balances.
 */
const XLSX = require('xlsx');
const E = require('./loanEngine');

const norm = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const lower = (v) => norm(v).toLowerCase();
const num = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/[,₱\s]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

/** Excel serial, Date, or text ("Oct.23", "Nov-2024", "May 08,2025", "6/1/2025") → Date (UTC) */
function toDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  if (typeof v === 'number') return v > 20000 && v < 80000 ? new Date(Math.round((v - 25569) * 86400000)) : null;
  const s = norm(v);
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Date.UTC(+m[3], +m[1] - 1, Math.min(+m[2], 28)));
  m = s.match(/^([A-Za-z]+)\.?[\s\-.]*(\d{1,2})?,?\s*(\d{2}|\d{4})$/);
  if (m) {
    const mo = MONTHS[m[1].toLowerCase().slice(0, 4)] || MONTHS[m[1].toLowerCase().slice(0, 3)];
    if (mo) {
      const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
      return new Date(Date.UTC(y, mo - 1, m[2] ? Math.min(+m[2], 28) : 1));
    }
  }
  m = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, m[3] ? +m[3] : 1));
  return null; // free text like "August to December" is handled by periodFromText
}

/** Period from free text on a card ("January 2026 - TEX", "August to December"), using the previous row's period for the year. */
function periodFromText(v, lastPeriod) {
  const s = norm(v).toLowerCase();
  const names = [...s.matchAll(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/g)].map((m) => MONTHS[m[1]]);
  if (!names.length) return null;
  const mo = names[names.length - 1];
  const y = (s.match(/(20\d{2})/) || [])[1];
  if (y) return `${y}-${String(mo).padStart(2, '0')}`;
  if (!lastPeriod) return null;
  let [ly] = lastPeriod.split('-').map(Number);
  let p = `${ly}-${String(mo).padStart(2, '0')}`;
  if (E.periodIndex(p) <= E.periodIndex(lastPeriod)) p = `${ly + 1}-${String(mo).padStart(2, '0')}`;
  return p;
}

const colIdx = (letter) => XLSX.utils.decode_col(letter);
const addr = (c, r) => XLSX.utils.encode_cell({ c, r });

function sheetGrid(ws) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  const get = (c, r) => ws[addr(c, r)];
  return { range, v: (c, r) => get(c, r)?.v, f: (c, r) => get(c, r)?.f, w: (c, r) => get(c, r)?.w };
}

/** Parse one ledger card tab. Returns null when the tab is not a ledger card. */
function parseCard(ws, tab) {
  const g = sheetGrid(ws);
  const maxR = Math.min(g.range.e.r, 400);
  const maxC = Math.min(g.range.e.c, 30);

  // Header row: the one containing "Date Granted"
  let hdr = -1;
  for (let r = 0; r <= Math.min(maxR, 20) && hdr < 0; r++) {
    for (let c = 0; c <= maxC; c++) if (/date\s*granted/i.test(norm(g.v(c, r)))) { hdr = r; break; }
  }
  if (hdr < 0) return null;
  // Two card templates are in use:
  //   A: Date Granted | Loan Amount | No. of Months | Loan Amount w/ Interest | Date of Deduction | Payment w/ Interest | Principal Payments | Months | … | Total Payment w/ Interest | BALANCE | (notes)
  //   B: DATE GRANTED | LOAN AMOUNT | NET PROCEED | NO. OF MONTHS | TOTAL PAYABLES | DATE PAID | INTEREST | PRINCIPAL | NO. OF MONTH PAID | REMAINING MONTHS | MONTHLY AMORTIZATION | BALANCE | REMARKS
  const col = {};
  for (let c = 0; c <= maxC; c++) {
    const t = lower(g.v(c, hdr));
    if (!t) continue;
    if (t.includes('date granted')) col.granted = c;
    else if (t.includes('loan amount') && t.includes('interest')) col.withInt = c;
    else if (t.includes('total payables')) col.withInt = c;
    else if (t.includes('loan amount')) col.amount = c;
    else if (t.includes('net proceed')) col.net = c;
    else if (t.includes('no. of months') || t.includes('no of months')) col.months = c;
    else if (t.includes('date of deduction') || t.includes('date paid')) col.date = c;
    else if ((t.includes('payment w/ interest') && !t.includes('total')) || t === 'interest') col.interest = c;
    else if (t.includes('principal')) col.principal = c;
    else if (t === 'months' || t.includes('month paid')) col.paidFlag = c;
    else if (t.includes('remaining month')) col.left = c;
    else if (t.includes('total payment') || t.includes('amortization')) col.payment = c;
    else if (t.includes('balance')) col.balance = c;
    else if (t.includes('remarks')) col.note = c;
  }
  if (col.amount == null || col.balance == null) return null;
  if (col.paidFlag == null) col.paidFlag = (col.principal ?? col.balance - 4) + 1;
  if (col.left == null) col.left = col.paidFlag + 1;
  if (col.note == null) col.note = col.balance + 1;

  // Some cards have the data one column to the left of the headers (e.g. GALICIAR). Detect it from
  // the first loan row: the "No. of Months" cell must hold a term (6–120).
  const firstLoanRow = hdr + 1;
  const monthsVal = num(g.v(col.months, firstLoanRow));
  if (!(monthsVal >= 6 && monthsVal <= 120)) {
    const shifted = num(g.v(col.months - 1, firstLoanRow));
    if (shifted >= 6 && shifted <= 120) {
      for (const k of Object.keys(col)) if (col[k] > col.amount) col[k] -= 1;
    }
  }

  // Name, school, employee number (rows above the header)
  let name = '', school = '', emp = '';
  for (let r = 0; r < hdr; r++) {
    for (let c = 0; c <= maxC; c++) {
      const t = norm(g.v(c, r));
      if (/^name\s*:?$/i.test(t)) {
        for (let k = c + 1; k <= maxC; k++) { const x = norm(g.v(k, r)); if (x) { if (!name) name = x; else school = x; } }
      }
      if (/employee\s*no/i.test(t)) {
        for (let k = c + 1; k <= maxC; k++) { const x = g.v(k, r); if (x != null && /^\d{4,10}(\.0)?$/.test(String(x))) { emp = String(x).replace(/\.0$/, ''); break; } }
      }
    }
  }
  if (!emp) return null;

  // Rows until the Total row
  let totalRow = null;
  for (let r = hdr + 1; r <= maxR; r++) {
    if (/^total/i.test(norm(g.v(0, r)))) { totalRow = r; break; }
  }
  const last = totalRow != null ? totalRow - 1 : maxR;

  const blocks = [];
  let cur = null;
  const notes = [];
  for (let r = hdr + 1; r <= last; r++) {
    const amount = num(g.v(col.amount, r));
    const months = num(g.v(col.months, r));
    // A loan block: plausible principal and term (rows with dates typed in these columns are notes)
    if (amount >= 1000 && amount <= 300000 && months >= 6 && months <= 120 && Number.isInteger(Math.round(months * 1000) / 1000)) {
      cur = {
        row: r + 1,
        granted: toDate(g.v(col.granted, r)),
        loan_amount: amount,
        no_of_months: Math.round(months),
        monthly_amortization: num(g.v(col.payment, r)) || num(g.v(col.payment, r + 1)) || null,
        entries: [],
        notes: [],
        card_balance: amount,
        card_paid: 0,
      };
      blocks.push(cur);
      continue;
    }
    if (!cur) continue;
    const flag = num(g.v(col.paidFlag, r));
    const rawDate = g.v(col.date, r);
    const note = norm(g.v(col.note, r));
    const lastPeriod = cur.entries.length ? cur.entries[cur.entries.length - 1].period : null;
    let d = toDate(rawDate);
    if (d && E.toPeriod(d) < '2000-01') d = null;
    const period = d ? E.toPeriod(d)
      : (periodFromText(rawDate, lastPeriod || (cur.granted ? E.toPeriod(cur.granted) : null))
        || (lastPeriod ? E.addMonths(lastPeriod, 1) : (cur.granted ? E.addMonths(E.toPeriod(cur.granted), 1) : null)));
    if (/morator/i.test(note)) {
      if (period) cur.entries.push({ entry_type: 'moratorium', period, amount_paid: 0, notes: 'MORATORIUM' });
      continue;
    }
    if (flag != null && flag > 0 && period) {
      const months = Math.max(1, Math.round(flag));
      const interest = num(g.v(col.interest, r));
      const principal = num(g.v(col.principal, r));
      // Lump settlement of the whole balance with no interest (e.g. paid at the cashier by OR)
      const prevBal = cur.card_balance;
      if (months > 1 && !(interest > 0) && principal != null && Math.abs(principal - prevBal) < 1) {
        cur.entries.push({ entry_type: 'payoff', period: d ? E.toPeriod(d) : (lastPeriod || period), amount_paid: E.round2(principal), notes: 'Balance paid in full (ledger card)', undated: !d });
        cur.card_paid += months;
        cur.card_balance = 0;
        continue;
      }
      // Several months paid in one row: the amount is interest + principal as written on the card.
      const pay = months > 1 && interest != null && principal != null
        ? E.round2(interest + principal)
        : (num(g.v(col.payment, r)) || cur.monthly_amortization);
      const text = typeof rawDate === 'string' ? norm(rawDate) : '';
      cur.entries.push({ entry_type: 'deduction', period, amount_paid: pay, months_covered: months > 1 ? months : null, notes: [text && !d ? text : null, note || null].filter(Boolean).join(' – ') || null });
      cur.card_paid += months;
      const bal = num(g.v(col.balance, r));
      if (bal != null) cur.card_balance = bal;
      continue;
    }
    if (note) cur.notes.push(note);
  }
  // Notes (e.g. "CO MAKER : …") anywhere on the card
  for (const b of blocks) for (const n of b.notes) {
    if (/^[\d.,\s-]+$/.test(n) || notes.includes(n)) continue; // drop stray numbers/dates and repeats
    notes.push(n);
  }

  return {
    tab,
    employee_number: emp,
    name,
    school,
    blocks,
    total: totalRow != null ? { paid: num(g.v(col.paidFlag, totalRow)), left: num(g.v(col.left, totalRow)), balance: num(g.v(col.balance, totalRow)) } : null,
    notes,
  };
}

/** Parse the SUMMARY tab (master list). */
function parseSummary(ws) {
  const g = sheetGrid(ws);
  let hdr = -1;
  for (let r = 0; r <= 10 && hdr < 0; r++) for (let c = 0; c <= 25; c++) if (/employee\s*number/i.test(norm(g.v(c, r)))) { hdr = r; break; }
  if (hdr < 0) return new Map();
  const col = {};
  for (let c = 0; c <= 30; c++) {
    const t = lower(g.v(c, hdr));
    if (!t) continue;
    if (t.startsWith('station')) col.station = c;
    else if (t.includes('employee number')) col.emp = c;
    else if (t.includes('name of employee')) col.name = c;
    else if (t.includes('loan application')) col.appNo = c;
    else if (t.startsWith('check no')) col.checkNo = c;
    else if (t.startsWith('check date')) col.checkDate = c;
    else if (t === 'loan amount') col.amount = c;
    else if (t.includes('effective date')) col.effective = c;
    else if (t.includes('month paid')) col.paid = c;
    else if (t === 'loan balance') col.balance = c;
    else if (t === 'status') col.status = c;
    else if (t === 'remarks') col.remarks = c;
    else if (t === 'notes') col.notes = c;
  }
  const out = new Map();
  for (let r = hdr + 1; r <= Math.min(g.range.e.r, 2000); r++) {
    const emp = String(g.v(col.emp, r) ?? '').replace(/\.0$/, '').trim();
    if (!/^\d{4,10}$/.test(emp)) continue;
    out.set(emp, {
      row: r + 1,
      station: norm(g.v(col.station, r)),
      name: norm(g.v(col.name, r)),
      application_no: norm(g.v(col.appNo, r)) || null,
      check_number: norm(g.v(col.checkNo, r)).replace(/\.0$/, '') || null,
      check_date: toDate(g.v(col.checkDate, r)),
      loan_amount: num(g.v(col.amount, r)),
      effective: toDate(g.v(col.effective, r)),
      paid: num(g.v(col.paid, r)),
      balance: num(g.v(col.balance, r)),
      status: norm(g.v(col.status, r)),
      remarks: norm(g.v(col.remarks, r)),
      notes: norm(g.v(col.notes, r)),
    });
  }
  return out;
}

function parseWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellFormula: true, cellDates: false });
  const names = wb.SheetNames;
  const summaryName = names.find((n) => /^summary$/i.test(n.trim())) || names.find((n) => /summary/i.test(n) && !/copy/i.test(n));
  const summary = summaryName ? parseSummary(wb.Sheets[summaryName]) : new Map();
  const cards = [];
  const skipped = [];
  for (const n of names) {
    if (/summary/i.test(n)) continue;
    const c = parseCard(wb.Sheets[n], n);
    if (c && c.blocks.length) cards.push(c); else skipped.push(n);
  }
  return { summaryName, summary, cards, skipped };
}

function splitName(full) {
  const parts = norm(full).toUpperCase().split(' ').filter(Boolean);
  if (parts.length <= 1) return { first_name: parts[0] || '', middle_name: null, last_name: parts[0] || '' };
  const suffix = /^(JR\.?|SR\.?|II|III|IV)$/.test(parts[parts.length - 1]) ? parts.pop() : null;
  const last = parts.pop();
  const mid = parts.length > 1 && /^[A-Z]\.?$/.test(parts[parts.length - 1]) ? parts.pop() : null;
  return { first_name: parts.join(' '), middle_name: mid, last_name: suffix ? `${last} ${suffix}` : last };
}

/** Find "FULLY PAID … April 27, 2026 … OR# 0313529" in remarks. */
function parsePayoff(remarks) {
  if (!/fully\s*paid/i.test(remarks || '')) return null;
  // "fully paid 2nd loan …", "fully paid of previous loan …" describe an earlier loan
  if (/(previous|prev\.|1st|2nd|3rd|4th|first|second|third)\s*(loan)?/i.test(remarks)) return null;
  const or = (remarks.match(/O\.?R\.?\s*#?\s*:?\s*([A-Z0-9-]+)/i) || [])[1] || null;
  const dm = remarks.match(/([A-Za-z]+)\.?\s+(\d{1,2})(?:,\s*|\s+)(\d{4})/);
  let d = dm ? toDate(`${dm[1]} ${dm[2]},${dm[3]}`) : null;
  if (!d) { const my = remarks.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})/i); if (my) d = toDate(`${my[1]} ${my[2]}`); }
  return { reference: or ? `OR# ${or}` : null, date: d };
}

/**
 * Import into the database. Existing loans created by a previous card import for the same
 * borrowers are replaced when replace=true; otherwise those borrowers are skipped.
 */
async function importWorkbook(buffer, { replace = false, user = 'Import' } = {}) {
  const { models } = require('../database/db');
  const ledger = require('./ledgerService');
  const { Employee, Loan, LedgerEntry } = models;
  const parsed = parseWorkbook(buffer);
  const result = { summary_tab: parsed.summaryName, cards: parsed.cards.length, employees_created: 0, employees_updated: 0, loans_created: 0, entries_created: 0, payoffs: 0, skipped_existing: [], summary_only: 0, errors: [], skipped_tabs: parsed.skipped };

  const moratoria = await require('./settings').getMoratoria();
  const seen = new Set();
  for (const card of parsed.cards) {
    try {
      const s = parsed.summary.get(card.employee_number);
      const nm = splitName(card.name || s?.name || '');
      let emp = await Employee.findOne({ where: { employee_number: card.employee_number } });
      const empData = {
        employee_number: card.employee_number, ...nm, school: card.school || emp?.school || null,
        station: s?.station || emp?.station || null, status: /deceased/i.test(`${s?.remarks} ${s?.status}`) ? 'deceased' : (emp?.status || 'active'),
      };
      if (emp) { await emp.update(empData); result.employees_updated++; } else { emp = await Employee.create({ ...empData, position: 'Teacher', department: 'DepEd' }); result.employees_created++; }
      seen.add(card.employee_number);

      const existing = await Loan.findAll({ where: { employee_number: card.employee_number } });
      if (existing.length) {
        if (!replace) { result.skipped_existing.push(card.employee_number); continue; }
        await LedgerEntry.destroy({ where: { loan_id: existing.map((l) => l.id) } });
        await Loan.destroy({ where: { id: existing.map((l) => l.id) } });
      }

      let prevLoan = null;
      for (let bi = 0; bi < card.blocks.length; bi++) {
        const b = card.blocks[bi];
        const isLatest = bi === card.blocks.length - 1;
        const granted = b.granted || (isLatest ? s?.check_date : null) || null;
        // First deduction: the first posted row; else the month after release, moved past any moratorium.
        let firstPeriod = b.entries.find((e) => e.entry_type === 'deduction')?.period
          || (isLatest && s?.effective && (!granted || s.effective > granted) ? E.toPeriod(s.effective) : null)
          || (granted ? E.addMonths(E.toPeriod(granted), 1) : null);
        if (firstPeriod && !b.entries.length) {
          while (E.inMoratorium(firstPeriod, moratoria)) firstPeriod = E.addMonths(firstPeriod, 1);
        }
        const loan = await Loan.create({
          employee_number: card.employee_number,
          loan_type: b.loan_amount > 100000 ? 'additional' : 'multi_purpose',
          loan_amount: b.loan_amount,
          no_of_months: b.no_of_months,
          monthly_amortization: b.monthly_amortization || E.amortization(b.loan_amount, b.no_of_months),
          interest_rate: 6,
          date_granted: granted ? granted.toISOString().slice(0, 10) : null,
          loan_application_date: granted || null,
          effective_date: firstPeriod ? `${firstPeriod}-01` : null,
          application_no: isLatest ? s?.application_no || null : null,
          check_number: isLatest ? s?.check_number || null : null,
          check_date: isLatest && s?.check_date ? s.check_date.toISOString().slice(0, 10) : null,
          remarks: isLatest ? [s?.remarks, s?.status ? `Sheet status: ${s.status}` : null].filter(Boolean).join(' | ') || null : null,
          notes: [isLatest ? s?.notes : null, ...(isLatest ? card.notes : [])].filter(Boolean).join(' | ') || null,
          previous_loan_id: prevLoan ? prevLoan.id : null,
          reason: 'Imported from ledger card',
          approved_by: 'Import',
          status: 'active',
          loan_balance: b.loan_amount,
          no_of_months_paid: 0,
          source: 'card_import',
        });
        result.loans_created++;
        for (const e of b.entries) {
          await LedgerEntry.create({
            employee_number: card.employee_number, loan_id: loan.id, entry_type: e.entry_type, period: e.period,
            payment_date: E.periodEndDate(e.period), date_of_deduction: E.periodEndDate(e.period),
            amount_paid: e.amount_paid, monthly_payment_amount: e.amount_paid, notes: e.notes, months_covered: e.months_covered || null,
            reference_number: null, recorded_by: user, payroll_batch: 'CARD-IMPORT', paid_status: e.entry_type === 'deduction',
          });
          result.entries_created++;
        }
        // An earlier block that was not paid down to zero was renewed into the next loan.
        if (prevLoan) {
          const prevCard = await ledger.cardFor(prevLoan);
          if (prevCard.summary.balance > 0.5) {
            const p = firstPeriod ? E.addMonths(firstPeriod, -1) : prevCard.summary.next_due_period;
            await LedgerEntry.create({
              employee_number: card.employee_number, loan_id: prevLoan.id, entry_type: 'renewal_offset', period: p,
              payment_date: E.periodEndDate(p), amount_paid: prevCard.summary.balance,
              notes: 'Outstanding balance deducted from the new loan (renewal)', recorded_by: user, payroll_batch: 'CARD-IMPORT',
            });
            await loan.update({ outstanding_deducted: prevCard.summary.balance, net_proceeds: E.round2(b.loan_amount - prevCard.summary.balance) });
            result.entries_created++;
          }
          await ledger.refreshLoan(prevLoan);
        }
        // Early payoff recorded only in the SUMMARY remarks
        if (isLatest && s) {
          const po = parsePayoff(s.remarks);
          // A payoff row on the card without a date takes the date/OR from the SUMMARY remark
          if (po) {
            const undated = await LedgerEntry.findOne({ where: { loan_id: loan.id, entry_type: 'payoff' } });
            if (undated && (po.date || po.reference)) {
              const p2 = po.date ? E.toPeriod(po.date) : undated.period;
              await undated.update({ period: p2, payment_date: po.date || undated.payment_date, reference_number: po.reference || undated.reference_number, notes: `${undated.notes || ''} – ${s.remarks}`.trim() });
            }
          }
          const c = await ledger.cardFor(loan);
          // Only a payoff dated within the current loan's life (an earlier date refers to the previous loan)
          if (po && c.summary.balance > 0.5 && (!po.date || !firstPeriod || E.toPeriod(po.date) >= firstPeriod)) {
            const p = po.date ? E.toPeriod(po.date) : (c.rows.filter((r) => !r.projected).slice(-1)[0]?.period || firstPeriod);
            await LedgerEntry.create({
              employee_number: card.employee_number, loan_id: loan.id, entry_type: 'payoff', period: p,
              payment_date: po.date || E.periodEndDate(p), amount_paid: c.summary.balance, reference_number: po.reference,
              notes: `From SUMMARY remarks: ${s.remarks}`, recorded_by: user, payroll_batch: 'CARD-IMPORT',
            });
            result.payoffs++;
            result.entries_created++;
          }
        }
        await ledger.refreshLoan(loan);
        prevLoan = loan;
      }
    } catch (err) {
      result.errors.push({ tab: card.tab, employee_number: card.employee_number, error: err.message });
    }
  }

  // SUMMARY rows without a ledger card → summary-only loans with an opening balance
  for (const [emp, s] of parsed.summary) {
    if (seen.has(emp) || !(s.loan_amount > 0)) continue;
    result.summary_only++;
    result.errors.push({ employee_number: emp, error: `No ledger card tab found for ${s.name} (SUMMARY row ${s.row}); not imported` });
  }

  result.reconciliation = await reconcile(parsed);
  return result;
}

/** Compare the system's computed cards with the workbook's card balances and SUMMARY. */
async function reconcile(parsed) {
  const ledger = require('./ledgerService');
  const { models } = require('../database/db');
  const out = [];
  for (const card of parsed.cards) {
    const loans = await models.Loan.findAll({ where: { employee_number: card.employee_number }, order: [['effective_date', 'ASC'], ['id', 'ASC']] });
    if (!loans.length) continue;
    const latest = loans[loans.length - 1];
    const c = await ledger.cardFor(latest);
    const b = card.blocks[card.blocks.length - 1];
    const s = parsed.summary.get(card.employee_number);
    const issues = [];
    if (Math.abs(c.summary.balance - Math.max(b.card_balance, 0)) > 1 && c.summary.status === 'active') issues.push(`card balance ₱${b.card_balance.toFixed(2)} vs system ₱${c.summary.balance.toFixed(2)}`);
    if (b.card_paid !== c.summary.months_paid && c.summary.status === 'active') issues.push(`card months paid ${b.card_paid} vs system ${c.summary.months_paid}`);
    if (card.total && card.total.paid != null && card.total.paid !== b.card_paid) issues.push(`card Total row says ${card.total.paid} months paid but the current loan block has ${b.card_paid} deductions`);
    if (s && s.balance != null && Math.abs(Math.max(s.balance, 0) - c.summary.balance) > 1) issues.push(`SUMMARY balance ₱${s.balance.toFixed(2)} vs system ₱${c.summary.balance.toFixed(2)}`);
    const settledByOR = c.summary.closed_by === 'payoff';
    if (s && s.paid != null && s.paid !== c.summary.months_paid && !(settledByOR && s.paid >= c.summary.months_paid)) issues.push(`SUMMARY months paid ${s.paid} vs system ${c.summary.months_paid}`);
    if (Math.abs(c.terms.monthly_amortization - c.terms.expected_amortization) > 0.011) issues.push(`card amortization ₱${c.terms.monthly_amortization} vs 6% table ₱${c.terms.expected_amortization}`);
    if (c.summary.refund_due > 0) issues.push(`over-deducted ₱${c.summary.refund_due.toFixed(2)} (refund due)`);
    out.push({ tab: card.tab, employee_number: card.employee_number, name: card.name, loans: loans.length, system_balance: c.summary.balance, months_paid: c.summary.months_paid, status: c.summary.status, issues });
  }
  return { checked: out.length, with_issues: out.filter((x) => x.issues.length).length, rows: out };
}

module.exports = { parseWorkbook, parseCard, parseSummary, importWorkbook, reconcile, toDate, splitName, parsePayoff };
