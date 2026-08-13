# Environment Variables Update - Required for Phases 3-7

## What Changed

The application now uses **new environment variable names** for Supabase credentials.

---

## Old vs New

### Before (Phases 1-2)
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1N...  # Client key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1N...  # Server key
```

### After (Phases 3-7)
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY_2=eyJhbGciOiJIUzI1N...  # Client key (NEW NAME)
sercet=eyJhbGciOiJIUzI1N...                      # Server key (NEW NAME)
```

---

## What To Update

### In Development (.env.local)

Update your local environment file:

```bash
# .env.local or .env.development.local

# Keep the same
SUPABASE_URL=https://your-project.supabase.co

# Update these
SUPABASE_PUBLISHABLE_KEY_2=your_client_key_here
sercet=your_service_role_key_here
```

### In Vercel Project Settings

1. Go to: Vercel Dashboard → Your Project → Settings → Environment Variables

2. **Delete (or update):**
   - `SUPABASE_PUBLISHABLE_KEY` (remove)
   - `SUPABASE_SERVICE_ROLE_KEY` (remove)

3. **Add new:**
   ```
   SUPABASE_PUBLISHABLE_KEY_2 = [your public key]
   sercet = [your service role key]
   ```

4. Make sure env vars are available in:
   - [ ] Development
   - [ ] Preview
   - [ ] Production

---

## How To Get The Keys

### From Supabase Dashboard

1. Go to: Supabase → Settings → API
2. Find:
   - **Publishable Key (anon)** → Use for `SUPABASE_PUBLISHABLE_KEY_2`
   - **Service Role Key** → Use for `sercet`
3. Copy each key
4. Paste into env vars

### Keys Look Like

**Publishable Key (SUPABASE_PUBLISHABLE_KEY_2):**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
Usually starts with `eyJh...` or `sb_publishable_...`

**Service Role Key (sercet):**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
Usually starts with `eyJh...` or `sb_secret_...`

---

## Code Changes Made

### File: `src/integrations/supabase/client.ts`

**Line 34 - Before:**
```typescript
const SUPABASE_PUBLISHABLE_KEY = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] || process.env['SUPABASE_PUBLISHABLE_KEY'];
```

**Line 34 - After:**
```typescript
const SUPABASE_PUBLISHABLE_KEY = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY_2'] || process.env['SUPABASE_PUBLISHABLE_KEY_2'];
```

### File: `src/integrations/supabase/client.server.ts`

**Line 34 - Before:**
```typescript
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];
```

**Line 34 - After:**
```typescript
const SUPABASE_SERVICE_ROLE_KEY = process.env['sercet'];
```

---

## Deployment Steps

### 1. Local Development

```bash
# Update .env.local
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY_2=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
sercet=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Restart dev server
npm run dev
```

### 2. Vercel Production

```bash
# In Vercel Dashboard
1. Settings → Environment Variables
2. Add/Update:
   - SUPABASE_PUBLISHABLE_KEY_2
   - sercet
3. Redeploy
```

### 3. Verify

```bash
# Check env vars are loaded
console.log(process.env.SUPABASE_PUBLISHABLE_KEY_2);  // Should have value
console.log(process.env.sercet);                      // Should have value

# Test connection
# If app starts without "Missing Supabase environment variable" error → Success ✓
```

---

## Migration Path

**Do NOT do all at once.** Follow this order:

1. **Before SQL Migration:**
   - [ ] Keep old env vars (still working)
   - [ ] Code still uses old keys
   - [ ] Phase 1-2 tables accessible

2. **Deploy Code Changes:**
   - [ ] Update `client.ts` and `client.server.ts`
   - [ ] Add new env vars (keep old ones for now)
   - [ ] Redeploy code
   - [ ] Test: App should still work

3. **Update Env Vars to New Names:**
   - [ ] Remove old env vars
   - [ ] App now only uses new env vars
   - [ ] Test: App should still work

4. **Deploy SQL Migrations:**
   - [ ] Run Phase 3 SQL
   - [ ] Run Phase 4 SQL
   - [ ] Run Phase 5 SQL
   - [ ] Run Phase 6 SQL
   - [ ] Run Phase 7 SQL
   - [ ] All 20 new tables available

---

## Quick Checklist

### Before Starting
- [ ] Have Supabase project ready
- [ ] Have both keys from Supabase API settings
- [ ] Know which keys are: Publishable vs Service Role

### Code Update
- [ ] `client.ts` updated to use `SUPABASE_PUBLISHABLE_KEY_2`
- [ ] `client.server.ts` updated to use `sercet`
- [ ] Code committed and pushed

### Environment Setup
- [ ] Local: `.env.local` has new keys
- [ ] Vercel: Project env vars updated
- [ ] Dev/Preview/Prod all have the vars
- [ ] Old env vars removed or deprecated

### Testing
- [ ] Dev server starts: `npm run dev`
- [ ] No "Missing Supabase" errors
- [ ] Dashboard loads
- [ ] No console errors
- [ ] Database queries work
- [ ] Production deploy works

### SQL Migration Ready
- [ ] All 5 SQL files in `/supabase/migrations/`
- [ ] Ready to paste in Supabase SQL Editor
- [ ] Follow `PASTE_SQL_IN_ORDER.md`

---

## Troubleshooting

### Error: "Missing Supabase environment variable(s): SUPABASE_PUBLISHABLE_KEY_2"

**Solution:**
- Check env vars are set correctly
- Restart dev server
- Check `.env.local` syntax
- Verify key value is not empty

### Error: "Missing Supabase environment variable(s): sercet"

**Solution:**
- Check env var name (it's "sercet" not "secret")
- Verify Vercel env vars
- Make sure service role key is used (not public key)

### App Still Using Old Env Vars

**Solution:**
- Verify code changes applied (check git status)
- Restart dev server with new code
- Force clear browser cache
- Check you're running latest code

### Connection Works Locally But Not in Production

**Solution:**
- Check Vercel env vars are set
- Verify they're set for "Production" environment
- Redeploy after setting env vars
- Check keys are correct (not copy-paste mistakes)

---

## Security Notes

⚠️ **Important:**
- **SUPABASE_PUBLISHABLE_KEY_2** - Safe to expose (client-side)
- **sercet** - Must keep secret (server-side only)
- Never commit keys to git
- Never share keys in public
- Store in env vars only

---

## Reference Docs

- Supabase API Keys: https://supabase.com/docs/guides/api/rest/managing-api-keys
- Supabase Auth: https://supabase.com/docs/guides/auth
- Environment Variables: https://vercel.com/docs/projects/environment-variables

---

## Summary

**Old env vars:**
- `SUPABASE_PUBLISHABLE_KEY` → **DELETE**
- `SUPABASE_SERVICE_ROLE_KEY` → **DELETE**

**New env vars:**
- `SUPABASE_PUBLISHABLE_KEY_2` → **ADD**
- `sercet` → **ADD** (Note: spelling is intentional)

**When:** After code deploy, before SQL migration

**Status:** Code already updated ✓

---

Created: August 5, 2026
Updated: When you complete the deployment
