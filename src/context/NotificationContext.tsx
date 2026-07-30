import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";

const MUTE_KEY = "komunita.notifications.muted.v1";
const CATS_KEY = "komunita.notifications.categories.v1";

export type NotifCategory =
  | "obecne"
  | "havarie"
  | "kulturne"
  | "farske"
  | "ostatne";

export const NOTIF_CATEGORIES: { key: NotifCategory; label: string }[] = [
  { key: "obecne", label: "Obecné" },
  { key: "havarie", label: "Havárie a núdzové situácie" },
  { key: "kulturne", label: "Kultúrne podujatia" },
  { key: "farske", label: "Farské oznamy" },
  { key: "ostatne", label: "Ostatné" },
];

export interface LiveNotification {
  id: string;
  postId: string;
  title: string;
  body: string;
  authorName: string;
  category: NotifCategory;
  createdAt: string;
}

interface NotificationCtx {
  muted: boolean;
  setMuted: (v: boolean) => void;
  categories: Record<NotifCategory, boolean>;
  setCategory: (key: NotifCategory, on: boolean) => void;
  current: LiveNotification | null;
  dismiss: () => void;
  hasOfficialUnread: boolean;
  hasMessageUnread: boolean;
  hasBellDot: boolean;
  clearOfficialUnread: () => void;
  clearMessageUnread: () => void;
}

const DEFAULT_CATS: Record<NotifCategory, boolean> = {
  obecne: true,
  havarie: true,
  kulturne: true,
  farske: true,
  ostatne: true,
};

const Ctx = createContext<NotificationCtx | null>(null);

function classify(type: string, category: string | null): NotifCategory {
  const t = (type ?? "").toLowerCase();
  const c = (category ?? "").toLowerCase();
  if (
    c.includes("havar") ||
    c.includes("núdz") ||
    c.includes("nudz") ||
    c.includes("výstraha") ||
    c.includes("vystraha") ||
    c === "vysoka"
  )
    return "havarie";
  if (c.includes("kult") || c.includes("podujat") || c.includes("udalost"))
    return "kulturne";
  if (c.includes("farsk") || c.includes("kostol") || t === "farsky_oznam")
    return "farske";
  if (t === "hlasnik" || t === "official_alert" || c.includes("obec"))
    return "obecne";
  return "ostatne";
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [muted, setMutedState] = useState<boolean>(false);
  const [categories, setCategories] =
    useState<Record<NotifCategory, boolean>>(DEFAULT_CATS);
  const [current, setCurrent] = useState<LiveNotification | null>(null);
  const [hasOfficialUnread, setHasOfficialUnread] = useState(false);
  const [hasMessageUnread, setHasMessageUnread] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const mutedRef = useRef(false);
  const catsRef = useRef(categories);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const m = window.localStorage.getItem(MUTE_KEY) === "1";
      setMutedState(m);
      mutedRef.current = m;
      const raw = window.localStorage.getItem(CATS_KEY);
      if (raw) {
        const parsed = { ...DEFAULT_CATS, ...(JSON.parse(raw) as object) };
        setCategories(parsed);
        catsRef.current = parsed;
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setMuted = useCallback((v: boolean) => {
    setMutedState(v);
    mutedRef.current = v;
    try {
      window.localStorage.setItem(MUTE_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (v) setCurrent(null);
  }, []);

  const setCategory = useCallback((key: NotifCategory, on: boolean) => {
    setCategories((prev) => {
      const next = { ...prev, [key]: on };
      catsRef.current = next;
      try {
        window.localStorage.setItem(CATS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const dismiss = useCallback(() => setCurrent(null), []);
  const clearOfficialUnread = useCallback(() => setHasOfficialUnread(false), []);
  const clearMessageUnread = useCallback(() => setHasMessageUnread(false), []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setCurrentUserId(data.user?.id ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user?.id ?? null);
      if (!session?.user) {
        setHasOfficialUnread(false);
        setHasMessageUnread(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("realtime-posts-notify")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        async (payload) => {
          if (mutedRef.current) return;
          const row = payload.new as {
            id: string;
            user_id: string;
            type: string;
            category: string | null;
            title: string;
            content: string;
            created_at: string;
          };
          const typeLc = (row.type ?? "").toLowerCase();
          const catLc = (row.category ?? "").toLowerCase();
          const isHlasnik =
            typeLc === "hlasnik" || typeLc === "official_alert";
          const isHigh =
            catLc === "vysoka" ||
            catLc === "výstraha" ||
            catLc === "vystraha" ||
            catLc.includes("havar") ||
            catLc.includes("núdz");
          if (!isHlasnik && !isHigh) return;

          const { data: prof } = await supabase
            .from("profiles")
            .select("name, role")
            .eq("id", row.user_id)
            .maybeSingle();
          if (!prof || (prof.role !== "Starosta" && prof.role !== "Uradnik")) return;

          const bucket = classify(row.type, row.category);
          if (!catsRef.current[bucket]) return;

          setHasOfficialUnread(true);

          setCurrent({
            id: `${row.id}-${Date.now()}`,
            postId: row.id,
            title: row.title,
            body: row.content,
            authorName: prof.name ?? "Starosta",
            category: bucket,
            createdAt: row.created_at,
          });
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => setCurrent(null), 12000);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const row = payload.new as {
            chat_id: string;
            sender_id: string;
          };

          if (!currentUserId) return;
          if (!row?.chat_id || row.sender_id === currentUserId) return;

          const { data: chat } = await supabase
            .from("chats")
            .select("buyer_id, seller_id")
            .eq("id", row.chat_id)
            .maybeSingle();

          if (!chat) return;

          if (chat.buyer_id === currentUserId || chat.seller_id === currentUserId) {
            setHasMessageUnread(true);
          }
        },
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const hasBellDot = hasOfficialUnread || hasMessageUnread;

  const value = useMemo<NotificationCtx>(
    () => ({
      muted,
      setMuted,
      categories,
      setCategory,
      current,
      dismiss,
      hasOfficialUnread,
      hasMessageUnread,
      hasBellDot,
      clearOfficialUnread,
      clearMessageUnread,
    }),
    [
      muted,
      setMuted,
      categories,
      setCategory,
      current,
      dismiss,
      hasOfficialUnread,
      hasMessageUnread,
      hasBellDot,
      clearOfficialUnread,
      clearMessageUnread,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useNotifications must be used within <NotificationProvider>");
  return ctx;
}
