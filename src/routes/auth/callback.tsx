import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      const sessionResult = await supabase.auth.getSession();

      if (sessionResult.data.session) {
        await navigate({ to: "/", replace: true });
        return;
      }

      const code = new URLSearchParams(window.location.search).get("code");
      if (!code) {
        await navigate({ to: "/auth", replace: true });
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error(error);
        await navigate({ to: "/auth", replace: true });
        return;
      }

      await navigate({ to: "/", replace: true });
    };

    void run();
  }, [navigate]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 text-slate-900">
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Prihlasovanie prebieha...
      </div>
    </div>
  );
}