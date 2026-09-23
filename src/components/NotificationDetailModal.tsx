import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowLeft, Bell, Loader2, RefreshCw, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { isIosDevice } from "@/lib/pwa";

/**
 * Detail notifikácie na celú plochu – otvára sa kliknutím na položku v zozname
 * upozornení (notifikačný panel v hlavičke a záložka „Notifikácie“ v Moje správy).
 *
 * Pred zobrazením sa riadok VŽDY overí proti databáze:
 *  - riadok už neexistuje (mazanie po 48 h alebo ručné zmazanie) → zrozumiteľná hláška,
 *  - vypršala platnosť (2 dni) → hláška o expirácii,
 *  - chyba siete → hláška s možnosťou „Skúsiť znova“ (nikdy tiché zlyhanie).
 */

/** Životnosť notifikácií – rovnaká ako v zoznamoch a v serverovom pg_cron cleanupe. */
export const NOTIFICATION_RETENTION_MS = 48 * 60 * 60 * 1000;

export const NOTIFICATION_MISSING_MESSAGE = "⚠️ Táto notifikácia je už vymazaná alebo neaktuálna.";
export const NOTIFICATION_EXPIRED_MESSAGE = "⚠️ Táto notifikácia už vypršala (platnosť 2 dni).";

/** Minimum údajov, ktoré musia poskytnúť zoznamy upozornení. */
export type NotificationDetailSource = {
  id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
};

type Status = "loading" | "ready" | "missing" | "expired" | "error";

interface NotificationDetailModalProps {
  /** Vybraná notifikácia zo zoznamu (null = detail sa nezobrazuje). */
  notification: NotificationDetailSource | null;
  userId: string | null;
  onClose: () => void;
  /** Zavolá sa po úspešnom označení notifikácie ako prečítanej (obnoví zoznam). */
  onMarkedRead?: (id: string) => void;
}

function formatCreatedAt(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString("sk-SK", { dateStyle: "medium", timeStyle: "short" });
}

export function NotificationDetailModal({
  notification,
  userId,
  onClose,
  onMarkedRead,
}: NotificationDetailModalProps) {
  // Počet pokusov („Skúsiť znova“). Zmena vytvorí čerstvý mount vnútorného
  // komponentu (cez key), takže stav loading/ready/… sa resetuje bez setState v effekte.
  const [attempt, setAttempt] = useState(0);
  const handleRetry = useCallback(() => setAttempt((prev) => prev + 1), []);

  if (!notification) return null;

  return createPortal(
    <NotificationDetailBody
      key={`${notification.id}:${attempt}`}
      notification={notification}
      userId={userId}
      onClose={onClose}
      onMarkedRead={onMarkedRead}
      onRetry={handleRetry}
    />,
    document.body,
  );
}

interface NotificationDetailBodyProps {
  notification: NotificationDetailSource;
  userId: string | null;
  onClose: () => void;
  onMarkedRead?: (id: string) => void;
  onRetry: () => void;
}

