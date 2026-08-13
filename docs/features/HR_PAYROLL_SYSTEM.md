# 🏢 Complete HR & Payroll Management System

## Overview

Clinic Flow now has a **Complete HR & Payroll System** with:
- ✅ Department Assignment Management
- ✅ Shift & Schedule Management
- ✅ Automatic Salary Calculation
- ✅ Late Deduction System
- ✅ Absence Deduction System
- ✅ Insurance & Tax Deductions
- ✅ Real-Time Payroll Processing
- ✅ Monthly Payroll Reports

---

## 📋 System Components

### 1. Assignment Management (`/hr/assignments`)

**Purpose**: Manage employee department, shift, and position assignments

**Features**:
- 👥 View all active employees
- 🏢 Assign to departments
- 📅 Assign work shifts (with time display)
- 💼 Assign positions/roles
- ✏️ Edit assignments with modal dialogs
- 📊 Statistics dashboard

**Automatic Setup**:
- Shows unassigned employees in red
- Validates all assignments required
- Prevents incomplete assignments
- Tracks assignment history

**Real-Time Sync**:
- Immediate table updates after save
- Live employee list filtering
- Department availability tracking

---

### 2. Salary Management (`/hr/salary`)

**Purpose**: Configure and manage employee salaries

**Features**:
- 💰 Base Salary Configuration
- 📈 Allowances Setup
- 🎁 Bonus Management
- 📉 Automatic Deductions
- 🔧 Edit salary components
- 📊 Real-time totals calculation

**Salary Components**:
- **Base Salary**: Core monthly salary
- **Allowances**: Performance/responsibility bonuses
- **Bonus**: Monthly/ad-hoc bonuses
- **Late Deduction**: Auto-calculated from attendance
- **Absence Deduction**: Auto-calculated from absence
- **Insurance**: 10% automatic deduction

**Calculation**:
```
Net Salary = Base + Allowance + Bonus - Late - Absence - Insurance
```

**Features**:
- 📊 Filter by department and status
- 🔍 Search employees
- 📈 View statistics (total payroll, deductions)
- ✏️ Inline editing of salary components

---

### 3. Payroll Processing (`/hr/payroll`)

**Purpose**: Calculate monthly payroll automatically

**Features**:
- 🔄 Automatic calculation from attendance
- 📅 Select month and year
- 📊 Detailed breakdown per employee
- ✅ Approve/finalize payroll
- 📥 Export payroll reports
- 🔍 Search and filter

**Automatic Calculations**:
- **Late Days**: From attendance_records (late_minutes > 15)
- **Absent Days**: Count of absent status
- **Worked Days**: Count of present status
- **Late Deduction**: (Base / 26 / 8 / 60) × late_minutes
- **Absence Deduction**: Base / 26 per day
- **Insurance**: Base × 10%
- **Net Salary**: Base - All Deductions

**Status Tracking**:
- Pending: Initial state
- Calculated: Automatic calculation done
- Approved: Reviewed and approved
- Paid: Payment processed

---

## 🗄️ Database Schema

### Employees Table
```sql
employees:
  - id (UUID)
  - employee_code (TEXT)
  - full_name (TEXT)
  - email (TEXT)
  - department_id (FK)
  - shift_id (FK)
  - position_id (FK)
  - start_date (DATE)
  - employment_status (active/probation/on_leave/suspended/terminated)
  - deleted_at (TIMESTAMP) - soft delete
```

### Salary Config Table
```sql
salary_config:
  - id (UUID)
  - employee_id (FK)
  - base_salary (DECIMAL)
  - allowance (DECIMAL)
  - bonus (DECIMAL)
  - late_deduction (DECIMAL) - auto-calculated
  - absence_deduction (DECIMAL) - auto-calculated
  - insurance_deduction (DECIMAL) - 10% of base
  - updated_at (TIMESTAMP)
```

### Payroll Records Table
```sql
payroll_records:
  - id (UUID)
  - employee_id (FK)
  - month (INTEGER 1-12)
  - year (INTEGER)
  - worked_days (INTEGER)
  - late_days (INTEGER)
  - absent_days (INTEGER)
  - base_salary (DECIMAL)
  - late_deduction (DECIMAL)
  - absence_deduction (DECIMAL)
  - insurance (DECIMAL)
  - net_salary (DECIMAL)
  - status (pending/calculated/approved/paid)
  - approved_at (TIMESTAMP)
```

---

## 🔐 Automatic Late Deduction System

### How It Works

1. **Attendance Recording**:
   ```sql
   -- When employee checks in late
   INSERT INTO attendance_records
   VALUES (..., late_minutes = 45, ...);
   ```

2. **Payroll Calculation**:
   ```typescript
   if (lateMinutes > 15) {
     late_days++;
     lateDeduction = (baseSalary / 26 / 8 / 60) * lateMinutes;
   }
   ```

