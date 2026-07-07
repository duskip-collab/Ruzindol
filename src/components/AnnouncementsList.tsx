import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  published_at: string;
}

export function AnnouncementsList() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  // 1. Načítanie existujúcich dát pri štarte
  useEffect(() => {
    async function fetchAnnouncements() {
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .order("published_at", { ascending: false });
      
      if (data) setAnnouncements(data);
    }

    fetchAnnouncements();

    // 2. Implementácia Realtime "počúvania"
    const channel = supabase
      .channel("public:announcements")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "announcements" },
        (payload) => {
          console.log("Realtime event prijatý:", payload);
          // Okamžite pridá nové oznámenie na začiatok zoznamu
          setAnnouncements((prev) => [payload.new as Announcement, ...prev]);
        }
      )
      .subscribe((status) => {
        console.log("Realtime status:", status);
      });

    // Cleanup pri odchode zo stránky
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="space-y-4">
      {announcements.map((item) => (
        <div key={item.id} className="p-4 bg-white rounded-lg shadow">
          <h3 className="font-bold">{item.title}</h3>
          <p className="text-sm text-gray-600">{item.content}</p>
          <span className="text-xs text-blue-500 uppercase">{item.priority}</span>
        </div>
      ))}
    </div>
  );
}