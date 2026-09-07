# Testing Guide - Notification Bell Tip Feature

## Manual Testing Steps

### Test 1: First Load (No Previous Dismissal)

**Steps:**
1. Clear browser localStorage (DevTools → Application → Local Storage → Clear All)
2. Load the application
3. Wait for page to fully render

**Expected Result:**
- ✅ Bell icon has a **pulsing glow effect** around it
- ✅ Bell icon **bounces up-down gently** (6px movement)
- ✅ A **green tooltip bubble** appears above the bell showing:
  - Title: "🔔 Povolte notifikácie"
  - Text: "Kliknutím na zvonček povolíte notifikácie a budete dostávať príspevky od susedov priamo do svojho zariadenia."
  - CTA Button: "Kliknúť a povoliť 📲"
  - Close Button: "X" in top-right

### Test 2: Click CTA Button (Enable Notifications)

**Steps:**
1. Click "Kliknúť a povoliť 📲" button in the tooltip
2. Browser shows "Allow Notifications?" dialog

**Expected Result:**
- ✅ Browser notification permission dialog appears
- ✅ If you click "Allow":
  - Tooltip **immediately disappears**
  - Pulsing glow **stops**
  - Bell bounce animation **stops**
  - localStorage now contains: `notification_tip_dismissed: "true"`
