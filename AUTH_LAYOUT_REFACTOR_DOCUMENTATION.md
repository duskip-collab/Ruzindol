# Auth Layout Refactor - Legal Consent at Top

## Changes Summary

Úprava prihlasovacieho formulára podľa požiadaviek:

### ✅ Čo bolo zmenené:

1. **VPP a GDPR súhlas na začiatok** ✅
   - Presunutý z konca do úplného začiatku (po titulke, pred Email/Google)
   - Zobrazuje sa s motivačným textom: "⚠️ Aby pokračovali, musíte odsúhlasiť VPP a GDPR"

2. **Zablokované tlačidlá bez súhlasu** ✅
   - Email tlačidlo: `disabled={!legalAccepted}`
   - Google tlačidlo: `disabled={busy || !legalAccepted}`
   - Visuálny efekt: `disabled:opacity-50 disabled:cursor-not-allowed`

3. **Odstránený duplikát checkboxu** ✅
   - Starý checkbox bol na konci SELECT módu - odstránený
   - Starý checkbox bol v EMAIL móde - odstránený
   - Teraz existuje len jeden checkbox na začiatku

4. **Zjednotený workflow** ✅
   - User musí NAJSKÔR odsúhlasiť VPP a GDPR
   - Potom si vyberie Email alebo Google
   - Žiadne opakovanie súhlas neskôr

## File Changes

**File:** `src/routes/auth.tsx`

**Changes:**
- Lines 188-209: Added consent checkbox at the top with warning message
- Line 227: Added `disabled={!legalAccepted}` to Email button
- Line 243: Added `disabled={busy || !legalAccepted}` to Google button
- Lines 224-254: Added `disabled:cursor-not-allowed` to both buttons
- Removed: Duplicate consent checkbox from around line 232 (old)
- Removed: Duplicate consent checkbox from around line 302-308 (email form)

## Visual Flow

### BEFORE
```
Badge
Headings
[Email Button]  ← ENABLED (no check)
[Google Button] ← ENABLED (no check)
VPP + GDPR Checkbox (at bottom)
```

### AFTER
```
Badge
Headings
VPP + GDPR Checkbox (at TOP) ← MUST CHECK FIRST
⚠️ Warning message
[Email Button]  ← DISABLED until checked
[Google Button] ← DISABLED until checked
```

## Code Changes

### 1. Added Consent Section at Top (Lines 188-209)

```typescript
{/* CONSENT CHECKBOX - MOVED TO THE TOP (BEFORE ANY AUTH OPTIONS) */}
<motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.3 }}
  className="mb-8"
>
  <ConsentCheckbox
    checked={legalAccepted}
    onChange={setLegalAccepted}
    onOpenLegal={openLegalDialog}
  />
  {!legalAccepted && (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mt-3 text-center text-xs text-amber-500/80"
    >
      ⚠️ Aby pokračovali, musíte odsúhlasiť VPP a GDPR
    </motion.p>
  )}
</motion.div>
```

### 2. Email Button - Added Disabled State

**Before:**
```typescript
<button
  onClick={() => setViewMode("email")}
  className="group relative flex w-full items-center gap-4 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 text-left transition-all duration-300 hover:border-emerald-500/50 hover:bg-slate-900 active:scale-[0.99]"
>
```

**After:**
```typescript
<button
  onClick={() => setViewMode("email")}
  disabled={!legalAccepted}
  className="group relative flex w-full items-center gap-4 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 text-left transition-all duration-300 hover:border-emerald-500/50 hover:bg-slate-900 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
>
```

### 3. Google Button - Added Disabled State

**Before:**
```typescript
<button
  onClick={handleGoogle}
  disabled={busy}
  className="group relative flex w-full items-center gap-4 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 text-left transition-all duration-300 hover:border-blue-500/50 hover:bg-slate-900 active:scale-[0.99] disabled:opacity-50"
>
```

**After:**
```typescript
<button
  onClick={handleGoogle}
  disabled={busy || !legalAccepted}
  className="group relative flex w-full items-center gap-4 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 text-left transition-all duration-300 hover:border-blue-500/50 hover:bg-slate-900 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
>
```

