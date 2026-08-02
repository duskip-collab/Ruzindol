import { useEffect, useRef, useState } from "react";
import { Send, X, User2, ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type ChatMessage = {
  id: string;
  sender_id: string;
  text: string;
  created_at: string;
};

type Props = {
  chatId: string;
  currentUserId: string;
  listingTitle: string;
  counterpartyName: string;
  canSendMessages?: boolean;
  onClose: () => void;
};

const MAX_MESSAGES = 15;

export function SafeChat({
  chatId,
  currentUserId,
  listingTitle,
  counterpartyName,
  canSendMessages = true,
  onClose,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isLocked = messages.length >= MAX_MESSAGES;
  const isWriteLocked = !canSendMessages || isLocked;
  const remaining = Math.max(0, MAX_MESSAGES - messages.length);

  // Initial load + realtime subscription.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, sender_id, text, created_at")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });
      if (!mounted) return;
      setMessages((data as ChatMessage[] | null) ?? []);
      setLoading(false);
    })();

    const channel = supabase
      .channel(`chat-${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [chatId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function trySend() {
    if (isWriteLocked || sending) return;
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("messages")
      .insert({ chat_id: chatId, sender_id: currentUserId, text })
      .select("id, sender_id, text, created_at")
      .single();
    setSending(false);
    if (err) {
      // The DB trigger enforces the 15-message limit and raises
      // ERRCODE 'check_violation' (23514). Show a friendly banner.
      if (err.code === "23514" || /Limit/i.test(err.message)) {
        setError("Limit správ (15) pre tento chat bol dosiahnutý.");
      } else {
        setError(err.message);
      }
      return;
    }
    if (data) {
      setMessages((prev) =>
        prev.some((x) => x.id === data.id) ? prev : [...prev, data as ChatMessage],
      );
      setDraft("");
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/25 p-0 backdrop-blur-sm md:items-center md:justify-center md:p-5">
      <div className="flex h-full w-full flex-col bg-white md:h-[min(92vh,760px)] md:max-w-3xl md:overflow-hidden md:rounded-3xl md:border md:border-neutral-200 md:shadow-2xl">
        <div className="flex items-center gap-3 border-b border-neutral-200 bg-white/80 px-4 py-3 backdrop-blur-xl">
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-neutral-100"
            aria-label="Zavrieť chat"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-neutral-900">{counterpartyName}</p>
            <p className="truncate text-xs text-neutral-500">k inzerátu: {listingTitle}</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
              isLocked
                ? "bg-amber-100 text-amber-800 ring-amber-200"
                : "bg-neutral-100 text-neutral-700 ring-neutral-200"
            }`}
          >
            {messages.length} / {MAX_MESSAGES}
          </span>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto bg-neutral-50/60 p-4">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
            </div>
          ) : messages.length === 0 ? (
            <p className="mt-8 text-center text-sm text-neutral-500">
              Napíš prvú správu k inzerátu.
            </p>
          ) : (
            messages.map((m) => (
              <MessageBubble key={m.id} isMe={m.sender_id === currentUserId} text={m.text} />
            ))
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void trySend();
          }}
          className="border-t border-neutral-200 bg-white/80 p-3 backdrop-blur-xl"
        >
          {!isWriteLocked && !error && (
            <p className="mb-2 text-center text-xs text-neutral-500">
              Ostáva {remaining} {remaining === 1 ? "správa" : remaining < 5 ? "správy" : "správ"}{" "}
              do limitu — dohodnite sa stručne.
            </p>
          )}

          {!canSendMessages && (
            <div className="mb-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Režim čítania: na odoslanie správy potrebuješ platný pozývací kód.
            </div>
          )}

          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void trySend();
                }
              }}
              disabled={isWriteLocked || sending}
              rows={1}
              placeholder={isWriteLocked ? "Režim čítania" : "Napíš správu…"}
              className="max-h-32 min-h-[42px] flex-1 resize-none rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
            />
            <button
              type="submit"
              disabled={isWriteLocked || sending || draft.trim().length === 0}
              aria-label="Odoslať"
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white shadow-sm transition active:scale-95 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>

          {(isLocked || error || !canSendMessages) && (
            <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-amber-300/70 bg-amber-50/80 p-3 shadow-sm ring-1 ring-amber-200/50 backdrop-blur-xl">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <p className="text-xs leading-relaxed text-amber-900">
                <span className="font-semibold">
                  ⚠️ {error ?? (!canSendMessages ? "Režim čítania pre správy." : "Limit správ pre tento chat bol dosiahnutý.")}
                </span>{" "}
                Detaily (miesto, čas, telefón) si, prosím, dohodnite osobne.
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ isMe, text }: { isMe: boolean; text: string }) {
  return (
    <div className={`flex gap-2 ${isMe ? "justify-end" : "justify-start"}`}>
      {!isMe && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-600">
          <User2 className="h-3.5 w-3.5" />
        </div>
      )}
      <div
        className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
          isMe
            ? "rounded-br-md bg-neutral-900 text-white"
            : "rounded-bl-md border border-neutral-200 bg-white text-neutral-800"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{text}</p>
      </div>
    </div>
  );
}
