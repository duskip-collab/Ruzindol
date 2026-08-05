import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { evaluatePushDecision, parseWebhookRecord } from "./logic.ts";

const PUBLIC_VAPID_KEY = Deno.env.get("VITE_PUBLIC_VAPID_KEY") || Deno.env.get("PUBLIC_VAPID_KEY") || "";
const PRIVATE_VAPID_KEY = Deno.env.get("PRIVATE_VAPID_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:podpora@mojisusedia.sk";

if (PUBLIC_VAPID_KEY && PRIVATE_VAPID_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, PUBLIC_VAPID_KEY, PRIVATE_VAPID_KEY);
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isMissingRelationOrColumnError(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  const msg = String(e?.message ?? "").toLowerCase();
  return e?.code === "42703" || e?.code === "42P01" || msg.includes("column") || msg.includes("relation");
}

function resolveTargetUrl(record: Record<string, unknown>, critical: boolean): string {
  const recordUrl = typeof record.url === "string" ? record.url : null;
  if (recordUrl && recordUrl.startsWith("/")) return recordUrl;

  const type = String(record.type ?? "").toLowerCase();
  const refId = typeof record.ref_id === "string" ? record.ref_id : null;

  if (type === "message" && refId) return `/chat/${refId}`;
  if (type === "official_alert" || type === "hlasnik") return "/nastenka";
  if (type === "announcement" || type === "group_announcement") return "/aktuality";
  if (critical) return "/aktuality";
  return "/";
}

async function loadSubscriptions(supabase: ReturnType<typeof createClient>, userId: string) {
  const withEndpoint = await supabase
    .from("user_push_subscriptions")
    .select("id, subscription, user_id, endpoint")
    .eq("user_id", userId);

  if (!withEndpoint.error) return withEndpoint;
  if (!isMissingRelationOrColumnError(withEndpoint.error)) return withEndpoint;

  return supabase
    .from("user_push_subscriptions")
    .select("subscription, user_id")
    .eq("user_id", userId);
}

async function shouldSendOptionalNotification(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<boolean> {
  // Prefer explicit per-user settings table if present.
  const settingsResult = await supabase
    .from("user_settings")
    .select("notifications_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (!settingsResult.error && settingsResult.data) {
    return settingsResult.data.notifications_enabled !== false;
  }

  if (settingsResult.error && !isMissingRelationOrColumnError(settingsResult.error)) {
    console.error("Chyba pri čítaní user_settings.notifications_enabled:", settingsResult.error);
  }

  // Fallback to profiles.notifications_enabled if the column exists.
  const profileResult = await supabase
    .from("profiles")
    .select("notifications_enabled")
    .eq("id", userId)
    .maybeSingle();

  if (!profileResult.error && profileResult.data) {
    return profileResult.data.notifications_enabled !== false;
  }

  if (profileResult.error && !isMissingRelationOrColumnError(profileResult.error)) {
    console.error("Chyba pri čítaní profiles.notifications_enabled:", profileResult.error);
  }

  // If settings storage is not available, default to send instead of silently dropping alerts.
  return true;
}

serve(async (req) => {
  try {
    if (!PUBLIC_VAPID_KEY || !PRIVATE_VAPID_KEY || !VAPID_SUBJECT) {
      return json(
        {
          success: false,
          error:
            "Missing VAPID secrets. Set PUBLIC_VAPID_KEY (or VITE_PUBLIC_VAPID_KEY), PRIVATE_VAPID_KEY and VAPID_SUBJECT.",
        },
        500,
      );
    }

    const payloadData = await req.json();
    const record = parseWebhookRecord(payloadData);
    const decision = evaluatePushDecision(record);

    if (!record || decision.reason === "missing_record") {
      return json({ success: false, message: "Chýba record" }, 400);
    }

    if (decision.reason === "missing_user_id") {
      // Graceful no-op: malformed payload must not crash function.
      console.warn("send-push: record neobsahuje user_id, push sa preskakuje.");
      return json({ success: true, skipped: true, reason: "missing_user_id" });
    }

    const userId = decision.userId as string;
    const critical = decision.critical;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!critical) {
      const enabled = await shouldSendOptionalNotification(supabase, userId);
      const optionalDecision = evaluatePushDecision(record, enabled);
      if (!optionalDecision.shouldSend) {
        return json({ success: true, skipped: true, reason: optionalDecision.reason });
      }
    }

    const { data: subscriptions, error } = await loadSubscriptions(supabase, userId);

    if (error) {
      console.error("Chyba pri načítaní user_push_subscriptions:", error);
      return json({ success: false, error: "subscription_query_failed" }, 500);
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`Žiadne push subskripcie pre user_id: ${userId}`);
      return json({ success: true, message: "Žiadna subskripcia nenájdená", skipped: true });
    }

    const pushPayload = JSON.stringify({
      title: record.title || "Moji Susedia",
      body: record.body || "Máte novú správu v aplikácii.",
      url: resolveTargetUrl(record, critical),
      priority: critical ? "high" : "normal",
      renotify: critical,
      requireInteraction: critical,
      vibrate: critical ? [300, 120, 300, 120, 500] : [120, 80, 120],
      sound: "default",
      tag: record.type ? `komunita-${record.type}` : "komunita-system",
      isCritical: critical,
    });

    const pushOptions = {
      TTL: critical ? 3600 : 86400,
      headers: {
        "Urgency": critical ? "high" : "normal",
        "Topic": record.type || "system",
      },
    };

    let sentCount = 0;
    let failedCount = 0;

    const sendPromises = subscriptions.map(async (subRow) => {
      try {
        await webpush.sendNotification((subRow as any).subscription, pushPayload, pushOptions);
        sentCount += 1;
      } catch (err: any) {
        failedCount += 1;
        if (err.statusCode === 410 || err.statusCode === 404) {
          const endpoint =
            (subRow as any).endpoint ||
            ((subRow as any).subscription && typeof (subRow as any).subscription === "object"
              ? (subRow as any).subscription.endpoint
              : null);

          if ((subRow as any).id) {
            await supabase.from("user_push_subscriptions").delete().eq("id", (subRow as any).id);
          } else if (endpoint) {
            await supabase.from("user_push_subscriptions").delete().eq("endpoint", endpoint);
          }
        }
        console.error("Chyba pri odosielaní push notifikácie:", err);
      }
    });

    await Promise.all(sendPromises);

    return json({
        success: failedCount === 0,
        attempted: subscriptions.length,
        sent: sentCount,
        failed: failedCount,
        critical,
      });
  } catch (err: any) {
    console.error("Chyba v send-push Edge Funkcii:", err);
    return json({ error: err.message }, 500);
  }
});