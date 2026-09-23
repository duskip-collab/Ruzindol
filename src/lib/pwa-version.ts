/**
 * PWA aktualizácie – verzia aplikácie a ošetrenie návratu z pozadia (iOS).
 *
 * Tu je len čistá, testovateľná logika a zdieľané kľúče; samotné browserové
 * udalosti (`pageshow`, `visibilitychange`), fetch a reload sú v `src/main.tsx`.
 */

/** Naposledy potvrdená verzia zo servera (aby klient poznal, čo už videl). */
export const APP_VERSION_STORAGE_KEY = "app-version";

/** Čas posledného vynúteného updatu (sessionStorage) – ochrana proti slučke reloadov. */
export const FORCED_UPDATE_AT_KEY = "komunita.pwa.last-forced-update-at";

/** Do tohto času potlačíme reload z controllerchange (aby po vynútenom update nedošlo k dvojitému reloadu). */
export const SW_RELOAD_SUPPRESS_UNTIL_KEY = "komunita.pwa.suppress-sw-reload-until";

/** Minimálny odstup medzi automatickými kontrolami verzie (ms). */
export const VERSION_CHECK_MIN_INTERVAL_MS = 30_000;

/** Ak sa verzia nezmenila ani po vynútenom update, ďalší pokus až po tomto čase (ms). */
export const FORCED_UPDATE_COOLDOWN_MS = 30_000;

/** Ako dlho po vynútenom reloade ignorovať reload z `controllerchange` (ms). */
export const SW_RELOAD_SUPPRESS_MS = 10_000;

/** Maximálna dĺžka čakania na `version.json` (ms) – mobilné siete. */
export const VERSION_FETCH_TIMEOUT_MS = 8_000;

export type ServerVersionInfo = {
  version?: string | null;
  buildId?: string | null;
  builtAt?: string | null;
};

export type VersionCheckInput = {
  /** Verzia zo servera (`version.json`). */
  serverVersion?: string | null;
  /** Identifikátor vstupného bundle na serveri (napr. `index-Bd2w330s.js`). */
  serverBuildId?: string | null;
  /** Verzia, ktorú si klient pamätá v localStorage. */
  storedVersion?: string | null;
  /** Identifikátor práve bežiaceho bundle (odvodený z `import.meta.url`). */
  runningBuildId?: string | null;
};

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/**
 * Rozhodne, či klient beží na inej verzii, než akú práve servíruje server.
 *
 * 1) `storedVersion !== serverVersion` → od nasledujúceho potvrdenia sa zmenila
 *    verzia nasadenia (nová aktualita, nový build).
 * 2) `serverBuildId !== runningBuildId` → bežiaci bundle nie je ten, ktorý
 *    server aktuálne ponúka (na iOS typicky starý `index.html` z Workbox
 *    precache alebo z bfcache). Toto odhalí starý kód aj vtedy, keď už je
 *    verzia v localStorage prepísaná na novú.
 */
export function isAppOutdated(input: VersionCheckInput): boolean {
  const serverVersion = normalized(input.serverVersion);
  if (!serverVersion) return false;

  const storedVersion = normalized(input.storedVersion);
  if (storedVersion && storedVersion !== serverVersion) return true;

  const serverBuildId = normalized(input.serverBuildId);
  const runningBuildId = normalized(input.runningBuildId);
  return Boolean(serverBuildId && runningBuildId && serverBuildId !== runningBuildId);
}

/**
 * Vytiahne názov súboru (identifikátor buildu) z URL modulu – v produkcii je to
 * napr. `index-Bd2w330s.js` z `/assets/index-Bd2w330s.js`.
 */
export function buildIdFromUrl(url: string): string {
  if (!url) return "";
  try {
    const path = new URL(url, "https://localhost").pathname;
    return path.split("/").filter(Boolean).pop() ?? "";
  } catch {
    return "";
  }
}

/** `true`, ak od `lastAt` ešte neuplynul `cooldownMs` (ochrana proti slučke/spleti). */
export function isWithinCooldown(
  lastAt: number | null | undefined,
  now: number,
  cooldownMs: number,
): boolean {
  if (!lastAt || lastAt <= 0) return false;
  return now - lastAt < cooldownMs;
}
