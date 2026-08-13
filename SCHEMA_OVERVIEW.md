# Complete Database Schema Overview

## All Phases (1-7) Complete Schema

### PHASE 1: Foundation & Authentication (✓ Complete)

```
organizations
├── id (UUID, PK)
├── name
├── slug (unique)
├── is_default
└── timestamps

user_profiles
├── id (FK: auth.users)
├── organization_id (FK)
├── full_name
├── email, phone
├── avatar_url
└── timestamps

user_roles
├── id
├── user_id (FK)
├── organization_id (FK)
├── role (enum: administrator, manager, receptionist, employee)
└── timestamps

clinic_profiles
├── id
├── organization_id (unique FK)
├── name, short_name, legal_name
├── logo_url, favicon_url, cover_url
├── address, ward, district, city
├── phone, hotline, appointment_phone
├── website, facebook, zalo
├── working_hours, lunch_break
├── weekly_days_off, tax_code
├── timezone, language, date_format
├── policies (reminder, attendance, overtime)
└── timestamps

app_settings
├── id
├── organization_id (FK)
├── group_key, setting_key
├── value (JSONB)
└── timestamps

audit_logs
├── id
├── organization_id (FK)
├── user_id (FK)
├── action, entity_type, entity_id
├── previous_values, new_values (JSONB)
├── ip_address, user_agent
└── created_at
```

---

### PHASE 2: HR Management (✓ Complete)

```
departments
├── id
├── organization_id (FK)
├── name, code, description
├── display_order
├── is_active, deleted_at
└── timestamps

positions
├── id
├── organization_id (FK)
├── department_id (FK)
├── name, description
├── can_receive_appointments
├── display_order
├── is_active, deleted_at
└── timestamps

shifts
├── id
├── organization_id (FK)
├── name, code
├── start_time, end_time
├── break_start, break_end
├── paid_break
├── grace_period_minutes
├── overtime_threshold_minutes
├── min_overtime_minutes
├── crosses_midnight
├── working_days (int array)
├── is_active, deleted_at
├── UNIQUE (organization_id, code)
└── timestamps

employees
├── id
├── organization_id (FK)
├── user_id (FK: auth.users)
├── employee_code (unique)
├── device_user_id
├── full_name, preferred_name
├── gender, date_of_birth
├── phone, email, address
├── avatar_url
├── emergency_contact_*
├── department_id (FK)
├── position_id (FK)
├── employment_type (enum)
├── employment_status (enum)
├── start_date, probation_end_date
├── contract_start_date, contract_end_date
├── default_shift_id (FK)
├── manager_id (FK: self-reference)
├── professional_title, license_number
├── license_expiry_date, specialization
├── years_of_experience
├── can_receive_appointments
├── appointment_display_name
├── UNIQUE (organization_id, employee_code)
└── timestamps
```

---

### PHASE 3: Attendance & Timekeeping (→ To Deploy)

```
attendance_records
├── id
├── organization_id (FK)
├── employee_id (FK)
├── work_date
├── shift_id (FK)
├── check_in_time, check_out_time
├── device_check_in_time, device_check_out_time
├── late_minutes, early_leave_minutes
├── overtime_minutes
├── paid_break_minutes, unpaid_break_minutes
├── worked_minutes
├── attendance_status (enum)
├── is_approved
├── approval_notes
├── UNIQUE (organization_id, employee_id, work_date)
└── timestamps

attendance_adjustments
├── id
├── organization_id (FK)
├── employee_id (FK)
├── attendance_id (FK)
├── adjustment_type
├── reason, adjusted_value
├── requested_by (FK: auth.users)
├── approved_by (FK: auth.users)
├── status (pending, approved, rejected)
└── timestamps

attendance_summary
├── id
├── organization_id (FK)
├── employee_id (FK)
├── year, month
├── total_working_days, present_days
├── absent_days, leave_days, holiday_days
├── sick_days
├── late_count, early_leave_count
├── total_overtime_minutes, total_worked_minutes
├── UNIQUE (organization_id, employee_id, year, month)
└── computed_at, updated_at
```

---

### PHASE 4: Device Synchronization (→ To Deploy)

```
device_configs
├── id
├── organization_id (unique FK)
├── device_ip_address, device_port
├── device_username, device_password_encrypted
├── connection_method (network, usb, api)
├── device_type (zkteco, hikvision, other)
├── sync_interval_minutes
├── auto_sync_enabled
├── last_sync_time
├── is_connected
├── last_test_time, test_result
└── timestamps

device_sync_logs
├── id
├── organization_id (FK)
├── sync_type (initial, incremental, full_resync)
├── status (started, completed, failed)
├── error_message
├── records_found, records_imported
├── records_skipped, records_failed
├── started_at, completed_at
├── duration_seconds
└── created_at

device_sync_mappings
├── id
├── organization_id (FK)
├── device_user_id
├── employee_id (FK)
├── is_active
├── last_sync_time
├── sync_status (pending, synced, error)
├── UNIQUE (organization_id, device_user_id)
└── timestamps
```

---

### PHASE 5: Appointments & Scheduling (→ To Deploy)

