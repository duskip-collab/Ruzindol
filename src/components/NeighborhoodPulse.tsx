import { useEffect, useMemo, useRef, useState } from "react";
import { Sun, Sunrise, Sunset, MapPin } from "lucide-react";

/**
 * Neighborhood Pulse — real interactive OpenStreetMap (Leaflet) with an
 * animated glow overlay for key village zones. Intensity/radius reacts to
 * the selected time-of-day filter.
 */

type TimeOfDay = "morning" | "noon" | "evening";

interface Zone {
  key: string;
  label: string;
  lat: number;
  lng: number;
  // Base weight per zone at each daypart (0..1).
  weights: Record<TimeOfDay, number>;
  color: string; // hex without alpha
}

// Mock GPS around a Slovak village center (example: Modra ~48.3341, 17.3086).
const CENTER: [number, number] = [48.3341, 17.3086];

const ZONES: Zone[] = [
  {
    key: "namestie",
    label: "Námestie",
    lat: 48.3345,
    lng: 17.3088,
    weights: { morning: 0.55, noon: 0.95, evening: 0.7 },
    color: "#f59e0b",
  },
  {
    key: "trhovisko",
    label: "Trhovisko",
    lat: 48.3335,
    lng: 17.3105,
    weights: { morning: 0.95, noon: 0.6, evening: 0.25 },
    color: "#10b981",
  },
  {
    key: "park",
    label: "Park",
    lat: 48.3352,
    lng: 17.3072,
    weights: { morning: 0.4, noon: 0.7, evening: 0.9 },
    color: "#22d3ee",
  },
  {
    key: "skola",
    label: "Škola",
    lat: 48.3328,
    lng: 17.3062,
    weights: { morning: 0.9, noon: 0.85, evening: 0.15 },
    color: "#6366f1",
  },
  {
    key: "kostol",
    label: "Kostol",
    lat: 48.3348,
    lng: 17.3110,
    weights: { morning: 0.5, noon: 0.35, evening: 0.85 },
    color: "#a855f7",
  },
];

const TIME_LABEL: Record<TimeOfDay, { label: string; icon: React.ReactNode }> = {
  morning: { label: "Ráno", icon: <Sunrise className="h-3.5 w-3.5" /> },
  noon: { label: "Poludnie", icon: <Sun className="h-3.5 w-3.5" /> },
  evening: { label: "Večer", icon: <Sunset className="h-3.5 w-3.5" /> },
};

export function NeighborhoodPulse() {
  const [tod, setTod] = useState<TimeOfDay>("noon");
  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);
  const layerRef = useRef<unknown>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);

  // Load Leaflet only in the browser.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined") return;
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;
      LRef.current = L;

      const map = L.map(containerRef.current, {
        center: CENTER,
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);
      L.control.attribution({ position: "bottomright", prefix: false })
        .addAttribution("© OpenStreetMap")
        .addTo(map);

      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      const m = mapRef.current as { remove?: () => void } | null;
      m?.remove?.();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  const zonesForTod = useMemo(
    () =>
      ZONES.map((z) => ({
        ...z,
        intensity: z.weights[tod],
      })),
    [tod],
  );

  // Rebuild markers whenever intensity changes.
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current as
      | (import("leaflet").Map & { removeLayer: (l: unknown) => void })
      | null;
    if (!ready || !L || !map) return;

    if (layerRef.current) map.removeLayer(layerRef.current);

    const group = L.layerGroup();
    for (const z of zonesForTod) {
      const radius = 14 + z.intensity * 22; // px
      const glow = 8 + z.intensity * 18; // px
      const html = `
        <div class="np-pulse" style="--np-color:${z.color};--np-size:${radius}px;--np-glow:${glow}px;">
          <span class="np-dot"></span>
          <span class="np-ring"></span>
          <span class="np-label">${z.label}</span>
        </div>`;
      const icon = L.divIcon({
        html,
        className: "np-icon",
        iconSize: [radius * 2, radius * 2],
        iconAnchor: [radius, radius],
      });
      L.marker([z.lat, z.lng], { icon, interactive: false }).addTo(group);
    }
    group.addTo(map);
    layerRef.current = group;
  }, [zonesForTod, ready]);

  return (
    <section className="overflow-hidden rounded-3xl border border-neutral-200/60 bg-white/80 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            <MapPin className="h-4 w-4" />
            Neighborhood Pulse
          </h3>
          <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
            Živá mapa aktivít v obci
          </p>
        </div>
        <div className="flex overflow-hidden rounded-full border border-neutral-200 bg-white/70 p-0.5 text-[11px] dark:border-white/10 dark:bg-white/5">
          {(Object.keys(TIME_LABEL) as TimeOfDay[]).map((k) => (
            <button
              key={k}
              onClick={() => setTod(k)}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-medium transition ${
                tod === k
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-600 dark:text-neutral-300"
              }`}
            >
              {TIME_LABEL[k].icon}
              {TIME_LABEL[k].label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative mt-3">
        <div
          ref={containerRef}
          className="h-64 w-full bg-neutral-100 dark:bg-neutral-900"
        />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500">
            Načítavam mapu…
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 px-4 py-3">
        {zonesForTod.map((z) => (
          <span
            key={z.key}
            className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white/70 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background: z.color,
                boxShadow: `0 0 ${4 + z.intensity * 10}px ${z.color}`,
              }}
            />
            {z.label} · {Math.round(z.intensity * 100)}%
          </span>
        ))}
      </div>

      <style>{`
        .np-icon { background: transparent !important; border: 0 !important; }
        .np-pulse {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .np-pulse .np-dot {
          position: absolute;
          width: 12px;
          height: 12px;
          border-radius: 9999px;
          background: var(--np-color);
          box-shadow: 0 0 var(--np-glow) var(--np-color);
        }
        .np-pulse .np-ring {
          position: absolute;
          width: var(--np-size);
          height: var(--np-size);
          border-radius: 9999px;
          border: 2px solid var(--np-color);
          opacity: 0.7;
          animation: npPulse 2.2s ease-out infinite;
        }
        .np-pulse .np-label {
          position: absolute;
          top: calc(50% + calc(var(--np-size) / 2) + 4px);
          left: 50%;
          transform: translateX(-50%);
          font-size: 10px;
          font-weight: 600;
          color: #111;
          background: rgba(255,255,255,0.85);
          padding: 1px 6px;
          border-radius: 9999px;
          white-space: nowrap;
          pointer-events: none;
        }
        @keyframes npPulse {
          0%   { transform: scale(0.4); opacity: 0.8; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </section>
  );
}
