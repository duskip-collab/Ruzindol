import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";

export function useUnreadNotifications() {
  const { userId } = useCurrentUser();
  const [hasUnread, setHasUnread] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    const checkUnread = async () => {
      try {
        // Count unread messages in chats (warehouse item conversations)
        const [chatsRes, announcementsRes] = await Promise.all([
          supabase
            .from("chats")
            .select("id, buyer_id, seller_id, created_at", { count: "exact", head: true })
            .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
            .order("created_at", { ascending: false })
            .limit(100),
          supabase
            .from("announcements")
            .select("id, published_at", { count: "exact", head: true })
            .eq("source", "internal")
            .order("published_at", { ascending: false })
            .limit(50),
        ]);

        const unreadChats = chatsRes.count ?? 0;
        const newAnnouncements = announcementsRes.count ?? 0;
        const total = unreadChats + newAnnouncements;

        setUnreadCount(total);
        setHasUnread(total > 0);
      } catch (error) {
        console.error("Error checking unread notifications:", error);
      }
    };

    void checkUnread();

    // Subscribe to real-time updates for chats
    const chatsChannel = supabase
      .channel(`user-chats-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chats",
          filter: `or(buyer_id.eq.${userId},seller_id.eq.${userId})`,
        },
        () => {
          void checkUnread();
        },
      )
      .subscribe();

    // Subscribe to real-time updates for announcements
    const announcementsChannel = supabase
      .channel("internal-announcements")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "announcements",
          filter: "source.eq.internal",
        },
        () => {
          void checkUnread();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatsChannel);
      supabase.removeChannel(announcementsChannel);
    };
  }, [userId]);

  // Pri odhlásenom používateľovi hlásime "bez neprečítaných" (odvodený stav,
  // namiesto synchronného setState v efekte).
  return {
    hasUnread: userId ? hasUnread : false,
    unreadCount: userId ? unreadCount : 0,
  };
}
