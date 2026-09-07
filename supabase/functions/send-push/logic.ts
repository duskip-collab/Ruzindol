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