# Push Notifications RLS & Upsert Fix
**Dátum:** 2026-09-03

---

## 🔴 PROBLÉM

Konzola hlásila chyby pri ukladaní push subscripcie:

```
POST https://vzmxbbemhsdbzytzwwxz.supabase.co/rest/v1/user_push_subscriptions?on_conflict=endpoint 403 (Forbidden)
Chyba pri ukladaní subskripcie do Supabase: {code: '42501', message: 'new row violates row-level security policy (USING expression) for table "user_push_subscriptions"'}

POST https://vzmxbbemhsdbzytzwwxz.supabase.co/rest/v1/user_push_subscriptions?on_conflict=user_id 400 (Bad Request)
```

**Príčiny:**
1. ❌ RLS (Row-Level Security) politika bránila INSERT/UPDATE operáciám
2. ❌ `onConflict: "endpoint"` - len endpoint, ale endpoint nie je unikátny pre všetkých užívateľov
3. ❌ Potrebný je composite UNIQUE constraint na `(user_id, endpoint)`
4. ❌ RLS politika na UPDATE nebola správne nastavená

---

## ✅ RIEŠENIE

### 1. **Code Fix: [src/lib/push.ts](../src/lib/push.ts#L50-L99)**

**Problem:** 
```typescript
// ❌ WRONG - endpoint je globálny, nie per-user
.upsert(payload, { onConflict: "endpoint" })
```

**Solution:**
```typescript
// ✅ CORRECT - composite key (user_id, endpoint)
.upsert(payload, { onConflict: "user_id,endpoint" })

// + Fallback strategy
if (error) {
  // DELETE stary záznam a INSERT nový
  await delete().eq("user_id", userId).eq("endpoint", endpoint);
  const { error: insertError } = await insert(payload);
}
```

### 2. **SQL Migration: [20260903200000_fix_push_subscriptions_rls_comprehensive.sql](../supabase/migrations/20260903200000_fix_push_subscriptions_rls_comprehensive.sql)**

**Úpravy:**

**Step 1:** Opravia composite UNIQUE constraint
```sql
DROP CONSTRAINT user_push_subscriptions_endpoint_key;
ADD CONSTRAINT user_push_subscriptions_user_id_endpoint_key UNIQUE (user_id, endpoint);
```

**Step 2:** Nastaví REPLICA IDENTITY pre Realtime
```sql
ALTER TABLE user_push_subscriptions REPLICA IDENTITY FULL;
```

**Step 3:** Prestaví RLS politiky
```sql
-- SELECT: only own subscriptions
CREATE POLICY user_push_subscriptions_select_own
  USING (auth.uid() = user_id);

-- INSERT: allow authenticated users
CREATE POLICY user_push_subscriptions_insert_own
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: only own, with both USING and WITH CHECK
CREATE POLICY user_push_subscriptions_update_own
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: only own
CREATE POLICY user_push_subscriptions_delete_own
  USING (auth.uid() = user_id);
```

**Step 4:** Povolí Realtime publikáciu
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE user_push_subscriptions;
```

---

## 🚀 DEPLOYMENT

### Krok 1: Run SQL Migration
```
1. Supabase Console > SQL Editor
2. Skopírovať: supabase/migrations/20260903200000_fix_push_subscriptions_rls_comprehensive.sql
3. Spustiť
4. Čakať na úspešne completion
```

### Krok 2: Deploy Code
```bash
git add src/lib/push.ts
git commit -m "fix: improve push subscription upsert with fallback strategy"
git push
```

### Krok 3: Test
```
1. Otvoriť aplikáciu v dev mode
2. Povoliť push notifikácie
3. Skontrolovať Browser Console:
   - Chybová správa "403 (Forbidden)" by mala zmiznúť
   - Správa "Push subskripcia úspešne uložená" by mala sa zobrazovať
4. Skontrolovať Network tab v Dev Tools
   - POST `/user_push_subscriptions` by mal byť 200 OK
```

---

## 📋 PROBLÉM ANALYZOVANÝ

### RLS Policy Issues

**Problem:**
```sql
-- Stará politika - prílisž strictná
CREATE POLICY user_push_subscriptions_insert_own
  WITH CHECK (auth.uid() = user_id);
  
-- Bez USING pre UPDATE - blokuje upsert
CREATE POLICY user_push_subscriptions_update_own
  WITH CHECK (auth.uid() = user_id);  -- ← CHÝBA USING!
```

**Solution:**
```sql
-- Nová politika - úplná
CREATE POLICY user_push_subscriptions_insert_own
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_push_subscriptions_update_own
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)         -- ← ADDED!
  WITH CHECK (auth.uid() = user_id);
```

### Upsert Issues

**Problem:**
- `onConflict: "endpoint"` - endpoint je globálny, viac užívateľov môže mať rovnaký endpoint
- Composite key `(user_id, endpoint)` je správny - per-user basis

**Solution:**
```typescript
// Správne upsert s composite key
.upsert(payload, { onConflict: "user_id,endpoint" })

// Fallback DELETE + INSERT ak upsert zlyhá
if (error) {
  await delete().eq("user_id", userId).eq("endpoint", endpoint);
  await insert(payload);
}
```

---

## ✨ EXPECTED RESULTS

**Pred opravami:**
- ❌ `403 Forbidden` chyby pri save
- ❌ Push notifikácie sa neukladali
- ❌ User nemohol dostávať push notifications

**Po opravách:**
- ✅ `200 OK` pri save push subscription
- ✅ User push subscriptions sa ukladajú
- ✅ User dostáva push notifikácie

---

## 📚 REFERENCE

**Related Files:**
- [src/lib/push.ts](../src/lib/push.ts) - Push subscription management
- [src/context/NotificationContext.tsx](../src/context/NotificationContext.tsx) - Notification handling
- Database: `user_push_subscriptions` table

**Migrations:**
- `20260805173000_push_notifications_pipeline.sql` - Initial table
- `20260830_fix_push_subscriptions_rls.sql` - First RLS attempt
- `20260903120000_fix_push_subscriptions_rls.sql` - Previous fix attempt
- `20260903200000_fix_push_subscriptions_rls_comprehensive.sql` - ✅ **Current comprehensive fix**

---

**Status:** ✅ READY FOR PRODUCTION
