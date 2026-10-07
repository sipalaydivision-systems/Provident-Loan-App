'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV = [
  { href: '/admin/overview', label: 'Overview' },
  { href: '/admin/summary', label: 'Summary' },
  { href: '/admin/posting', label: 'Monthly posting' },
  { href: '/admin/applications', label: 'Applications' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/employees', label: 'Employees' },
  { href: '/admin/import', label: 'Import' },
  { href: '/admin/settings', label: 'Settings' },
];

export default function AdminLayout({ children }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const isLogin = pathname.startsWith('/admin/login');
  const isPrint = pathname.startsWith('/admin/print');

  useEffect(() => {
    if (isLogin) { setReady(true); return; }
    const token = localStorage.getItem('token');
    if (!token) router.replace('/admin/login');
    else setReady(true);
  }, [isLogin, router]);

  if (isLogin) return children;
  if (!ready) return null;
  if (isPrint) return <div className="min-h-screen bg-white">{children}</div>;

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.replace('/admin/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-2.5">
          <Link href="/admin/overview" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-blue-800 text-xs font-bold text-white">PF</span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-sm font-semibold">Provident Fund</span>
              <span className="block text-[11px] text-slate-500">Accounting Section · SDO Sipalay City</span>
            </span>
          </Link>
          <nav className="hidden flex-1 items-center gap-0.5 lg:flex">
            {NAV.map((n) => {
              const active = pathname.startsWith(n.href) || (n.href === '/admin/summary' && pathname.startsWith('/admin/ledger'));
              return (
                <Link key={n.href} href={n.href} className={`rounded-md px-2.5 py-1.5 text-sm ${active ? 'bg-blue-50 font-medium text-blue-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={logout} className="rounded-md px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Sign out</button>
            <button onClick={() => setOpen(!open)} className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm lg:hidden" aria-label="Menu">☰</button>
          </div>
        </div>
        {open && (
          <nav className="grid grid-cols-2 gap-1 border-t border-slate-100 px-4 py-2 lg:hidden">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="rounded-md px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-100">{n.label}</Link>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-6">{children}</main>
    </div>
  );
}
