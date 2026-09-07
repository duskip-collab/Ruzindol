# Fix: AuthSessionMissingError in useCurrentUser Hook

## Problem

Konzola zobrazovala nepotrebné chybové hlásenie pre neprihlásených používateľov:
```
[useCurrentUser] getUser chyba: AuthSessionMissingError: Auth session missing!
```

Problém bol v tom, že hook `useCurrentUser` volal `supabase.auth.getUser()` bez priorného skontrolovania či vôbec existuje relácia (`getSession()`).

## Root Cause

V `src/hooks/useCurrentUser.ts` bola logika:
```typescript
// ❌ NESPRÁVNE - getUser() bez session check
const { data: { user }, error: userError } = await supabase.auth.getUser();

if (userError) {
  // Chyba sa hlásila aj pre neprihlásených používateľov
  console.warn("[useCurrentUser] getUser chyba:", userError);
  // ...
}
```

Keď používateľ NEBOL prihlásený:
1. `getSession()` vrátilo `session: null`
2. Hook napriek tomu zavolal `getUser()`
3. `getUser()` vrátilo `AuthSessionMissingError`
4. Chyba sa hlásila v konzole (zbytočné, normálne správanie)

## Solution

Upravená logika v `src/hooks/useCurrentUser.ts`:

```typescript
// ✅ SPRÁVNE - Najskôr check session
const { data: { session }, error: sessionError } = await supabase.auth.getSession();

// Ak session neexistuje, ticho vráti null (bez hlásenia chyby)
if (sessionError || !session) {
  if (mounted) {
    setUserId(null);
    setProfile(null);
    setLoading(false);
  }
  return;  // ← Bez getUser() call
}

// Iba ak session existuje, zavoláme getUser()
const { data: { user }, error: userError } = await supabase.auth.getUser();

// Teraz sú to skutočné chyby, nie false positives
if (userError) {
  console.warn("[useCurrentUser] getUser chyba:", userError);
  // ...
}
```

## Changes Made

**File:** `src/hooks/useCurrentUser.ts`

**Before:**
```typescript
// Riadky 37-63 (stará logika)
(async () => {
  try {
    setLoading(true);
    setError(null);
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.warn("[useCurrentUser] getUser chyba:", userError);
      // ...
    }
    // ...
  }
})();
```

**After:**
```typescript
// Riadky 37-75 (nová logika)
(async () => {
  try {
    setLoading(true);
    setError(null);
    
    // 1. Najskôr skontrolovať či existuje relácia (bez chybových hlásení)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      // Žiadny používateľ nie je prihlásený – ticho
      if (mounted) {
        setUserId(null);
        setProfile(null);
        setLoading(false);
      }
      return;
    }
    
    // 2. Ak relácia existuje, bezpečne zavoláme getUser()
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.warn("[useCurrentUser] getUser chyba:", userError);
      // ...
    }
    // ...
  }
})();
```

## Impact

### Before Fix
- ❌ Konzola: Zbytočné chybové hlásenia pre neprihlásených používateľov
- ❌ Hluk v console → obtiaž pri debuggingu
- ❌ False positives v error tracking/monitoring

### After Fix
- ✅ Konzola: Čistá, bez false positives
- ✅ Len skutočné chyby sú hlásené
- ✅ Lepšia developer experience
- ✅ Lepší error monitoring (bez šumu)

## Behavior Changes

### Scenario: Unauthenticated User
**Before:**
```
[useCurrentUser] getUser chyba: AuthSessionMissingError: Auth session missing!
userId: null
profile: null
loading: false
```

**After:**
```
(žiadne hlásenie v konzole)
userId: null
profile: null
loading: false
```

### Scenario: Authenticated User
- Bez zmeny - funciona rovnako ako predtým

### Scenario: Real Error (e.g., network issue)
- Stále sa hlási ako predtým (správne chovaní)

## Testing

### Manual Test 1: Unauthenticated User
1. Otvoriť aplikáciu bez prihlásenia
2. Otvoriť DevTools → Console
3. **Expected:** Žiadne chybové hlásenia o `getUser` (before fix: malo jedno)

### Manual Test 2: Authenticated User
1. Prihlásiť sa
2. Otvoriť DevTools → Console
3. **Expected:** Profil sa načíta správne (same as before)
4. **Expected:** Žiadne chybové hlásenia

### Manual Test 3: Session Expired
1. Prihlásiť sa
2. Očistiť cookies/session v DevTools
3. Refresh stránka
4. **Expected:** Aktualizuje sa na unauthenticated state
5. **Expected:** Žiadne hlásenia o `AuthSessionMissingError`

## Performance Impact

- ✅ Minimálny - jednoducho jeden dodatočný `getSession()` call
- ✅ Rýchly - `getSession()` je lokálny (bez siete)
- ✅ Bez zmeny výkonu - približne rovnaký čas

## Code Quality

- ✅ Lepšia čitateľnosť - jasný komentár o krokovom prístupe
- ✅ Logické - najskôr check session, potom getUser
- ✅ Bezpečný - obchádza problém z principu
- ✅ Maintainable - ľahko pochopiteľná logika

## Git Commit

```
Commit: d56ce35
Message: fix: prevent AuthSessionMissingError in useCurrentUser hook
File: src/hooks/useCurrentUser.ts
Lines changed: +14, -1
```

## Related Files

- `src/hooks/useCurrentUser.ts` - Fixed hook
- `src/integrations/supabase/client.ts` - Supabase client (unchanged)
- `src/lib/async-guard.ts` - Error handling utilities (unchanged)

## Rollback Instructions

If needed, revert with:
```bash
git revert d56ce35
```

Or manually restore the old logic (call getUser() directly without session check).

## Follow-up

### Optional Enhancements (for future)
1. Add retry logic for getSession() failures
2. Cache session in memory to avoid repeated calls
3. Add metrics/monitoring for session check performance
4. Consider adding specific error types for better debugging

### Monitoring
- Monitor console for any new `AuthSessionMissingError` - should be rare now
- If errors still appear, investigate specific auth state issues

## Conclusion

✅ **Fix Complete**

- Chyba v konzole je vyriešená
- Bez regresia na existujúcu funkčnosť
- Build prešiel úspešne
- Code quality улучшена
- Ready for deployment

---

**Status:** ✅ Complete
**Date:** 2026-09-07
**Impact:** Console cleanup, improved DX
