import { supabase } from "@/integrations/supabase/client";
import { isIosDevice, isStandaloneMode } from "@/lib/pwa";

const PUBLIC_VAPID_KEY = import.meta.env.VITE_PUBLIC_VAPID_KEY;
let swPushMessageListenerAttached = false;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function getPushServiceWorkerRegistration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

function ensurePushMessageListener() {
  if (swPushMessageListenerAttached || !("serviceWorker" in navigator)) return;

  navigator.serviceWorker.addEventListener("message", (event) => {
    const messageType = (event.data as { type?: string } | null)?.type;
    if (messageType !== "PUSH_SUBSCRIPTION_REFRESH_REQUIRED") return;

    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      syncPushSubscriptionSilently().catch((error) => {
        console.error("Chyba pri refreshi push subskripcie zo SW správy:", error);
      });
    }
  });

  swPushMessageListenerAttached = true;
}

function isMissingEndpointColumnOrConstraint(error: unknown) {
  const err = error as { message?: string; code?: string } | null;
  const message = String(err?.message ?? "").toLowerCase();
  return (
    err?.code === "42703" ||
    err?.code === "42P10" ||
    message.includes("endpoint") ||
    message.includes("constraint")
  );
}

type SubscribeToPushOptions = {
  requestPermission?: boolean;
};

export async function subscribeToPush(options: SubscribeToPushOptions = {}) {
  try {
    const { requestPermission = true } = options;

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("Push notifikácie nie sú podporované v tomto prehliadači.");
      return false;
    }

    if (!PUBLIC_VAPID_KEY) {
      console.error("VITE_PUBLIC_VAPID_KEY nie je nastavený v .env súbore!");
      return false;
    }

    if (typeof Notification === "undefined") {
      console.warn("Notification API nie je podporované v tomto prehliadači.");
      return false;
    }

    if (requestPermission && isIosDevice() && !isStandaloneMode()) {
      console.warn("Na iOS je možné povoliť notifikácie až po pridaní aplikácie na plochu.");
      return false;
    }

    const permission = requestPermission
      ? await Notification.requestPermission()
      : Notification.permission;

    if (permission !== "granted") {
      console.warn("Používateľ nepovolil notifikácie.");
      return false;
    }

    const registration = await getPushServiceWorkerRegistration();
    await navigator.serviceWorker.ready;
    ensurePushMessageListener();

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
      });
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      console.warn("Používateľ nie je prihlásený, subskripcia sa neuloží.");
      return false;
    }

    const serializedSubscription = subscription.toJSON();
    if (!serializedSubscription.endpoint) {
      console.error("Neplatná push subskripcia: chýba endpoint.");
      return false;
    }

    const endpoint = serializedSubscription.endpoint;

    // Prefer endpoint-based upsert so one user can have multiple active devices.
    const { error: endpointError } = await (supabase as any).from("user_push_subscriptions").upsert(
      {
        user_id: session.user.id,
        endpoint,
        subscription: serializedSubscription,
        user_agent: navigator.userAgent,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );

    if (!endpointError) {
      console.log("Push notifikácie úspešne aktivované a uložené!");
      return true;
    }

    if (!isMissingEndpointColumnOrConstraint(endpointError)) {
      console.error("Chyba pri ukladaní subskripcie do Supabase:", endpointError);
      return false;
    }

    // Backward-compatible fallback for older schema (single subscription per user).
    const { error } = await (supabase as any).from("user_push_subscriptions").upsert(
      {
        user_id: session.user.id,
        subscription: serializedSubscription,
      },
      { onConflict: "user_id" },
    );

    if (error) {
      console.error("Chyba pri ukladaní subskripcie do Supabase:", error);
      return false;
    } else {
      console.log("Push notifikácie úspešne aktivované a uložené!");
      return true;
    }
  } catch (error) {
    console.error("Neočakávaná chyba pri subscribeToPush:", error);
    return false;
  }
}

// Public helper aligned with standard frontend Web Push onboarding flow.
export async function enableNotifications() {
  return subscribeToPush({ requestPermission: true });
}

export async function syncPushSubscriptionSilently() {
  return subscribeToPush({ requestPermission: false });
}