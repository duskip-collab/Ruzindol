import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout, retryAsync } from "@/lib/async-guard";

export function useIsAdmin(userId: string | null | undefined) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!userId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const { data } = await withTimeout(
          () =>
            retryAsync(
              () =>
                supabase
                  .from("user_roles")
                  .select("role")
                  .eq("user_id", userId)
                  .eq("role", "admin")
                  .maybeSingle(),
              { retries: 1, delayMs: 300 },
            ),
          5000,
          "Kontrola admin oprávnení trvala príliš dlho",
        );
        if (!alive) return;
        setIsAdmin(!!data);
      } catch (err) {
        console.warn("[useIsAdmin] Admin check chyba:", err);
        if (alive) setIsAdmin(false);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  return {
    isAdmin: userId ? isAdmin : false,
    loading: userId ? loading : false,
  };
}
