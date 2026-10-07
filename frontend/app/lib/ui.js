'use client';

import { useEffect, useState, useCallback } from 'react';

// ── Formatting ────────────────────────────────────────────────────────────────
export const peso = (n, { blankZero = false } = {}) => {
  if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return '';
  if (blankZero && Number(n) === 0) return '';
  return Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
export const php = (n) => (n === null || n === undefined ? '—' : `₱${peso(n)}`);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const periodLabel = (p, long = false) => {
  if (!p || !/^\d{4}-\d{2}/.test(p)) return p || '—';
  const [y, m] = p.split('-').map(Number);
  return `${(long ? MONTH : MON)[m - 1]} ${y}`;
};
export const dateLabel = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return `${MON[dt.getUTCMonth()]} ${String(dt.getUTCDate()).padStart(2, '0')}, ${dt.getUTCFullYear()}`;
};
export const currentPeriod = (offset = 0) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const addPeriod = (p, k) => {
  const [y, m] = p.split('-').map(Number);
  const i = y * 12 + (m - 1) + k;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
};
export const errMsg = (e) => e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Something went wrong';

// ── Building blocks ───────────────────────────────────────────────────────────
const BTN = {
  primary: 'bg-blue-800 text-white hover:bg-blue-900 disabled:bg-slate-300',
  outline: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:text-slate-400',
  ghost: 'text-slate-700 hover:bg-slate-100',
  danger: 'bg-red-700 text-white hover:bg-red-800 disabled:bg-slate-300',
  success: 'bg-emerald-700 text-white hover:bg-emerald-800 disabled:bg-slate-300',
};
export function Btn({ variant = 'primary', size = 'md', className = '', ...props }) {
  const sz = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm';
  return <button type="button" className={`inline-flex items-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed ${sz} ${BTN[variant]} ${className}`} {...props} />;
}

export function Card({ title, subtitle, actions, children, className = '', bodyClass = 'p-4' }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function PageTitle({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
    </div>
  );
}

const TONES = {
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-blue-50 text-blue-800 ring-1 ring-blue-200',
  green: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  violet: 'bg-violet-50 text-violet-800 ring-1 ring-violet-200',
};
export function Pill({ tone = 'slate', children, className = '' }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium ${TONES[tone]} ${className}`}>{children}</span>;
}

export function LoanStatus({ status, eligible }) {
  if (status === 'fully_paid') return <Pill tone="green">Fully paid</Pill>;
  if (status === 'renewed') return <Pill tone="violet">Renewed</Pill>;
  return eligible ? <Pill tone="blue">Qualified for re-loan</Pill> : <Pill>Not yet qualified</Pill>;
}

export const ENTRY_LABEL = {
  deduction: 'Payroll deduction', or_payment: 'Payment at cashier (OR)', moratorium: 'MORATORIUM', prepayment: 'Partial payment (OR)',
  payoff: 'Paid in full', renewal_offset: 'Deducted from new loan', adjustment: 'Adjustment', refund: 'Refund of over-deduction',
  opening: 'Opening balance', no_deduction: 'No deduction', projected: 'Scheduled',
};

export function Stat({ label, value, hint, tone = 'slate' }) {
  const color = { slate: 'text-slate-900', blue: 'text-blue-800', green: 'text-emerald-700', amber: 'text-amber-700', red: 'text-red-700' }[tone];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}
export const inputBase = 'rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-700';
export const inputCls = `w-full ${inputBase}`;
/** For inputs given their own width (w-40 etc.) */
export const inputInline = inputBase;

export function Modal({ open, title, onClose, children, footer, wide = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 print:hidden" onMouseDown={onClose}>
      <div className={`mt-10 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-lg bg-white shadow-xl`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">✕</button>
        </div>
        <div className="p-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Alert({ tone = 'red', children }) {
  if (!children) return null;
  const c = { red: 'border-red-200 bg-red-50 text-red-800', green: 'border-emerald-200 bg-emerald-50 text-emerald-800', amber: 'border-amber-200 bg-amber-50 text-amber-900', blue: 'border-blue-200 bg-blue-50 text-blue-900' }[tone];
  return <div className={`rounded-md border px-3 py-2 text-sm ${c}`}>{children}</div>;
}

export function Loading({ label = 'Loading…' }) {
  return <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-800" />{label}</div>;
}

export function Empty({ children }) {
  return <div className="p-8 text-center text-sm text-slate-500">{children}</div>;
}

/** Run an async loader; returns { data, error, loading, reload }. */
export function useLoad(fn, deps = []) {
  const [state, set] = useState({ data: null, error: '', loading: true });
  const load = useCallback(async () => {
    set((s) => ({ ...s, loading: true, error: '' }));
    try {
      const r = await fn();
      set({ data: r?.data?.data ?? r?.data ?? r, error: '', loading: false });
    } catch (e) {
      set({ data: null, error: errMsg(e), loading: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

export const th = 'whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600';
export const td = 'border-b border-slate-100 px-2.5 py-1.5 text-sm text-slate-800';
export const tdNum = `${td} text-right tabular-nums`;
