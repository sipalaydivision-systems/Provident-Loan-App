# API Documentation - Provident Loan Management System

## 🔐 Authentication Endpoints

### POST /api/auth/login
Admin login endpoint

**Request:**
```json
{
  "username": "admin_user",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin_user",
    "email": "admin@company.com",
    "role": "admin"
  }
}
```

**Status Codes:** 200 (OK), 401 (Unauthorized), 400 (Bad Request)

---

### POST /api/auth/logout
Logout current user

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### POST /api/auth/refresh
Refresh JWT token

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "token": "new_jwt_token"
}
```

---

## 👥 Admin - Employee Management

### GET /api/admin/employees
Get all employees with pagination and filters

**Query Parameters:**
- `page` (int, default: 1) - Page number
- `limit` (int, default: 50) - Records per page
- `station` (string) - Filter by station
- `status` (string) - Filter by status (active, inactive, separated)
- `search` (string) - Search by name or employee number

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 850,
    "page": 1,
    "limit": 50,
    "employees": [
      {
        "id": 1,
        "employee_number": "4261248",
        "station": "26",
        "first_name": "MIREN",
        "last_name": "HIRSCH",
        "middle_name": "SAILBIM",
        "position": "Officer",
        "department": "HR",
        "email": "miren@company.com",
        "phone": "+63-2-XXXX-XXXX",
        "status": "active",
        "created_at": "2023-12-01T10:00:00Z"
      }
    ]
  }
}
```

---

### GET /api/admin/employees/:employeeNumber
Get single employee details

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "employee_number": "4261248",
    "first_name": "MIREN",
    "last_name": "HIRSCH",
    "position": "Officer",
    "department": "HR",
    "email": "miren@company.com",
    "status": "active",
    "created_at": "2023-12-01T10:00:00Z",
    "updated_at": "2023-12-01T10:00:00Z"
  }
}
```

---

### POST /api/admin/employees
Create new employee

**Request:**
```json
{
  "employee_number": "4261248",
  "station": "26",
  "first_name": "MIREN",
  "last_name": "HIRSCH",
  "middle_name": "SAILBIM",
  "position": "Officer",
  "department": "HR",
  "email": "miren@company.com",
  "phone": "+63-2-XXXX-XXXX",
  "status": "active"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Employee created successfully",
  "data": {
    "id": 1,
    "employee_number": "4261248"
  }
}
```

---

### PUT /api/admin/employees/:employeeNumber
Update employee details

**Response:**
```json
{
  "success": true,
  "message": "Employee updated successfully"
}
```

---

### DELETE /api/admin/employees/:employeeNumber
Delete employee (soft delete)

**Response:**
```json
{
  "success": true,
  "message": "Employee deleted successfully"
}
```

---

## 💰 Admin - Loan Management

### GET /api/admin/loans
Get all loans with pagination and filters

**Query Parameters:**
- `page` (int, default: 1)
- `limit` (int, default: 50)
- `status` (string) - QUALIFIED FOR RENEWAL, NOT QUALIFIED FOR RENEWAL, COMPLETED, ACTIVE
- `station` (string)
- `search` (string)
- `sortBy` (string, default: created_at)
- `order` (string, default: DESC)

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 800,
    "page": 1,
    "limit": 50,
    "loans": [
      {
        "id": 1,
        "employee_number": "4261248",
        "employee_name": "MIREN HIRSCH SAILBIM",
        "station": "26",
        "loan_amount": 100000.00,
        "no_of_months": 60,
        "monthly_amortization": 1993.29,
        "loan_balance": 98565.71,
        "loan_application_date": "2025-04-01",
        "effective_date": "2023-12-01",
        "termination_date": "2028-12-31",
        "no_of_months_paid": 1,
        "check_number": "736010",
        "check_date": "2023-05-08",
        "status": "QUALIFIED FOR RENEWAL",
        "remarks": "",
        "created_at": "2023-12-01T10:00:00Z"
      }
    ]
  }
}
```

---

### GET /api/admin/loans/:employeeNumber
Get loan details for specific employee

