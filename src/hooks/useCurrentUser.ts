import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ProfileRole = "Sused" | "Starosta" | "VIP_Firma" | "Uradnik" | "Farar";

export type Profile = {
  id: string;
  name: string;
  street: string | null;
  role: ProfileRole;
  is_active_neighbor: boolean;
  invite_code: string | null;
  banned_until: string | null;
  ban_reason: string | null;
};

const SELECT =
  "id, name, street, role, is_active_neighbor, invite_code, banned_until, ban_reason";

export function useCurrentUser() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!mounted) return;
      setUserId(uid);
      if (uid) {
        const { data: p } = await supabase
          .from("profiles")
          .select(SELECT)
          .eq("id", uid)
          .maybeSingle();
        if (!mounted) return;
        setProfile((p as Profile | null) ?? null);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return {
    userId,
    profile,
    loading,
    refresh: async () => {
      if (!userId) return;
      const { data: p } = await supabase
        .from("profiles")
        .select(SELECT)
        .eq("id", userId)
        .maybeSingle();
      setProfile((p as Profile | null) ?? null);
    },
  };
}
