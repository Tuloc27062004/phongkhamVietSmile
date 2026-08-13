# SQL Migrations Guide - Clinic Flow Phases 3-7

**Environment Variables Updated:**
- Client: `SUPABASE_PUBLISHABLE_KEY_2` (was `SUPABASE_PUBLISHABLE_KEY`)
- Server: `sercet` (was `SUPABASE_SERVICE_ROLE_KEY`)

## Phase 3: Attendance & Timekeeping System
**File:** `supabase/migrations/20260805090000_phase_3_attendance.sql`

**Tables Created:**
1. `attendance_records` - Daily check-in/check-out records with computed attendance metrics
2. `attendance_adjustments` - Manual adjustments to attendance records (excuses, manual entries)
3. `attendance_summary` - Cached monthly attendance summaries for performance

**Features:**
- Track employee attendance with late/early leave minutes
- Compute overtime and work duration
- Store device check-in times vs manual adjustments
- Monthly summary for payroll calculations
- Full RLS with employee and manager access

---

## Phase 4: Device Synchronization & Agent
**File:** `supabase/migrations/20260805091000_phase_4_device_sync.sql`

**Tables Created:**
1. `device_configs` - Device connection settings (IP, port, credentials)
2. `device_sync_logs` - Historical sync logs with import statistics
3. `device_sync_mappings` - Map device user IDs to employee records

**Features:**
- Configure biometric device connections (ZKTeco, Hikvision)
- Track sync operations (imported, skipped, failed records)
- Map device user IDs to employees
- Record sync errors and status
- Test connection functionality
- Auto-sync scheduling support

---

## Phase 5: Appointment & Scheduling System
**File:** `supabase/migrations/20260805092000_phase_5_appointments.sql`

**Tables Created:**
1. `services` - Dental services/procedures offered
2. `patients` - Patient profiles with contact and medical info
3. `appointments` - Appointment bookings with status tracking
4. `appointment_reminders` - Reminder scheduling (SMS, email, WhatsApp)

**Features:**
- Service catalog with duration and appointment capability
- Patient database with insurance info and medical notes
- Appointment scheduling with confirmation workflow
- Automatic reminder generation
- Multi-channel reminder support
- Cancellation tracking

---

## Phase 6: Reporting & Analytics
**File:** `supabase/migrations/20260805093000_phase_6_reports.sql`

**Tables Created:**
1. `report_configs` - Saved report configurations
2. `generated_reports` - Generated report files and metadata
3. `export_logs` - History of data exports
4. `kpi_metrics` - Key Performance Indicators tracking

**Features:**
- Create custom report templates
- Schedule automated report generation
- Export to multiple formats (Excel, CSV, PDF)
- Track export history
- Calculate KPI metrics (attendance rate, punctuality, etc.)
- Email report distribution

---

## Phase 7: Finalization & System Enhancements
**File:** `supabase/migrations/20260805094000_phase_7_finalization.sql`

**Tables Created:**
1. `notifications` - In-app notification system
2. `system_backups` - Database backup tracking
3. `system_events` - Audit trail for all system actions
4. `notification_templates` - SMS/Email/WhatsApp message templates
5. `api_keys` - API authentication for integrations
6. `integration_logs` - Third-party system sync logs

**Features:**
- Real-time notifications for users
- Automatic backup scheduling
- Complete audit logging
- Configurable message templates
- API key management
- Integration error tracking

---

## Migration Order

Execute migrations in this order (already timestamped correctly):

1. **Phase 1** (Already applied)
   - Foundation, auth, permissions, clinic profile
   
2. **Phase 2** (Already applied)
   - Departments, positions, shifts, employees

3. **Phase 3** → `20260805090000_phase_3_attendance.sql`
   - Attendance tracking system

4. **Phase 4** → `20260805091000_phase_4_device_sync.sql`
   - Device synchronization

5. **Phase 5** → `20260805092000_phase_5_appointments.sql`
   - Appointment scheduling

6. **Phase 6** → `20260805093000_phase_6_reports.sql`
   - Reporting and analytics

7. **Phase 7** → `20260805094000_phase_7_finalization.sql`
   - System finalization and enhancements

---

## Key Design Principles

### Security (RLS)
- All tables have Row Level Security enabled
- Managers can see all organization data
- Employees see only their own records
- Administrators have full access

### Performance
- Indexed all common query patterns
- Monthly summaries cache expensive calculations
- Separate logs tables for audit trail
- Foreign key relationships properly constrained

### Scalability
- Soft deletes with `deleted_at` timestamps
- Organization isolation for multi-tenant support
- Normalized schemas avoiding data duplication
- Efficient indexes for date and status queries

### Auditability
- `created_at` and `updated_at` on all tables
- Automatic trigger-based timestamp updates
- Audit logs for all changes
- System event tracking

---

## Environment Variables Setup

Update your Supabase credentials in:
- **Client:** Set `SUPABASE_PUBLISHABLE_KEY_2`
- **Server:** Set `sercet` (service role key)
- **URL:** `SUPABASE_URL` (same as before)

Files updated:
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/client.server.ts`

---

## SQL Paste Instructions

1. Go to Supabase SQL Editor
2. Create new query
3. Copy and paste each migration SQL file
4. Execute in order (Phase 3 → 7)
5. Verify all tables created successfully

---

## Post-Migration Checklist

- [ ] All 7 phases executed successfully
- [ ] Environment variables set (SUPABASE_PUBLISHABLE_KEY_2, sercet)
- [ ] App starts without errors
- [ ] Dashboard shows phase completion status
- [ ] Run test queries on new tables
- [ ] Verify RLS policies are working
- [ ] Check indexes are created

---

## Table Statistics After Full Deploy

**Total Tables Created:** 28
**Total Indexes:** 25+
**Total Functions:** Helper functions for RLS
**Total Policies:** ~50 RLS policies across all tables

---

## Support & Troubleshooting

If migrations fail:
1. Check Supabase logs for detailed errors
2. Verify environment variables are set
3. Ensure service role key has admin permissions
4. Run each phase independently
5. Check for foreign key constraint violations