3. **Formula Breakdown**:
   - `baseSalary / 26` = Daily wage (26 working days/month)
   - `/ 8` = Hourly wage (8 hours/day)
   - `/ 60` = Per-minute wage
   - `× lateMinutes` = Total deduction for late

### Example Calculation
```
Base Salary: 10,000,000 VND
Daily Rate: 10,000,000 / 26 = 384,615 VND
Hourly Rate: 384,615 / 8 = 48,076 VND
Per-Minute Rate: 48,076 / 60 = 801 VND

Employee arrives 45 minutes late:
Deduction = 801 × 45 = 36,045 VND
```

---

## 📊 Automatic Absence Deduction

### How It Works

1. **Mark Absence**:
   ```sql
   UPDATE attendance_records 
   SET attendance_status = 'absent' 
   WHERE work_date = '2024-01-15';
   ```

2. **Calculate Deduction**:
   ```typescript
   if (attendanceStatus === 'absent') {
     absentDays++;
     absenceDeduction = baseSalary / 26; // Full day deduction
   }
   ```

### Formula
```
Absence Deduction = Base Salary / 26 (per absent day)
```

### Example
```
Base Salary: 10,000,000 VND
Absent Days: 2
Deduction: (10,000,000 / 26) × 2 = 769,230 VND
```

---

## 💼 Automatic Insurance Deduction

### How It Works
```typescript
insurance = baseSalary × 0.10; // 10% automatic
```

### Components
- Health Insurance: 3-5%
- Social Insurance: 4-5%
- Unemployment Insurance: 0.5-1%

**Total**: ~10% of base salary

---

## 🔄 Complete Payroll Workflow

```
┌─────────────────────────────────────────────────┐
│ 1. ATTENDANCE RECORDING                         │
│    • Employee checks in/out daily              │
│    • System records time and late minutes      │
│    • Biometric/Manual entries stored           │
└────────────┬────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────┐
│ 2. MONTHLY AGGREGATION                         │
│    • Collect all attendance for month          │
│    • Calculate worked days, late days, etc.    │
│    • Count absences                            │
└────────────┬────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────┐
│ 3. AUTOMATIC CALCULATION                       │
│    • Late Deduction = (Base/26/8/60) × mins   │
│    • Absence Deduction = Base / 26 × days     │
│    • Insurance = Base × 10%                    │
│    • Net = Base + Allowance + Bonus - Ded.    │
└────────────┬────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────┐
│ 4. REVIEW & APPROVAL                           │
│    • HR reviews calculated payroll             │
│    • Can adjust if needed                      │
│    • Approve final amounts                     │
└────────────┬────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────┐
│ 5. PAYMENT PROCESSING                          │
│    • Generate payment transfers                │
│    • Bank reconciliation                       │
│    • Tax reporting                             │
└─────────────────────────────────────────────────┘
```

---

## 🎯 Key Features

### Assignment Management
- ✅ Bulk assignment updates
- ✅ Shift change tracking
- ✅ Department transfer history
- ✅ Position upgrade/change logging
- ✅ Effective date scheduling

### Salary Management
- ✅ Component-based salary structure
- ✅ Multiple allowance types
- ✅ Bonus management
- ✅ Deduction tracking
- ✅ Annual salary increases

### Payroll Processing
- ✅ Automatic calculation
- ✅ Manual override capability
- ✅ Approval workflow
- ✅ Payment status tracking
- ✅ Audit trail logging

### Reporting
- ✅ Monthly payroll reports
- ✅ Deduction analysis
- ✅ Employee salary summaries
- ✅ Department payroll totals
- ✅ Tax reporting ready

---

## 📊 Statistics Dashboard

Each page displays real-time statistics:

**Assignment Page**:
- Total Employees
- Assigned Count
- Unassigned Count

**Salary Page**:
- Total Employees
- Total Payroll
- Total Deductions

**Payroll Page**:
- Total Employees
- Total Salary
- Total Deductions
- Total Net Salary

---

## 🔍 Filtering & Search

### Salary Management
- Search by name or employee code
- Filter by department
- Filter by employment status
- View specific period

### Assignment Management
- Search by name or code
- View all/assigned/unassigned
- Department-specific view
- Status-based filtering

### Payroll Processing
- Search by name or code
- Monthly view
- Year selection
- Status filtering

---

## 📱 Responsive Design

### Mobile View
- Single column layout
- Touch-friendly buttons
- Horizontal scroll for tables
- Collapsible sections

### Tablet View
- 2-column layout
- Optimized spacing
- Touch and mouse support

### Desktop View
- Full multi-column layout
- Advanced filtering
- Detailed statistics
- Print-friendly

---

## 🔐 Security & Permissions

### Role-Based Access
- **Admin**: Full access to all HR functions
- **Manager**: Can view and manage assignments, view payroll
- **HR**: Full salary and payroll access
- **Employee**: Can view own salary (read-only)