```
services
├── id
├── organization_id (FK)
├── name, code, description
├── category
├── default_duration_minutes
├── requires_professional
├── can_reserve_slot
├── display_order
├── is_active, deleted_at
└── timestamps

patients
├── id
├── organization_id (FK)
├── patient_code (unique)
├── full_name, phone, email
├── date_of_birth, gender, address
├── avatar_url
├── insurance_number, insurance_provider
├── medical_notes, allergies
├── first_visit_date, last_visit_date
├── is_active, deleted_at
└── timestamps

appointments
├── id
├── organization_id (FK)
├── patient_id (FK)
├── assigned_dentist_id (FK: employees)
├── service_id (FK)
├── appointment_date
├── start_time, end_time, duration_minutes
├── status (scheduled, confirmed, completed, cancelled)
├── confirmation_status
├── notes, treatment_notes
├── reminder_sent, reminder_sent_at
├── cancelled_at, cancellation_reason
└── timestamps

appointment_reminders
├── id
├── organization_id (FK)
├── appointment_id (FK)
├── reminder_type (sms, email, call, whatsapp)
├── send_hours_before
├── status (pending, sent, failed)
├── sent_at, error_message
└── timestamps
```

---

### PHASE 6: Reporting & Analytics (→ To Deploy)

```
report_configs
├── id
├── organization_id (FK)
├── report_name, report_type
├── description
├── filter_settings (JSONB)
├── columns (JSONB array)
├── schedule_enabled
├── schedule_frequency, schedule_day_*
├── schedule_hour, schedule_minute
├── email_recipients (text array)
├── is_active, deleted_at
└── timestamps

generated_reports
├── id
├── organization_id (FK)
├── report_config_id (FK)
├── report_name, report_type
├── data_rows
├── file_url, file_format
├── generated_by (FK: auth.users)
├── filters_applied (JSONB)
└── timestamps

export_logs
├── id
├── organization_id (FK)
├── export_type, export_format
├── file_name, file_size_bytes
├── file_url
├── rows_exported, errors
├── exported_by (FK: auth.users)
├── export_date_range (JSONB)
└── created_at

kpi_metrics
├── id
├── organization_id (FK)
├── metric_date
├── metric_type
├── employee_id (FK)
├── department_id (FK)
├── metric_value, target_value, variance
└── timestamps
```

---

### PHASE 7: Finalization & Enhancements (→ To Deploy)

```
notifications
├── id
├── organization_id (FK)
├── user_id (FK: auth.users)
├── notification_type
├── title, message
├── data (JSONB)
├── read_at, is_read
├── action_url, action_text
└── timestamps

system_backups
├── id
├── organization_id (FK)
├── backup_type, backup_scope
├── file_url, file_size_bytes
├── backup_status, error_message
├── triggered_by
├── backup_date, completed_at
├── next_backup_date
└── created_at

system_events
├── id
├── organization_id (FK)
├── event_type, event_category
├── severity (info, warning, error, critical)
├── actor_id (FK: auth.users)
├── actor_email
├── subject, description
├── affected_records, changes (JSONB)
├── source_ip, user_agent
└── created_at

notification_templates
├── id
├── organization_id (FK)
├── template_name, template_type
├── trigger_event
├── subject, body
├── variables (JSONB)
├── is_active
└── timestamps

api_keys
├── id
├── organization_id (FK)
├── key_name, key_hash (unique)
├── created_by (FK: auth.users)
├── last_used_at, expires_at
├── scopes (text array)
├── is_active
└── timestamps

integration_logs
├── id
├── organization_id (FK)
├── integration_name, integration_type
├── action, status
├── request_data, response_data (JSONB)
├── error_message
├── execution_time_ms
└── created_at
```

---

## Summary Statistics

| Phase | Tables | Indexes | Features |
|-------|--------|---------|----------|
| 1 | 5 | 3 | Auth, Org, Profiles, Settings |
| 2 | 4 | 2 | Departments, Positions, Shifts, Employees |
| 3 | 3 | 4 | Attendance, Adjustments, Summary |
| 4 | 3 | 4 | Device Configs, Sync Logs, Mappings |
| 5 | 4 | 6 | Services, Patients, Appointments, Reminders |
| 6 | 4 | 4 | Reports, Exports, KPIs |
| 7 | 6 | 5 | Notifications, Backups, Events, Templates, API, Logs |
| **Total** | **28** | **28** | **Complete System** |

---

## Key Relationships

```
Organization (root)
├── User Profiles
│   └── User Roles
├── Clinic Profile
├── Departments
│   ├── Positions
│   └── Employees
│       ├── Attendance Records
│       ├── Attendance Adjustments
│       └── Appointments
├── Shifts
│   └── Attendance Records
├── Services
│   └── Appointments
├── Patients
│   └── Appointments
│       └── Appointment Reminders
├── Device Configs
│   ├── Device Sync Logs
│   └── Device Sync Mappings
├── Report Configs
│   └── Generated Reports
└── Notification Templates
    └── Notifications
```

---

## Field Enums

**app_role**: administrator, manager, receptionist, employee

**employment_type**: full_time, part_time, contract, intern

**employment_status**: probation, active, on_leave, suspended, terminated

**appointment_status**: scheduled, confirmed, in_progress, completed, cancelled, no_show

**confirmation_status**: unconfirmed, confirmed, rejected

**backup_type**: full, incremental, selective

**notification_type**: sms, email, call, whatsapp

**event_severity**: info, warning, error, critical

---

## RLS Summary

✓ All tables have Row Level Security enabled
✓ Managers can see all org data
✓ Employees see own records + org public data
✓ Administrators have full access
✓ Service role bypasses RLS

---

Generated for: Nha khoa Việt Smile Clinic Suite
System: clinic-flow
Prepared: August 2026