**Response:**
```json
{
  "success": true,
  "loan": {
    "id": 1,
    "employee_number": "4261248",
    "loan_amount": 100000.00,
    "no_of_months": 60,
    "monthly_amortization": 1993.29,
    "loan_balance": 98565.71,
    "status": "QUALIFIED FOR RENEWAL"
  },
  "ledgerCards": [
    {
      "payment_month": 1,
      "date_of_deduction": "2023-12-01",
      "payment_with_interest": 500.00,
      "principal_payments": 1433.29,
      "monthly_payment_amount": 1933.29,
      "balance": 98566.71
    }
  ]
}
```

---

### POST /api/admin/loans
Create new loan

**Request:**
```json
{
  "employee_number": "4261248",
  "loan_amount": 100000.00,
  "no_of_months": 60,
  "monthly_amortization": 1993.29,
  "loan_application_date": "2025-04-01",
  "effective_date": "2023-12-01",
  "check_number": "736010",
  "check_date": "2023-05-08",
  "remarks": "Initial loan application"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Loan created successfully",
  "data": {
    "id": 1,
    "employee_number": "4261248"
  }
}
```

---

### PUT /api/admin/loans/:employeeNumber
Update loan details

**Response:**
```json
{
  "success": true,
  "message": "Loan updated successfully"
}
```

---

## 📊 Admin - Ledger Card Management

### GET /api/admin/ledger/:employeeNumber
Get full ledger card for employee

**Response:**
```json
{
  "success": true,
  "employeeNumber": "4261248",
  "ledgerCards": [
    {
      "id": 1,
      "payment_month": 1,
      "date_of_deduction": "2023-12-01",
      "payment_with_interest": 500.00,
      "principal_payments": 1433.29,
      "paid_status": true,
      "monthly_payment_amount": 1933.29,
      "paid_months": 1,
      "balance": 98566.71
    }
  ]
}
```

---

### POST /api/admin/ledger
Add payment record to ledger

**Request:**
```json
{
  "employee_number": "4261248",
  "payment_month": 1,
  "date_of_deduction": "2023-12-01",
  "payment_with_interest": 500.00,
  "principal_payments": 1433.29,
  "monthly_payment_amount": 1933.29,
  "balance": 98566.71
}
```

**Response:**
```json
{
  "success": true,
  "message": "Ledger card entry created successfully"
}
```

---

### PUT /api/admin/ledger/:id
Update payment record

**Response:**
```json
{
  "success": true,
  "message": "Ledger card updated successfully"
}
```

---

## 📁 Admin - Bulk Operations

### POST /api/admin/import
Import data from CSV file

**Form Data:**
- `file`: CSV file (multipart/form-data)
- `type` (string): employees | loans | both

**Response:**
```json
{
  "success": true,
  "message": "Data imported successfully",
  "imported": 150,
  "errors": []
}
```

---

### GET /api/admin/export
Export data to CSV

**Query Parameters:**
- `type` (string): employees | loans | ledger
- `format` (string): csv | excel

**Response:**
CSV file download

---

## 📈 Admin - Reports & Analytics

### GET /api/admin/dashboard
Get dashboard statistics

**Response:**
```json
{
  "success": true,
  "stats": {
    "total_employees": 850,
    "total_loans": 800,
    "total_loan_amount": 80000000.00,
    "total_outstanding_balance": 25000000.00,
    "active_loans": 650,
    "qualified_for_renewal": 350,
    "not_qualified": 150,
    "average_balance_per_employee": 31250.00
  }
}
```

---

### GET /api/admin/audit-logs
Get audit trail

