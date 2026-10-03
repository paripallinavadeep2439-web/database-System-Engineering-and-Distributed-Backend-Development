// Every date boundary in this project is computed in UTC. Server and client can
// sit in different time zones, so a "today" or "this month" filter must not
// depend on the host's local offset. All helpers below return Date instances
// that MongoDB comparisons and ISO serialisation handle consistently.

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Truncates a value to midnight UTC of the same calendar day. Anything already
// stored as midnight UTC is returned unchanged, which keeps date-only fields
// (expiryDate, for example) stable across read/write cycles.
export function startOfDayUtc(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid date");
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Last representable millisecond of a UTC day, so `$lte` includes the whole day.
export function endOfDayUtc(value = new Date()) {
  const start = startOfDayUtc(value);
  return new Date(start.getTime() + 86399999);
}

// A date-only string is anchored at UTC midnight instead of being parsed in the
// host's local zone, which is what would otherwise shift 2026-03-01 by a day.
function parseBoundary(value, endOfDay) {
  if (value === undefined || value === null || value === "") return undefined;
  if (DATE_ONLY.test(value)) {
    return endOfDay ? endOfDayUtc(`${value}T00:00:00.000Z`) : startOfDayUtc(`${value}T00:00:00.000Z`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new RangeError("Invalid date");
  return parsed;
}

// Builds a Mongo range from `from`/`to` query values. The field name is
// configurable because purchases and sales do not share a date property.
export function dateRangeFilter(query = {}, { field = "date", defaultFromDays } = {}) {
  const filter = {};
  const from = parseBoundary(query.from, false);
  const to = parseBoundary(query.to, true);
  if (!from && defaultFromDays) {
    const start = startOfDayUtc(new Date());
    start.setUTCDate(start.getUTCDate() - defaultFromDays);
    filter[field] = { $gte: start };
    if (to) filter[field].$lte = to;
    return filter;
  }
  if (from || to) {
    filter[field] = {};
    if (from) filter[field].$gte = from;
    if (to) filter[field].$lte = to;
  }
  return filter;
}

// Resolves a reporting window to concrete bounds. `defaultFromDays` keeps the
// analytics page populated when the caller sends no range at all.
export function resolveDateRange(query = {}, { defaultFromDays } = {}) {
  const now = new Date();
  const from = parseBoundary(query.from, false);
  const to = parseBoundary(query.to, true);
  if (from && to) return { from, to };
  if (from) return { from, to: endOfDayUtc(now) };
  if (to) {
    const start = startOfDayUtc(now);
    if (defaultFromDays) start.setUTCDate(start.getUTCDate() - defaultFromDays);
    return { from: start, to };
  }
  const start = startOfDayUtc(now);
  if (defaultFromDays) start.setUTCDate(start.getUTCDate() - defaultFromDays);
  return { from: start, to: endOfDayUtc(now) };
}

// True when two values fall on the same UTC calendar day. Used by seed and
// verification so chronology checks cannot be skewed by the local offset.
export function isSameUtcDay(left, right) {
  return startOfDayUtc(left).getTime() === startOfDayUtc(right).getTime();
}