function NotificationDetailBody({
  notification,
  userId,
  onClose,
  onMarkedRead,
  onRetry,
}: NotificationDetailBodyProps) {
  const useIosBackNav = isIosDevice();
  // Čerstvý mount (key vyššie) = počiatočný stav – netreba ho resetovať v effekte.
  const [status, setStatus] = useState<Status>("loading");
  const [record, setRecord] = useState<NotificationDetailSource | null>(null);

  // Callback držíme v ref, aby sa overenie nespúšťalo znova pri každom renderi rodiča.
  const markedReadRef = useRef(onMarkedRead);
  useEffect(() => {
    markedReadRef.current = onMarkedRead;
  }, [onMarkedRead]);

  useEffect(() => {
    let isMounted = true;

    const verifyAndLoad = async () => {
      // Bez prihláseného používateľa (napr. obnovená session) zobrazíme aspoň text
      // zo zoznamu – ten už aj tak pochádza z vlastných riadkov (RLS + .eq user_id).
      if (!userId) {
        if (!isMounted) return;
        setRecord(notification);
        setStatus("ready");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("id, title, body, type, is_read, created_at")
          .eq("id", notification.id)
          .eq("user_id", userId)
          .maybeSingle();

        if (error) throw error;
        if (!isMounted) return;

        // Notifikáciu medzitým zmazal cleanup (48 h) alebo používateľ → jasná hláška.
        if (!data) {
          setRecord(null);
          setStatus("missing");
          return;
        }

        const createdMs = Date.parse(data.created_at);
        if (!Number.isNaN(createdMs) && createdMs < Date.now() - NOTIFICATION_RETENTION_MS) {
          setRecord(null);
          setStatus("expired");
          return;
        }

        setRecord({
          id: data.id,
          title: data.title ?? "",
          body: data.body ?? "",
          type: data.type ?? "",
          is_read: Boolean(data.is_read),
          created_at: data.created_at,
        });
        setStatus("ready");

        if (!data.is_read) {
          void supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("id", data.id)
            .eq("user_id", userId)
            .then(({ error: markError }) => {
              if (markError) {
                console.error("Nepodarilo sa označiť notifikáciu ako prečítanú:", markError);
                return;
              }
              markedReadRef.current?.(data.id);
            });
        }
      } catch (err) {
        console.error("Overenie notifikácie zlyhalo:", err);
        if (isMounted) setStatus("error");
      }
    };

    void verifyAndLoad();

    return () => {
      isMounted = false;
    };
  }, [notification, userId]);

  // Zatvorenie klávesou Escape (desktop / iPad s klávesnicou).
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Detail notifikácie"
      className="fixed inset-0 z-[170] flex h-[100dvh] w-full min-h-[100dvh] flex-col overflow-hidden bg-[color:var(--bg-app)] pt-safe"
    >
      <div className="app-toolbar flex items-center gap-3 border-b px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className={`header-action-button h-9 w-9 items-center justify-center rounded-full ${useIosBackNav ? "hidden md:flex" : "flex"}`}
          aria-label="Zavrieť detail"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="line-clamp-1 text-sm font-semibold text-neutral-900 md:text-base dark:text-[#f8fafc]">
          Notifikácia
        </h2>
      </div>

      <div
        className={`min-h-0 flex-1 overflow-y-auto p-4 ${useIosBackNav ? "pb-24" : ""} md:p-6 md:pb-6`}
      >
        {status === "loading" && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {(status === "missing" || status === "expired") && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
            <p className="flex items-start gap-2 font-semibold">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {status === "missing" ? NOTIFICATION_MISSING_MESSAGE : NOTIFICATION_EXPIRED_MESSAGE}
            </p>
            <p className="mt-2 text-xs leading-relaxed opacity-90">
              Upozornenia sa v aplikácii uchovávajú maximálne 2 dni, potom sa automaticky mažú.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary-surface mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
            >
              Zavrieť
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
            <p className="flex items-start gap-2 font-semibold">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Nepodarilo sa overiť stav notifikácie.
            </p>
            <p className="mt-2 text-xs leading-relaxed opacity-90">
              Skontroluj pripojenie k internetu a skús to znova.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onRetry}
                className="btn-secondary-surface inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Skúsiť znova
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground"
              >
                Zavrieť
              </button>
            </div>
          </div>
        )}

        {status === "ready" && record && (
          <div className="rounded-2xl border border-[color:var(--border-card)] bg-[color:var(--bg-surface)] p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-700 dark:text-emerald-300">
                <Bell className="h-3.5 w-3.5" /> Upozornenie
              </span>
              {formatCreatedAt(record.created_at) && (
                <span className="chip-muted rounded-full px-2 py-1 text-[#94a3b8]">
                  {formatCreatedAt(record.created_at)}
                </span>
              )}
            </div>

            {record.title.trim() && (
              <h3 className="mt-3 text-base font-semibold text-neutral-900 dark:text-[#f8fafc]">
                {record.title}
              </h3>
            )}

            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-900 dark:text-[#f8fafc]">
              {record.body.trim() || record.title.trim() || "Bez ďalšieho textu."}
            </p>
          </div>
        )}
      </div>

      {useIosBackNav && (
        <div className="border-t border-[color:var(--border-card)] bg-[color:var(--bg-surface)]/95 px-4 py-3 pb-safe md:hidden">
          <button
            type="button"
            onClick={onClose}
            className="btn-primary-glow flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold"
            aria-label="Späť"
          >
            <ArrowLeft className="h-4 w-4" />
            Späť
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
