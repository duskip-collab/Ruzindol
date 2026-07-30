import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "komunita.onboarding.v1";
const BYPASS_CODE = "ADMI.DP.77";

// Mock valid invite codes for local development.
const MOCK_VALID_CODES = new Set(["OBEC-2026-XY", "SUSED-HELLO", "VITAJ-DOMA-1"]);

export type OnboardingRole = "Sused" | "Starosta" | "Admin";

export interface OnboardingState {
  onboarded: boolean; // finished welcome + geo wizard
  region: string | null;
  municipality: string | null;
  municipalityId: string | null;
  isVerified: boolean; // entered a valid invite/community code
  activatedCode: string | null;
  bypass: boolean;
  role: OnboardingRole;
  invitesGenerated: number;
  generatedCodes: string[];
}

interface AppModeCtx extends OnboardingState {
  isReadonly: boolean;
  maxInvites: number;
  invitesRemaining: number;
  setGeo: (region: string, municipality: string) => void;
  finishOnboarding: () => void;
  activateCode: (
    code: string,
  ) => { ok: true } | { ok: false; error: string };
  generateInviteCode: () => { ok: true; code: string } | { ok: false; error: string };
  resetOnboarding: () => void;
  setRole: (role: OnboardingRole) => void;
}

const DEFAULT: OnboardingState = {
  onboarded: false,
  region: null,
  municipality: null,
  municipalityId: null,
  isVerified: false,
  activatedCode: null,
  bypass: false,
  role: "Sused",
  invitesGenerated: 0,
  generatedCodes: [],
};

function load(): OnboardingState {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...(JSON.parse(raw) as Partial<OnboardingState>) };
  } catch {
    return DEFAULT;
  }
}

function save(s: OnboardingState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

function randomCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    if (i === 4) out += "-";
    else out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out; // e.g. "AB3D-XYZ9K" (10 chars incl. dash-ish; 9 + separator)
}

const AppModeContext = createContext<AppModeCtx | null>(null);

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(() => load());

  useEffect(() => {
    save(state);
  }, [state]);

  const setGeo = useCallback((region: string, municipality: string, municipalityId?: string) => {
    setState((s) => ({
      ...s,
      region,
      municipality,
      municipalityId: municipalityId ?? s.municipalityId,
    }));
  }, []);

  const finishOnboarding = useCallback(() => {
    setState((s) => ({ ...s, onboarded: true }));
  }, []);

  const setRole = useCallback((role: OnboardingRole) => {
    setState((s) => ({ ...s, role }));
  }, []);

  const activateCode = useCallback((raw: string) => {
    const code = raw.trim().toUpperCase();
    if (!code) return { ok: false as const, error: "Zadaj kód." };
    if (code.replace(/[-.\s]/g, "").length < 8)
      return { ok: false as const, error: "Kód je príliš krátky." };

    if (code === BYPASS_CODE.toUpperCase()) {
      setState((s) => ({
        ...s,
        isVerified: true,
        bypass: true,
        activatedCode: code,
        role: "Admin",
      }));
      return { ok: true as const };
    }

    // Mock validation: predefined codes OR previously generated ones OR
    // anything matching the 10-char pattern for demo purposes.
    const pattern = /^[A-Z0-9-]{8,14}$/;
    if (MOCK_VALID_CODES.has(code) || pattern.test(code)) {
      setState((s) => ({
        ...s,
        isVerified: true,
        activatedCode: code,
      }));
      return { ok: true as const };
    }
    return { ok: false as const, error: "Neplatný pozývací kód." };
  }, []);

  const maxInvites = state.role === "Sused" ? 5 : Infinity;

  const generateInviteCode = useCallback(() => {
    if (!state.isVerified)
      return { ok: false as const, error: "Najprv aktivuj svoj účet kódom." };
    if (state.invitesGenerated >= maxInvites)
      return {
        ok: false as const,
        error: `Dosiahol si limit ${maxInvites} pozvánok.`,
      };
    const code = randomCode();
    setState((s) => ({
      ...s,
      invitesGenerated: s.invitesGenerated + 1,
      generatedCodes: [code, ...s.generatedCodes],
    }));
    return { ok: true as const, code };
  }, [state.invitesGenerated, state.isVerified, maxInvites]);

  const resetOnboarding = useCallback(() => setState(DEFAULT), []);

  const value = useMemo<AppModeCtx>(
    () => ({
      ...state,
      isReadonly: !state.isVerified,
      maxInvites,
      invitesRemaining:
        maxInvites === Infinity
          ? Infinity
          : Math.max(0, maxInvites - state.invitesGenerated),
      setGeo,
      finishOnboarding,
      activateCode,
      generateInviteCode,
      resetOnboarding,
      setRole,
    }),
    [
      state,
      maxInvites,
      setGeo,
      finishOnboarding,
      activateCode,
      generateInviteCode,
      resetOnboarding,
      setRole,
    ],
  );

  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
}

export function useAppMode() {
  const ctx = useContext(AppModeContext);
  if (!ctx) throw new Error("useAppMode must be used inside <AppModeProvider>");
  return ctx;
}

export const ONBOARDING_BYPASS_CODE = BYPASS_CODE;
