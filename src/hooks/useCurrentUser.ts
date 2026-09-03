import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { retryAsync, withTimeout } from "@/lib/async-guard";

export type ProfileRole = "Sused" | "Starosta" | "VIP_Firma" | "Uradnik" | "Farar";

export type Profile = {
  id: string;
  name: string;
  street: string | null;
  role: ProfileRole;
  is_active_neighbor: boolean;
  municipality_id: string | null;
  invite_code: string | null;
  banned_until: string | null;
  ban_reason: string | null;
};

const SELECT =
  "id, name, street, role, is_active_neighbor, municipality_id, invite_code, banned_until, ban_reason";

function fallbackName(email?: string | null) {
  if (!email) return "Sused";
  const local = email.split("@")[0]?.trim();
  return local ? local.slice(0, 32) : "Sused";
}

export function useCurrentUser() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    (async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Bezpečné získanie auth user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.warn("[useCurrentUser] getUser chyba:", userError);
          if (mounted) {
            setUserId(null);
            setProfile(null);
            setLoading(false);
          }
          return;
        }
        
        if (!user) {
          console.info("[useCurrentUser] Žiadny autentifikovaný user");
          if (mounted) {
            setUserId(null);
            setProfile(null);
            setLoading(false);
          }
          return;
        }

        // Validácia userId
        if (!user.id || typeof user.id !== "string" || user.id.trim() === "") {
          console.error("[useCurrentUser] Invalid user.id:", user.id);
          if (mounted) {
            setUserId(null);
            setProfile(null);
            setError("Neplatné user ID");
            setLoading(false);
          }
          return;
        }

        setUserId(user.id);

        // Načítaj profil z databázy
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select(SELECT)
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.warn("[useCurrentUser] Profile load chyba:", profileError);
          if (mounted) {
            setProfile(null);
            setError("Nepodarilo sa načítať profil");
          }
        } else if (mounted) {
          setProfile((profileData as Profile | null) ?? null);
        }
      } catch (e) {
        console.error("[useCurrentUser] Neočakávaná chyba:", e);
        if (mounted) {
          setProfile(null);
          setUserId(null);
          setError("Nepodarilo sa načítať používateľa. Skús obnoviť stránku.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return {
    userId,
    profile,
    loading,
    error,
    refresh: async () => {
      if (!userId) {
        console.warn("[useCurrentUser.refresh] Žiadny userId");
        return;
      }
      try {
        const { data: p, error: err } = await withTimeout(
          () =>
            retryAsync(
              () =>
                supabase
                  .from("profiles")
                  .select(SELECT)
                  .eq("id", userId)
                  .maybeSingle(),
              { retries: 1, delayMs: 250 },
            ),
          7000,
          "Obnova profilu trvala príliš dlho.",
        );
        
        if (err) {
          console.error("[useCurrentUser.refresh] Chyba:", err);
          setError("Obnova profilu zlyhala");
        } else {
          setProfile((p as Profile | null) ?? null);
          setError(null);
        }
      } catch (e) {
        console.error("[useCurrentUser.refresh] Neočakávaná chyba:", e);
        setError("Obnova profilu zlyhala");
      }
    },
  };
}
