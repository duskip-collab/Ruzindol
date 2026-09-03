# DEPLOYMENT CHECKLIST - 2026-09-03
## Realtime Channel Management & Push Notifications Complete Fix

---

## 📋 COMPLETED WORK SUMMARY

### ✅ Phase 1: Realtime Channel Management Audit
- [x] NastenkaScreen.tsx - Fixed infinite CLOSED loops
- [x] SafeChat.tsx - Fixed channel name generation
- [x] MojeSpravyScreen.tsx - Fixed channel name + dependency
- [x] AdminPanel.tsx - Added isMounted flag
- [x] AktualityGroupsPanel.tsx - Added isMounted flag
- [x] InquiriesScreen.tsx - Added isMounted flag
- [x] FullscreenAlert.tsx - Verified correct
- [x] NotificationContext.tsx - Verified correct

### ✅ Phase 2: Realtime Table Publications
- [x] Created SQL: 20260903180000_enable_post_replies_realtime.sql
  - post_replies
  - group_announcements
  - group_admins
  - announcements
  - mayor_inquiries
  - app_settings

### ✅ Phase 3: Push Notifications RLS & Upsert
- [x] Fixed src/lib/push.ts with composite key upsert
- [x] Created SQL: 20260903200000_fix_push_subscriptions_rls_comprehensive.sql
  - Composite UNIQUE (user_id, endpoint)
  - Fixed RLS policies
  - Enabled Realtime publication

### ✅ Phase 4: Documentation
- [x] REALTIME_AUDIT_SUMMARY.md
- [x] PUSH_NOTIFICATIONS_FIX_SUMMARY.md
- [x] Session memory notes

---

## 🚀 DEPLOYMENT SEQUENCE

### Step 1: Database Migrations (MUST RUN IN THIS ORDER)

#### Migration 1: Enable Realtime Publications
**File:** `supabase/migrations/20260903180000_enable_post_replies_realtime.sql`

```bash
# In Supabase Console > SQL Editor:
# 1. Copy full content of above file
# 2. Paste and Execute
# 3. Wait for completion (should see NOTICES about added tables)
# 4. Verify: No errors in output
```

**Expected Output:**
```
Added post_replies to supabase_realtime publication
Added group_announcements to supabase_realtime publication
Added group_admins to supabase_realtime publication
Added announcements to supabase_realtime publication
Added mayor_inquiries to supabase_realtime publication
Added app_settings to supabase_realtime publication
```

---

#### Migration 2: Fix Push Notifications RLS
**File:** `supabase/migrations/20260903200000_fix_push_subscriptions_rls_comprehensive.sql`

```bash
# In Supabase Console > SQL Editor:
# 1. Copy full content of above file
# 2. Paste and Execute
# 3. Wait for completion
# 4. Verify: No errors
```

**Expected Output:**
```
Dropped single-column endpoint unique constraint
Added composite UNIQUE constraint on (user_id, endpoint)
Added user_push_subscriptions to supabase_realtime publication
```

---

### Step 2: Deploy Code Changes

```bash
# Commit all code changes
git add src/

# Check what's being committed
git status

# Should see:
# - src/components/SafeChat.tsx
# - src/components/AdminPanel.tsx
# - src/components/AktualityGroupsPanel.tsx
# - src/screens/NastenkaScreen.tsx
# - src/screens/MojeSpravyScreen.tsx
# - src/screens/InquiriesScreen.tsx
# - src/lib/push.ts

git commit -m "fix: realtime channel management & push notifications RLS

- Fix infinite CLOSED loops in Realtime subscriptions
- Add isMounted guards to prevent state updates after unmount
- Move channel name generation inside setupRealtime()
- Fix dependency arrays to prevent unnecessary re-subscriptions
- Improve push subscription upsert with composite key
- Enable Realtime publications for 6 tables
- Fix RLS policies for user_push_subscriptions"

git push origin main
```

---

### Step 3: Verify Deployment

#### In Browser Console (Production)

```javascript
// 1. Check for Realtime connection errors
// Should NOT see:
// ❌ "Nastenka realtime status: CLOSED"
// ❌ "Chat realtime status: CLOSED"
// ❌ "removeChannel" repeated errors

// 2. Enable push notifications
// Should see:
// ✅ "Push subskripcia úspešne uložená."
// NOT: "403 (Forbidden)"
// NOT: "new row violates row-level security policy"
```

#### Network Tab Check
```
POST /rest/v1/user_push_subscriptions?on_conflict=user_id,endpoint
Status: 200 OK (was 403/400 before)
```

#### Realtime Functionality
- [ ] Bulletin board updates appear in real-time
- [ ] Group announcements update instantly
- [ ] Chat messages arrive without delay
- [ ] Admin user list reflects changes
- [ ] Mayor inquiries load without errors

---

## 📦 FILES CHANGED

