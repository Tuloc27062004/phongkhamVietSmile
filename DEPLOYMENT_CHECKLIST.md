# Clinic Flow Deployment Checklist

## Complete Phases 3-7 SQL Deployment

### Prerequisites ✓
- [x] Supabase project created and configured
- [x] Phase 1-2 migrations already deployed
- [x] Service role key available
- [x] All SQL files generated and ready to paste

---

## Step 1: SQL Migration Execution

Follow file: `PASTE_SQL_IN_ORDER.md`

### Phase 3: Attendance System
- [ ] Copy entire `20260805090000_phase_3_attendance.sql`
- [ ] Paste in Supabase SQL Editor
- [ ] Click "Run"
- [ ] Wait for success message
- [ ] Verify: 3 tables + 3 indexes created

### Phase 4: Device Synchronization
- [ ] Copy entire `20260805091000_phase_4_device_sync.sql`
- [ ] Paste in Supabase SQL Editor
- [ ] Click "Run"
- [ ] Wait for success message
- [ ] Verify: 3 tables + 3 indexes created

### Phase 5: Appointments & Scheduling
- [ ] Copy entire `20260805092000_phase_5_appointments.sql`
- [ ] Paste in Supabase SQL Editor
- [ ] Click "Run"
- [ ] Wait for success message
- [ ] Verify: 4 tables + 6 indexes created

### Phase 6: Reporting & Analytics
- [ ] Copy entire `20260805093000_phase_6_reports.sql`
- [ ] Paste in Supabase SQL Editor
- [ ] Click "Run"
- [ ] Wait for success message
- [ ] Verify: 4 tables + 4 indexes created

### Phase 7: Finalization & Enhancements
- [ ] Copy entire `20260805094000_phase_7_finalization.sql`
- [ ] Paste in Supabase SQL Editor
- [ ] Click "Run"
- [ ] Wait for success message
- [ ] Verify: 6 tables + 5 indexes created

---

## Step 2: Environment Variables Update

### Update Supabase Credentials

In your Vercel/Project Settings → Environment Variables:

```
SUPABASE_URL=your_supabase_url
SUPABASE_PUBLISHABLE_KEY_2=your_new_publishable_key
sercet=your_service_role_key
```

- [x] Code already updated in:
  - `src/integrations/supabase/client.ts` → uses `SUPABASE_PUBLISHABLE_KEY_2`
  - `src/integrations/supabase/client.server.ts` → uses `sercet`

---

## Step 3: Verify Database Schema

In Supabase SQL Editor, run:

```sql
-- Total tables check
SELECT COUNT(*) as table_count 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- Should show: 28 tables

-- List all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Verify Phase 3-7 tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN (
  'attendance_records', 'attendance_adjustments', 'attendance_summary',
  'device_configs', 'device_sync_logs', 'device_sync_mappings',
  'services', 'patients', 'appointments', 'appointment_reminders',
  'report_configs', 'generated_reports', 'export_logs', 'kpi_metrics',
  'notifications', 'system_backups', 'system_events', 'notification_templates',
  'api_keys', 'integration_logs'
);

-- Should show: 20 new tables
```

- [ ] Execute verification queries
- [ ] Confirm all 28 tables exist
- [ ] Confirm 20 new Phase 3-7 tables created

---

## Step 4: Verify RLS Policies

```sql
-- Check RLS enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Should show: all public tables have rowsecurity = true
```

- [ ] RLS enabled on all tables
- [ ] Policies not causing query errors

---

## Step 5: Test Application Startup

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Check for errors in console
```

- [ ] Application starts without errors
- [ ] No Supabase connection errors
- [ ] No RLS policy violations
- [ ] Dashboard loads successfully

---

## Step 6: Verify Data Access (RLS)

In Supabase SQL Editor, as authenticated user:

```sql
-- Test as authenticated user (should work)
SELECT * FROM public.attendance_records LIMIT 1;

-- Test as admin (should work)
SELECT * FROM public.device_configs LIMIT 1;
```

- [ ] Authenticated queries work
- [ ] RLS prevents unauthorized access
- [ ] Manager queries show org data
- [ ] Employee queries show only own data

---

## Step 7: Dashboard Phase Indicators

Update `src/routes/_authenticated/dashboard.tsx` to reflect completion:

Current roadmap:
```
Giai đoạn 1 ✓ Complete
Giai đoạn 2 ✓ Complete
Giai đoạn 3 → Attendance System
Giai đoạn 4 → Device Sync Agent
Giai đoạn 5-7 → Appointments, Reports, Finalization
```

After deployment:
```
Giai đoạn 1 ✓ Complete
Giai đoạn 2 ✓ Complete
Giai đoạn 3 ✓ Complete
Giai đoạn 4 ✓ Complete
Giai đoạn 5-7 ✓ Complete
```

- [ ] Dashboard updated (optional UI work)
- [ ] Phase indicators reflect current state

---

## Step 8: Database Backup

Before going to production:

```sql
-- In Supabase Dashboard:
-- → Backups → Create backup (manual)
-- → Confirm backup completed
```

- [ ] Create manual backup
- [ ] Note backup ID/timestamp
- [ ] Enable automated backups (recommended: daily)

---

## Step 9: Git Commit & Push

```bash
# Commit all changes
git add -A
git commit -m "Phase 3-7: Complete attendence, device sync, appointments, reports, and finalization

