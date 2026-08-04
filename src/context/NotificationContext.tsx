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
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { subscribeToPush } from "@/lib/push";

const MUTE_KEY = "komunita.notifications.muted.v1";
const CATS_KEY = "komunita.notifications.categories.v1";

export type NotifCategory = "obecne" | "havarie" | "kulturne" | "farske" | "ostatne";

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

export interface DbNotification {
  id: string;
  user_id: string;
  created_at: string;
  type: string;
  title?: string | null;
  body?: string | null;
  is_read: boolean;
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
  notifications: DbNotification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
}

const DEFAULT_CATS: Record<NotifCategory, boolean> = {
  obecne: true,
  havarie: true,
  kulturne: true,
  farske: true,
  ostatne: true,
};

function getInitialMuted() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function getInitialCategories() {
  if (typeof window === "undefined") return DEFAULT_CATS;
  try {
    const raw = window.localStorage.getItem(CATS_KEY);
    if (!raw) return DEFAULT_CATS;
    return { ...DEFAULT_CATS, ...(JSON.parse(raw) as object) };
  } catch {
    return DEFAULT_CATS;
  }
}

const Ctx = createContext<NotificationCtx | null>(null);

function extractRecord(payload: unknown, kind: "new" | "old"): Record<string, unknown> | null {
  const p = payload as any;
  return (
    p?.payload?.[kind] ??
    p?.[kind] ??
    p?.record?.[kind] ??
    p?.payload?.record?.[kind] ??
    p?.payload?.data?.[kind] ??
    null
  );
}

function toDbNotification(record: unknown): DbNotification | null {
  const r = record as any;
  if (!r?.id || !r?.user_id || !r?.created_at || !r?.type) return null;
  return {
    id: String(r.id),
    user_id: String(r.user_id),
    created_at: String(r.created_at),
    type: String(r.type),
    title: r.title ?? null,
    body: r.body ?? null,
    is_read: Boolean(r.is_read),
  };
}

function byCreatedAtDesc(a: DbNotification, b: DbNotification): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

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
  if (c.includes("kult") || c.includes("podujat") || c.includes("udalost")) return "kulturne";
  if (c.includes("farsk") || c.includes("kostol") || t === "farsky_oznam") return "farske";
  if (t === "hlasnik" || t === "official_alert" || c.includes("obec")) return "obecne";
  return "ostatne";
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [muted, setMutedState] = useState<boolean>(getInitialMuted);
  const [categories, setCategories] =
    useState<Record<NotifCategory, boolean>>(getInitialCategories);
  const [current, setCurrent] = useState<LiveNotification | null>(null);
  const [hasOfficialUnread, setHasOfficialUnread] = useState(false);
  const [hasMessageUnread, setHasMessageUnread] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<DbNotification[]>([]);

  const mutedRef = useRef(false);
  const catsRef = useRef(categories);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    catsRef.current = categories;
  }, [categories]);

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
        setNotifications([]);
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
          const isHlasnik = typeLc === "hlasnik" || typeLc === "official_alert";
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

  useEffect(() => {
    if (!currentUserId) return;

    let cancelled = false;

    (async () => {
      const { data, error } = await (supabase as any)
        .from("notifications")
        .select("id, user_id, created_at, type, title, body, is_read")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!cancelled) {
        setNotifications(((data ?? []) as DbNotification[]).sort(byCreatedAtDesc));
      }
    })().catch((error) => {
      console.error("Chyba pri načítaní notifications:", error);
    });

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      if (notificationChannelRef.current) {
        supabase.removeChannel(notificationChannelRef.current);
        notificationChannelRef.current = null;
      }
      return;
    }

    const topic = `user:${currentUserId}:notifications`;

    if (notificationChannelRef.current) {
      supabase.removeChannel(notificationChannelRef.current);
      notificationChannelRef.current = null;
    }

    let isMounted = true;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await supabase.realtime.setAuth(session?.access_token ?? "");

      const channel = supabase.channel(topic, {
        config: { private: true },
      });

      channel
        .on("broadcast", { event: "INSERT" }, (payload: unknown) => {
          if (!isMounted) return;

          const record = extractRecord(payload, "new") ?? ((payload as any)?.payload ?? null);
          const nextItem = toDbNotification(record);
          if (!nextItem || nextItem.user_id !== currentUserId) return;

          setNotifications((prev) => {
            const exists = prev.some((item) => item.id === nextItem.id);
            if (exists) return prev;
            return [nextItem, ...prev].sort(byCreatedAtDesc);
          });
        })
        .on("broadcast", { event: "UPDATE" }, (payload: unknown) => {
          if (!isMounted) return;

          const updated = toDbNotification(extractRecord(payload, "new"));
          if (!updated || updated.user_id !== currentUserId) return;

          setNotifications((prev) => {
            const idx = prev.findIndex((item) => item.id === updated.id);
            if (idx === -1) return [updated, ...prev].sort(byCreatedAtDesc);
            const next = prev.slice();
            next[idx] = updated;
            return next.sort(byCreatedAtDesc);
          });
        })
        .on("broadcast", { event: "DELETE" }, (payload: unknown) => {
          if (!isMounted) return;

          const oldRec = extractRecord(payload, "old");
          if (!oldRec?.id) return;

          const deletedId = String(oldRec.id);
          setNotifications((prev) => prev.filter((item) => item.id !== deletedId));
        })
        .subscribe();

      notificationChannelRef.current = channel;
    })().catch((error) => {
      console.error("Chyba pri subscribe notifications channel:", error);
    });

    return () => {
      isMounted = false;
      if (notificationChannelRef.current) {
        supabase.removeChannel(notificationChannelRef.current);
        notificationChannelRef.current = null;
      }
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    subscribeToPush({ requestPermission: false }).catch((error) => {
      console.error("Chyba pri synchronizácii push subskripcie:", error);
    });
  }, [currentUserId]);

  const unreadCount = useMemo(
    () => notifications.reduce((acc, n) => acc + (n.is_read ? 0 : 1), 0),
    [notifications],
  );

  const markAsRead = useCallback(
    async (id: string) => {
      if (!currentUserId) return;

      const { error } = await (supabase as any)
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id)
        .eq("user_id", currentUserId);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)),
      );
    },
    [currentUserId],
  );

  const hasBellDot = hasOfficialUnread || hasMessageUnread || unreadCount > 0;

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
      notifications,
      unreadCount,
      markAsRead,
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
      notifications,
      unreadCount,
      markAsRead,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNotifications must be used within <NotificationProvider>");
  return ctx;
}