## User Experience

### Scenario 1: User Opens App (No Consent)
1. Sees headline "Vitaj u susedov..."
2. Sees VPP + GDPR checkbox unchecked
3. Sees warning: "⚠️ Aby pokračovali, musíte odsúhlasiť VPP a GDPR"
4. Email button is greyed out (50% opacity, not clickable)
5. Google button is greyed out (50% opacity, not clickable)

### Scenario 2: User Checks Consent
1. Clicks checkbox
2. Warning message disappears
3. Email button becomes active (100% opacity, clickable)
4. Google button becomes active (100% opacity, clickable)
5. User can now proceed with Email or Google

### Scenario 3: User Selects Email
1. Form appears with email/password inputs
2. No consent checkbox (already checked at top)
3. User enters credentials
4. Submits to login/signup

### Scenario 4: User Selects Google
1. Google OAuth flow starts
2. Redirects to Google login
3. Returns to app after authentication

## Compliance Benefits

✅ **Clear Consent Flow**: Users see and accept VPP + GDPR before proceeding
✅ **Legal Protection**: Timestamp of legal_accepted_at is recorded
✅ **No Confusion**: Only one place to accept terms (not repeated)
✅ **Compliance**: GDPR requirement for explicit opt-in before processing
✅ **UX**: Users understand requirements upfront

## Technical Details

### State Management
- `legalAccepted` - boolean state (starts as false)
- Persisted in Supabase when user signs up: `legal_accepted_at` timestamp

### Validation
- Email form: Already checks `if (!legalAccepted)` - will show error if unchecked
- Google: Now can't be clicked until checked
- Email: Now can't be clicked until checked

### CSS Classes
- `disabled:opacity-50` - Visual indication buttons are disabled
- `disabled:cursor-not-allowed` - Cursor changes to indicate non-clickable

## Testing Checklist

- [x] Build successful
- [x] No TypeScript errors
- [x] Consent checkbox visible at top
- [x] Warning message shows when unchecked
- [x] Email button disabled when unchecked
- [x] Google button disabled when unchecked
- [x] Email button enabled when checked
- [x] Google button enabled when checked
- [x] No duplicate checkboxes in forms
- [x] Email form works correctly
- [x] Google login works correctly
- [x] Legal values recorded in Supabase

## Files Modified

- `src/routes/auth.tsx` - Main auth page component

## Related Files (Unchanged)

- `src/components/LegalDocuments.tsx` - Dialog for viewing full legal docs
- `src/components/LegalDocuments.tsx` - LegalLinkButton component
- Supabase RLS policies - No changes needed
- Auth flow - No changes needed

## Git Commit

```
Commit: ecdf3ea
Message: refactor: move legal consent to top of auth flow
Files: 1 file changed, 27 insertions(+), 21 deletions(-)
```

## Build Status

✅ Build successful (2.97s)
✅ No errors or warnings
✅ Bundle size unchanged
✅ PWA files regenerated

## Deployment Notes

- No database migrations needed
- No API changes
- Backward compatible (existing users unaffected)
- Can be deployed immediately

## Future Enhancements (Optional)

1. **Progress Indicator** - Show step 1/3, 2/3, 3/3
2. **Smooth Transitions** - Fade in buttons when consent checked
3. **Remember Choice** - Save consent in localStorage for faster onboarding
4. **Analytics** - Track consent acceptance rate
5. **Localization** - Translate warning message to other languages

## Summary

✅ **Status: Complete**

All requirements met:
1. ✅ VPP + GDPR moved to top
2. ✅ Buttons disabled without consent
3. ✅ Duplicate checkboxes removed
4. ✅ Clean workflow
5. ✅ Build verified
6. ✅ No regressions

The auth flow is now more compliant, user-friendly, and clearly communicates the legal requirements upfront.

---

**Date:** 2026-09-07
**Author:** Copilot
**Status:** ✅ Ready for Production
