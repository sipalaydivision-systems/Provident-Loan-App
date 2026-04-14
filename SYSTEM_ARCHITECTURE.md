# Provident Loan Management System - Architecture

## 📋 Project Overview

A full-stack web application with dual interfaces:
- **Admin Portal**: Data management, entry creation, updates
- **Employee Portal**: Self-service lookup of provident loan data

---

## 📁 Folder Hierarchy

```
provident-loan-system/
│
├── backend/                          # Backend API (Node.js/Express)
│   ├── config/                       # Configuration files
│   │   ├── database.js               # DB connection config
│   │   ├── environment.js            # Environment variables
│   │   └── cors.js                   # CORS settings
│   │
│   ├── database/                     # Database layer (SEPARATE from public)
│   │   ├── migrations/               # DB migration scripts
│   │   ├── seeds/                    # Seed data for testing
│   │   └── models/
│   │       ├── Employee.js           # Employee model
│   │       ├── ProvidentLoan.js      # Loan data model
│   │       └── AdminUser.js          # Admin authentication
│   │
│   ├── middleware/
│   │   ├── auth.js                   # JWT authentication
│   │   ├── authorization.js          # Role-based access
│   │   └── validation.js             # Request validation
│   │
│   ├── routes/
│   │   ├── admin.routes.js           # Admin endpoints
│   │   ├── employee.routes.js        # Employee endpoints
│   │   └── auth.routes.js            # Authentication
│   │
│   ├── controllers/
│   │   ├── adminController.js        # Admin logic
│   │   ├── employeeController.js     # Employee lookup logic
│   │   └── authController.js         # Auth logic
│   │
│   ├── services/
│   │   ├── loanService.js            # Business logic
│   │   ├── employeeService.js        # Employee service
│   │   └── emailService.js           # Notifications
│   │
│   ├── utils/
│   │   ├── errors.js                 # Error handling
│   │   ├── logger.js                 # Logging
│   │   └── validators.js             # Data validators
│   │
│   ├── .env                          # Environment variables (GITIGNORE)
│   ├── .env.example                  # Template env file
│   ├── package.json
│   └── server.js                     # Entry point
│
├── frontend/                         # Frontend (React/Next.js)
│   ├── public/
│   │   ├── logos/
│   │   └── assets/
│   │
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   ├── Header.jsx
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   └── Footer.jsx
│   │   │   │
│   │   │   ├── admin/
│   │   │   │   ├── EmployeeForm.jsx          # Add/Edit employee
│   │   │   │   ├── LoanDataForm.jsx          # Add/Edit loan
│   │   │   │   ├── DataTable.jsx             # Admin data view
│   │   │   │   ├── BulkImport.jsx            # CSV upload
│   │   │   │   └── Dashboard.jsx             # Admin dashboard
│   │   │   │
│   │   │   └── employee/
│   │   │       ├── SearchForm.jsx            # Employee lookup
│   │   │       ├── LoanDetails.jsx           # Results display
│   │   │       └── Dashboard.jsx             # Employee dashboard
│   │   │
│   │   ├── pages/
│   │   │   ├── admin/
│   │   │   │   ├── login.jsx
│   │   │   │   ├── dashboard.jsx
│   │   │   │   ├── employees.jsx
│   │   │   │   ├── loans.jsx
│   │   │   │   └── settings.jsx
│   │   │   │
│   │   │   └── employee/
│   │   │       ├── index.jsx
│   │   │       ├── search.jsx
│   │   │       └── results.jsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   ├── useFetch.js
│   │   │   └── useForm.js
│   │   │
│   │   ├── services/
│   │   │   ├── api.js                # API client
│   │   │   ├── auth.js               # Auth service
│   │   │   └── storage.js            # Local storage
│   │   │
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── DataContext.jsx
│   │   │
│   │   ├── styles/
│   │   │   ├── global.css
│   │   │   ├── admin.css
│   │   │   └── employee.css
│   │   │
│   │   └── App.jsx
│   │
│   ├── .env.local
│   ├── .env.example
│   ├── package.json
│   └── next.config.js (if using Next.js)
│
├── docs/
│   ├── API_DOCUMENTATION.md          # API endpoints
│   ├── SETUP_GUIDE.md                # Installation guide
│   ├── DATABASE_SCHEMA.md            # DB design
│   └── USER_GUIDE.md                 # User manual
│
├── docker/                           # Docker configuration
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── docker-compose.yml
│
├── tests/
│   ├── backend/
│   │   ├── unit/
│   │   └── integration/
│   └── frontend/
│       └── components/
│
├── .gitignore
├── README.md
└── docker-compose.yml

```

---

## 🗄️ Database Schema

### Employees Table
```sql
employees (
  id PK,
  employee_id UNIQUE VARCHAR,
  first_name VARCHAR,
  last_name VARCHAR,
  email VARCHAR,
  department VARCHAR,
  designation VARCHAR,
  joining_date DATE,
  status ENUM (active, inactive),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### Provident Loan Data Table
```sql
provident_loans (
  id PK,
  employee_id FK,
  contribution_amount DECIMAL,
  current_balance DECIMAL,
  interest_rate DECIMAL,
  loan_amount DECIMAL,
  disbursement_date DATE,
  maturity_date DATE,
  status ENUM (active, completed, pending),
  last_updated DATE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### Admin Users Table
```sql
admin_users (
  id PK,
  username UNIQUE VARCHAR,
  email UNIQUE VARCHAR,
  password_hash VARCHAR,
  role ENUM (super_admin, admin, auditor),
  created_at TIMESTAMP,
  last_login TIMESTAMP
)
```

---

## 🔐 Security & Access Control

### Database Access
- **Database files**: Stored separately in `backend/database/`
- **Credentials**: Environment variables (`.env`)
- **Encryption**: Passwords hashed with bcrypt
- **Backups**: Daily automated backups

### Admin Portal
- JWT-based authentication
- Role-based access control (RBAC)
- Admin-only endpoints
- Audit logs for all changes

### Employee Portal
- Lookup by Employee ID or Name
- Session-based security
- No direct database access
- Rate limiting on searches

---

## 🚀 Key Features

### Admin Features
1. ✅ Dashboard with statistics
2. ✅ Add/Edit/Delete employees
3. ✅ Manage provident loan data
4. ✅ Bulk import from CSV
5. ✅ Export data
6. ✅ Search & filter
7. ✅ Audit logs
8. ✅ User management

### Employee Features
1. ✅ Search by Employee ID
2. ✅ Search by Name
3. ✅ View personal loan data
4. ✅ Download statements
5. ✅ No edit permissions

---

## 🔄 Data Flow

```
Admin Portal                          Employee Portal
     ↓                                     ↓
  Authentication                    Lookup Request
     ↓                                     ↓
  Admin Dashboard          →  API Authentication Gate
     ↓                                     ↓
  Edit/Add/Delete          →  Database Query (Read-only)
     ↓                                     ↓
  Backend API              ←  Employee Data
     ↓                                     ↓
  Database Store           →  Display Results
     ↓                                     ↓
  Audit Logs               →  Employee View
```

---

## 📊 Technology Stack

- **Backend**: Node.js + Express.js
- **Frontend**: React/Next.js
- **Database**: PostgreSQL or MySQL
- **Authentication**: JWT
- **ORM**: Sequelize or TypeORM
- **Validation**: Joi or Zod
- **Hosting**: Docker containerized

---

## 🛠️ Deployment

```
├── Development
│   └── Local machine with .env
├── Staging
│   └── Docker containers
└── Production
    └── Docker Swarm / Kubernetes
```