### React Components (Code)
```
src/components/SafeChat.tsx                      (1 change)
src/components/AdminPanel.tsx                    (1 change)
src/components/AktualityGroupsPanel.tsx          (1 change)
src/screens/NastenkaScreen.tsx                   (1 change)
src/screens/MojeSpravyScreen.tsx                 (1 change)
src/screens/InquiriesScreen.tsx                  (1 change)
src/lib/push.ts                                  (1 change)
```

### SQL Migrations (Database)
```
supabase/migrations/20260903180000_enable_post_replies_realtime.sql
supabase/migrations/20260903200000_fix_push_subscriptions_rls_comprehensive.sql
```

### Documentation (Reference)
```
REALTIME_AUDIT_SUMMARY.md                        (NEW)
PUSH_NOTIFICATIONS_FIX_SUMMARY.md                (NEW)
```

---

## ✨ EXPECTED IMPROVEMENTS

### Before Deploy
- ❌ Infinite "CLOSED" status in Realtime
- ❌ Memory leaks from unreleased channels
- ❌ 403/400 errors on push subscription save
- ❌ Push notifi notifications not saving
- ❌ State updates after component unmount

### After Deploy
- ✅ Stable Realtime connections
- ✅ No memory leaks
- ✅ 200 OK on push subscription save
- ✅ Push notifications work seamlessly
- ✅ No state update warnings

---

## 🔍 ROLLBACK PLAN

If issues occur after deployment:

### Immediate Rollback
```bash
git revert --no-edit HEAD
git push origin main
```

### Partial Rollback (if needed)
```bash
# Only revert SQL, keep code
# 1. Drop newly added policies in Supabase
# 2. Keep SQL for composite constraint (safe)
# 3. Revert code: git revert HEAD
```

---

## 📞 TROUBLESHOOTING

### Issue: Still seeing "403 Forbidden" after SQL migration

**Solution:**
1. Verify SQL migration ran completely
2. Check Supabase > SQL Editor > Query Logs
3. Confirm RLS policies were recreated:
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'user_push_subscriptions';
   ```
4. If missing, run migration again manually

### Issue: "CLOSED" status still appearing

**Solution:**
1. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
2. Clear browser cache
3. Check that code changes were deployed
4. Verify `isMounted` flag logic in components

### Issue: Realtime updates not working after deploy

**Solution:**
1. Verify publication was added:
   ```sql
   SELECT * FROM pg_publication_tables 
   WHERE pubname = 'supabase_realtime';
   ```
2. Confirm REPLICA IDENTITY FULL:
   ```sql
   SELECT schemaname, tablename, replica_identity 
   FROM pg_tables t
   JOIN pg_class c ON c.relname = t.tablename
   WHERE schemaname = 'public';
   ```
3. Restart Supabase realtime (if needed)

---

## ✅ FINAL VERIFICATION CHECKLIST

- [ ] All 8 React components deployed
- [ ] Both SQL migrations executed successfully
- [ ] No console errors on app load
- [ ] Push subscriptions save without error
- [ ] Realtime updates flow without "CLOSED" status
- [ ] Bulletin board updates in real-time
- [ ] Chat messages arrive instantly
- [ ] Admin panel reflects changes
- [ ] Group announcements update live
- [ ] Mayor inquiries load without errors
- [ ] No memory leaks (monitor Dev Tools Memory tab)
- [ ] No "violated row-level security" messages

---

## 📊 METRICS TO MONITOR

### Realtime Stability
- [ ] Monitor Supabase Realtime dashboard
- [ ] Check connection count per user
- [ ] No spike in subscription errors

### Database Performance
- [ ] RLS policy execution time < 1ms
- [ ] Push subscription upsert latency < 100ms
- [ ] Realtime event delivery < 500ms

### User Experience
- [ ] No console errors
- [ ] Push notifications working
- [ ] Realtime features responsive
- [ ] No "loading" spinners hanging

---

## 📚 REFERENCES

**Related Documentation:**
- [REALTIME_AUDIT_SUMMARY.md](../REALTIME_AUDIT_SUMMARY.md)
- [PUSH_NOTIFICATIONS_FIX_SUMMARY.md](../PUSH_NOTIFICATIONS_FIX_SUMMARY.md)
- Supabase Realtime Docs: https://supabase.com/docs/guides/realtime
- PostgreSQL RLS: https://www.postgresql.org/docs/current/sql-altertable.html#SQL-ALTERTABLE-REPLICA-IDENTITY

---

## 📝 SIGN-OFF

**Date:** 2026-09-03
**Status:** ✅ READY FOR PRODUCTION
**Estimated Deploy Time:** 10-15 minutes
**Risk Level:** LOW (only improves stability, no breaking changes)
**Rollback Risk:** MINIMAL (changes are backward compatible)

---

**Next Steps:**
1. Execute SQL migrations in order
2. Deploy code to production
3. Monitor for 24 hours
4. Collect user feedback on Realtime stability
