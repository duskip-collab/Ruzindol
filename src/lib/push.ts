import { supabase } from "@/integrations/supabase/client";
import { isIosDevice, isStandaloneMode } from "@/lib/pwa";

const PUBLIC_VAPID_KEY = import.meta.env.VITE_PUBLIC_VAPID_KEY;
let swPushMessageListenerAttached = false;

// ✅ POISTKA PROTI SÚBEHU — Bráni paralelným upsertom a getSubscription()
let isSavingSubscription = false;
let isGettingSubscription = false;
let cachedSubscription: PushSubscription | null = null;
let subscriptionCacheTime = 0;

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

type SubscribeToPushOptions = {
  requestPermission?: boolean;
};

async function savePushSubscription(subscription: PushSubscription, userId: string) {
  if (isSavingSubscription) {
    console.info("[Push] Ukladanie už prebieha, paralelné volanie je ignorované");
    return false;
  }

  isSavingSubscription = true;

  try {
    const subJson = subscription.toJSON();

    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      console.error("[Push] Chyba: userId nie je dostupný alebo je neplatný!");
      return false;
    }

    if (!subscription.endpoint) {
      console.error("[Push] Subscription neobsahuje endpoint!");
      return false;
    }

    // 1. Skúsime najskôr použiť RPC funkciu (obchádza RLS 403 pri prepise endpointu)
    const { error: rpcError } = await supabase.rpc("save_push_subscription", {
      p_endpoint: subscription.endpoint,
      p_p256dh: subJson.keys?.p256dh || null,
      p_auth: subJson.keys?.auth || null,
    });

    if (!rpcError) {
      console.log("[Push] Push subskripcia úspešne uložená cez RPC.");
      return true;
    }

    // 2. Fallback na priamy upsert ak RPC neexistuje alebo zlyhá
    const payload = {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: subJson.keys?.p256dh || null,
      auth: subJson.keys?.auth || null,
      subscription: subJson,
      user_agent: navigator.userAgent,
      last_seen_at: new Date().toISOString(),
    };

    const { error: upsertError } = await (supabase as any)
      .from("user_push_subscriptions")
      .upsert(payload, { 
        onConflict: "endpoint"
      });

    if (upsertError) {
      console.error("[Push] Chyba pri upsert/RPC:", upsertError);
      return false;
    }

    console.log("[Push] Push subskripcia úspešne uložená cez upsert.");
    return true;
  } finally {
    isSavingSubscription = false;
  }
}

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

    const now = Date.now();
    if (isGettingSubscription || (cachedSubscription && now - subscriptionCacheTime < 1000)) {
      console.info("[Push] Používam cached subscription, paralelné getSubscription ignorované");
      const subscription = cachedSubscription;
      
      if (!subscription) {
        console.error("[Push] Cached subscription je null, nemôžeme pokračovať");
        return false;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        console.warn("[Push] Session nie je dostupná pre cached subscription");
        return false;
      }

      return await savePushSubscription(subscription, session.user.id);
    }

    isGettingSubscription = true;
    try {
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
        });
      }

      cachedSubscription = subscription;
      subscriptionCacheTime = Date.now();

      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        console.warn("[Push] Žiadna platná session alebo user.id nedostupné");
        return false;
      }

      const userId = session.user.id;

      if (typeof userId !== "string" || userId.trim() === "") {
        console.error("[Push] Chyba: session.user.id je neplatný string");
        return false;
      }

      const saved = await savePushSubscription(subscription, userId);
      if (saved) {
        console.log("[Push] Push notifikácie úspešne aktivované a uložené!");
        return true;
      }

      console.warn("[Push] savePushSubscription vrátilo false, zastavujem sa");
      return false;
    } finally {
      isGettingSubscription = false;
    }
  } catch (error) {
    console.error("Neočakávaná chyba pri subscribeToPush:", error);
    return false;
  }
}

export async function enableNotifications() {
  return subscribeToPush({ requestPermission: true });
}

export async function syncPushSubscriptionSilently() {
  return subscribeToPush({ requestPermission: false });
}