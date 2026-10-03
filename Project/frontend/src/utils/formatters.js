export function formatINR(value) {
  if (value == null || Number.isNaN(Number(value))) return "₹0";
  const num = Number(value);
  const formatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(num);
}

export function formatINRCompact(value) {
  const num = Number(value);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)} K`;
  return formatINR(num);
}

export function formatNumber(value) {
  if (value == null || Number.isNaN(Number(value))) return "0";
  return new Intl.NumberFormat("en-IN").format(Number(value));
}

export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Expiry counting is anchored to the current UTC day, matching the backend's
// Batch.status and expiry-risk calculations. Using local midnight here would
// make a batch look one day closer to expiry than the server reports for anyone
// in a positive-offset timezone.
function startOfUTCDay(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function daysUntil(iso) {
  if (!iso) return NaN;
  const target = startOfUTCDay(iso);
  if (target === null) return NaN;
  return Math.round((target - startOfUTCDay(new Date())) / 86400000);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
