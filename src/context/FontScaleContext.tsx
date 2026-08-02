import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const FONT_SCALE_KEY = "komunita.ui.fontScale.v1";

export type FontScale = 1 | 2 | 3;

type FontScaleCtx = {
  fontScale: FontScale;
  setFontScale: (value: FontScale) => void;
  fontSizePx: number;
};

const FONT_SIZE_BY_SCALE: Record<FontScale, number> = {
  1: 16,
  2: 18,
  3: 20,
};

function isFontScale(value: unknown): value is FontScale {
  return value === 1 || value === 2 || value === 3;
}

function getInitialFontScale(): FontScale {
  if (typeof window === "undefined") return 1;
  try {
    const raw = window.localStorage.getItem(FONT_SCALE_KEY);
    const parsed = Number(raw);
    return isFontScale(parsed) ? parsed : 1;
  } catch {
    return 1;
  }
}

function applyFontScale(scale: FontScale) {
  if (typeof document === "undefined") return;
  document.documentElement.style.fontSize = `${FONT_SIZE_BY_SCALE[scale]}px`;
}

const Ctx = createContext<FontScaleCtx | null>(null);

export function FontScaleProvider({ children }: { children: ReactNode }) {
  const [fontScale, setFontScaleState] = useState<FontScale>(getInitialFontScale);

  useLayoutEffect(() => {
    applyFontScale(fontScale);
    try {
      window.localStorage.setItem(FONT_SCALE_KEY, String(fontScale));
    } catch {
      /* ignore */
    }
  }, [fontScale]);

  const setFontScale = useCallback((value: FontScale) => {
    setFontScaleState(value);
  }, []);

  const value = useMemo<FontScaleCtx>(
    () => ({
      fontScale,
      setFontScale,
      fontSizePx: FONT_SIZE_BY_SCALE[fontScale],
    }),
    [fontScale, setFontScale],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFontScale() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFontScale must be used inside <FontScaleProvider>");
  return ctx;
}

export const FONT_SCALE_OPTIONS: { value: FontScale; label: string; description: string }[] = [
  { value: 1, label: "1", description: "Štandard" },
  { value: 2, label: "2", description: "Väčšie" },
  { value: 3, label: "3", description: "Veľké" },
];
