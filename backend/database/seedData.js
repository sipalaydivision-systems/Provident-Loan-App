// Mock Database Service - For Development/Demo
// In production, replace with actual Sequelize database

const mockData = {
  admins: [
    {
      id: 1,
      username: 'admin',
      email: 'admin@company.com',
      password_hash: '$2a$10$E4zAXSKyAqOa4xDcMkMWM.i/X6z/6emrLMZu8UIRQFpH0FmdFjYom', // password: admin123
      first_name: 'System',
      last_name: 'Administrator',
      role: 'super_admin',
      is_active: true,
      created_at: new Date('2023-12-01'),
    },
  ],

  // ── EMPLOYEES ─────────────────────────────────────────────────────────────
  employees: [
    { id: 1,  employee_number: '4261248', station: '26',  first_name: 'MIREN',      last_name: 'HIRSCH',      middle_name: 'S',   position: 'Officer I',      department: 'Finance',    email: 'miren.hirsch@agency.gov.ph',      phone: '09171234501', status: 'active',   created_at: new Date('2019-01-15') },
    { id: 2,  employee_number: '4611581', station: '26',  first_name: 'MARILEN',    last_name: 'IGUINA',      middle_name: 'M',   position: 'Admin Aide VI',  department: 'Admin',      email: 'marilen.iguina@agency.gov.ph',    phone: '09171234502', status: 'active',   created_at: new Date('2018-03-10') },
    { id: 3,  employee_number: '4231830', station: '26',  first_name: 'ODESSA',     last_name: 'LOMOD',       middle_name: 'A',   position: 'Specialist II',  department: 'Operations', email: 'odessa.lomod@agency.gov.ph',      phone: '09171234503', status: 'active',   created_at: new Date('2017-06-01') },
    { id: 4,  employee_number: '4198320', station: '26',  first_name: 'ROLANDO',    last_name: 'DELA CRUZ',   middle_name: 'B',   position: 'Clerk III',      department: 'Records',    email: 'rolando.delacruz@agency.gov.ph',  phone: '09171234504', status: 'active',   created_at: new Date('2016-08-22') },
    { id: 5,  employee_number: '4305671', station: '26',  first_name: 'TERESITA',   last_name: 'SANTOS',      middle_name: 'C',   position: 'Accountant III', department: 'Finance',    email: 'teresita.santos@agency.gov.ph',   phone: '09171234505', status: 'active',   created_at: new Date('2015-04-05') },
    { id: 6,  employee_number: '4417892', station: '26',  first_name: 'JUANITO',    last_name: 'REYES',       middle_name: 'P',   position: 'Engineer II',    department: 'Technical',  email: 'juanito.reyes@agency.gov.ph',     phone: '09171234506', status: 'active',   created_at: new Date('2020-01-20') },
    { id: 7,  employee_number: '4523140', station: '26',  first_name: 'MARICEL',    last_name: 'BAUTISTA',    middle_name: 'D',   position: 'Nurse II',       department: 'Health',     email: 'maricel.bautista@agency.gov.ph',  phone: '09171234507', status: 'active',   created_at: new Date('2019-07-11') },
    { id: 8,  employee_number: '4634987', station: '26',  first_name: 'EDGAR',      last_name: 'VILLANUEVA',  middle_name: 'T',   position: 'Driver II',      department: 'Transport',  email: 'edgar.villanueva@agency.gov.ph',  phone: '09171234508', status: 'active',   created_at: new Date('2018-09-03') },
    { id: 9,  employee_number: '4745623', station: '26',  first_name: 'NELIA',      last_name: 'FERNANDEZ',   middle_name: 'L',   position: 'Teacher I',      department: 'Education',  email: 'nelia.fernandez@agency.gov.ph',   phone: '09171234509', status: 'active',   created_at: new Date('2017-11-28') },
    { id: 10, employee_number: '4856310', station: '26',  first_name: 'ANTONIO',    last_name: 'GARCIA',      middle_name: 'R',   position: 'Foreman',        department: 'Public Works',email:'antonio.garcia@agency.gov.ph',    phone: '09171234510', status: 'active',   created_at: new Date('2016-02-14') },
    { id: 11, employee_number: '4967045', station: '26',  first_name: 'REMEDIOS',   last_name: 'MENDOZA',     middle_name: 'G',   position: 'Bookkeeper II',  department: 'Finance',    email: 'remedios.mendoza@agency.gov.ph',  phone: '09171234511', status: 'active',   created_at: new Date('2021-05-17') },
    { id: 12, employee_number: '5012678', station: '26',  first_name: 'VICTOR',     last_name: 'TORRES',      middle_name: 'E',   position: 'Security Guard', department: 'Security',   email: 'victor.torres@agency.gov.ph',     phone: '09171234512', status: 'active',   created_at: new Date('2020-08-30') },
    { id: 13, employee_number: '5123890', station: '26A', first_name: 'LOURDES',    last_name: 'CASTILLO',    middle_name: 'N',   position: 'Midwife II',     department: 'Health',     email: 'lourdes.castillo@agency.gov.ph',  phone: '09171234513', status: 'active',   created_at: new Date('2019-03-25') },
    { id: 14, employee_number: '5234502', station: '26A', first_name: 'ROBERTO',    last_name: 'AQUINO',      middle_name: 'F',   position: 'Carpenter III',  department: 'Public Works',email:'roberto.aquino@agency.gov.ph',    phone: '09171234514', status: 'active',   created_at: new Date('2018-06-12') },
    { id: 15, employee_number: '5345217', station: '26A', first_name: 'CONCHITA',   last_name: 'PASCUAL',     middle_name: 'V',   position: 'Clerk II',       department: 'Admin',      email: 'conchita.pascual@agency.gov.ph',  phone: '09171234515', status: 'active',   created_at: new Date('2017-10-07') },
    // Discharged / inactive employees
    { id: 16, employee_number: '3891045', station: '26',  first_name: 'DANILO',     last_name: 'CRUZ',        middle_name: 'H',   position: 'Laborer II',     department: 'Public Works',email:'danilo.cruz@agency.gov.ph',       phone: '09171234516', status: 'inactive', created_at: new Date('2010-01-10') },
    { id: 17, employee_number: '3902367', station: '26',  first_name: 'FLORENCIA',  last_name: 'NAVARRO',     middle_name: 'J',   position: 'Teacher I',      department: 'Education',  email: 'florencia.navarro@agency.gov.ph', phone: '09171234517', status: 'inactive', created_at: new Date('2009-05-20') },
    { id: 18, employee_number: '4013489', station: '26',  first_name: 'BERNARDO',   last_name: 'SALAZAR',     middle_name: 'K',   position: 'Clerk I',        department: 'Records',    email: 'bernardo.salazar@agency.gov.ph',  phone: '09171234518', status: 'inactive', created_at: new Date('2008-09-15') },
  ],

  // ── LOANS ─────────────────────────────────────────────────────────────────
  loans: [
    {
      id: 1,  employee_number: '4261248',
      loan_amount: 100000.00, no_of_months: 60, monthly_amortization: 1993.29,
      loan_application_date: new Date('2023-11-10'), check_number: '736010', check_date: new Date('2023-11-20'),
      effective_date: new Date('2023-12-01'), termination_date: new Date('2028-11-30'),
      loan_balance: 76144.89, no_of_months_paid: 15, status: 'QUALIFIED FOR RENEWAL', remarks: '', created_at: new Date('2023-12-01'),
    },
    {
      id: 2,  employee_number: '4611581',
      loan_amount: 80000.00, no_of_months: 48, monthly_amortization: 1850.00,
      loan_application_date: new Date('2024-05-20'), check_number: '750201', check_date: new Date('2024-06-01'),
      effective_date: new Date('2024-06-15'), termination_date: new Date('2028-06-14'),
      loan_balance: 69100.00, no_of_months_paid: 6, status: 'ACTIVE', remarks: '', created_at: new Date('2024-06-15'),
    },
    {
      id: 3,  employee_number: '4231830',
      loan_amount: 75000.00, no_of_months: 60, monthly_amortization: 1500.00,
      loan_application_date: new Date('2023-02-15'), check_number: '710456', check_date: new Date('2023-03-01'),
      effective_date: new Date('2023-04-01'), termination_date: new Date('2028-03-31'),
      loan_balance: 30000.00, no_of_months_paid: 30, status: 'QUALIFIED FOR RENEWAL', remarks: '', created_at: new Date('2023-04-01'),
    },
    {
      id: 4,  employee_number: '4198320',
      loan_amount: 50000.00, no_of_months: 36, monthly_amortization: 1527.78,
      loan_application_date: new Date('2024-01-08'), check_number: '762034', check_date: new Date('2024-01-15'),
      effective_date: new Date('2024-02-01'), termination_date: new Date('2027-01-31'),
      loan_balance: 42888.84, no_of_months_paid: 5, status: 'ACTIVE', remarks: '', created_at: new Date('2024-02-01'),
    },
    {
      id: 5,  employee_number: '4305671',
      loan_amount: 150000.00, no_of_months: 60, monthly_amortization: 2900.00,
      loan_application_date: new Date('2022-08-03'), check_number: '698120', check_date: new Date('2022-08-10'),
      effective_date: new Date('2022-09-01'), termination_date: new Date('2027-08-31'),
      loan_balance: 60900.00, no_of_months_paid: 31, status: 'QUALIFIED FOR RENEWAL', remarks: '', created_at: new Date('2022-09-01'),
    },
    {
      id: 6,  employee_number: '4417892',
      loan_amount: 120000.00, no_of_months: 60, monthly_amortization: 2350.00,
      loan_application_date: new Date('2023-06-12'), check_number: '724501', check_date: new Date('2023-06-20'),
      effective_date: new Date('2023-07-01'), termination_date: new Date('2028-06-30'),
      loan_balance: 84600.00, no_of_months_paid: 15, status: 'ACTIVE', remarks: '', created_at: new Date('2023-07-01'),
    },
    {
      id: 7,  employee_number: '4523140',
      loan_amount: 90000.00, no_of_months: 48, monthly_amortization: 2062.50,
      loan_application_date: new Date('2024-03-05'), check_number: '768903', check_date: new Date('2024-03-12'),
      effective_date: new Date('2024-04-01'), termination_date: new Date('2028-03-31'),
      loan_balance: 77625.00, no_of_months_paid: 6, status: 'ACTIVE', remarks: '', created_at: new Date('2024-04-01'),
    },
    {
      id: 8,  employee_number: '4634987',
      loan_amount: 60000.00, no_of_months: 36, monthly_amortization: 1833.33,
      loan_application_date: new Date('2022-11-18'), check_number: '704567', check_date: new Date('2022-11-25'),
      effective_date: new Date('2022-12-01'), termination_date: new Date('2025-11-30'),
      loan_balance: 5499.99, no_of_months_paid: 33, status: 'QUALIFIED FOR RENEWAL', remarks: '', created_at: new Date('2022-12-01'),
    },
    {
      id: 9,  employee_number: '4745623',
      loan_amount: 85000.00, no_of_months: 60, monthly_amortization: 1700.00,
      loan_application_date: new Date('2023-09-22'), check_number: '731289', check_date: new Date('2023-09-30'),
      effective_date: new Date('2023-10-01'), termination_date: new Date('2028-09-30'),
      loan_balance: 72250.00, no_of_months_paid: 8, status: 'ACTIVE', remarks: '', created_at: new Date('2023-10-01'),
    },
    {
      id: 10, employee_number: '4856310',
      loan_amount: 200000.00, no_of_months: 60, monthly_amortization: 3833.33,
      loan_application_date: new Date('2021-03-10'), check_number: '651034', check_date: new Date('2021-03-18'),
      effective_date: new Date('2021-04-01'), termination_date: new Date('2026-03-31'),
      loan_balance: 22999.98, no_of_months_paid: 54, status: 'QUALIFIED FOR RENEWAL', remarks: '', created_at: new Date('2021-04-01'),
    },
    {
      id: 11, employee_number: '4967045',
      loan_amount: 40000.00, no_of_months: 24, monthly_amortization: 1833.33,
      loan_application_date: new Date('2024-07-01'), check_number: '779012', check_date: new Date('2024-07-08'),
      effective_date: new Date('2024-08-01'), termination_date: new Date('2026-07-31'),
      loan_balance: 34666.67, no_of_months_paid: 3, status: 'ACTIVE', remarks: '', created_at: new Date('2024-08-01'),
    },
    {
      id: 12, employee_number: '5012678',
      loan_amount: 55000.00, no_of_months: 36, monthly_amortization: 1611.11,
      loan_application_date: new Date('2023-04-14'), check_number: '715678', check_date: new Date('2023-04-20'),
      effective_date: new Date('2023-05-01'), termination_date: new Date('2026-04-30'),
      loan_balance: 38666.64, no_of_months_paid: 10, status: 'ACTIVE', remarks: '', created_at: new Date('2023-05-01'),
    },
    {
      id: 13, employee_number: '5123890',
      loan_amount: 70000.00, no_of_months: 48, monthly_amortization: 1604.17,
      loan_application_date: new Date('2024-02-19'), check_number: '764890', check_date: new Date('2024-02-26'),
      effective_date: new Date('2024-03-01'), termination_date: new Date('2028-02-29'),
      loan_balance: 57750.12, no_of_months_paid: 8, status: 'NOT QUALIFIED', remarks: 'Missed 2 payments', created_at: new Date('2024-03-01'),
    },
    {
      id: 14, employee_number: '5234502',
      loan_amount: 110000.00, no_of_months: 60, monthly_amortization: 2133.33,
      loan_application_date: new Date('2022-05-30'), check_number: '680123', check_date: new Date('2022-06-07'),
      effective_date: new Date('2022-07-01'), termination_date: new Date('2027-06-30'),
      loan_balance: 40533.27, no_of_months_paid: 31, status: 'QUALIFIED FOR RENEWAL', remarks: '', created_at: new Date('2022-07-01'),
    },
    {
      id: 15, employee_number: '5345217',
      loan_amount: 65000.00, no_of_months: 36, monthly_amortization: 1944.44,
      loan_application_date: new Date('2024-04-08'), check_number: '771234', check_date: new Date('2024-04-15'),
      effective_date: new Date('2024-05-01'), termination_date: new Date('2027-04-30'),
      loan_balance: 54722.36, no_of_months_paid: 5, status: 'ACTIVE', remarks: '', created_at: new Date('2024-05-01'),
    },
    // Discharged employees – fully paid loans
    {
      id: 16, employee_number: '3891045',
      loan_amount: 30000.00, no_of_months: 24, monthly_amortization: 1375.00,
      loan_application_date: new Date('2020-01-05'), check_number: '611045', check_date: new Date('2020-01-12'),
      effective_date: new Date('2020-02-01'), termination_date: new Date('2022-01-31'),
      loan_balance: 0.00, no_of_months_paid: 24, status: 'FULLY PAID', remarks: 'Separated from service', created_at: new Date('2020-02-01'),
    },
    {
      id: 17, employee_number: '3902367',
      loan_amount: 45000.00, no_of_months: 36, monthly_amortization: 1375.00,
      loan_application_date: new Date('2018-06-10'), check_number: '583201', check_date: new Date('2018-06-18'),
      effective_date: new Date('2018-07-01'), termination_date: new Date('2021-06-30'),
      loan_balance: 0.00, no_of_months_paid: 36, status: 'FULLY PAID', remarks: 'Retired', created_at: new Date('2018-07-01'),
    },
    {
      id: 18, employee_number: '4013489',
      loan_amount: 25000.00, no_of_months: 24, monthly_amortization: 1145.83,
      loan_application_date: new Date('2019-03-20'), check_number: '605789', check_date: new Date('2019-03-28'),
      effective_date: new Date('2019-04-01'), termination_date: new Date('2021-03-31'),
      loan_balance: 0.00, no_of_months_paid: 24, status: 'FULLY PAID', remarks: 'Resigned', created_at: new Date('2019-04-01'),
    },
  ],

  // ── LEDGER CARDS (payment history) ────────────────────────────────────────
  ledgerCards: [
    // ── Emp 4261248 HIRSCH (15 payments, balance 76,144.89) ──
    { id: 1,  employee_number: '4261248', payment_month: 1,  date_of_deduction: new Date('2023-12-31'), payment_with_interest: 400.00, principal_payments: 1593.29, paid_status: true, monthly_payment_amount: 1993.29, paid_months: 1,  balance: 98006.71 },
    { id: 2,  employee_number: '4261248', payment_month: 2,  date_of_deduction: new Date('2024-01-31'), payment_with_interest: 392.03, principal_payments: 1601.26, paid_status: true, monthly_payment_amount: 1993.29, paid_months: 2,  balance: 96405.45 },
    { id: 3,  employee_number: '4261248', payment_month: 3,  date_of_deduction: new Date('2024-02-29'), payment_with_interest: 385.62, principal_payments: 1607.67, paid_status: true, monthly_payment_amount: 1993.29, paid_months: 3,  balance: 94797.78 },
    { id: 4,  employee_number: '4261248', payment_month: 4,  date_of_deduction: new Date('2024-03-31'), payment_with_interest: 379.19, principal_payments: 1614.10, paid_status: true, monthly_payment_amount: 1993.29, paid_months: 4,  balance: 93183.68 },
    { id: 5,  employee_number: '4261248', payment_month: 5,  date_of_deduction: new Date('2024-04-30'), payment_with_interest: 372.73, principal_payments: 1620.56, paid_status: true, monthly_payment_amount: 1993.29, paid_months: 5,  balance: 91563.12 },
    { id: 6,  employee_number: '4261248', payment_month: 6,  date_of_deduction: new Date('2024-05-31'), payment_with_interest: 366.25, principal_payments: 1627.04, paid_status: true, monthly_payment_amount: 1993.29, paid_months: 6,  balance: 89936.08 },
    { id: 7,  employee_number: '4261248', payment_month: 7,  date_of_deduction: new Date('2024-06-30'), payment_with_interest: 359.74, principal_payments: 1633.55, paid_status: true, monthly_payment_amount: 1993.29, paid_months: 7,  balance: 88302.53 },
    { id: 8,  employee_number: '4261248', payment_month: 8,  date_of_deduction: new Date('2024-07-31'), payment_with_interest: 353.21, principal_payments: 1640.08, paid_status: true, monthly_payment_amount: 1993.29, paid_months: 8,  balance: 86662.45 },
    { id: 9,  employee_number: '4261248', payment_month: 9,  date_of_deduction: new Date('2024-08-31'), payment_with_interest: 346.65, principal_payments: 1646.64, paid_status: true, monthly_payment_amount: 1993.29, paid_months: 9,  balance: 85015.81 },
    { id: 10, employee_number: '4261248', payment_month: 10, date_of_deduction: new Date('2024-09-30'), payment_with_interest: 340.06, principal_payments: 1653.23, paid_status: true, monthly_payment_amount: 1993.29, paid_months: 10, balance: 83362.58 },
    { id: 11, employee_number: '4261248', payment_month: 11, date_of_deduction: new Date('2024-10-31'), payment_with_interest: 333.45, principal_payments: 1659.84, paid_status: true, monthly_payment_amount: 1993.29, paid_months: 11, balance: 81702.74 },
    { id: 12, employee_number: '4261248', payment_month: 12, date_of_deduction: new Date('2024-11-30'), payment_with_interest: 326.81, principal_payments: 1666.48, paid_status: true, monthly_payment_amount: 1993.29, paid_months: 12, balance: 80036.26 },
    { id: 13, employee_number: '4261248', payment_month: 13, date_of_deduction: new Date('2024-12-31'), payment_with_interest: 320.15, principal_payments: 1673.14, paid_status: true, monthly_payment_amount: 1993.29, paid_months: 13, balance: 78363.12 },
    { id: 14, employee_number: '4261248', payment_month: 14, date_of_deduction: new Date('2025-01-31'), payment_with_interest: 313.45, principal_payments: 1679.84, paid_status: true, monthly_payment_amount: 1993.29, paid_months: 14, balance: 76683.28 },
    { id: 15, employee_number: '4261248', payment_month: 15, date_of_deduction: new Date('2025-02-28'), payment_with_interest: 306.73, principal_payments: 1686.56, paid_status: true, monthly_payment_amount: 1993.29, paid_months: 15, balance: 76144.89 },

    // ── Emp 4611581 IGUINA (6 payments, balance 69,100.00) ──
    { id: 16, employee_number: '4611581', payment_month: 1, date_of_deduction: new Date('2024-07-15'), payment_with_interest: 320.00, principal_payments: 1530.00, paid_status: true, monthly_payment_amount: 1850.00, paid_months: 1, balance: 78150.00 },
    { id: 17, employee_number: '4611581', payment_month: 2, date_of_deduction: new Date('2024-08-15'), payment_with_interest: 312.60, principal_payments: 1537.40, paid_status: true, monthly_payment_amount: 1850.00, paid_months: 2, balance: 76612.60 },
    { id: 18, employee_number: '4611581', payment_month: 3, date_of_deduction: new Date('2024-09-15'), payment_with_interest: 306.45, principal_payments: 1543.55, paid_status: true, monthly_payment_amount: 1850.00, paid_months: 3, balance: 75069.05 },
    { id: 19, employee_number: '4611581', payment_month: 4, date_of_deduction: new Date('2024-10-15'), payment_with_interest: 300.28, principal_payments: 1549.72, paid_status: true, monthly_payment_amount: 1850.00, paid_months: 4, balance: 73519.33 },
    { id: 20, employee_number: '4611581', payment_month: 5, date_of_deduction: new Date('2024-11-15'), payment_with_interest: 294.08, principal_payments: 1555.92, paid_status: true, monthly_payment_amount: 1850.00, paid_months: 5, balance: 71963.41 },
    { id: 21, employee_number: '4611581', payment_month: 6, date_of_deduction: new Date('2024-12-15'), payment_with_interest: 287.85, principal_payments: 1562.15, paid_status: true, monthly_payment_amount: 1850.00, paid_months: 6, balance: 69100.00 },

    // ── Emp 4231830 LOMOD (30 payments, balance 30,000.00) ──
    { id: 22, employee_number: '4231830', payment_month: 1,  date_of_deduction: new Date('2023-04-30'), payment_with_interest: 300.00, principal_payments: 1200.00, paid_status: true, monthly_payment_amount: 1500.00, paid_months: 1,  balance: 73800.00 },
    { id: 23, employee_number: '4231830', payment_month: 5,  date_of_deduction: new Date('2023-08-31'), payment_with_interest: 280.00, principal_payments: 1220.00, paid_status: true, monthly_payment_amount: 1500.00, paid_months: 5,  balance: 68700.00 },
    { id: 24, employee_number: '4231830', payment_month: 10, date_of_deduction: new Date('2024-01-31'), payment_with_interest: 255.00, principal_payments: 1245.00, paid_status: true, monthly_payment_amount: 1500.00, paid_months: 10, balance: 62200.00 },
    { id: 25, employee_number: '4231830', payment_month: 20, date_of_deduction: new Date('2024-11-30'), payment_with_interest: 210.00, principal_payments: 1290.00, paid_status: true, monthly_payment_amount: 1500.00, paid_months: 20, balance: 47400.00 },
    { id: 26, employee_number: '4231830', payment_month: 28, date_of_deduction: new Date('2025-07-31'), payment_with_interest: 170.00, principal_payments: 1330.00, paid_status: true, monthly_payment_amount: 1500.00, paid_months: 28, balance: 33400.00 },
    { id: 27, employee_number: '4231830', payment_month: 30, date_of_deduction: new Date('2025-09-30'), payment_with_interest: 160.00, principal_payments: 1340.00, paid_status: true, monthly_payment_amount: 1500.00, paid_months: 30, balance: 30000.00 },

    // ── Emp 4198320 DELA CRUZ (5 payments) ──
    { id: 28, employee_number: '4198320', payment_month: 1, date_of_deduction: new Date('2024-02-29'), payment_with_interest: 200.00, principal_payments: 1327.78, paid_status: true, monthly_payment_amount: 1527.78, paid_months: 1, balance: 48672.22 },
    { id: 29, employee_number: '4198320', payment_month: 2, date_of_deduction: new Date('2024-03-31'), payment_with_interest: 194.69, principal_payments: 1333.09, paid_status: true, monthly_payment_amount: 1527.78, paid_months: 2, balance: 47339.13 },
    { id: 30, employee_number: '4198320', payment_month: 3, date_of_deduction: new Date('2024-04-30'), payment_with_interest: 189.36, principal_payments: 1338.42, paid_status: true, monthly_payment_amount: 1527.78, paid_months: 3, balance: 46000.71 },
    { id: 31, employee_number: '4198320', payment_month: 4, date_of_deduction: new Date('2024-05-31'), payment_with_interest: 184.00, principal_payments: 1343.78, paid_status: true, monthly_payment_amount: 1527.78, paid_months: 4, balance: 44656.93 },
    { id: 32, employee_number: '4198320', payment_month: 5, date_of_deduction: new Date('2024-06-30'), payment_with_interest: 178.63, principal_payments: 1349.15, paid_status: true, monthly_payment_amount: 1527.78, paid_months: 5, balance: 42888.84 },

    // ── Emp 4305671 SANTOS (31 payments) ──
    { id: 33, employee_number: '4305671', payment_month: 1,  date_of_deduction: new Date('2022-09-30'), payment_with_interest: 600.00, principal_payments: 2300.00, paid_status: true, monthly_payment_amount: 2900.00, paid_months: 1,  balance: 147700.00 },
    { id: 34, employee_number: '4305671', payment_month: 10, date_of_deduction: new Date('2023-06-30'), payment_with_interest: 520.00, principal_payments: 2380.00, paid_status: true, monthly_payment_amount: 2900.00, paid_months: 10, balance: 124900.00 },
    { id: 35, employee_number: '4305671', payment_month: 20, date_of_deduction: new Date('2024-04-30'), payment_with_interest: 430.00, principal_payments: 2470.00, paid_status: true, monthly_payment_amount: 2900.00, paid_months: 20, balance: 96700.00 },
    { id: 36, employee_number: '4305671', payment_month: 31, date_of_deduction: new Date('2025-03-31'), payment_with_interest: 335.00, principal_payments: 2565.00, paid_status: true, monthly_payment_amount: 2900.00, paid_months: 31, balance: 60900.00 },

    // ── Emp 4417892 REYES (15 payments) ──
    { id: 37, employee_number: '4417892', payment_month: 1,  date_of_deduction: new Date('2023-07-31'), payment_with_interest: 480.00, principal_payments: 1870.00, paid_status: true, monthly_payment_amount: 2350.00, paid_months: 1,  balance: 118130.00 },
    { id: 38, employee_number: '4417892', payment_month: 8,  date_of_deduction: new Date('2024-02-29'), payment_with_interest: 420.00, principal_payments: 1930.00, paid_status: true, monthly_payment_amount: 2350.00, paid_months: 8,  balance: 100380.00 },
    { id: 39, employee_number: '4417892', payment_month: 15, date_of_deduction: new Date('2024-09-30'), payment_with_interest: 360.00, principal_payments: 1990.00, paid_status: true, monthly_payment_amount: 2350.00, paid_months: 15, balance: 84600.00 },

    // ── Emp 4523140 BAUTISTA (6 payments) ──
    { id: 40, employee_number: '4523140', payment_month: 1, date_of_deduction: new Date('2024-04-30'), payment_with_interest: 360.00, principal_payments: 1702.50, paid_status: true, monthly_payment_amount: 2062.50, paid_months: 1, balance: 88297.50 },
    { id: 41, employee_number: '4523140', payment_month: 3, date_of_deduction: new Date('2024-06-30'), payment_with_interest: 345.00, principal_payments: 1717.50, paid_status: true, monthly_payment_amount: 2062.50, paid_months: 3, balance: 84862.50 },
    { id: 42, employee_number: '4523140', payment_month: 6, date_of_deduction: new Date('2024-09-30'), payment_with_interest: 320.00, principal_payments: 1742.50, paid_status: true, monthly_payment_amount: 2062.50, paid_months: 6, balance: 77625.00 },

    // ── Emp 4634987 VILLANUEVA (33 payments) ──
    { id: 43, employee_number: '4634987', payment_month: 1,  date_of_deduction: new Date('2022-12-31'), payment_with_interest: 240.00, principal_payments: 1593.33, paid_status: true, monthly_payment_amount: 1833.33, paid_months: 1,  balance: 58406.67 },
    { id: 44, employee_number: '4634987', payment_month: 12, date_of_deduction: new Date('2023-11-30'), payment_with_interest: 180.00, principal_payments: 1653.33, paid_status: true, monthly_payment_amount: 1833.33, paid_months: 12, balance: 38399.96 },
    { id: 45, employee_number: '4634987', payment_month: 33, date_of_deduction: new Date('2025-08-31'), payment_with_interest: 80.00,  principal_payments: 1753.33, paid_status: true, monthly_payment_amount: 1833.33, paid_months: 33, balance: 5499.99 },

    // ── Emp 4745623 FERNANDEZ (8 payments) ──
    { id: 46, employee_number: '4745623', payment_month: 1, date_of_deduction: new Date('2023-10-31'), payment_with_interest: 340.00, principal_payments: 1360.00, paid_status: true, monthly_payment_amount: 1700.00, paid_months: 1, balance: 83640.00 },
    { id: 47, employee_number: '4745623', payment_month: 4, date_of_deduction: new Date('2024-01-31'), payment_with_interest: 315.00, principal_payments: 1385.00, paid_status: true, monthly_payment_amount: 1700.00, paid_months: 4, balance: 78800.00 },
    { id: 48, employee_number: '4745623', payment_month: 8, date_of_deduction: new Date('2024-05-31'), payment_with_interest: 285.00, principal_payments: 1415.00, paid_status: true, monthly_payment_amount: 1700.00, paid_months: 8, balance: 72250.00 },

    // ── Emp 4856310 GARCIA (54 payments) ──
    { id: 49, employee_number: '4856310', payment_month: 1,  date_of_deduction: new Date('2021-04-30'), payment_with_interest: 800.00, principal_payments: 3033.33, paid_status: true, monthly_payment_amount: 3833.33, paid_months: 1,  balance: 196966.67 },
    { id: 50, employee_number: '4856310', payment_month: 20, date_of_deduction: new Date('2022-11-30'), payment_with_interest: 600.00, principal_payments: 3233.33, paid_status: true, monthly_payment_amount: 3833.33, paid_months: 20, balance: 119999.93 },
    { id: 51, employee_number: '4856310', payment_month: 40, date_of_deduction: new Date('2024-07-31'), payment_with_interest: 380.00, principal_payments: 3453.33, paid_status: true, monthly_payment_amount: 3833.33, paid_months: 40, balance: 53333.27 },
    { id: 52, employee_number: '4856310', payment_month: 54, date_of_deduction: new Date('2025-09-30'), payment_with_interest: 200.00, principal_payments: 3633.33, paid_status: true, monthly_payment_amount: 3833.33, paid_months: 54, balance: 22999.98 },

    // ── Emp 4967045 MENDOZA (3 payments) ──
    { id: 53, employee_number: '4967045', payment_month: 1, date_of_deduction: new Date('2024-08-31'), payment_with_interest: 160.00, principal_payments: 1673.33, paid_status: true, monthly_payment_amount: 1833.33, paid_months: 1, balance: 38326.67 },
    { id: 54, employee_number: '4967045', payment_month: 2, date_of_deduction: new Date('2024-09-30'), payment_with_interest: 153.31, principal_payments: 1680.02, paid_status: true, monthly_payment_amount: 1833.33, paid_months: 2, balance: 36646.65 },
    { id: 55, employee_number: '4967045', payment_month: 3, date_of_deduction: new Date('2024-10-31'), payment_with_interest: 146.59, principal_payments: 1686.74, paid_status: true, monthly_payment_amount: 1833.33, paid_months: 3, balance: 34666.67 },

    // ── Emp 5012678 TORRES (10 payments) ──
    { id: 56, employee_number: '5012678', payment_month: 1,  date_of_deduction: new Date('2023-05-31'), payment_with_interest: 220.00, principal_payments: 1391.11, paid_status: true, monthly_payment_amount: 1611.11, paid_months: 1,  balance: 53608.89 },
    { id: 57, employee_number: '5012678', payment_month: 5,  date_of_deduction: new Date('2023-09-30'), payment_with_interest: 196.00, principal_payments: 1415.11, paid_status: true, monthly_payment_amount: 1611.11, paid_months: 5,  balance: 47944.45 },
    { id: 58, employee_number: '5012678', payment_month: 10, date_of_deduction: new Date('2024-02-29'), payment_with_interest: 166.00, principal_payments: 1445.11, paid_status: true, monthly_payment_amount: 1611.11, paid_months: 10, balance: 38666.64 },

    // ── Emp 5123890 CASTILLO (8 payments, NOT QUALIFIED) ──
    { id: 59, employee_number: '5123890', payment_month: 1, date_of_deduction: new Date('2024-03-31'), payment_with_interest: 280.00, principal_payments: 1324.17, paid_status: true,  monthly_payment_amount: 1604.17, paid_months: 1, balance: 68695.83 },
    { id: 60, employee_number: '5123890', payment_month: 2, date_of_deduction: new Date('2024-04-30'), payment_with_interest: 274.78, principal_payments: 1329.39, paid_status: true,  monthly_payment_amount: 1604.17, paid_months: 2, balance: 67366.44 },
    { id: 61, employee_number: '5123890', payment_month: 3, date_of_deduction: new Date('2024-05-31'), payment_with_interest: 269.47, principal_payments: 1334.70, paid_status: true,  monthly_payment_amount: 1604.17, paid_months: 3, balance: 66031.74 },
    { id: 62, employee_number: '5123890', payment_month: 4, date_of_deduction: new Date('2024-06-30'), payment_with_interest: 264.13, principal_payments: 1340.04, paid_status: false, monthly_payment_amount: 0,       paid_months: 4, balance: 66031.74 },
    { id: 63, employee_number: '5123890', payment_month: 5, date_of_deduction: new Date('2024-07-31'), payment_with_interest: 264.13, principal_payments: 1340.04, paid_status: false, monthly_payment_amount: 0,       paid_months: 5, balance: 66031.74 },
    { id: 64, employee_number: '5123890', payment_month: 6, date_of_deduction: new Date('2024-08-31'), payment_with_interest: 253.56, principal_payments: 1350.61, paid_status: true,  monthly_payment_amount: 1604.17, paid_months: 6, balance: 64681.13 },
    { id: 65, employee_number: '5123890', payment_month: 7, date_of_deduction: new Date('2024-09-30'), payment_with_interest: 258.72, principal_payments: 1345.45, paid_status: true,  monthly_payment_amount: 1604.17, paid_months: 7, balance: 59835.68 },
    { id: 66, employee_number: '5123890', payment_month: 8, date_of_deduction: new Date('2024-10-31'), payment_with_interest: 239.34, principal_payments: 1364.83, paid_status: true,  monthly_payment_amount: 1604.17, paid_months: 8, balance: 57750.12 },

    // ── Emp 5234502 AQUINO (31 payments) ──
    { id: 67, employee_number: '5234502', payment_month: 1,  date_of_deduction: new Date('2022-07-31'), payment_with_interest: 440.00, principal_payments: 1693.33, paid_status: true, monthly_payment_amount: 2133.33, paid_months: 1,  balance: 108306.67 },
    { id: 68, employee_number: '5234502', payment_month: 15, date_of_deduction: new Date('2023-09-30'), payment_with_interest: 340.00, principal_payments: 1793.33, paid_status: true, monthly_payment_amount: 2133.33, paid_months: 15, balance: 78199.95 },
    { id: 69, employee_number: '5234502', payment_month: 31, date_of_deduction: new Date('2025-01-31'), payment_with_interest: 210.00, principal_payments: 1923.33, paid_status: true, monthly_payment_amount: 2133.33, paid_months: 31, balance: 40533.27 },

    // ── Emp 5345217 PASCUAL (5 payments) ──
    { id: 70, employee_number: '5345217', payment_month: 1, date_of_deduction: new Date('2024-05-31'), payment_with_interest: 260.00, principal_payments: 1684.44, paid_status: true, monthly_payment_amount: 1944.44, paid_months: 1, balance: 63315.56 },
    { id: 71, employee_number: '5345217', payment_month: 3, date_of_deduction: new Date('2024-07-31'), payment_with_interest: 247.00, principal_payments: 1697.44, paid_status: true, monthly_payment_amount: 1944.44, paid_months: 3, balance: 59932.68 },
    { id: 72, employee_number: '5345217', payment_month: 5, date_of_deduction: new Date('2024-09-30'), payment_with_interest: 234.00, principal_payments: 1710.44, paid_status: true, monthly_payment_amount: 1944.44, paid_months: 5, balance: 54722.36 },

    // ── Discharged: 3891045 CRUZ (24 payments – fully paid) ──
    { id: 73, employee_number: '3891045', payment_month: 1,  date_of_deduction: new Date('2020-02-29'), payment_with_interest: 120.00, principal_payments: 1255.00, paid_status: true, monthly_payment_amount: 1375.00, paid_months: 1,  balance: 28745.00 },
    { id: 74, employee_number: '3891045', payment_month: 12, date_of_deduction: new Date('2021-01-31'), payment_with_interest: 65.00,  principal_payments: 1310.00, paid_status: true, monthly_payment_amount: 1375.00, paid_months: 12, balance: 14300.00 },
    { id: 75, employee_number: '3891045', payment_month: 24, date_of_deduction: new Date('2022-01-31'), payment_with_interest: 5.50,   principal_payments: 1369.50, paid_status: true, monthly_payment_amount: 1375.00, paid_months: 24, balance: 0.00 },

    // ── Discharged: 3902367 NAVARRO (36 payments – fully paid) ──
    { id: 76, employee_number: '3902367', payment_month: 1,  date_of_deduction: new Date('2018-07-31'), payment_with_interest: 180.00, principal_payments: 1195.00, paid_status: true, monthly_payment_amount: 1375.00, paid_months: 1,  balance: 43805.00 },
    { id: 77, employee_number: '3902367', payment_month: 18, date_of_deduction: new Date('2019-12-31'), payment_with_interest: 95.00,  principal_payments: 1280.00, paid_status: true, monthly_payment_amount: 1375.00, paid_months: 18, balance: 22500.00 },
    { id: 78, employee_number: '3902367', payment_month: 36, date_of_deduction: new Date('2021-06-30'), payment_with_interest: 5.50,   principal_payments: 1369.50, paid_status: true, monthly_payment_amount: 1375.00, paid_months: 36, balance: 0.00 },

    // ── Discharged: 4013489 SALAZAR (24 payments – fully paid) ──
    { id: 79, employee_number: '4013489', payment_month: 1,  date_of_deduction: new Date('2019-04-30'), payment_with_interest: 100.00, principal_payments: 1045.83, paid_status: true, monthly_payment_amount: 1145.83, paid_months: 1,  balance: 23954.17 },
    { id: 80, employee_number: '4013489', payment_month: 12, date_of_deduction: new Date('2020-03-31'), payment_with_interest: 52.00,  principal_payments: 1093.83, paid_status: true, monthly_payment_amount: 1145.83, paid_months: 12, balance: 11558.34 },
    { id: 81, employee_number: '4013489', payment_month: 24, date_of_deduction: new Date('2021-03-31'), payment_with_interest: 4.58,   principal_payments: 1141.25, paid_status: true, monthly_payment_amount: 1145.83, paid_months: 24, balance: 0.00 },
  ],

  auditLogs: [],
};