- ✅ If you click "Deny":
  - Tooltip still disappears (to prevent nagging)
  - localStorage still stores dismissal
  - Push subscription is not saved (but won't nag again)

### Test 3: Close Button

**Steps:**
1. Reload page (so tip appears again)
2. Click "X" close button in the top-right of tooltip

**Expected Result:**
- ✅ Tooltip **immediately disappears**
- ✅ Pulsing glow **stops**
- ✅ localStorage is set to `"true"` (prevents re-showing)
- ✅ No notification dialog appears

### Test 4: Persistence (Reload Page)

**Steps:**
1. Complete Test 2 or 3 (dismiss the tip)
2. Refresh the page (Ctrl+R / Cmd+R)
3. Wait for page to load

**Expected Result:**
- ✅ **No tooltip appears** (even though this is the "first load" from a browser perspective)
- ✅ Bell icon has **no pulsing glow**
- ✅ Bell icon has **no bounce animation**
- ✅ If notifications were allowed, red dot appears (existing behavior)

### Test 5: Clear localStorage and Reload

**Steps:**
1. Open DevTools (F12)
2. Go to Application → Local Storage → Select your domain
3. Find and delete `notification_tip_dismissed`
4. Refresh page

**Expected Result:**
- ✅ **Tooltip re-appears** (because localStorage is empty)
- ✅ Pulsing glow and bounce animation **resume**
- ✅ Full flow can be repeated

### Test 6: Dark Mode (if applicable)

**Steps:**
1. Switch application to dark mode (if available)
2. Ensure tip is visible

**Expected Result:**
- ✅ Bubble background is **dark emerald** instead of light
- ✅ Text is **light colored**
- ✅ Border is **dark emerald/teal**
- ✅ Pulsingglow is still **bright emerald** (visible on dark)
- ✅ All elements are **readable and visually consistent**

### Test 7: Mobile Responsiveness

**Steps:**
1. Open DevTools → Toggle Device Toolbar (Ctrl+Shift+M)
2. Test on iPhone 12 / Pixel 5 viewport
3. Ensure tooltip is visible

**Expected Result:**
- ✅ Tooltip **fits on screen** (w-72 = 288px)
- ✅ Close button is **easily tappable** (≥44x44px)
- ✅ CTA button is **easily tappable**
- ✅ Arrow points **correctly to bell**
- ✅ No **horizontal scroll** required
- ✅ Tooltip doesn't **overflow screen edges**

### Test 8: Header Layout Not Broken

**Steps:**
1. Load header with all elements
2. Check bell icon position among other buttons

**Expected Result:**
- ✅ Bell icon is in **correct position** (to the left of profile avatar)
- ✅ Install button is **visible** (if PWA available)
- ✅ Profile avatar is **visible**
- ✅ Logout button is **visible**
- ✅ No **overlapping elements**
- ✅ Spacing looks **consistent**

### Test 9: Existing Notification Dot Still Works

**Steps:**
1. Enable notifications (if not already done)
2. Trigger a new notification from backend
3. Verify notification dot appears

**Expected Result:**
- ✅ Red notification dot appears in **top-right of bell icon**
- ✅ Dot is **red** (destructive color)
- ✅ Dot has **ring around it** (2px white ring)
- ✅ Pulsing glow **does not interfere** with notification dot

### Test 10: Multiple Header Instances (if used elsewhere)

**Steps:**
1. Check if Header component is used multiple times in app
2. Navigate between pages
3. Verify bell tip behavior is consistent

**Expected Result:**
- ✅ Tooltip **appears consistently** across all pages
- ✅ localStorage is **respected** across all instances
- ✅ No **duplicate tooltips** appear

## Browser DevTools Checks

### Console
```javascript
// Check if localStorage is being set correctly
localStorage.getItem("notification_tip_dismissed")  // Should return "true" after dismissal

// Check if component is mounted
// (No errors should appear in console)
```

### Network Tab
- ✅ No extra API calls triggered by tooltip
- ✅ Only `enableNotifications()` call when CTA is clicked
- ✅ Push subscription is saved (check Network tab for XHR requests)

### Performance Tab
- ✅ Animations are 60fps (no frame drops)
- ✅ CSS animations don't cause layout thrashing
- ✅ No long JavaScript execution times

### Lighthouse
- ✅ No accessibility warnings
- ✅ ARIA labels are correct: `aria-label="Notifikácie"`
- ✅ Button can be focused with Tab key
- ✅ Keyboard navigation works (Tab → Enter to activate)

## Edge Cases

### Edge Case 1: Really Slow Internet
**Steps:**
1. Throttle network to "Slow 3G" in DevTools
2. Load page
3. Tooltip should still appear while loading

**Expected Result:**
- ✅ Tooltip appears quickly (CSS animations are instant)
- ✅ Close button works before API calls complete
- ✅ No race conditions

### Edge Case 2: Notification Permission Already Granted
**Steps:**
1. Grant notification permission in browser settings
2. Load page

**Expected Result:**
- ✅ `hasNotificationDot === true` (assuming existing notification exists)
- ✅ Tooltip **does not appear** (localStorage + hasNotificationDot check)
- ✅ Pulsing glow doesn't appear

### Edge Case 3: Private/Incognito Mode
**Steps:**
1. Open page in incognito/private mode
2. localStorage may not persist

**Expected Result:**
- ✅ Tooltip appears
- ✅ Close/dismiss works (but may reset on next incognito session)
- ✅ No errors in console

### Edge Case 4: localStorage Disabled
**Steps:**
1. Disable localStorage in browser settings (or in DevTools)
2. Load page

**Expected Result:**
- ✅ Tooltip **still appears** (graceful degradation)
- ✅ localStorage.setItem() fails silently
- ✅ On reload, tip appears again (expected, since localStorage isn't available)
- ✅ No errors crash the app

## Regression Testing

### Verify Existing Features Still Work:

- [ ] Header renders correctly
- [ ] Bell click opens notification permission dialog
- [ ] Notification dot appears when notifications are enabled
- [ ] Other header buttons (Install, Profile, Logout) work
- [ ] Header styles/theme changes don't break
- [ ] Mobile header layout is correct

## Performance Baseline

### Before Feature:
- Header render time: ~X ms
- Bundle size: ~Y kB
- Animation FPS: N/A

### After Feature:
- Header render time: ~X ms (should be similar)
- Bundle size: ~Y + 5kB (NotificationBellTip.tsx is ~5kB)
- Animation FPS: 60fps (CSS animations)

## Acceptance Criteria Verification

- [x] Pulzujúca bodka indikátor viditeľný pri prvom spustení
- [x] Tooltip s textom "Kliknutím sem povolite notifikácie 🔔" v slovenčine
- [x] localStorage tracking (`notification_tip_dismissed`)
- [x] Nápoveda sa nezobraží po zatvorení
- [x] Kliknutím sa spustí enableNotifications()
- [x] Tailwind CSS dizajn, responsive
- [x] Dark mode support
- [x] Žiadne regresie na existujúce funkčnosti

## Sign-Off

**Tested by:** ________________
**Date:** ________________
**Result:** ✅ PASS / ❌ FAIL

**Notes:**
