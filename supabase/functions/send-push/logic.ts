/**
 * Voliteľné filtre záujmov – serverová klasifikácia notifikácií do kategórií.
 * Je to presné zrkadlo klientskej funkcie `classify()` (NotificationContext),
 * takže notifikácia, ktorú používateľ vidí v aplikácii, zodpovedá kategórii,
 * ktorú si vypol / zapol v profile.
 */
export type NotifyCategoryKey = "obecne" | "havarie" | "kulturne" | "farske" | "ostatne";

export const NOTIFY_CATEGORY_COLUMN: Record<NotifyCategoryKey, string> = {
  obecne: "notify_obecne",
  havarie: "notify_havarie",
  kulturne: "notify_kulturne",
  farske: "notify_farske",
  ostatne: "notify_ostatne",
};

export function resolveNotifyCategory(record: Record<string, unknown>): NotifyCategoryKey {
  const t = String(record.type ?? "").toLowerCase();
  const c = String(record.category ?? "").toLowerCase();
  const p = String(record.priority ?? "").toLowerCase();

  if (
    c.includes("havar") ||
    c.includes("núdz") ||
    c.includes("nudz") ||
    c.includes("výstraha") ||
    c.includes("vystraha") ||
    c === "vysoka" ||
    p === "vystraha" ||
    p === "urgentne" ||
    p === "urgent" ||
    p === "high"
  )
    return "havarie";
  if (c.includes("kult") || c.includes("podujat") || c.includes("udalost")) return "kulturne";
  if (c.includes("farsk") || c.includes("kostol") || t === "farsky_oznam") return "farske";
  if (t === "hlasnik" || t === "official_alert" || c.includes("obec")) return "obecne";
  return "ostatne";
}

export type PushDecision = {
  userId: string | null;
  critical: boolean;
  shouldSend: boolean;
  reason?: "missing_record" | "missing_user_id" | "notifications_disabled";
};

export function parseWebhookRecord(payload: unknown): Record<string, unknown> | null {
  const p = payload as any;
  if (!p || typeof p !== "object") return null;

  // 1. Štandardný Supabase Database Webhook formát
  if (p.record && typeof p.record === "object") return p.record as Record<string, unknown>;
  if (p.new && typeof p.new === "object") return p.new as Record<string, unknown>;

  // 2. Fallback: Ak bol poslaný priamo objekt notifikácie (napr. pri manuálnom teste v Dashboarde)
  if (typeof p.user_id === "string" || typeof p.title === "string" || typeof p.type === "string") {
    return p as Record<string, unknown>;
  }

  return null;
}

export function isCriticalNotification(record: Record<string, unknown>) {
  if (record.is_critical === true) return true;

  const rawPriority = String(record.priority ?? "").toLowerCase();
  return (
    rawPriority === "high" ||
    rawPriority === "urgent" ||
    rawPriority === "urgentne" ||
    rawPriority === "vystraha"
  );
}

export function evaluatePushDecision(
  record: Record<string, unknown> | null,
  notificationsEnabled: boolean | null = null,
): PushDecision {
  if (!record) {
    return {
      userId: null,
      critical: false,
      shouldSend: false,
      reason: "missing_record",
    };
  }

  const userId = typeof record.user_id === "string" ? record.user_id : null;
  if (!userId) {
    return {
      userId: null,
      critical: false,
      shouldSend: false,
      reason: "missing_user_id",
    };
  }

  const critical = isCriticalNotification(record);
  if (critical) {
    return {
      userId,
      critical: true,
      shouldSend: true,
    };
  }

  if (notificationsEnabled === false) {
    return {
      userId,
      critical: false,
      shouldSend: false,
      reason: "notifications_disabled",
    };
  }

  return {
    userId,
    critical: false,
    shouldSend: true,
  };
}
