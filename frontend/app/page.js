'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Animated background blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full mix-blend-screen filter blur-3xl opacity-50 animate-pulse"></div>
      <div className="absolute top-40 right-0 w-96 h-96 bg-cyan-500/20 rounded-full mix-blend-screen filter blur-3xl opacity-50 animate-pulse" style={{ animationDelay: '2s' }}></div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-slate-700/50 bg-slate-900/30 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Provident Loan System
              </h1>
              <p className="text-slate-400 text-xs md:text-sm">Secure Financial Management Platform</p>
            </div>
            <div className="text-slate-300 text-xs md:text-sm flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>System Active</span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-6 py-20">
          {/* Hero Section */}
          <section className="text-center mb-24 space-y-8">
            <div className="space-y-4">
              <h2 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Manage Your Provident Loans
              </h2>
              <p className="text-lg md:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
                A modern platform for employees and administrators to manage provident fund loans with transparency and ease.
              </p>
            </div>

            {/* Quick Stats */}
            <div className="grid md:grid-cols-3 gap-4 mt-12 max-w-2xl mx-auto">
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 backdrop-blur">
                <div className="text-2xl font-bold text-purple-400">500+</div>
                <p className="text-slate-400 text-sm">Employees</p>
              </div>
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 backdrop-blur">
                <div className="text-2xl font-bold text-cyan-400">100+</div>
                <p className="text-slate-400 text-sm">Active Loans</p>
              </div>
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 backdrop-blur">
                <div className="text-2xl font-bold text-emerald-400">₱50M</div>
                <p className="text-slate-400 text-sm">Managed</p>
              </div>
            </div>
          </section>

          {/* CTA Cards - 21st.dev Style */}
          <div className="grid md:grid-cols-2 gap-8 mb-20">
            {/* Employee Portal Card */}
            <Link href="/employee">
              <div className="group relative bg-gradient-to-br from-slate-800/50 to-slate-900/30 border border-slate-700/50 rounded-2xl p-8 hover:border-purple-500/50 transition-all duration-300 cursor-pointer overflow-hidden backdrop-blur-xl">
                {/* Animated gradient border */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"></div>
                
                <div className="relative z-10 space-y-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30">
                    <span className="text-3xl">👤</span>
                  </div>

                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">Employee Portal</h3>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      Search and view your loan information, check payment history, and download statements instantly.
                    </p>
                  </div>

                  <ul className="space-y-2">
                    {[
                      'Search by Employee Number',
                      'Search by Name',
                      'View Real-Time Balance',
                      'Download Statements'
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-slate-300 text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                        {item}
                      </li>
                    ))}
                  </ul>

                  <button className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold transition-all duration-300 group-hover:shadow-lg group-hover:shadow-purple-500/25">
                    Access Portal →
                  </button>
                </div>
              </div>
            </Link>

            {/* Admin Dashboard Card */}
            <Link href="/admin/login">
              <div className="group relative bg-gradient-to-br from-slate-800/50 to-slate-900/30 border border-slate-700/50 rounded-2xl p-8 hover:border-cyan-500/50 transition-all duration-300 cursor-pointer overflow-hidden backdrop-blur-xl">
                {/* Animated gradient border */}
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"></div>
                
                <div className="relative z-10 space-y-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-cyan-500/20 to-orange-500/20 border border-cyan-500/30">
                    <span className="text-3xl">🔐</span>
                  </div>

                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">Admin Dashboard</h3>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      Manage employees, loans, record payments, and generate comprehensive reports and analytics.
                    </p>
                  </div>

                  <ul className="space-y-2">
                    {[
                      'Employee Management',
                      'Loan Administration',
                      'Payment Recording',
                      'Advanced Reporting'
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-slate-300 text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                        {item}
                      </li>
                    ))}
                  </ul>

                  <button className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-600 to-orange-600 hover:from-cyan-700 hover:to-orange-700 text-white font-semibold transition-all duration-300 group-hover:shadow-lg group-hover:shadow-cyan-500/25">
                    Admin Login →
                  </button>
                </div>
              </div>
            </Link>
          </div>

          {/* Status Section */}
          <section className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-xl">
            <h3 className="text-xl font-semibold text-white mb-8 text-center">System Status</h3>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: '⚡', label: 'Backend API', value: 'Running', color: 'from-purple-400 to-blue-400' },
                { icon: '🎨', label: 'Frontend', value: 'Ready', color: 'from-blue-400 to-cyan-400' },
                { icon: '💾', label: 'Database', value: 'Active', color: 'from-cyan-400 to-emerald-400' }
              ].map((item, idx) => (
                <div key={idx} className="text-center p-4 rounded-lg bg-slate-800/30 border border-slate-700/30">
                  <div className="text-3xl mb-2">{item.icon}</div>
                  <p className="text-slate-400 text-sm mb-1">{item.label}</p>
                  <p className={`text-lg font-semibold bg-gradient-to-r ${item.color} bg-clip-text text-transparent`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="border-t border-slate-700/50 bg-slate-900/30 backdrop-blur mt-20 py-8 text-center text-slate-400 text-sm">
          <div className="max-w-7xl mx-auto px-6 space-y-2">
            <p>Provident Loan Management System v1.0</p>
            <p className="text-xs">© 2026 All Rights Reserved • Built with modern security standards</p>
          </div>
        </footer>
      </div>
    </main>
  );
}