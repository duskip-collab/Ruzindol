import {
  evaluatePushDecision,
  isCriticalNotification,
  parseWebhookRecord,
} from "./logic.ts";
import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

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
