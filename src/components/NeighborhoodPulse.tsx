import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Sun, Sunrise, Sunset } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

/**
 * Neighborhood Pulse renders a live OpenStreetMap view centered on the
 * current municipality. The pulse markers are positioned relative to the
 * municipality coordinates that come from the database.
 */

type TimeOfDay = "morning" | "noon" | "evening";

interface Zone {
  key: string;
  label: string;
  lat: number;
  lng: number;
  weights: Record<TimeOfDay, number>;
  color: string;
}

type MunicipalityRow = {
  id: string;
  name: string;
  slug: string;
  region: string | null;
  logo_url: string | null;
  latitude: number | null;
  longitude: number | null;
};

type ZoneTemplate = {
  key: string;
  label: string;
  latOffset: number;
  lngOffset: number;
  weights: Record<TimeOfDay, number>;
  color: string;
};

const DEFAULT_CENTER: [number, number] = [48.37001, 17.4943815];
const DEFAULT_ZOOM = 15;

const ZONE_TEMPLATES: ZoneTemplate[] = [
  {
    key: "centrum",
    label: "Centrum",
    latOffset: 0.00035,
    lngOffset: 0.00025,
    weights: { morning: 0.55, noon: 0.95, evening: 0.7 },
    color: "#f59e0b",
  },
  {
    key: "trh",
    label: "Trh",
    latOffset: -0.00055,
    lngOffset: 0.00115,
    weights: { morning: 0.95, noon: 0.6, evening: 0.25 },
    color: "#10b981",
  },
  {
    key: "park",
    label: "Park",
    latOffset: 0.0011,
    lngOffset: -0.0009,
    weights: { morning: 0.4, noon: 0.7, evening: 0.9 },
    color: "#22d3ee",
  },
  {
    key: "skola",
    label: "Škola",
    latOffset: -0.0012,
    lngOffset: -0.00145,
    weights: { morning: 0.9, noon: 0.85, evening: 0.15 },
    color: "#6366f1",
  },
  {
    key: "kostol",
    label: "Kostol",
    latOffset: 0.0007,
    lngOffset: 0.0018,
    weights: { morning: 0.5, noon: 0.35, evening: 0.85 },
    color: "#a855f7",
  },
];

const TIME_LABEL: Record<TimeOfDay, { label: string; icon: React.ReactNode }> = {
  morning: { label: "Ráno", icon: <Sunrise className="h-3.5 w-3.5" /> },
  noon: { label: "Poludnie", icon: <Sun className="h-3.5 w-3.5" /> },
  evening: { label: "Večer", icon: <Sunset className="h-3.5 w-3.5" /> },
};

function buildZones(center: [number, number]): Zone[] {
  return ZONE_TEMPLATES.map((template) => ({
    key: template.key,
    label: template.label,
    lat: center[0] + template.latOffset,
    lng: center[1] + template.lngOffset,
    weights: template.weights,
    color: template.color,
  }));
}

export function NeighborhoodPulse() {
  const [tod, setTod] = useState<TimeOfDay>("noon");
  const [ready, setReady] = useState(false);
  const [municipality, setMunicipality] = useState<MunicipalityRow | null>(null);
  const { profile } = useCurrentUser();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!profile?.municipality_id) {
        setMunicipality(null);
        return;
      }

      const { data } = await supabase
        .from("municipalities")
        .select("id, name, slug, region, logo_url, latitude, longitude")
        .eq("id", profile.municipality_id)
        .maybeSingle();

      if (!cancelled) {
        setMunicipality((data as MunicipalityRow | null) ?? null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.municipality_id]);

  const center = useMemo<[number, number]>(() => {
    const latitude = municipality?.latitude ?? DEFAULT_CENTER[0];
    const longitude = municipality?.longitude ?? DEFAULT_CENTER[1];
    return [latitude, longitude];
  }, [municipality?.latitude, municipality?.longitude]);

  const zonesForTod = useMemo(
    () =>
      buildZones(center).map((zone) => ({
        ...zone,
        intensity: zone.weights[tod],
      })),
    [center, tod],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (typeof window === "undefined" || !containerRef.current) return;

      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;

      leafletRef.current = L;

      const map = L.map(containerRef.current, {
        center,
        zoom: DEFAULT_ZOOM,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);
      L.control
        .attribution({ position: "bottomright", prefix: false })
        .addAttribution("© OpenStreetMap")
        .addTo(map);

      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      layerRef.current?.remove();
      mapRef.current?.remove();
      layerRef.current = null;
      mapRef.current = null;
      leafletRef.current = null;
    };
  }, [center]);

  useEffect(() => {
    mapRef.current?.setView(center, DEFAULT_ZOOM);
  }, [center]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;

    layerRef.current?.remove();

    const group = L.layerGroup();
    for (const zone of zonesForTod) {
      const radius = 14 + zone.intensity * 22;
      const glow = 8 + zone.intensity * 18;
      const icon = L.divIcon({
        html: `
          <div class="np-pulse" style="--np-color:${zone.color};--np-size:${radius}px;--np-glow:${glow}px;">
            <span class="np-dot"></span>
            <span class="np-ring"></span>
            <span class="np-label">${zone.label}</span>
          </div>
        `,
        className: "np-icon",
        iconSize: [radius * 2, radius * 2],
        iconAnchor: [radius, radius],
      });

      L.marker([zone.lat, zone.lng], { icon, interactive: false }).addTo(group);
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
            {municipality?.name ?? "Ružindol"} pulse mapa
          </h3>
          <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
            Živá mapa aktivít v komunite {municipality?.name ?? "Ružindol"}
          </p>
        </div>
        <div className="flex overflow-hidden rounded-full border border-neutral-200 bg-white/70 p-0.5 text-[11px] dark:border-white/10 dark:bg-white/5">
          {(Object.keys(TIME_LABEL) as TimeOfDay[]).map((key) => (
            <button
              key={key}
              onClick={() => setTod(key)}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-medium transition ${
                tod === key
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-600 dark:text-neutral-300"
              }`}
            >
              {TIME_LABEL[key].icon}
              {TIME_LABEL[key].label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-3">
        <div ref={containerRef} className="h-64 w-full bg-neutral-100 dark:bg-neutral-900" />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500">
            Načítavam mapu komunity…
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 py-3">
        {zonesForTod.map((zone) => (
          <span
            key={zone.key}
            className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white/70 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:border-neutral-300 dark:bg-neutral-200 dark:text-neutral-900"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background: zone.color,
                boxShadow: `0 0 ${4 + zone.intensity * 10}px ${zone.color}`,
              }}
            />
            {zone.label} · {Math.round(zone.intensity * 100)}%
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
          background: rgba(255, 255, 255, 0.9);
          padding: 1px 6px;
          border-radius: 9999px;
          white-space: nowrap;
          pointer-events: none;
        }
        @keyframes npPulse {
          0% { transform: scale(0.4); opacity: 0.8; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </section>
  );
}
