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
import { Plus, Edit, Trash2, Search, Users, ArrowLeft, Upload, FileText, CheckCircle, XCircle } from 'lucide-react';
import { importAPI } from '../../lib/api';

// Form validation schema
const employeeSchema = z.object({
  employee_number: z.string().min(1, 'Employee number is required'),
  station: z.string().min(1, 'Station is required'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  middle_name: z.string().optional(),
  position: z.string().min(1, 'Position is required'),
  department: z.string().min(1, 'Department is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

export default function EmployeesManagement() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Import state
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
  });

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/admin/login');
      return;
    }
    setUser(JSON.parse(storedUser));
    fetchEmployees();
  }, [router]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.employees.getAll({ page: 1, limit: 100 });
      setEmployees(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load employees');
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

  const onSubmit = async (data: EmployeeFormData) => {
    try {
      setIsSubmitting(true);

      if (editingEmployee) {
        // Update existing employee
        await adminAPI.employees.update(editingEmployee.employee_number, data);
        setEditingEmployee(null);
      } else {
        // Create new employee
        await adminAPI.employees.create(data);
      }

      reset();
      setIsAddDialogOpen(false);
      fetchEmployees(); // Refresh the list
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save employee');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    // Populate form with employee data
    (Object.keys(employee) as Array<keyof EmployeeFormData>).forEach(key => {
      if (employee[key] !== null && employee[key] !== undefined) {
        setValue(key, employee[key]);
      }
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (employeeNumber) => {
    try {
      await adminAPI.employees.delete(employeeNumber);
      fetchEmployees(); // Refresh the list
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete employee');
      console.error(err);
    }
  };

  const handleDialogClose = () => {
    setIsAddDialogOpen(false);
    setEditingEmployee(null);
    reset();
  };

  const handleImport = async () => {
    if (!importFile) return;
    setIsImporting(true);
    setImportResult(null);
    try {
      const response = await importAPI.importFile(importFile);
      setImportResult({ success: true, ...response.data });
      fetchEmployees();
    } catch (err: any) {
      setImportResult({
        success: false,
        message: err.response?.data?.error || err.response?.data?.message || 'Import failed',
        errors: err.response?.data?.errors || [],
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportDialogClose = () => {
    setIsImportDialogOpen(false);
    setImportFile(null);
    setImportResult(null);
  };

  const filteredEmployees = employees.filter(employee =>
    employee.employee_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.station?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-background text-foreground p-4 md:p-8 flex flex-col gap-4 md:gap-8">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-muted-foreground">Loading employees...</p>
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
              Employee Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage employee records and information.
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

      {/* Search and Add Employee */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {/* Import Dialog */}
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={() => { setImportFile(null); setImportResult(null); }}>
                <Upload className="h-4 w-4 mr-2" />
                Import PDF/CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Import Employees from File</DialogTitle>
                <DialogDescription>
                  Upload a Provident Loan Summary PDF or CSV file to bulk-import employees and their loan data.
                </DialogDescription>
              </DialogHeader>

              {!importResult ? (
                <div className="space-y-4">
                  <div
                    className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => document.getElementById('import-file-input')?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file) setImportFile(file);
                    }}
                  >
                    <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    {importFile ? (
                      <div>
                        <p className="font-medium text-sm">{importFile.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {(importFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium">Click to select or drag & drop</p>
                        <p className="text-xs text-muted-foreground mt-1">PDF or CSV files only</p>
                      </div>
                    )}
                    <input
                      id="import-file-input"
                      type="file"
                      accept=".pdf,.csv"
                      className="hidden"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    />
                  </div>

                  <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">Expected format:</p>
                    <p>• Columns: Station, Employee Number, Name, Loan Application Date, Loan Amount, No. of Months, etc.</p>
                    <p>• Name format: LAST NAME, FIRST NAME, MIDDLE NAME</p>
                    <p>• You can use the exported CSV from Reports as a template.</p>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={handleImportDialogClose}>Cancel</Button>
                    <Button onClick={handleImport} disabled={!importFile || isImporting}>
                      {isImporting ? (
                        <>
                          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Import
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                <div className="space-y-4">
                  {importResult.success ? (
                    <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-sm text-green-700 dark:text-green-400">{importResult.message}</p>
                        <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                          <p>• {importResult.created} employees created</p>
                          <p>• {importResult.updated} employees updated</p>
                          <p>• {importResult.loansCreated} loans created</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                      <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                      <p className="text-sm text-destructive">{importResult.message}</p>
                    </div>
                  )}

                  {importResult.errors?.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Row errors ({importResult.errors.length}):</p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {importResult.errors.map((e: any, i: number) => (
                          <p key={i} className="text-xs text-destructive bg-destructive/5 rounded px-2 py-1">
                            Row {e.row} ({e.employee}): {e.error}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  <DialogFooter>
                    <Button onClick={handleImportDialogClose}>Done</Button>
                  </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingEmployee(null); reset(); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
              </DialogTitle>
              <DialogDescription>
                {editingEmployee ? 'Update employee information.' : 'Enter the details for the new employee.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employee_number">Employee Number *</Label>
                  <Input
                    id="employee_number"
                    {...register('employee_number')}
                    placeholder="e.g., EMP001"
                  />
                  {errors.employee_number && (
                    <p className="text-sm text-destructive">{errors.employee_number.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="station">Station *</Label>
                  <Input
                    id="station"
                    {...register('station')}
                    placeholder="e.g., Main Office"
                  />
                  {errors.station && (
                    <p className="text-sm text-destructive">{errors.station.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    {...register('first_name')}
                    placeholder="John"
                  />
                  {errors.first_name && (
                    <p className="text-sm text-destructive">{errors.first_name.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="middle_name">Middle Name</Label>
                  <Input
                    id="middle_name"
                    {...register('middle_name')}
                    placeholder="Robert"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    {...register('last_name')}
                    placeholder="Doe"
                  />
                  {errors.last_name && (
                    <p className="text-sm text-destructive">{errors.last_name.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="position">Position *</Label>
                  <Input
                    id="position"
                    {...register('position')}
                    placeholder="e.g., Clerk"
                  />
                  {errors.position && (
                    <p className="text-sm text-destructive">{errors.position.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department *</Label>
                  <Input
                    id="department"
                    {...register('department')}
                    placeholder="e.g., Finance"
                  />
                  {errors.department && (
                    <p className="text-sm text-destructive">{errors.department.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    placeholder="john.doe@company.com"
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    {...register('phone')}
                    placeholder="+63 912 345 6789"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select onValueChange={(value) => setValue('status', value as 'active' | 'inactive')} defaultValue="active">
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                {errors.status && (
                  <p className="text-sm text-destructive">{errors.status.message}</p>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleDialogClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : editingEmployee ? 'Update Employee' : 'Add Employee'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Employees Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Employees ({filteredEmployees.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEmployees.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.employee_number}>
                    <TableCell className="font-mono">{employee.employee_number}</TableCell>
                    <TableCell>
                      {employee.first_name} {employee.middle_name ? `${employee.middle_name} ` : ''}{employee.last_name}
                    </TableCell>
                    <TableCell>{employee.position}</TableCell>
                    <TableCell>{employee.department}</TableCell>
                    <TableCell>{employee.station}</TableCell>
                    <TableCell>
                      <Badge variant={employee.status === 'active' ? 'default' : 'secondary'}>
                        {employee.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(employee)}
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
                              <AlertDialogTitle>Delete Employee</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete employee {employee.employee_number}?
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(employee.employee_number)}
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
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? 'No employees found matching your search.' : 'No employees found. Add your first employee to get started.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}