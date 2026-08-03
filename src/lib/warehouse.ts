export type WarehouseItemType = "trh" | "darovanie" | "sklad_ponuka" | "sklad_dopyt";

const DAY_MS = 24 * 60 * 60 * 1000;

export function getWarehouseLifetimeDays(type: WarehouseItemType) {
  if (type === "trh" || type === "darovanie") return 30;
  if (type === "sklad_ponuka") return 14;
  return 1;
}

export function getWarehouseExpiryIso(type: WarehouseItemType, createdAt = Date.now()) {
  return new Date(createdAt + getWarehouseLifetimeDays(type) * DAY_MS).toISOString();
}

export function resolveWarehouseExpiry(
  type: WarehouseItemType,
  createdAt: string,
  expiresAt?: string | null,
) {
  if (expiresAt) return new Date(expiresAt);
  return new Date(getWarehouseExpiryIso(type, new Date(createdAt).getTime()));
}

export function getWarehouseLifetimeLabel(type: WarehouseItemType) {
  const days = getWarehouseLifetimeDays(type);
  return days === 1 ? "24 hodín" : `${days} dní`;
}

export function formatWarehouseExpiry(type: WarehouseItemType, createdAt: string, expiresAt?: string | null) {
  return resolveWarehouseExpiry(type, createdAt, expiresAt).toLocaleString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getWarehouseRemainingLabel(
  type: WarehouseItemType,
  createdAt: string,
  nowMs: number,
  expiresAt?: string | null,
) {
  const expiryMs = resolveWarehouseExpiry(type, createdAt, expiresAt).getTime();
  const diff = expiryMs - nowMs;

  if (diff <= 0) return "Expirované";

  const hours = Math.ceil(diff / (60 * 60 * 1000));
  if (hours < 24) return `Ešte ${hours} h`;

  return `Ešte ${Math.ceil(hours / 24)} dní`;
}