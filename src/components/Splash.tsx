import { useEffect, useState } from "react";

// Splash screen: fade-in for ~500ms, hold, then fade-out at 1.5s, unmount at 2s.
export function Splash() {
  const [phase, setPhase] = useState<"in" | "out" | "done">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("out"), 1500);
    const t2 = setTimeout(() => setPhase("done"), 2000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (phase === "done") return null;

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-sky-50 transition-opacity duration-500 ${
        phase === "in" ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden
    >
      <img
        src="/icon-192.png"
        alt=""
        className="h-24 w-24 rounded-3xl shadow-xl ring-1 ring-black/5"
      />
      <h1 className="mt-4 text-lg font-semibold tracking-tight text-neutral-800">Komunita</h1>
      <p className="mt-1 text-xs text-neutral-500">Váš obecný priestor</p>
    </div>
  );
}
