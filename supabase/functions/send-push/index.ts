import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const PUBLIC_VAPID_KEY = Deno.env.get("VITE_PUBLIC_VAPID_KEY") || Deno.env.get("PUBLIC_VAPID_KEY") || "";
const PRIVATE_VAPID_KEY = Deno.env.get("PRIVATE_VAPID_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:podpora@mojisusedia.sk";

if (PUBLIC_VAPID_KEY && PRIVATE_VAPID_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, PUBLIC_VAPID_KEY, PRIVATE_VAPID_KEY);
}

serve(async (req) => {
  try {
    if (!PUBLIC_VAPID_KEY || !PRIVATE_VAPID_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing VAPID keys. Set PUBLIC_VAPID_KEY/VITE_PUBLIC_VAPID_KEY and PRIVATE_VAPID_KEY secrets.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const payloadData = await req.json();
    const record = payloadData.record;

    if (!record) {
      return new Response(
        JSON.stringify({ message: "Chýba record" }), 
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Získanie subskripcií: Ak record.user_id existuje, vybereme len jeho. Ak nie, vyberieme VŠETKY subskripcie v databáze!
    let query = supabase.from("user_push_subscriptions").select("subscription, user_id");
    
    if (record.user_id) {
      query = query.eq("user_id", record.user_id);
    }

    const { data: subscriptions, error } = await query;

    if (error || !subscriptions || subscriptions.length === 0) {
      console.log(`Žiadne push subskripcie pre ciel`);
      return new Response(
        JSON.stringify({ message: "Nenašli sa žiadne subskripcie" }), 
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const pushPayload = JSON.stringify({
      title: record.title || "Moji Susedia",
      body: record.body || "Máte novú správu v aplikácii.",
      url: record.ref_id ? `/chat/${record.ref_id}` : "/",
    });

    const pushOptions = {
      TTL: 86400,
      headers: {
        "Urgency": "high",
        "Topic": record.type || "system",
      },
    };

    let sentCount = 0;
    let failedCount = 0;

    const sendPromises = subscriptions.map(async (subRow) => {
      try {
        await webpush.sendNotification(subRow.subscription, pushPayload, pushOptions);
        sentCount += 1;
      } catch (err: any) {
        failedCount += 1;
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
      JSON.stringify({
        success: failedCount === 0,
        attempted: subscriptions.length,
        sent: sentCount,
        failed: failedCount,
      }),
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