import { useEffect, useRef, useState } from "react";
import { CheckCheck, Loader2, MessageSquare, Info, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type Notification = {
  id: string;
  title: string;
  body: string;
  type: string;
  ref_id: string | null;
  is_read: boolean;
  created_at: string;
};

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { userId } = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // Jedno odčítanie času pri mounte (namiesto Date.now() pri každom renderi)
  const [renderedAt] = useState(() => Date.now());

  // Načítanie notifikácií
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", userId],
    enabled: Boolean(userId) && isOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(30); // Zvýšime limit, aby sme mali dostatok dát na filtrovanie

      if (error) throw error;
      return data as Notification[];
    },
  });

  // Zatvorenie pri kliknutí mimo okna
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filtrovanie: Neprečítané ukazujeme vždy, prečítané iba ak sú mladšie ako 7 dní (skryjeme staré mesačné histórie)
  const visibleNotifications = notifications.filter((notif) => {
    if (!notif.is_read) return true; // Neprečítané sa nestratia
    const createdTime = new Date(notif.created_at).getTime();
    const sevenDaysAgo = renderedAt - 7 * 24 * 60 * 60 * 1000;
    return createdTime > sevenDaysAgo; // Prečítané staršie ako 7 dní nezobrazíme
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.is_read) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", notif.id);
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    }
    onClose();

    if (notif.type === "inquiry") {
      navigate({ to: "/podnety" });
    } else if (notif.type === "post") {
      navigate({ to: "/nastenka" });
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!userId || unreadCount === 0) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
  };

  // Pomocná funkcia na čistenie a zabránenie duplicity title a body
  const getCleanNotificationContent = (notif: Notification) => {
    const title = (notif.title ?? "").trim();
    let body = (notif.body ?? "").trim();

    // Ak sú title a body identické, vrátime len jedno
    if (title.toLowerCase() === body.toLowerCase()) {
      return { title: "", body: title };
    }

    // Ak body začína na title, odstránime duplicitný prefix z body
    if (body.toLowerCase().startsWith(title.toLowerCase())) {
      body = body.slice(title.length).trim();
      if (body.startsWith(":") || body.startsWith("-")) {
        body = body.slice(1).trim();
      }
    }

    return { title, body };
  };

  return (
    <div
      ref={dropdownRef}
      className="fixed right-4 top-16 z-[9999] w-[calc(100vw-32px)] max-w-[400px] sm:absolute sm:right-0 sm:top-auto sm:mt-3 sm:w-96 sm:max-w-none rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Hlavička */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/40">
        <h3 className="font-semibold text-sm text-foreground">História upozornení</h3>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Prečítať všetko
            </button>
          )}
          <button
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Zoznam */}
      <div className="max-h-80 overflow-y-auto divide-y divide-border">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : visibleNotifications.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Žiadne predchádzajúce upozornenia
          </div>
        ) : (
          visibleNotifications.map((notif) => {
            const { title, body } = getCleanNotificationContent(notif);
            return (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`p-3.5 transition-colors cursor-pointer flex gap-3 items-start ${
                  notif.is_read ? "bg-card opacity-75" : "bg-emerald-50/50 dark:bg-emerald-950/20"
                } hover:bg-muted/50`}
              >
                <div
                  className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
                    notif.is_read
                      ? "bg-muted text-muted-foreground"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {notif.type === "inquiry" ? (
                    <MessageSquare className="h-4 w-4" />
                  ) : (
                    <Info className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {title && (
                    <p
                      className={`text-xs font-semibold truncate ${
                        notif.is_read ? "text-foreground" : "text-emerald-900 dark:text-emerald-300"
                      }`}
                    >
                      {title}
                    </p>
                  )}
                  {body && (
                    <p
                      className={`text-xs text-muted-foreground mt-0.5 line-clamp-2 ${!title ? "font-semibold text-foreground" : ""}`}
                    >
                      {body}
                    </p>
                  )}
                  <span className="text-[10px] text-muted-foreground/70 mt-1 block">
                    {new Date(notif.created_at).toLocaleDateString("sk-SK", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
