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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit, Trash2, Search, CreditCard, ArrowLeft, Calendar, DollarSign } from 'lucide-react';

// Form validation schema
const loanSchema = z.object({
  employee_number: z.string().min(1, 'Employee number is required'),
  loan_amount: z.number().min(1, 'Loan amount must be greater than 0'),
  no_of_months: z.number().min(1, 'Number of months must be at least 1'),
  monthly_amortization: z.number().min(0, 'Monthly amortization must be non-negative'),
  loan_application_date: z.string().min(1, 'Application date is required'),
  effective_date: z.string().min(1, 'Effective date is required'),
  check_number: z.string().optional(),
  check_date: z.string().optional(),
  remarks: z.string().optional(),
});

type LoanFormData = z.infer<typeof loanSchema>;

export default function LoansManagement() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loans, setLoans] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
  });

  // Watch loan amount and months to calculate monthly amortization
  const loanAmount = watch('loan_amount');
  const noOfMonths = watch('no_of_months');

  useEffect(() => {
    if (loanAmount && noOfMonths) {
      const monthlyAmortization = loanAmount / noOfMonths;
      setValue('monthly_amortization', Math.round(monthlyAmortization * 100) / 100);
    }
  }, [loanAmount, noOfMonths, setValue]);

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
      const [loansRes, employeesRes] = await Promise.all([
        adminAPI.loans.getAll({ page: 1, limit: 100 }),
        adminAPI.employees.getAll({ page: 1, limit: 1000 }), // Get all employees for dropdown
      ]);

      setLoans(loansRes.data.data || []);
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

  const onSubmit = async (data: LoanFormData) => {
    try {
      setIsSubmitting(true);

      if (editingLoan) {
        // Update existing loan
        await adminAPI.loans.update(editingLoan.id, data);
        setEditingLoan(null);
      } else {
        // Create new loan
        await adminAPI.loans.create(data);
      }

      reset();
      setIsAddDialogOpen(false);
      fetchData(); // Refresh the list
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save loan');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (loan) => {
    setEditingLoan(loan);
    // Populate form with loan data
    (Object.keys(loan) as Array<keyof LoanFormData>).forEach(key => {
      if (loan[key] !== null && loan[key] !== undefined) {
        if (key === 'loan_amount' || key === 'no_of_months' || key === 'monthly_amortization') {
          setValue(key, Number(loan[key]));
        } else {
          setValue(key, loan[key]);
        }
      }
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (loanId) => {
    try {
      await adminAPI.loans.delete(loanId);
      fetchData(); // Refresh the list
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete loan');
      console.error(err);
    }
  };

  const handleDialogClose = () => {
    setIsAddDialogOpen(false);
    setEditingLoan(null);
    reset();
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '—';
    return '₱ ' + Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const filteredLoans = loans.filter(loan =>
    loan.employee_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    loan.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    loan.status?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-background text-foreground p-4 md:p-8 flex flex-col gap-4 md:gap-8">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-muted-foreground">Loading loans...</p>
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
              Loan Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Create and manage provident loans for employees.
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

      {/* Search and Add Loan */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search loans..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingLoan(null); reset(); }}>
              <Plus className="h-4 w-4 mr-2" />
              Create Loan
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingLoan ? 'Edit Loan' : 'Create New Loan'}
              </DialogTitle>
              <DialogDescription>
                {editingLoan ? 'Update loan information.' : 'Enter the loan details for the employee.'}
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
                  <Label htmlFor="loan_amount">Loan Amount (₱) *</Label>
                  <Input
                    id="loan_amount"
                    type="number"
                    step="0.01"
                    {...register('loan_amount', { valueAsNumber: true })}
                    placeholder="50000"
                  />
                  {errors.loan_amount && (
                    <p className="text-sm text-destructive">{errors.loan_amount.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="no_of_months">Number of Months *</Label>
                  <Input
                    id="no_of_months"
                    type="number"
                    {...register('no_of_months', { valueAsNumber: true })}
                    placeholder="12"
                  />
                  {errors.no_of_months && (
                    <p className="text-sm text-destructive">{errors.no_of_months.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthly_amortization">Monthly Amortization (₱)</Label>
                  <Input
                    id="monthly_amortization"
                    type="number"
                    step="0.01"
                    {...register('monthly_amortization', { valueAsNumber: true })}
                    placeholder="Auto-calculated"
                    readOnly
                  />
                  <p className="text-xs text-muted-foreground">
                    Automatically calculated from loan amount and months
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="loan_application_date">Application Date *</Label>
                  <Input
                    id="loan_application_date"
                    type="date"
                    {...register('loan_application_date')}
                  />
                  {errors.loan_application_date && (
                    <p className="text-sm text-destructive">{errors.loan_application_date.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="effective_date">Effective Date *</Label>
                  <Input
                    id="effective_date"
                    type="date"
                    {...register('effective_date')}
                  />
                  {errors.effective_date && (
                    <p className="text-sm text-destructive">{errors.effective_date.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="check_number">Check Number</Label>
                  <Input
                    id="check_number"
                    {...register('check_number')}
                    placeholder="CHK-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="check_date">Check Date</Label>
                  <Input
                    id="check_date"
                    type="date"
                    {...register('check_date')}
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
                  {isSubmitting ? 'Saving...' : editingLoan ? 'Update Loan' : 'Create Loan'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Loans Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Loans ({filteredLoans.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredLoans.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee #</TableHead>
                  <TableHead>Employee Name</TableHead>
                  <TableHead>Loan Amount</TableHead>
                  <TableHead>Monthly Payment</TableHead>
                  <TableHead>Months</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLoans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-mono">{loan.employee_number}</TableCell>
                    <TableCell>{loan.employee_name || 'N/A'}</TableCell>
                    <TableCell className="font-semibold text-green-600">
                      {formatCurrency(loan.loan_amount || 0)}
                    </TableCell>
                    <TableCell>{formatCurrency(loan.monthly_amortization || 0)}</TableCell>
                    <TableCell>{loan.no_of_months}</TableCell>
                    <TableCell>
                      <Badge variant={
                        (loan.status || '').toUpperCase() === 'ACTIVE' ? 'default' :
                        (loan.status || '').toUpperCase().includes('FULLY') ? 'outline' : 'secondary'
                      }>
                        {loan.status || 'ACTIVE'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(loan.effective_date)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(loan)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Loan</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this loan for employee {loan.employee_number}?
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(loan.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? 'No loans found matching your search.' : 'No loans found. Create your first loan to get started.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}