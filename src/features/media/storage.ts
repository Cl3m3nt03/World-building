import type { StorageUsage } from "@/lib/bindings";

/** Share of the limit from which a world is said to be nearly full. */
export const WARNING_SHARE = 0.9;
/** Free disk space under which BuilderZ warns, limit or not: 500 MB. */
export const LOW_DISK = 500 * 1024 * 1024;
/** Smallest limit (also checked by the Rust side): 10 MB. */
export const MIN_LIMIT = 10 * 1024 * 1024;

export type StorageUnit = "MB" | "GB";
const UNIT_BYTES: Record<StorageUnit, number> = { MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };

/** How full a world is compared with its limit. */
export function storageLevel(usage: StorageUsage): "ok" | "warning" | "full" {
  const total = usage.total ?? 0;
  if (usage.limit === null) return "ok";
  if (total >= usage.limit) return "full";
  return total >= usage.limit * WARNING_SHARE ? "warning" : "ok";
}

/** Whether the disk holding the world (or the library) is nearly full. */
export function isDiskLow(usage: StorageUsage): boolean {
  return usage.available !== null && usage.available < LOW_DISK;
}

/** A limit in bytes, from a number of MB or GB (null if not a usable number). */
export function limitBytes(value: number, unit: StorageUnit): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.max(Math.round(value * UNIT_BYTES[unit]), MIN_LIMIT);
}

/** A limit in bytes as a number and a unit, for the form. */
export function limitParts(bytes: number): { value: number; unit: StorageUnit } {
  // In GB when it is a whole number of tenths of a GB (2 GB, 1.5 GB).
  const tenths = (bytes / UNIT_BYTES.GB) * 10;
  return bytes >= UNIT_BYTES.GB && Math.abs(tenths - Math.round(tenths)) < 1e-6
    ? { value: Math.round(tenths) / 10, unit: "GB" }
    : { value: Math.round(bytes / UNIT_BYTES.MB), unit: "MB" };
}