- Add 5 SQL migration files for phases 3-7
- Update Supabase client env vars (SUPABASE_PUBLISHABLE_KEY_2, sercet)
- Add 20 new database tables with RLS policies
- Add comprehensive documentation and guides"

# Push to repo
git push origin main
```

- [ ] All files committed
- [ ] Push successful
- [ ] PR review (if applicable)

---

## Step 10: Production Deployment

```bash
# Deploy to Vercel
npm run build
# Vercel auto-deploys on push, or:
vercel deploy --prod
```

- [ ] Build succeeds without errors
- [ ] Deployment completes
- [ ] Production env vars configured
- [ ] Production database migration complete (run SQL in prod Supabase)

---

## Post-Deployment Testing

### Test Attendance Features
- [ ] Create attendance record
- [ ] Create adjustment
- [ ] View summary

### Test Device Sync
- [ ] Create device config
- [ ] Test connection
- [ ] View sync logs

### Test Appointments
- [ ] Create service
- [ ] Create patient
- [ ] Create appointment
- [ ] Set reminder

### Test Reports
- [ ] Create report config
- [ ] Generate report
- [ ] Export data

### Test System Features
- [ ] Create notification
- [ ] Create backup config
- [ ] Check system events
- [ ] Verify audit logs

---

## Data Migration (If Needed)

If migrating from legacy system:

```sql
-- After all phases deployed, import legacy data:
-- Phase 3: Import attendance records from legacy
-- Phase 4: Import device mappings
-- Phase 5: Import patients and appointments
-- etc.
```

- [ ] Legacy data export prepared
- [ ] Migration scripts written (if needed)
- [ ] Data import testing completed
- [ ] Data validation passed

---

## Performance Monitoring

Monitor after deployment:

```sql
-- Check index usage
SELECT 
  schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Check slow queries (if Supabase Logs enabled)
-- Monitor response times in dashboard
```

- [ ] Page load times acceptable
- [ ] Database queries performing well
- [ ] No N+1 queries detected
- [ ] Cache hit rates good

---

## Documentation

Files created for reference:

- [x] `SQL_MIGRATIONS_GUIDE.md` - Detailed migration reference
- [x] `PASTE_SQL_IN_ORDER.md` - Step-by-step paste instructions
- [x] `SCHEMA_OVERVIEW.md` - Complete schema documentation
- [x] `DEPLOYMENT_CHECKLIST.md` - This file

---

## Rollback Plan (If Issues)

If critical issues occur:

1. **Connection Issues**
   - Verify env vars: `SUPABASE_PUBLISHABLE_KEY_2`, `sercet`, `SUPABASE_URL`
   - Check Supabase service status
   - Restart dev server

2. **RLS Policy Errors**
   - Review RLS policies in Supabase
   - Check user roles in `user_roles` table
   - Verify organization_id in user_profiles

3. **Data Corruption**
   - Restore from backup (note backup ID from Step 8)
   - Re-run migrations
   - Re-verify data

4. **Complete Rollback**
   - Delete Phase 3-7 migrations only (keep Phase 1-2)
   - Restore backup from before migration
   - Revert env var changes

---

## Success Criteria ✓

After all steps complete, confirm:

- [x] All 20 Phase 3-7 tables created
- [x] All RLS policies enabled
- [x] All indexes created
- [x] Environment variables updated
- [x] Application starts successfully
- [x] No connection errors
- [x] Dashboard loads
- [x] Database queries execute properly
- [x] Data access controlled by RLS
- [x] Backup created

---

## Sign-Off

- [ ] Developer: _________________ Date: _______
- [ ] QA Tester: ________________ Date: _______
- [ ] Product Manager: __________ Date: _______

---

## Support Contacts

- **Database Issues:** Check Supabase Logs → SQL Editor
- **Code Issues:** Check VS Code console & browser dev tools
- **Deployment Issues:** Check Vercel deployment logs
- **RLS Issues:** Review Supabase authentication state

---

Generated: August 5, 2026
Project: Clinic Flow (Nha khoa Việt Smile)
Version: 1.0 Complete
