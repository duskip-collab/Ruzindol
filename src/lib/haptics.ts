export type HapticType = 'light' | 'success' | 'error';

/**
 * Haptic vibration patterns (durations in milliseconds).
 * - light: short 12ms tap
 * - success: distinct sequence [15ms, 50ms pause, 20ms]
 * - error: warning pattern [40ms, 60ms pause, 40ms, 60ms pause, 40ms]
 */
const HAPTIC_PATTERNS: Record<HapticType, number | number[]> = {
  light: 12,
  success: [15, 50, 20],
  error: [40, 60, 40, 60, 40],
};

/**
 * Triggers haptic feedback via Web Vibration API if supported by the browser and device.
 * Safely handles environments without navigator.vibrate support (e.g. SSR, desktop).
 *
 * @param type - Pattern type to trigger: 'light' | 'success' | 'error'
 * @returns boolean - true if vibration was successfully requested, false otherwise
 */
export function triggerHaptic(type: HapticType): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !('vibrate' in navigator)) {
    return false;
  }

  try {
    const pattern = HAPTIC_PATTERNS[type];
    return navigator.vibrate(pattern);
  } catch {
    // Silently handle cases where vibration is prohibited by browser policy or user preference
    return false;
  }
}
