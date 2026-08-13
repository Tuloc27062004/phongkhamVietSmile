# Paste SQL Migrations in This Order

## Instructions
1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy and paste each SQL block below in order
4. Click "Run" for each one
5. Wait for success before proceeding to next

---

## PHASE 3: ATTENDANCE SYSTEM

**File to paste:** `/supabase/migrations/20260805090000_phase_3_attendance.sql`

Content includes:
- `attendance_records` table
- `attendance_adjustments` table  
- `attendance_summary` table
- RLS policies and indexes

**Status:** Ready to paste ✓

---

## PHASE 4: DEVICE SYNCHRONIZATION

**File to paste:** `/supabase/migrations/20260805091000_phase_4_device_sync.sql`

Content includes:
- `device_configs` table
- `device_sync_logs` table
- `device_sync_mappings` table
- RLS policies and indexes

**Status:** Ready to paste ✓

---

## PHASE 5: APPOINTMENTS & SCHEDULING

**File to paste:** `/supabase/migrations/20260805092000_phase_5_appointments.sql`

Content includes:
- `services` table
- `patients` table
- `appointments` table
- `appointment_reminders` table
- RLS policies and indexes

**Status:** Ready to paste ✓

---

## PHASE 6: REPORTING & ANALYTICS

**File to paste:** `/supabase/migrations/20260805093000_phase_6_reports.sql`

Content includes:
- `report_configs` table
- `generated_reports` table
- `export_logs` table
- `kpi_metrics` table
- RLS policies and indexes

**Status:** Ready to paste ✓

---

## PHASE 7: FINALIZATION & ENHANCEMENTS

**File to paste:** `/supabase/migrations/20260805094000_phase_7_finalization.sql`

Content includes:
- `notifications` table
- `system_backups` table
- `system_events` table
- `notification_templates` table
- `api_keys` table
- `integration_logs` table
- RLS policies and indexes

**Status:** Ready to paste ✓

---

## Verification

After pasting all migrations, verify in Supabase SQL:

```sql
-- Check all tables created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Should show all Phase 1-7 tables
```

Expected count: 28 total tables

---

## Environment Variables

After migrations, update in project settings:
- `SUPABASE_PUBLISHABLE_KEY_2` (Client key)
- `sercet` (Service role key)

Files updated in code:
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/client.server.ts`

---

## Troubleshooting Common Errors

**Error: "Key (organization_id) already exists"**
- Previous phase already ran successfully, skip to next

**Error: "Relation 'xxx' does not exist"**
- Previous phases may not have run, ensure Phase 1-2 complete first

**Error: "Foreign key violation"**
- Check organization_id values exist in the seed data

**Error: "Permission denied"**
- Ensure using service role key, not public key

---

## Next Steps After SQL Complete

1. ✓ Run all SQL migrations (this guide)
2. ✓ Update environment variables (SUPABASE_PUBLISHABLE_KEY_2, sercet)
3. → Build UI components for each phase
4. → Deploy to production
5. → Update dashboard phase indicators

---

## File Locations

All SQL files are in: `/supabase/migrations/`

Files:
- `20260805090000_phase_3_attendance.sql`
- `20260805091000_phase_4_device_sync.sql`
- `20260805092000_phase_5_appointments.sql`
- `20260805093000_phase_6_reports.sql`
- `20260805094000_phase_7_finalization.sql`
