# Database Schema & Data Models

## 📑 Complete Database Schema

### Table 1: Employees
```sql
CREATE TABLE employees (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id VARCHAR(50) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(20),
  department VARCHAR(100),
  designation VARCHAR(100),
  joining_date DATE NOT NULL,
  status ENUM('active', 'inactive', 'on_leave') DEFAULT 'active',
  manager_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_employee_id (employee_id),
  INDEX idx_email (email),
  INDEX idx_status (status)
);
```

### Table 2: Provident Loans
```sql
CREATE TABLE provident_loans (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id VARCHAR(50) NOT NULL,
  
  -- Contribution Data
  monthly_contribution DECIMAL(10, 2) NOT NULL,
  employer_contribution DECIMAL(10, 2),
  total_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
  
  -- Loan/Withdrawal Data
  loan_amount DECIMAL(12, 2),
  remaining_loan_amount DECIMAL(12, 2),
  interest_rate DECIMAL(5, 2),
  
  -- Dates
  contribution_start_date DATE,
  last_contribution_date DATE,
  loan_disbursement_date DATE,
  loan_maturity_date DATE,
  
  -- Status
  status ENUM('active_contribution', 'loan_active', 'completed', 'suspended') DEFAULT 'active_contribution',
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
  INDEX idx_employee_id (employee_id),
  INDEX idx_status (status)
);
```

### Table 3: Admin Users
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
  permissions JSON,
  
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

### Table 4: Audit Logs
```sql
CREATE TABLE audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  admin_id BIGINT NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id VARCHAR(100),
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (admin_id) REFERENCES admin_users(id),
  INDEX idx_admin_id (admin_id),
  INDEX idx_created_at (created_at),
  INDEX idx_action (action)
);
```

### Table 5: Transactions
```sql
CREATE TABLE transactions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id VARCHAR(50) NOT NULL,
  transaction_type ENUM('contribution', 'withdrawal', 'loan_disbursement', 'loan_repayment', 'interest') NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  transaction_date DATE NOT NULL,
  description TEXT,
  status ENUM('pending', 'completed', 'failed') DEFAULT 'completed',
  reference_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
  INDEX idx_employee_id (employee_id),
  INDEX idx_date (transaction_date)
);
```

---

## 📊 Data Model Relationships

```
Employees (1) ──────→ (N) Provident_Loans
                           ↓
                    Transactions

Admin_Users ──────→ Audit_Logs
                    (tracks changes)
```

---

## 💾 Index Strategy

- **Primary Lookups**: `employee_id`, `email`, `username`
- **Filtering**: `status`, `created_at`, `department`
- **Performance**: Composite indexes on frequent queries

---

## 🔒 Access Control Matrix

| Role | Employees | Loans | Admin Users | Audit Logs |
|------|-----------|--------|-------------|-----------|
| Super Admin | CRUD | CRUD | CRUD | Read |
| Admin | CRU | CRUD | None | Read |
| Auditor | Read | Read | None | Read |
| Manager | Read | Read | None | None |

