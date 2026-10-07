'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { portalAPI } from '../lib/api';
import { Alert, Btn, Field, inputCls, errMsg } from '../lib/ui';
import Calculator from './Calculator';

export default function EmployeePortalLogin() {
  const router = useRouter();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ employee_number: '', password: '', last_name: '', code: '', confirm: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (localStorage.getItem('portal_token')) router.replace('/employee/home'); }, [router]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (mode === 'activate' && f.password !== f.confirm) { setErr('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const r = mode === 'login'
        ? await portalAPI.login({ employee_number: f.employee_number, password: f.password })
        : await portalAPI.activate({ employee_number: f.employee_number, last_name: f.last_name, code: f.code, password: f.password });
      localStorage.setItem('portal_token', r.data.data.token);
      router.replace('/employee/home');
    } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-blue-800 text-xs font-bold text-white">PF</span>
          <div className="leading-tight"><p className="text-sm font-semibold">DepEd Provident Fund – Employee Portal</p><p className="text-xs text-slate-500">Schools Division Office of Sipalay City · Accounting Section</p></div>
          <Link href="/" className="ml-auto text-sm text-slate-600 hover:underline">Home</Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[380px_1fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex rounded-md bg-slate-100 p-1 text-sm">
            {[['login', 'Sign in'], ['activate', 'Activate account']].map(([k, l]) => (
              <button key={k} onClick={() => { setMode(k); setErr(''); }} className={`flex-1 rounded px-3 py-1.5 ${mode === k ? 'bg-white font-medium shadow-sm' : 'text-slate-600'}`}>{l}</button>
            ))}
          </div>
          <form onSubmit={submit} className="space-y-3">
            <Field label="Employee number"><input className={inputCls} value={f.employee_number} onChange={set('employee_number')} inputMode="numeric" autoComplete="username" required /></Field>
            {mode === 'activate' && <>
              <Field label="Last name"><input className={inputCls} value={f.last_name} onChange={set('last_name')} required /></Field>
              <Field label="Activation code" hint="From the slip given by the Accounting Section"><input className={`${inputCls} font-mono uppercase tracking-widest`} value={f.code} onChange={set('code')} required /></Field>
            </>}
            <Field label={mode === 'activate' ? 'Create a password' : 'Password'} hint={mode === 'activate' ? 'At least 8 characters with letters and numbers' : ''}>
              <input type="password" className={inputCls} value={f.password} onChange={set('password')} autoComplete={mode === 'activate' ? 'new-password' : 'current-password'} required />
            </Field>
            {mode === 'activate' && <Field label="Confirm password"><input type="password" className={inputCls} value={f.confirm} onChange={set('confirm')} autoComplete="new-password" required /></Field>}
            <Alert>{err}</Alert>
            <Btn type="submit" className="w-full justify-center" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Activate and sign in'}</Btn>
          </form>
          <p className="mt-4 text-xs text-slate-500">No account yet? Ask the Accounting Section for your activation code. Forgot your password? The Accounting Section can issue a new code.</p>
        </section>
        <section>
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Loan calculator</h2>
          <p className="mb-4 text-sm text-slate-600">DepEd Provident Fund: 6% per annum on the diminishing balance, 12 to 60 months, up to ₱100,000 (multi-purpose).</p>
          <Calculator />
        </section>
      </div>
    </main>
  );
}
