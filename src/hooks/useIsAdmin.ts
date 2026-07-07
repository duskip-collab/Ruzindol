import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useIsAdmin(userId: string | null | undefined) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!userId) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (!alive) return;
      setIsAdmin(!!data);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  return { isAdmin, loading };
}
