import {
  evaluatePushDecision,
  isCriticalNotification,
  parseWebhookRecord,
  resolveNotifyCategory,
} from "./logic.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("parseWebhookRecord reads payload.record", () => {
  const payload = { record: { user_id: "u1", priority: "high" } };
  assertEquals(parseWebhookRecord(payload), payload.record);
});

Deno.test("parseWebhookRecord reads payload.new", () => {
  const payload = { new: { user_id: "u2", priority: "normal" } };
  assertEquals(parseWebhookRecord(payload), payload.new);
});

Deno.test("isCriticalNotification returns true for is_critical", () => {
  assertEquals(isCriticalNotification({ is_critical: true }), true);
});

Deno.test("isCriticalNotification returns true for priority vystraha", () => {
  assertEquals(isCriticalNotification({ priority: "vystraha" }), true);
});

Deno.test("critical notification bypasses disabled preference", () => {
  const record = { user_id: "user-1", priority: "high" };
  const decision = evaluatePushDecision(record, false);

  assertEquals(decision.shouldSend, true);
  assertEquals(decision.critical, true);
  assertEquals(decision.reason, undefined);
});

Deno.test("optional notification is skipped when notifications are disabled", () => {
  const record = { user_id: "user-1", priority: "normal" };
  const decision = evaluatePushDecision(record, false);

  assertEquals(decision.shouldSend, false);
  assertEquals(decision.critical, false);
  assertEquals(decision.reason, "notifications_disabled");
});

Deno.test("optional notification is sent when notifications are enabled", () => {
  const record = { user_id: "user-1", priority: "normal" };
  const decision = evaluatePushDecision(record, true);

  assertEquals(decision.shouldSend, true);
  assertEquals(decision.critical, false);
  assertEquals(decision.reason, undefined);
});

Deno.test("missing user_id is handled gracefully", () => {
  const record = { priority: "high" };
  const decision = evaluatePushDecision(record, true);

  assertEquals(decision.shouldSend, false);
  assertEquals(decision.reason, "missing_user_id");
});

Deno.test("resolveNotifyCategory keeps hlásnik items in 'obecne'", () => {
  assertEquals(resolveNotifyCategory({ type: "hlasnik" }), "obecne");
  assertEquals(resolveNotifyCategory({ type: "official_alert" }), "obecne");
});

Deno.test("resolveNotifyCategory maps new hlásnik item types to 'obecne'", () => {
  // Nové položky hlásnika (RSS aktualita + termín v kalendári) z migrácie
  // 20260923130000_hlasnik_new_items_push_notifications.sql
  assertEquals(resolveNotifyCategory({ type: "rss_announcement" }), "obecne");
  assertEquals(resolveNotifyCategory({ type: "calendar_event" }), "obecne");
  assertEquals(resolveNotifyCategory({ type: "RSS_ANNOUNCEMENT" }), "obecne");
  assertEquals(resolveNotifyCategory({ type: "calendar_event", url: "/kalendar" }), "obecne");
});

Deno.test("resolveNotifyCategory still prioritises urgent categories", () => {
  assertEquals(resolveNotifyCategory({ type: "calendar_event", priority: "high" }), "havarie");
  assertEquals(resolveNotifyCategory({ type: "rss_announcement", priority: "vystraha" }), "havarie");
});

Deno.test("resolveNotifyCategory keeps other types unchanged", () => {
  assertEquals(resolveNotifyCategory({ type: "neighbor_post" }), "ostatne");
  assertEquals(resolveNotifyCategory({ type: "farsky_oznam" }), "farske");
  assertEquals(resolveNotifyCategory({ type: "announcement", category: "kultúrne podujatie" }), "kulturne");
});