// ── MockDB class ────────────────────────────────────────────────────────────
class MockDB {
  constructor() {
    this.data = JSON.parse(JSON.stringify(mockData)); // deep copy
    // Restore Date objects lost during JSON serialization
    this.data.loans.forEach((l) => {
      ['loan_application_date', 'effective_date', 'termination_date', 'check_date', 'created_at'].forEach((f) => {
        if (l[f]) l[f] = new Date(l[f]);
      });
    });
    this.data.ledgerCards.forEach((e) => {
      if (e.date_of_deduction) e.date_of_deduction = new Date(e.date_of_deduction);
    });
    this.data.employees.forEach((e) => {
      if (e.created_at) e.created_at = new Date(e.created_at);
    });
  }

  // ── direct array accessors ──
  get employees()  { return this.data.employees; }
  get loans()      { return this.data.loans; }
  get ledger()     { return this.data.ledgerCards; }

  // ── admin ──
  findAdmin(username) {
    return this.data.admins.find((a) => a.username === username);
  }

  // ── employees ──
  getAllEmployees() { return this.data.employees; }

  findEmployeeByNumber(empNumber) {
    return this.data.employees.find((e) => e.employee_number === empNumber);
  }

  findEmployeesByName(firstName, lastName) {
    return this.data.employees.filter((e) => {
      if (firstName && !e.first_name.toLowerCase().includes(firstName.toLowerCase())) return false;
      if (lastName  && !e.last_name.toLowerCase().includes(lastName.toLowerCase()))  return false;
      return true;
    });
  }

  // ── loans ──
  getAllLoans() { return this.data.loans; }

  findLoanByEmployeeNumber(empNumber) {
    return this.data.loans.find((l) => l.employee_number === empNumber);
  }

  // ── ledger ──
  getLedgerByEmployeeNumber(empNumber) {
    return this.data.ledgerCards.filter((l) => l.employee_number === empNumber);
  }

  // ── audit ──
  logAudit(adminId, action, entityType, entityId, oldValues, newValues) {
    this.data.auditLogs.push({
      id: this.data.auditLogs.length + 1,
      admin_id: adminId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_values: oldValues,
      new_values: newValues,
      created_at: new Date(),
    });
  }
}

module.exports = new MockDB();
