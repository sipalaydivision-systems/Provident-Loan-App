'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authAPI } from '../../lib/api';

export default function AdminLogin() {
  const router = useRouter();
  const [formData, setFormData] = useState({ username: 'admin', password: 'admin123' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const canvasRef = useRef(null);

  // Animated blob background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    let time = 0;
    const animate = () => {
      time += 0.01;
      ctx.fillStyle = 'rgba(15, 23, 42, 1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw animated blob
      ctx.fillStyle = `rgba(139, 92, 246, ${0.1 + Math.sin(time) * 0.1})`;
      ctx.beginPath();
      const x = canvas.width / 2 + Math.sin(time * 0.5) * 50;
      const y = canvas.height / 2 + Math.cos(time * 0.7) * 50;
      ctx.arc(x, y, 150 + Math.sin(time * 0.3) * 30, 0, Math.PI * 2);
      ctx.fill();

      requestAnimationFrame(animate);
    };
    animate();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authAPI.login(formData);

      // Store token and user info
      localStorage.setItem('token', response.data.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.data.user));

      // Redirect to dashboard
      router.push('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Try admin/admin123');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 overflow-hidden flex items-center justify-center p-4">
      {/* Animated background */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full"
        style={{ opacity: 0.5 }}
      />

      {/* Glow effects */}
      <div className="fixed top-0 left-0 w-96 h-96 bg-purple-500/30 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-pulse"></div>
      <div className="fixed bottom-0 right-0 w-96 h-96 bg-cyan-500/30 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>

      {/* Back Button */}
      <Link href="/" className="absolute top-6 left-6 text-slate-400 hover:text-slate-200 text-sm font-semibold z-20 transition-colors">
        ← Back to Home
      </Link>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Card Container */}
        <div className="relative group">
          {/* Border glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/50 to-cyan-600/50 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

          {/* Main card */}
          <div className="relative bg-slate-900/80 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 space-y-8">
            {/* Header */}
            <div className="space-y-3 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/30">
                <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  A
                </span>
              </div>
              <h1 className="text-3xl font-bold text-white">Admin Access</h1>
              <p className="text-slate-400 text-sm">
                Secure login to manage provident loans
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
                <span className="text-red-400 text-lg leading-none">⚠️</span>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Username Field */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-200">
                  Username
                </label>
                <div className="relative group/input">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 to-cyan-500/0 group-focus-within/input:from-purple-500/20 group-focus-within/input:to-cyan-500/20 rounded-lg transition-all duration-300"></div>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    placeholder="Enter admin username"
                    className="relative w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:bg-slate-800 transition-colors duration-200"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-200">
                  Password
                </label>
                <div className="relative group/input">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 to-cyan-500/0 group-focus-within/input:from-purple-500/20 group-focus-within/input:to-cyan-500/20 rounded-lg transition-all duration-300"></div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Enter password"
                      className="relative w-full px-4 py-3 pr-12 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:bg-slate-800 transition-colors duration-200"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 disabled:from-slate-600 disabled:to-slate-600 text-white font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/25 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin"></span>
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <span>→</span>
                  </>
                )}
              </button>
            </form>

            {/* Demo Hint */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
              <p className="text-slate-400 text-xs mb-2">Demo Credentials</p>
              <p className="text-slate-300 text-sm font-mono">
                <span className="text-purple-400">admin</span> / <span className="text-cyan-400">admin123</span>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-slate-400 text-xs">
          <p>© 2026 Provident Loan System • All Rights Reserved</p>
        </div>
      </div>
    </main>
  );
}
