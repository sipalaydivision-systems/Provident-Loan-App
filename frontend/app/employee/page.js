'use client';

import { useState } from 'react';
import Link from 'next/link';
import { employeeAPI } from '../lib/api';

export default function EmployeePortal() {
  const [searchType, setSearchType] = useState('number');
  const [formData, setFormData] = useState({ employee_number: '', first_name: '', last_name: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      let response;
      if (searchType === 'number') {
        response = await employeeAPI.lookup(formData.employee_number);
        // Normalize lookup response to match expected shape: { data: { employee, loan, recentPayments } }
        if (response.data && !response.data.data) {
          response = { data: { data: { employee: response.data.employee, loan: response.data.loan, recentPayments: response.data.recentPayments } } };
        }
      } else {
        response = await employeeAPI.searchByName({
          first_name: formData.first_name,
          last_name: formData.last_name
        });
        // If multiple matches returned, pick the first and fetch full detail
        if (response.data?.matches?.length > 0) {
          const match = response.data.matches[0];
          const detail = await employeeAPI.lookup(match.employee_number);
          response = { data: { data: { employee: detail.data.employee, loan: detail.data.loan, recentPayments: detail.data.recentPayments } } };
        } else if (response.data && !response.data.data) {
          response = { data: { data: { employee: response.data.employee, loan: response.data.loan, recentPayments: response.data.recentPayments } } };
        }
      }
      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Background effects */}
      <div className="fixed top-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full mix-blend-screen filter blur-3xl opacity-20 pointer-events-none"></div>
      <div className="fixed bottom-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full mix-blend-screen filter blur-3xl opacity-20 pointer-events-none"></div>

      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="text-slate-400 hover:text-slate-200 text-sm font-semibold transition-colors flex items-center gap-2">
            <span>←</span>
            <span>Back to Home</span>
          </Link>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
            Employee Portal
          </h1>
          <div className="w-24"></div>
        </div>
      </header>

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-12">
        {/* Search Form */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/30 border border-slate-700/50 rounded-2xl p-8 mb-8 backdrop-blur-xl">
          <h2 className="text-3xl font-bold text-white mb-2">Search Your Loan</h2>
          <p className="text-slate-400 mb-8">Enter your employee information to view your provident loan details</p>

          {/* Search Type Toggle */}
          <div className="flex gap-3 mb-8">
            <button
              onClick={() => {
                setSearchType('number');
                setFormData({ employee_number: '', first_name: '', last_name: '' });
              }}
              className={`px-5 py-2.5 rounded-lg font-semibold transition-all duration-200 ${
                searchType === 'number'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/25'
                  : 'bg-slate-800/50 text-slate-300 border border-slate-700 hover:border-slate-600'
              }`}
            >
              Employee Number
            </button>
            <button
              onClick={() => {
                setSearchType('name');
                setFormData({ employee_number: '', first_name: '', last_name: '' });
              }}
              className={`px-5 py-2.5 rounded-lg font-semibold transition-all duration-200 ${
                searchType === 'name'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                  : 'bg-slate-800/50 text-slate-300 border border-slate-700 hover:border-slate-600'
              }`}
            >
              Name
            </button>
          </div>

          <form onSubmit={handleSearch} className="space-y-6">
            {searchType === 'number' ? (
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-200">
                  Employee Number
                </label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 to-cyan-500/0 group-focus-within:from-purple-500/20 group-focus-within:to-cyan-500/20 rounded-lg transition-all duration-300"></div>
                  <input
                    type="text"
                    name="employee_number"
                    value={formData.employee_number}
                    onChange={handleInputChange}
                    placeholder="e.g., 4261248"
                    className="relative w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 transition-colors duration-200"
                    required
                  />
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-200">
                    First Name
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 to-cyan-500/0 group-focus-within:from-purple-500/20 group-focus-within:to-cyan-500/20 rounded-lg transition-all duration-300"></div>
                    <input
                      type="text"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleInputChange}
                      placeholder="First name"
                      className="relative w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 transition-colors duration-200"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-200">
                    Last Name
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 to-cyan-500/0 group-focus-within:from-purple-500/20 group-focus-within:to-cyan-500/20 rounded-lg transition-all duration-300"></div>
                    <input
                      type="text"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleInputChange}
                      placeholder="Last name"
                      className="relative w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 transition-colors duration-200"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
                <span className="text-red-400 text-lg leading-none">⚠️</span>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 disabled:from-slate-600 disabled:to-slate-600 text-white font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/25 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Searching...
                </>
              ) : (
                <>
                  Search
                  <span>→</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results */}
        {result && result.data && (
          <div className="space-y-6">
            {/* Employee Info Card */}
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/30 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-xl">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-6">Employee Information</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-400">Employee Number</p>
                  <p className="text-2xl font-bold text-white font-mono">{result.data.employee?.employee_number}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-400">Full Name</p>
                  <p className="text-2xl font-bold text-white">
                    {result.data.employee?.first_name} {result.data.employee?.last_name}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-400">Position</p>
                  <p className="text-white">{result.data.employee?.position}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-400">Station</p>
                  <p className="text-white">{result.data.employee?.station}</p>
                </div>
              </div>
            </div>

            {/* Loan Details Card */}
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/30 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-xl">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-6">Loan Details</h3>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl p-6">
                  <p className="text-xs font-semibold text-slate-400 mb-2">Total Loan Amount</p>
                  <p className="text-3xl font-bold text-white">₱ {result.data.loan?.loan_amount?.toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-xl p-6">
                  <p className="text-xs font-semibold text-slate-400 mb-2">Current Balance</p>
                  <p className="text-3xl font-bold text-emerald-400">₱ {result.data.loan?.loan_balance?.toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-6">
                  <p className="text-xs font-semibold text-slate-400 mb-2">Monthly Amortization</p>
                  <p className="text-2xl font-bold text-white">₱ {result.data.loan?.monthly_amortization?.toLocaleString()}</p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <p className="text-xs font-semibold text-slate-400 mb-2">Status</p>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${result.data.loan?.status === 'active' ? 'bg-emerald-400' : 'bg-slate-400'}`}></span>
                    <p className="text-lg font-bold text-white uppercase">{result.data.loan?.status}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Payments */}
            {result.data.recentPayments && result.data.recentPayments.length > 0 && (
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/30 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-xl">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-6">Recent Payments</h3>
                <div className="space-y-3">
                  {result.data.recentPayments.slice(0, 5).map((payment, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 bg-slate-800/30 border border-slate-700/30 rounded-lg hover:border-emerald-500/30 transition-colors"
                    >
                      <span className="text-slate-300">
                        {new Date(payment.date_of_deduction || payment.date || payment.payment_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                      <span className="text-emerald-400 font-bold">₱ {(payment.monthly_payment_amount || payment.amount_paid || payment.amount)?.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
