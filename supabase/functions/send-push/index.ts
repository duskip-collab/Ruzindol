import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// Načítanie VAPID kľúčov zo Supabase Secretov a prostredia
const PUBLIC_VAPID_KEY = Deno.env.get("VITE_PUBLIC_VAPID_KEY") || "";
const PRIVATE_VAPID_KEY = Deno.env.get("PRIVATE_VAPID_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:podpora@mojisusedia.sk";

// Nastavenie konfigurácie pre Web Push
if (PUBLIC_VAPID_KEY && PRIVATE_VAPID_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, PUBLIC_VAPID_KEY, PRIVATE_VAPID_KEY);
}

serve(async (req) => {
  try {
    // 1. Prijatie dát z Database Webhooku (obsahuje vložený riadok tabuľky notifications)
    const payloadData = await req.json();
    const record = payloadData.record; // 'record' obsahuje nový riadok podľa AppNotification typu

    if (!record || !record.user_id) {
      return new Response(
        JSON.stringify({ message: "Chýba record alebo user_id" }), 
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Pripojenie k Supabase databáze s Admin právami (Service Role Key)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Vyhľadanie uloženej Push Subskripcie pre používateľa z tabuľky user_push_subscriptions
    const { data: subscriptions, error } = await supabase
      .from("user_push_subscriptions")
      .select("subscription")
      .eq("user_id", record.user_id);

    if (error || !subscriptions || subscriptions.length === 0) {
      console.log(`Žiadne push subskripcie pre user_id: ${record.user_id}`);
      return new Response(
        JSON.stringify({ message: "Nenašla sa žiadna subskripcia" }), 
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. Príprava obsahu notifikácie pre mobil / počítač
    const pushPayload = JSON.stringify({
      title: record.title || "Moji Susedia",
      body: record.body || "Máte novú správu v aplikácii.",
      url: record.ref_id ? `/chat/${record.ref_id}` : "/",
    });

    const pushOptions = {
      TTL: 86400, // Notifikácia počká 24 hodín na doručenie (ak je mobil vypnutý alebo offline)
      headers: {
        "Urgency": "high", // KĽÚČOVÉ PRE ANDROID: Vyžaduje okamžité prebudenie Service Workera na pozadí
        "Topic": record.type || "system",
      },
    };

    // 5. Odoslanie push notifikácie na všetky zariadenia používateľa
    const sendPromises = subscriptions.map(async (subRow) => {
      try {
        await webpush.sendNotification(subRow.subscription, pushPayload, pushOptions);
      } catch (err: any) {
        // Ak subskripcia už neplatí (napr. používateľ odinštaloval appku), vymažeme starý token
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase
            .from("user_push_subscriptions")
            .delete()
            .eq("subscription", subRow.subscription);
        }
        console.error("Chyba pri odosielaní push notifikácie:", err);
      }
    });

    await Promise.all(sendPromises);

    return new Response(
      JSON.stringify({ success: true }), 
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Chyba v send-push Edge Funkcii:", err);
    return new Response(
      JSON.stringify({ error: err.message }), 
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});