**Query Parameters:**
- `page` (int, default: 1)
- `limit` (int, default: 50)
- `action` (string) - CREATE | UPDATE | DELETE
- `admin_id` (int)

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 5000,
    "page": 1,
    "limit": 50,
    "logs": [
      {
        "id": 1,
        "admin_id": 1,
        "admin_name": "John Doe",
        "action": "UPDATE",
        "entity_type": "LOAN",
        "entity_id": "4261248",
        "old_values": { "loan_balance": 98566.71 },
        "new_values": { "loan_balance": 96566.71 },
        "ip_address": "192.168.1.1",
        "created_at": "2023-12-01T10:15:00Z"
      }
    ]
  }
}
```

---

## 👤 Employee Portal - Public Access

### POST /api/employee/search
Search for employee loan data

**Request:**
```json
{
  "employee_number": "4261248"
}
```

Or:

```json
{
  "first_name": "MIREN",
  "last_name": "HIRSCH"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "employee": {
      "employee_number": "4261248",
      "first_name": "MIREN",
      "last_name": "HIRSCH",
      "position": "Officer",
      "station": "26"
    },
    "loan": {
      "loan_amount": 100000.00,
      "loan_balance": 98565.71,
      "monthly_amortization": 1993.29,
      "no_of_months": 60,
      "no_of_months_paid": 1,
      "effective_date": "2023-12-01",
      "termination_date": "2028-12-31",
      "status": "QUALIFIED FOR RENEWAL"
    }
  }
}
```

---

### GET /api/employee/lookup/:employeeNumber
Get employee loan details by number

**Response:**
```json
{
  "success": true,
  "employee": {
    "employee_number": "4261248",
    "first_name": "MIREN",
    "last_name": "HIRSCH",
    "position": "Officer"
  },
  "loan": {
    "loan_amount": 100000.00,
    "loan_balance": 98565.71,
    "monthly_amortization": 1993.29,
    "status": "QUALIFIED FOR RENEWAL"
  },
  "recentPayments": [
    {
      "payment_month": 1,
      "date_of_deduction": "2023-12-01",
      "monthly_payment_amount": 1933.29,
      "balance": 98566.71
    }
  ]
}
```

---

### POST /api/employee/search-by-name
Search employees by name

**Request:**
```json
{
  "first_name": "MIREN",
  "last_name": "HIRSCH"
}
```

**Response:**
```json
{
  "success": true,
  "matches": [
    {
      "employee_number": "4261248",
      "first_name": "MIREN",
      "last_name": "HIRSCH",
      "position": "Officer",
      "station": "26"
    }
  ]
}
```

---

### GET /api/employee/ledger/:employeeNumber
Get detailed ledger card

**Query Parameters:**
- `year` (int) - Optional: filter by year
- `month` (int) - Optional: filter by month

**Response:**
```json
{
  "success": true,
  "ledgerCard": {
    "employee_number": "4261248",
    "employee_name": "MIREN HIRSCH SAILBIM",
    "position": "Officer",
    "loan_amount": 100000.00,
    "no_of_months": 60,
    "date_granted": "2023-12-01",
    "payments": [
      {
        "payment_month": 1,
        "date_of_deduction": "2023-12-01",
        "payment_with_interest": 500.00,
        "principal_payments": 1433.29,
        "monthly_payment_amount": 1933.29,
        "balance": 98566.71
      }
    ]
  }
}
```

---

### GET /api/employee/statement/:employeeNumber
Generate employee statement

**Query Parameters:**
- `format` (string): json | pdf (default: json)

**Response (JSON):**
```json
{
  "success": true,
  "statement": {
    "employee_number": "4261248",
    "employee_name": "MIREN HIRSCH SAILBIM",
    "generated_date": "2024-01-15T10:30:00Z",
    "loan_details": {
      "loan_amount": 100000.00,
      "effective_date": "2023-12-01",
      "termination_date": "2028-12-31",
      "status": "QUALIFIED FOR RENEWAL"
    },
    "payment_summary": {
      "total_paid": 1933.29,
      "remaining_balance": 98566.71,
      "months_remaining": 59
    }
  }
}
```

**Response (PDF):** PDF file download

---

### GET /api/employee/help
Get FAQ

**Response:**
```json
{
  "success": true,
  "faqs": [
    {
      "question": "How do I check my provident loan balance?",
      "answer": "Enter your employee number or name in the search box above."
    }
  ]
}
```

---

### GET /api/employee/contact
Get contact information

**Response:**
```json
{
  "success": true,
  "contact": {
    "hr_department": "hr@company.com",
    "hr_phone": "+63-2-XXXX-XXXX",
    "office_hours": "8:00 AM - 5:00 PM, Monday - Friday",
    "support_email": "provident-support@company.com"
  }
}
```

---

## 🔒 Error Response Format

All endpoints return errors in this format:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "employee_number",
      "message": "Employee number is required"
    }
  ]
}
```

**Common Status Codes:**
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

