'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminAPI } from '../../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Search, Receipt, ArrowLeft, DollarSign, Calendar, User } from 'lucide-react';

// Form validation schema
const paymentSchema = z.object({
  employee_number: z.string().min(1, 'Employee number is required'),
  amount: z.number().min(0.01, 'Payment amount must be greater than 0'),
  payment_date: z.string().min(1, 'Payment date is required'),
  payment_type: z.enum(['monthly', 'advance', 'final', 'adjustment']).default('monthly'),
  payment_method: z.enum(['cash', 'check', 'bank_transfer', 'deduction']).default('deduction'),
  reference_number: z.string().optional(),
  remarks: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

export default function PaymentsManagement() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [payments, setPayments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
  });

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/admin/login');
      return;
    }
    setUser(JSON.parse(storedUser));
    fetchData();
  }, [router]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [paymentsRes, employeesRes] = await Promise.all([
        adminAPI.ledger.recordPayment ? adminAPI.ledger.getAll({ page: 1, limit: 100 }) : Promise.resolve({ data: { data: [] } }),
        adminAPI.employees.getAll({ page: 1, limit: 1000 }), // Get all employees for dropdown
      ]);

      setPayments(paymentsRes.data.data || []);
      setEmployees(employeesRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data');
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

  const onSubmit = async (data: PaymentFormData) => {
    try {
      setIsSubmitting(true);

      // Use the recordPayment endpoint if available, otherwise use the ledger endpoint
      if (adminAPI.ledger.recordPayment) {
        await adminAPI.ledger.recordPayment(data);
      } else {
        // Fallback to ledger endpoint
        await adminAPI.ledger.create(data);
      }

      reset();
      setIsAddDialogOpen(false);
      fetchData(); // Refresh the list
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record payment');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDialogClose = () => {
    setIsAddDialogOpen(false);
    reset();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const filteredPayments = payments.filter(payment =>
    payment.employee_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.payment_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.payment_method?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-background text-foreground p-4 md:p-8 flex flex-col gap-4 md:gap-8">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-muted-foreground">Loading payments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background text-foreground p-4 md:p-8 flex flex-col gap-4 md:gap-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/dashboard">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Payment Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Record and track loan payments from employees.
            </p>
          </div>
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

      {/* Search and Record Payment */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search payments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => reset()}>
              <Plus className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record New Payment</DialogTitle>
              <DialogDescription>
                Enter the payment details for the employee.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employee_number">Employee Number *</Label>
                  <Select onValueChange={(value) => setValue('employee_number', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((employee) => (
                        <SelectItem key={employee.employee_number} value={employee.employee_number}>
                          {employee.employee_number} - {employee.first_name} {employee.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.employee_number && (
                    <p className="text-sm text-destructive">{errors.employee_number.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Payment Amount (₱) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    {...register('amount', { valueAsNumber: true })}
                    placeholder="5000.00"
                  />
                  {errors.amount && (
                    <p className="text-sm text-destructive">{errors.amount.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payment_date">Payment Date *</Label>
                  <Input
                    id="payment_date"
                    type="date"
                    {...register('payment_date')}
                    defaultValue={new Date().toISOString().split('T')[0]}
                  />
                  {errors.payment_date && (
                    <p className="text-sm text-destructive">{errors.payment_date.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_type">Payment Type *</Label>
                  <Select onValueChange={(value) => setValue('payment_type', value as any)} defaultValue="monthly">
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly Payment</SelectItem>
                      <SelectItem value="advance">Advance Payment</SelectItem>
                      <SelectItem value="final">Final Payment</SelectItem>
                      <SelectItem value="adjustment">Adjustment</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.payment_type && (
                    <p className="text-sm text-destructive">{errors.payment_type.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payment_method">Payment Method *</Label>
                  <Select onValueChange={(value) => setValue('payment_method', value as any)} defaultValue="deduction">
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deduction">Salary Deduction</SelectItem>
                      <SelectItem value="cash">Cash Payment</SelectItem>
                      <SelectItem value="check">Check Payment</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.payment_method && (
                    <p className="text-sm text-destructive">{errors.payment_method.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference_number">Reference Number</Label>
                  <Input
                    id="reference_number"
                    {...register('reference_number')}
                    placeholder="Check # or Transaction ID"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="remarks">Remarks</Label>
                <Input
                  id="remarks"
                  {...register('remarks')}
                  placeholder="Additional notes or remarks"
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleDialogClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Recording...' : 'Record Payment'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Payment Records ({filteredPayments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPayments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee #</TableHead>
                  <TableHead>Employee Name</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment, index) => (
                  <TableRow key={payment.id || index}>
                    <TableCell className="font-mono">{payment.employee_number}</TableCell>
                    <TableCell>{payment.employee_name || 'N/A'}</TableCell>
                    <TableCell className="font-semibold text-green-600">
                      {formatCurrency(payment.monthly_payment_amount || payment.amount_paid || payment.amount || 0)}
                    </TableCell>
                    <TableCell>{formatDate(payment.date_of_deduction || payment.payment_date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {payment.payment_type || 'monthly'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {payment.payment_method || 'deduction'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {payment.reference_number || `Month ${payment.payment_month || '—'}`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? 'No payments found matching your search.' : 'No payments recorded yet. Record your first payment to get started.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {payments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(payments.reduce((sum, payment) => sum + (payment.monthly_payment_amount || payment.amount_paid || payment.amount || 0), 0))}
              </div>
              <p className="text-xs text-muted-foreground">
                Across {payments.length} transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {payments.filter(payment => {
                  const paymentDate = new Date(payment.date_of_deduction || payment.payment_date);
                  const now = new Date();
                  return paymentDate.getMonth() === now.getMonth() &&
                         paymentDate.getFullYear() === now.getFullYear();
                }).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Payments recorded
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(payments.map(payment => payment.employee_number)).size}
              </div>
              <p className="text-xs text-muted-foreground">
                With payment records
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}