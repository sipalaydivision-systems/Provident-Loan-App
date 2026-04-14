# Provident Loan Management System

A comprehensive full-stack web application for managing provident fund loans across 500-1000 employees.

---

## 🎯 System Overview

**Two-Tier Architecture:**

1. **Admin Portal** - For HR/Finance teams
   - Manage employee records
   - Maintain loan data
   - Track payment history
   - Generate reports
   - Manage system users

2. **Employee Portal** - For employees
   - Search loan information by Employee Number or Name
   - View current loan balance
   - Access payment history
   - Download statements

---

## 📊 Data Structure

### Main Components

#### Employees Table
- Employee Number (ID)
- Name (First, Middle, Last)
- Position & Department
- Station/Location
- Status (Active, Inactive, Separated)
- Contact Information

#### Provident Loans Table
- Loan Amount: PHP 100,000
- Number of Months: 60 (5 years)
- Monthly Amortization: ~PHP 1,993
- Current Balance
- Status: QUALIFIED FOR RENEWAL / NOT QUALIFIED / COMPLETED / ACTIVE
- Dates: Application, Effective, Termination

#### Provident Ledger Cards Table
- Monthly payment records (one per month)
- Payment amounts with interest
- Principal payments
- Running balance
- Paid/Unpaid status

---

## 🏗️ Project Structure

```
provident-loan-system/
├── backend/                    # Node.js + Express API
│   ├── routes/                 # API endpoints
│   ├── controllers/            # Business logic
│   ├── services/               # Data operations
│   ├── middleware/             # Auth, validation
│   ├── database/               # Schema & migrations
│   ├── server.js               # Entry point
│   └── package.json
│
├── frontend/                   # React/Next.js UI
│   ├── src/
│   │   ├── pages/
│   │   │   ├── admin/          # Admin interface
│   │   │   └── employee/       # Employee portal
│   │   ├── components/         # Reusable UI
│   │   └── services/           # API integration
│   └── package.json
│
├── docs/
│   ├── API_DOCUMENTATION.md    # All endpoints
│   ├── DATABASE_SCHEMA_UPDATED.md  # DB design
│   ├── SYSTEM_ARCHITECTURE.md  # Architecture
│   └── SETUP_GUIDE.md          # Installation
│
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MySQL 5.7+
- npm or yarn

### Backend Setup

```bash
cd backend
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with database credentials

# Start development server
npm run dev
# Server runs on http://localhost:5000
```

### Frontend Setup

```bash
cd frontend
npm install

# Copy and configure environment
cp .env.example .env

# Start development server
npm run dev
# App runs on http://localhost:3000
```

---

## 📚 Documentation

- **[API Documentation](./docs/API_DOCUMENTATION.md)** - Complete API reference
- **[Database Schema](./docs/DATABASE_SCHEMA_UPDATED.md)** - Database design & relationships
- **[System Architecture](./docs/SYSTEM_ARCHITECTURE.md)** - System overview & design
- **[Setup Guide](./docs/SETUP_GUIDE.md)** - Step-by-step implementation guide

---

## ✨ Key Features

### Admin Portal Features
✅ Secure login with JWT authentication  
✅ Dashboard with key statistics  
✅ Employee management (CRUD operations)  
✅ Loan information management  
✅ Monthly payment tracking  
✅ Bulk data import from CSV  
✅ Data export functionality  
✅ Comprehensive audit logs  
✅ User & role management  
✅ Advanced reporting & analytics  

### Employee Portal Features
✅ Search by Employee Number  
✅ Search by Employee Name  
✅ View current loan information  
✅ Access payment history  
✅ Download PDF statements  
✅ View FAQ & support info  

---

## 🗄️ Database

Default schema includes:

- **employees** - Employee records (500-1000 records)
- **provident_loans** - Loan summaries
- **provident_ledger_cards** - Monthly payment entries
- **admin_users** - System admin accounts
- **audit_logs** - Change tracking

See [DATABASE_SCHEMA_UPDATED.md](./docs/DATABASE_SCHEMA_UPDATED.md) for complete schema.

---

## 🔐 Security Features

- JWT-based authentication
- Role-based access control (RBAC)
- Password hashing with bcryptjs
- SQL injection prevention
- CORS configuration
- Rate limiting
- Audit logging for all changes
- Environment-based configuration

---

## 📊 API Routes

### Admin Endpoints
```
POST   /api/auth/login              # Admin login
GET    /api/admin/employees         # List employees
POST   /api/admin/employees         # Create employee
PUT    /api/admin/employees/:id     # Update employee
DELETE /api/admin/employees/:id     # Delete employee

GET    /api/admin/loans             # List loans
POST   /api/admin/loans             # Create loan
PUT    /api/admin/loans/:id         # Update loan

GET    /api/admin/ledger/:empId     # Get payment history
POST   /api/admin/ledger            # Add payment

GET    /api/admin/dashboard         # Statistics
GET    /api/admin/audit-logs        # Audit trail
```

### Employee Endpoints
```
POST   /api/employee/search         # Search loan data
GET    /api/employee/lookup/:empId  # Get loan details
GET    /api/employee/ledger/:empId  # Get payment history
GET    /api/employee/statement/:empId  # Download statement
GET    /api/employee/help           # FAQ
GET    /api/employee/contact        # Contact info
```

See [API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md) for complete reference.

---

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MySQL/MariaDB
- **ORM**: Sequelize
- **Authentication**: JWT
- **Password Hashing**: bcryptjs
- **Validation**: Joi
- **Logging**: Morgan

### Frontend
- **Framework**: React/Next.js
- **State Management**: Zustand
- **Forms**: React Hook Form
- **HTTP Client**: Axios
- **PDF Generation**: jsPDF
- **Charts**: Chart.js (optional)
- **Styling**: Tailwind CSS

---

## 📈 Scalability

✅ Supports 500-1000 employees  
✅ Database indexed for fast queries  
✅ Pagination for large datasets  
✅ Rate limiting to prevent abuse  
✅ Containerized with Docker  
✅ Ready for horizontal scaling  

---

## 📋 Implementation Checklist

See [SETUP_GUIDE.md](./docs/SETUP_GUIDE.md) for detailed implementation checklist.

### Phase 1: Database (Week 1)
- [ ] Create database
- [ ] Run SQL schema
- [ ] Create initial admin user

### Phase 2: Backend (Week 2-3)
- [ ] Setup Node.js project
- [ ] Connect to database
- [ ] Implement authentication
- [ ] Build API endpoints
- [ ] Add audit logging

### Phase 3: Frontend (Week 3-4)
- [ ] Admin portal UI
- [ ] Employee portal UI
- [ ] API integration
- [ ] Forms & validation
- [ ] PDF export

### Phase 4: Testing & Deployment (Week 5-6)
- [ ] Functional testing
- [ ] Security testing
- [ ] Performance testing
- [ ] Docker setup
- [ ] Production deployment

---

## 🐳 Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build

# Services will be available at:
# - Frontend: http://localhost:3000
# - Backend: http://localhost:5000
# - MySQL: localhost:3306
```

---

## 📞 Getting Help

1. Check the relevant documentation file
2. Review API endpoint specifications
3. Check database schema for data relationships
4. Review error messages and logs

---

## 📝 License

Private project - All rights reserved

---

## 👥 Team

Built with efficiency and accuracy in mind for managing provident loans at scale.

---

## 🎉 Status

**Active Development** - Ready for implementation

