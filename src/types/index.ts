import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// Bezpečná podpora pre rôzne názvy premenných v Supabase Secrets
const PUBLIC_VAPID_KEY = 
  Deno.env.get("VAPID_PUBLIC_KEY") || 
  Deno.env.get("PUBLIC_VAPID_KEY") || 
  Deno.env.get("VITE_PUBLIC_VAPID_KEY") || 
  "";
const PRIVATE_VAPID_KEY = 
  Deno.env.get("VAPID_PRIVATE_KEY") || 
  Deno.env.get("PRIVATE_VAPID_KEY") || 
  "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@mojisusedia.sk";

// Konfigurácia Web Push
if (PUBLIC_VAPID_KEY && PRIVATE_VAPID_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, PUBLIC_VAPID_KEY, PRIVATE_VAPID_KEY);
} else {
  console.error("CHYBA: Chýbajú VAPID kľúče v environment premenných!");
}

serve(async (req) => {
  console.log("=== SEND-PUSH FUNCTION TRIGGERED ===");
  try {
    // 1. Prijatie dát z Database Webhooku
    const payloadData = await req.json();
    console.log("Prijatý payload:", JSON.stringify(payloadData));

    // Flexibilné parsovanie: podporuje { record: { ... } } aj priamy objekt { user_id: ... }
    const record = payloadData.record || payloadData;

    if (!record || !record.user_id) {
      console.warn("Chýbajúce record alebo user_id v datasete.");
      return new Response(JSON.stringify({ message: "Chýbajúce record alebo user_id" }), { status: 400 });
    }

    // 2. Pripojenie k Supabase databáze cez Service Role Key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Vyhľadanie Push Subskripcií pre daného používateľa
    const { data: subscriptions, error } = await supabase
      .from("user_push_subscriptions")
      .select("id, subscription, endpoint")
      .eq("user_id", record.user_id);

    if (error) {
      console.error("Chyba pri čítaní z user_push_subscriptions:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`Žiadne push subskripcie pre user_id: ${record.user_id}`);
      return new Response(JSON.stringify({ message: "Žiadna subskripcia nenájdená", skipped: true }), { status: 200 });
    }

    // 4. Príprava obsahu notifikácie
    const pushPayload = JSON.stringify({
      title: record.title || "Moji Susedia",
      body: record.body || "Máte novú správu v susedstve.",
      url: record.ref_id ? `/chat/${record.ref_id}` : (record.url || "/"),
    });

    const pushOptions = {
      TTL: 86400, // Notifikácia počká 24h na doručenie
      headers: {
        "Urgency": "high", // Kľúčové pre prebudenie mobilu (Android/iOS)
        "Topic": record.type || "system"
      }
    };

    let sentCount = 0;
    let failedCount = 0;

    // 5. Odoslanie notifikácie na všetky zariadenia používateľa
    const sendPromises = subscriptions.map(async (subRow) => {
      const endpoint = subRow.endpoint || (subRow.subscription && typeof subRow.subscription === "object" ? subRow.subscription.endpoint : null);

      try {
        await webpush.sendNotification(subRow.subscription, pushPayload, pushOptions);
        sentCount++;
        console.log(`Push úspešne odoslaný na endpoint: ${endpoint ? endpoint.slice(0, 30) + "..." : "neznámy"}`);
      } catch (err: any) {
        failedCount++;
        const status = err?.statusCode ?? err?.status;
        console.error(`Chyba pri odosielaní na zariadenie (status ${status}):`, err);

        // Ak je subskripcia neplatná/vypršaná, vymažeme ju z DB
        if ((status === 410 || status === 404) && endpoint) {
          console.log(`Mažem neplatnú subskripciu s endpointom: ${endpoint.slice(0, 30)}...`);
          await supabase
            .from("user_push_subscriptions")
            .delete()
            .eq("endpoint", endpoint);
        }
      }
    });

    await Promise.all(sendPromises);

    return new Response(JSON.stringify({ success: true, sent: sentCount, failed: failedCount }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error("Kritická chyba v Edge Funkcii send-push:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});