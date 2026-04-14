# Updated Database Schema - Based on Google Sheet Structure

## 📑 Provident Loan Fund Database Schema

### Table 1: Employees
```sql
CREATE TABLE employees (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_number VARCHAR(50) UNIQUE NOT NULL,
  station VARCHAR(100),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  position VARCHAR(100),
  department VARCHAR(100),
  email VARCHAR(150),
  phone VARCHAR(20),
  status ENUM('active', 'inactive', 'separated') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_employee_number (employee_number),
  INDEX idx_station (station),
  INDEX idx_status (status)
);
```

### Table 2: Provident Loans (Main/Summary)
```sql
CREATE TABLE provident_loans (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_number VARCHAR(50) NOT NULL UNIQUE,
  
  -- Loan Details
  loan_amount DECIMAL(12, 2) NOT NULL,
  no_of_months INT NOT NULL,
  monthly_amortization DECIMAL(10, 2) NOT NULL,
  
  -- Dates
  loan_application_date DATE,
  effective_date DATE,
  termination_date DATE,
  
  -- Check Information
  check_number VARCHAR(50),
  check_date DATE,
  
  -- Status & Balance
  loan_balance DECIMAL(12, 2) NOT NULL,
  status ENUM('QUALIFIED FOR RENEWAL', 'NOT QUALIFIED FOR RENEWAL', 'COMPLETED', 'ACTIVE') DEFAULT 'ACTIVE',
  no_of_months_paid INT DEFAULT 0,
  
  -- Ledger Reference
  ledger_type VARCHAR(50), -- 'PROVIDENT FUND'
  
  -- Additional
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (employee_number) REFERENCES employees(employee_number) ON DELETE CASCADE,
  INDEX idx_employee_number (employee_number),
  INDEX idx_status (status),
  INDEX idx_effective_date (effective_date)
);
```

### Table 3: Provident Ledger Cards (Detailed Payment History)
```sql
CREATE TABLE provident_ledger_cards (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_number VARCHAR(50) NOT NULL,
  admin_position VARCHAR(100),
  
  -- Loan Info
  date_granted DATE,
  loan_amount DECIMAL(12, 2),
  no_of_months INT,
  amount_with_interest DECIMAL(12, 2),
  
  -- Payment Details (one row per month)
  payment_month INT, -- Month sequence (1-60, etc.)
  date_of_deduction DATE,
  payment_with_interest DECIMAL(10, 2),
  principal_payments DECIMAL(10, 2),
  paid_status BOOLEAN DEFAULT FALSE, -- Whether payment was made
  monthly_payment_amount DECIMAL(10, 2),
  paid_months INT, -- Running count of months paid
  balance DECIMAL(12, 2),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (employee_number) REFERENCES employees(employee_number) ON DELETE CASCADE,
  INDEX idx_employee_number (employee_number),
  INDEX idx_payment_month (payment_month),
  INDEX idx_date_of_deduction (date_of_deduction)
);
```

### Table 4: Admin Users
```sql
CREATE TABLE admin_users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  
  -- Role-based Access
  role ENUM('super_admin', 'admin', 'auditor', 'manager') DEFAULT 'admin',
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP,
  login_attempts INT DEFAULT 0,
  locked_until TIMESTAMP NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_username (username),
  INDEX idx_email (email)
);
```

### Table 5: Audit Logs
```sql
CREATE TABLE audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  admin_id BIGINT NOT NULL,
  employee_number VARCHAR(50),
  action VARCHAR(100) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', etc.
  entity_type VARCHAR(50), -- 'EMPLOYEE', 'LOAN', 'LEDGER_CARD'
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (admin_id) REFERENCES admin_users(id),
  INDEX idx_admin_id (admin_id),
  INDEX idx_created_at (created_at),
  INDEX idx_employee_number (employee_number)
);
```

---

## 📊 Data Mapping from Google Sheet

### From Main Sheet → provident_loans table
| Google Sheet Column | Database Column | Example |
|---|---|---|
| No. | id | 1 |
| Station | station | 26 |
| Employee Number | employee_number | 4261248 |
| Name of Employee | first_name + last_name | MIREN HIRSCH SAILBIM |
| Loan Application Date | loan_application_date | 2025-04-011 |
| Check No. | check_number | 736010 |
| Check Date | check_date | May-08-2023 |
| Loan Amount | loan_amount | 100,000.00 |
| No. of Months | no_of_months | 60 |
| Monthly Amortization | monthly_amortization | 1,993.29 |
| Effective Date | effective_date | 12/1/2023 |
| Termination Date | termination_date | 12/31/2028 |
| No. of Months Paid | no_of_months_paid | 1 |
| Loan Balance | loan_balance | 98,565.71 |
| Status | status | QUALIFIED FOR RENEWAL |
| REMARKS | remarks | (text) |

### From Ledger Card → provident_ledger_cards table
| Google Sheet Column | Database Column | Example |
|---|---|---|
| Employee No. | employee_number | 6502917 |
| Position | admin_position | ADMINISTRATIVE AIDE VI |
| Date Granted | date_granted | (from main sheet) |
| Loan Amount | loan_amount | 100,000.00 |
| No. of Months | no_of_months | 60 |
| Amount w/ Interest | amount_with_interest | 115,997.40 |
| Date of Deduction | date_of_deduction | September 2025 |
| Payment w/ Interest | payment_with_interest | 500.00 |
| Principal Payments | principal_payments | 1,433.29 |
| Monthly Payment | monthly_payment_amount | 1,933.29 |
| Balance | balance | 98,565.71 |

---

## 🔄 Entity Relationships

```
Admin Users
    ↓
    ├── Can manage Employees
    ├── Can manage Provident Loans
    ├── Can view/edit Ledger Cards
    └── Creates Audit Logs

Employees (1) ──→ (1) Provident Loans
            └──→ (N) Provident Ledger Cards
                    (one row per payment month)

Audit Logs ← Admin User actions on all tables
```

---

## 🎯 Key Features of This Schema

✅ **Dual View**: Main summary + Detailed ledger cards
✅ **Separate Data**: Database isolated from public files
✅ **Status Tracking**: QUALIFIED/NOT QUALIFIED/COMPLETED
✅ **Payment History**: Monthly breakdown with balance tracking
✅ **Audit Trail**: All changes logged with admin info
✅ **Employee Search**: By employee_number or name
✅ **Performance**: Indexes on frequent queries

