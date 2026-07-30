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
      setLoading(true);
      setError(null);
      try {
        const { data } = await withTimeout(
          () => retryAsync(() => supabase.auth.getUser(), { retries: 1, delayMs: 250 }),
          7000,
          "Overenie prihlásenia trvalo príliš dlho.",
        );
        const uid = data.user?.id ?? null;
        if (!mounted) return;

        setUserId(uid);

        if (!uid) {
          setProfile(null);
          return;
        }

        let { data: p } = await withTimeout(
          () =>
            retryAsync(() => supabase.from("profiles").select(SELECT).eq("id", uid).maybeSingle(), {
              retries: 1,
              delayMs: 250,
            }),
          7000,
          "Načítanie profilu trvalo príliš dlho.",
        );

        // Self-heal: if profile row is missing, create a minimal one so UI is not stuck.
        if (!p) {
          const defaultName =
            (data.user?.user_metadata?.name as string | undefined) ??
            fallbackName(data.user?.email ?? null);

          await withTimeout(
            () =>
              retryAsync(
                () =>
                  supabase.from("profiles").upsert({
                    id: uid,
                    name: defaultName,
                    role: "Sused",
                  }),
                { retries: 1, delayMs: 250 },
              ),
            7000,
            "Vytvorenie profilu trvalo príliš dlho.",
          );

          const refetch = await withTimeout(
            () =>
              retryAsync(
                () => supabase.from("profiles").select(SELECT).eq("id", uid).maybeSingle(),
                { retries: 1, delayMs: 250 },
              ),
            7000,
            "Opätovné načítanie profilu trvalo príliš dlho.",
          );
          p = refetch.data;
        }

        if (!mounted) return;
        setProfile((p as Profile | null) ?? null);
      } catch (e) {
        console.error("useCurrentUser load failed", e);
        if (!mounted) return;
        setProfile(null);
        setError("Nepodarilo sa načítať používateľa. Skús obnoviť stránku.");
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
      if (!userId) return;
      try {
        const { data: p } = await withTimeout(
          () =>
            retryAsync(
              () => supabase.from("profiles").select(SELECT).eq("id", userId).maybeSingle(),
              { retries: 1, delayMs: 250 },
            ),
          7000,
          "Obnova profilu trvala príliš dlho.",
        );
        setProfile((p as Profile | null) ?? null);
      } catch (e) {
        console.error("useCurrentUser refresh failed", e);
      }
    },
  };
}
