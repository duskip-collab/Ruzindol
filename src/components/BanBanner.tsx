import { useEffect, useState } from "react";
import { Ban, Mail } from "lucide-react";
import type { Profile } from "@/hooks/useCurrentUser";

const CONTACT_EMAIL = "info@ruzindol.sk";

function daysLeft(until: string, nowMs: number): number {
  const diffMs = new Date(until).getTime() - nowMs;
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function BanBanner({
  profile,
  variant = "full",
}: {
  profile: Pick<Profile, "banned_until" | "ban_reason" | "name">;
  variant?: "full" | "compact";
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (!profile.banned_until) return null;
  const until = new Date(profile.banned_until);
  if (until.getTime() <= nowMs) return null;

  const left = daysLeft(profile.banned_until, nowMs);
  const subject = encodeURIComponent(`Žiadosť o odblokovanie — ${profile.name}`);
  const body = encodeURIComponent(
    `Dobrý deň,\n\nchcem požiadať o odblokovanie môjho účtu.\nBan trvá do: ${until.toLocaleDateString("sk-SK")} (${left} dní).\nDôvod (podľa systému): ${profile.ban_reason ?? "—"}\n\nĎakujem.`,
  );
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200">
        <Ban className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          Zablokovaný · zostáva {left} {left === 1 ? "deň" : left < 5 ? "dni" : "dní"}
        </span>
        <a
          href={mailto}
          className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
        >
          <Mail className="h-3 w-3" /> Kontakt
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-600 text-white">
          <Ban className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-rose-900 dark:text-rose-100">
            Váš účet je dočasne zablokovaný
          </h3>
          <p className="text-[11px] text-rose-700 dark:text-rose-300">
            Zostáva {left} {left === 1 ? "deň" : left < 5 ? "dni" : "dní"} · do{" "}
            {until.toLocaleDateString("sk-SK", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>
      {profile.ban_reason && (
        <p className="mb-3 rounded-lg bg-rose-500/12 px-3 py-2 text-xs italic text-rose-200">
          „{profile.ban_reason}"
        </p>
      )}
      <p className="mb-3 text-xs text-rose-800 dark:text-rose-200">
        Počas blokácie môžete obsah iba čítať. Ak si myslíte, že ide o omyl, kontaktujte starostu
        alebo administrátora.
      </p>
      <a
        href={mailto}
        className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
      >
        <Mail className="h-3.5 w-3.5" /> Kontaktovať správcu
      </a>
    </div>
  );
}
