import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { SafeChat } from "@/components/SafeChat";
import { retryAsync, withTimeout } from "@/lib/async-guard";

type ChatRow = {
  id: string;
  item_id: string;
  buyer_id: string;
  seller_id: string;
  created_at: string;
};

type ItemRow = { id: string; title: string; user_id: string };
type ProfileRow = { id: string; name: string | null };
type LastMessage = { chat_id: string; text: string; created_at: string; sender_id: string };

type Conversation = {
  id: string;
  itemId: string;
  itemTitle: string;
  counterpartyId: string;
  counterpartyName: string;
  lastText: string | null;
  lastAt: string;
  unread: boolean;
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "teraz";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
}

export function MojeSpravyScreen() {
  const { userId, profile, loading: authLoading } = useCurrentUser();
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setLoadError(null);

    try {
      const { data: chats, error } = await withTimeout(
        () =>
          retryAsync(
            () =>
              supabase
                .from("chats")
                .select("id, item_id, buyer_id, seller_id, created_at")
                .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
                .order("created_at", { ascending: false }),
            { retries: 1, delayMs: 250 },
          ),
        7000,
        "Načítanie konverzácií trvalo príliš dlho.",
      );

      if (error || !chats) {
        setConvos([]);
        setLoadError(error?.message ?? "Nepodarilo sa načítať konverzácie.");
        return;
      }

      const chatRows = chats as ChatRow[];
      if (chatRows.length === 0) {
        setConvos([]);
        return;
      }

      const itemIds = Array.from(new Set(chatRows.map((c) => c.item_id)));
      const otherIds = Array.from(
        new Set(chatRows.map((c) => (c.buyer_id === userId ? c.seller_id : c.buyer_id))),
      );
      const chatIds = chatRows.map((c) => c.id);

      const [{ data: items }, { data: profiles }, { data: msgs }] = await Promise.all([
        withTimeout(
          () =>
            retryAsync(
              () => supabase.from("warehouse_items").select("id, title, user_id").in("id", itemIds),
              { retries: 1, delayMs: 250 },
            ),
          7000,
          "Načítanie inzerátov ku konverzáciám trvalo príliš dlho.",
        ),
        withTimeout(
          () =>
            retryAsync(() => supabase.from("profiles").select("id, name").in("id", otherIds), {
              retries: 1,
              delayMs: 250,
            }),
          7000,
          "Načítanie profilov ku konverzáciám trvalo príliš dlho.",
        ),
        withTimeout(
          () =>
            retryAsync(
              () =>
                supabase
                  .from("messages")
                  .select("chat_id, text, created_at, sender_id")
                  .in("chat_id", chatIds)
                  .order("created_at", { ascending: false }),
              { retries: 1, delayMs: 250 },
            ),
          7000,
          "Načítanie správ trvalo príliš dlho.",
        ),
      ]);

      const itemMap = new Map<string, ItemRow>((items ?? []).map((i) => [i.id, i as ItemRow]));
      const profMap = new Map<string, ProfileRow>(
        (profiles ?? []).map((p) => [p.id, p as ProfileRow]),
      );
      const lastByChat = new Map<string, LastMessage>();
      for (const m of (msgs ?? []) as LastMessage[]) {
        if (!lastByChat.has(m.chat_id)) lastByChat.set(m.chat_id, m);
      }

      const result: Conversation[] = chatRows.map((c) => {
        const otherId = c.buyer_id === userId ? c.seller_id : c.buyer_id;
        const last = lastByChat.get(c.id) ?? null;
        return {
          id: c.id,
          itemId: c.item_id,
          itemTitle: itemMap.get(c.item_id)?.title ?? "Inzerát",
          counterpartyId: otherId,
          counterpartyName: profMap.get(otherId)?.name ?? "Sused",
          lastText: last?.text ?? null,
          lastAt: last?.created_at ?? c.created_at,
          unread: false,
        };
      });

      result.sort((a, b) => +new Date(b.lastAt) - +new Date(a.lastAt));
      setConvos(result);
    } catch (e) {
      console.error("Failed to load conversations", e);
      setConvos([]);
      setLoadError("Načítanie správ trvá príliš dlho. Skús to znova.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  // Realtime: new chats / new messages → refresh list.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`inbox-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chats" }, (payload) => {
        const row = payload.new as ChatRow;
        if (row.buyer_id === userId || row.seller_id === userId) void load();
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return convos;
    return convos.filter(
      (c) =>
        c.itemTitle.toLowerCase().includes(q) ||
        c.counterpartyName.toLowerCase().includes(q) ||
        (c.lastText ?? "").toLowerCase().includes(q),
    );
  }, [convos, search]);

  const selected = convos.find((c) => c.id === selectedId) ?? null;

  if (authLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <MessageCircle className="h-8 w-8 text-neutral-400" />
        <p className="text-sm font-medium text-neutral-700">Nie si prihlásený</p>
        <p className="max-w-[260px] text-xs text-neutral-500">
          Prihlás sa, aby si videl svoje konverzácie so susedmi.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      <div className="border-b border-neutral-200/60 bg-white/70 px-5 py-3 backdrop-blur-xl">
        <h2 className="text-base font-semibold tracking-tight">💬 Moje správy</h2>
        <p className="text-[11px] text-neutral-500">
          Konverzácie k tvojim inzerátom a inzerátom susedov.
        </p>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hľadať v konverzáciách…"
            className="w-full rounded-full border border-neutral-200 bg-white/80 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-neutral-400"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loadError && (
          <div className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            {loadError}
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
            <MessageCircle className="h-8 w-8 text-neutral-300" />
            <p className="text-sm font-medium text-neutral-700">Žiadne konverzácie</p>
            <p className="max-w-[260px] text-xs text-neutral-500">
              Napíš predávajúcemu cez tlačidlo „Safe Chat“ v detaile inzerátu.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-200/70">
            {filtered.map((c) => {
              const initials =
                c.counterpartyName
                  .split(/\s+/)
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() || "S";
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-neutral-50 active:bg-neutral-100"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-semibold text-white shadow-sm">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-neutral-900">
                          {c.counterpartyName}
                        </p>
                        <span className="shrink-0 text-[10px] text-neutral-400">
                          {timeAgo(c.lastAt)}
                        </span>
                      </div>
                      <p className="truncate text-[11px] text-neutral-500">📦 {c.itemTitle}</p>
                      <p className="mt-0.5 truncate text-xs text-neutral-600">
                        {c.lastText ?? <span className="italic text-neutral-400">Bez správ</span>}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selected && userId && (
        <SafeChat
          chatId={selected.id}
          currentUserId={userId}
          listingTitle={selected.itemTitle}
          counterpartyName={selected.counterpartyName}
          canSendMessages={profile?.is_active_neighbor ?? false}
          onClose={() => {
            setSelectedId(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