### Audit Trail
- All changes logged
- Timestamp on every action
- User tracking
- Before/after values recorded

---

## 🚀 Performance Optimization

### Database Indexes
- Employee ID indexing
- Department/shift queries
- Date range searches
- Status filtering

### Caching
- React Query caching
- Real-time invalidation
- Optimistic updates

### Calculations
- Server-side computation
- Batch processing
- Scheduled jobs ready

---

## 📈 Usage Scenarios

### Scenario 1: New Employee Onboarding
```
1. Create Employee Record
2. Go to /hr/assignments
3. Select department
4. Select shift
5. Select position
6. Go to /hr/salary
7. Configure base salary
8. System automatically ready for attendance
```

### Scenario 2: Late Arrival Processing
```
1. Employee checks in 30 minutes late
2. System records: late_minutes = 30
3. Monthly payroll calculates deduction
4. Formula: (10,000,000 / 26 / 8 / 60) × 30 = 24,038 VND
5. Deduction shown in payroll report
6. Employee sees in salary stub
```

### Scenario 3: Absent Day Processing
```
1. Employee marked absent (manual or auto)
2. Status: absent recorded
3. Payroll calculation includes:
   Absence Deduction = 10,000,000 / 26 = 384,615 VND
4. Shown in monthly payroll
5. Can be adjusted by HR if needed
```

### Scenario 4: Monthly Payroll
```
1. Go to /hr/payroll
2. Select Month (e.g., January)
3. Select Year (2024)
4. System calculates:
   - All late deductions
   - All absence deductions
   - Insurance (10%)
   - Net salary = Base + Allowance - Deductions
5. Review statistics
6. Approve final amounts
7. Generate payment file
```

---

## 🛠️ Configuration

### Working Days per Month
- Default: 26 days
- Configurable in settings
- Affects daily rate calculation

### Insurance Rate
- Default: 10%
- Can vary by company policy
- Applied to all employees

### Late Threshold
- Default: 15 minutes
- After 15 mins = deduction applies
- Before 15 mins = no deduction

### Absence Rules
- Full day deduction = Base / 26
- Can be overridden for special cases
- Tracked separately for reporting

---

## ✅ Testing Checklist

- [x] Department assignments work
- [x] Shift assignments display correctly
- [x] Position changes save
- [x] Salary calculations accurate
- [x] Late deduction formula correct
- [x] Absence deduction correct
- [x] Insurance 10% calculated
- [x] Payroll aggregation works
- [x] Monthly selection functions
- [x] Approval workflow operational
- [x] Export functionality ready
- [x] Mobile responsive
- [x] Real-time updates
- [x] Filtering accurate
- [x] Search working

---

## 🚀 Deployment

### Prerequisites
- Supabase PostgreSQL database
- All tables created (salary_config, payroll_records)
- Indexes created for performance
- RLS policies configured

### Environment Variables
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY_2=your_key
sercet=your_service_role_key
```

### Database Setup
```sql
-- Create salary_config table
CREATE TABLE salary_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id),
  base_salary DECIMAL(12,2),
  allowance DECIMAL(12,2),
  bonus DECIMAL(12,2),
  late_deduction DECIMAL(12,2),
  absence_deduction DECIMAL(12,2),
  insurance_deduction DECIMAL(12,2),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id)
);

-- Create payroll_records table
CREATE TABLE payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id),
  month INT,
  year INT,
  worked_days INT,
  late_days INT,
  absent_days INT,
  base_salary DECIMAL(12,2),
  late_deduction DECIMAL(12,2),
  absence_deduction DECIMAL(12,2),
  insurance DECIMAL(12,2),
  net_salary DECIMAL(12,2),
  status TEXT DEFAULT 'pending',
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, month, year)
);
```

---

## 📞 Support & Troubleshooting

### Common Issues

**Salary Not Calculating Correctly**
- Check attendance records for the month
- Verify employee has salary_config entry
- Check late_minutes values in attendance

**Late Deduction Not Applying**
- Verify attendance status is "present" (not manual)
- Check if late_minutes > 15
- Confirm base salary is set

**Absence Deduction Issues**
- Check attendance_status = 'absent'
- Verify payroll is recalculated
- Look for manual overrides

**Assignment Not Showing**
- Confirm employee status is "active"
- Check soft delete (deleted_at is null)
- Verify department/shift exist

---

## 🎯 Next Steps

1. ✅ Configure salary structure
2. ✅ Assign all employees to departments/shifts
3. ✅ Set base salaries
4. ✅ Monitor first payroll cycle
5. ✅ Adjust deduction rates if needed
6. ✅ Set up automatic pay day processing
7. ✅ Generate monthly reports

---

**Status**: ✅ Production Ready
**Version**: 1.0 Complete
**Last Updated**: August 5, 2026
**Quality**: Enterprise Grade

