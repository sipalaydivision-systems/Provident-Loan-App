'use client';

import React, { FC, useMemo } from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminAPI } from '../../lib/api';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';
import { DollarSign, Repeat2, TrendingUp, Activity, BarChart, Clock, Users, CreditCard, Receipt } from 'lucide-react';

// Helper for currency formatting — Philippine Peso standard
const formatCurrency = (amount: number) => {
  if (amount === null || amount === undefined) return '₱ 0.00';
  return '₱ ' + Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

interface MetricCardProps {
  title: string;
  value: number;
  unit?: string;
  icon?: React.ReactNode;
  description?: string;
  valueClassName?: string;
}

const MetricCard: FC<MetricCardProps> = ({ title, value, unit = '', icon, description, valueClassName }) => (
  <Card className="flex-1 min-w-[250px]">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className={`text-2xl font-bold ${valueClassName}`}>
        {unit === '₱'
          ? formatCurrency(typeof value === 'number' ? value : 0)
          : `${unit}${typeof value === 'number' ? value.toLocaleString() : '0'}`}
      </div>
      {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
    </CardContent>
  </Card>
);

interface RealtimeChartProps {
  data: any[];
  title: string;
  dataKey: string;
  lineColor: string;
  tooltipFormatter?: (value: number) => string;
  legendName: string;
}

const RealtimeChart: FC<RealtimeChartProps> = React.memo(({ data, title, dataKey, lineColor, tooltipFormatter, legendName }) => {
  // Memoize the chart data and filter to show only last data points
  const chartData = useMemo(() => {
    const validData = data || [];
    if (validData.length === 0) return [];

    // Show last 10 data points for better visualization
    return validData.slice(-10);
  }, [data]);

  // Create a stable key for the LineChart to prevent complete re-mounting
  const chartKey = useMemo(() => `chart-${title}-${dataKey}`, [title, dataKey]);

  // Theme-aware colors (safe for SSR)
  const isDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  const colors = {
    grid: isDark ? '#374151' : '#e5e7eb',
    axis: isDark ? '#9ca3af' : '#6b7280',
    tooltipBg: isDark ? '#1f2937' : '#ffffff',
    tooltipBorder: isDark ? '#374151' : '#d1d5db',
    tooltipText: isDark ? '#f9fafb' : '#111827',
    legend: isDark ? '#9ca3af' : '#6b7280',
    cursor: lineColor === '#3b82f6' || lineColor.includes('primary') ? '#3b82f6' : '#8b5cf6'
  };

  return (
    <Card className="flex-1 min-w-[300px] max-w-full lg:max-w-[calc(50%-16px)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart className="h-5 w-5 text-blue-600" />{title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ width: '100%', height: '350px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              key={chartKey}
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} strokeOpacity={0.5} />
              <XAxis
                dataKey="time"
                stroke={colors.axis}
                fontSize={12}
                interval="preserveStartEnd"
                tick={{ fontSize: 10 }}
              />
              <YAxis
                stroke={colors.axis}
                fontSize={12}
                tickFormatter={tooltipFormatter || ((value) => value.toString())}
              />
              <RechartsTooltip
                cursor={{ stroke: colors.cursor, strokeWidth: 1 }}
                contentStyle={{
                  backgroundColor: colors.tooltipBg,
                  borderColor: colors.tooltipBorder,
                  borderRadius: '0.5rem',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
                itemStyle={{ color: colors.tooltipText }}
                labelStyle={{ color: colors.legend }}
                formatter={tooltipFormatter ? (value: any) => {
                  const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
                  return [tooltipFormatter(numValue), legendName];
                } : undefined}
              />
              <Legend wrapperStyle={{ color: colors.legend, paddingTop: '10px' }} />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={lineColor}
                strokeWidth={2}
                dot={false}
                name={legendName}
                connectNulls={false}
                isAnimationActive={chartData.length <= 1}
                animationBegin={0}
                animationDuration={800}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loans, setLoans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/admin/login');
      return;
    }
    setUser(JSON.parse(storedUser));

    // Fetch dashboard data
    fetchDashboardData();
  }, [router]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, employeesRes, loansRes, paymentsRes] = await Promise.all([
        adminAPI.dashboard.getSummary(),
        adminAPI.employees.getAll({ page: 1, limit: 5 }),
        adminAPI.loans.getAll({ page: 1, limit: 5 }),
        adminAPI.ledger.getAll({ page: 1, limit: 10 }),
      ]);

      setStats(statsRes.data.data);
      setEmployees(employeesRes.data.data || []);
      setLoans(loansRes.data.data || []);
      setPayments(paymentsRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  // Prepare chart data for loan amounts over time
  const loanChartData = useMemo(() => {
    if (!loans.length) return [];
    return loans.slice(-10).map((loan, index) => ({
      time: `Loan ${index + 1}`,
      amount: loan.loan_amount || 0,
    }));
  }, [loans]);

  // Prepare chart data for payments over time
  const paymentChartData = useMemo(() => {
    if (!payments.length) return [];
    return payments.slice(-10).map((payment, index) => ({
      time: `Payment ${index + 1}`,
      amount: payment.amount_paid || payment.amount || 0,
    }));
  }, [payments]);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-background text-foreground p-4 md:p-8 flex flex-col gap-4 md:gap-8">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background text-foreground p-4 md:p-8 flex flex-col gap-4 md:gap-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Provident Loan Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Real-time insights into your loan management system.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold">
              {user?.username.charAt(0).toUpperCase()}
            </div>
            <div className="text-sm">
              <p className="font-medium">{user?.username}</p>
              <p className="text-muted-foreground">Administrator</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-md text-sm font-medium transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {/* Metrics Section */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Employees"
            value={stats.employees?.total || 0}
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
            description={`${stats.employees?.active || 0} active employees`}
          />
          <MetricCard
            title="Active Loans"
            value={stats.loans?.active || 0}
            icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
            description={`of ${stats.loans?.total || 0} total loans`}
          />
          <MetricCard
            title="Total Loaned Amount"
            value={stats.loans?.totalAmount || 0}
            unit="₱"
            icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
            description={`Remaining: ${formatCurrency(stats.loans?.remainingBalance || 0)}`}
            valueClassName="text-emerald-600"
          />
          <Card className="flex-1 min-w-[250px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                Live
              </div>
              <p className="text-xs text-muted-foreground mt-1">Data streaming in real-time</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Section */}
      <div className="flex flex-wrap gap-4 justify-center">
        <RealtimeChart
          data={loanChartData}
          title="Recent Loan Amounts"
          dataKey="amount"
          lineColor="#3b82f6"
          tooltipFormatter={formatCurrency}
          legendName="Loan Amount"
        />
        <RealtimeChart
          data={paymentChartData}
          title="Recent Payment Amounts"
          dataKey="amount"
          lineColor="#8b5cf6"
          tooltipFormatter={formatCurrency}
          legendName="Payment Amount"
        />
      </div>

      {/* Recent Activity Section */}
      <Card className="col-span-1 md:col-span-2 lg:col-span-4 max-h-[400px] overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" /> Recent Payments
          </CardTitle>
          <CardDescription>Recently recorded loan payments, updated live.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[250px] md:h-[300px] lg:h-[300px]">
            <div className="divide-y divide-border">
              {payments.length > 0 ? (
                payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col">
                      <span className="font-medium text-lg">{formatCurrency(payment.amount_paid || payment.amount || 0)}</span>
                      <span className="text-sm text-muted-foreground">
                        Employee #{payment.employee_number} - {payment.date_of_deduction ? new Date(payment.date_of_deduction).toLocaleDateString() : payment.payment_date || 'Recent'}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <Badge variant="secondary" className="text-xs">
                        {payment.payment_type || 'Payment'}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="p-4 text-center text-muted-foreground">No payments yet...</p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter className="pt-4 text-sm text-muted-foreground">
          <p>Displaying the 10 most recent payments.</p>
        </CardFooter>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/admin/report">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Employee Ledger
              </CardTitle>
              <CardDescription>
                Manage employees, loans, and payments — all in one place. Click any employee row in the report to open their full ledger.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/report">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Loan Summary Report
              </CardTitle>
              <CardDescription>
                View &amp; export the Provident Loan Fund summary. Import from .xlsx, .csv, or .pdf.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
