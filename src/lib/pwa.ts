export function isIosDevice() {
  if (typeof window === "undefined") return false;

  const userAgent = window.navigator.userAgent;
  const platform = window.navigator.platform;
  const touchPoints = window.navigator.maxTouchPoints ?? 0;

  if (/Android/i.test(userAgent)) return false;

  return /iPad|iPhone|iPod/i.test(userAgent) ||
    (/Mac/i.test(platform) && touchPoints > 1);
}

export function isStandaloneMode() {
  if (typeof window === "undefined") return false;

  const mediaStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

  return mediaStandalone || iosStandalone;
}