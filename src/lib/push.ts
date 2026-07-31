import { supabase } from "@/integrations/supabase/client";

const PUBLIC_VAPID_KEY = import.meta.env.VITE_PUBLIC_VAPID_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function subscribeToPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("Push notifikácie nie sú podporované v tomto prehliadači.");
    return;
  }

  if (!PUBLIC_VAPID_KEY) {
    console.error("VITE_PUBLIC_VAPID_KEY nie je nastavený v .env súbore!");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.warn("Používateľ nepovolil notifikácie.");
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
    });
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    console.warn("Používateľ nie je prihlásený, subskripcia sa neuloží.");
    return;
  }

  const { error } = await supabase.from("user_push_subscriptions").upsert(
    {
      user_id: session.user.id,
      subscription: subscription.toJSON(),
    },
    { onConflict: "user_id, subscription" }
  );

  if (error) {
    console.error("Chyba pri ukladaní subskripcie do Supabase:", error);
  } else {
    console.log("Push notifikácie úspešne aktivované a uložené!");
  }
}