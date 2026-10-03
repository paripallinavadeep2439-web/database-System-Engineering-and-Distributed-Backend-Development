const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "pharmastock.token";

export { API_BASE_URL };

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function token() {
  return typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;
}

function queryString(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "" && value !== "All") search.set(key, value);
  }
  const result = search.toString();
  return result ? `?${result}` : "";
}

async function requestWithMeta(path, options = {}) {
  const headers = { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) };
  const accessToken = token();
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    throw new ApiError(body.error?.message || "Request failed", response.status, body.error?.code, body.error?.details);
  }
  return { data: body.data, meta: body.meta || {} };
}

async function request(path, options = {}) {
  return (await requestWithMeta(path, options)).data;
}

export function login(email, password) {
  return request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function getCurrentUser() {
  return request("/auth/me");
}

export function updateProfile(data) {
  return request("/auth/me", { method: "PATCH", body: JSON.stringify(data) });
}

export function changePassword(data) {
  return request("/auth/change-password", { method: "POST", body: JSON.stringify(data) });
}

export function getDashboardData() {
  return request("/dashboard");
}

export function getAnalytics({ from, to } = {}) {
  return request(`/analytics${queryString({ from, to })}`);
}

export function getMedicines(params) {
  return request(`/medicines${queryString(params)}`);
}

export function getMedicineById(id) {
  return request(`/medicines/${encodeURIComponent(id)}`);
}

export function createMedicine(data) {
  return request("/medicines", { method: "POST", body: JSON.stringify(data) });
}

export function updateMedicine(id, data) {
  return request(`/medicines/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteMedicine(id) {
  return request(`/medicines/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function getBatches(params) {
  return request(`/batches${queryString(params)}`);
}

export function getBatchesByMedicine(medicineId) {
  return getBatches({ medicineId, limit: 100 });
}

export function createBatch(data) {
  return request("/batches", { method: "POST", body: JSON.stringify(data) });
}

export function getSuppliers(params) {
  return request(`/suppliers${queryString(params)}`);
}

export function createSupplier(data) {
  return request("/suppliers", { method: "POST", body: JSON.stringify(data) });
}

export function updateSupplier(id, data) {
  return request(`/suppliers/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteSupplier(id) {
  return request(`/suppliers/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function getPurchases(params) {
  return request(`/purchases${queryString(params)}`);
}

export function createPurchase(data) {
  return request("/purchases", { method: "POST", body: JSON.stringify(data) });
}

export function getSales(params) {
  return request(`/sales${queryString(params)}`);
}

export function createSale(data) {
  return request("/sales", { method: "POST", body: JSON.stringify(data) });
}

export function refundSale(id, reason) {
  return request(`/sales/${encodeURIComponent(id)}/refund`, {
    method: "POST",
    body: JSON.stringify(reason ? { reason } : {}),
  });
}

export function getUsers() {
  return request("/users");
}

export function createUser(data) {
  return request("/users", { method: "POST", body: JSON.stringify(data) });
}

export function updateUser(id, data) {
  return request(`/users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) });
}

// Returns the page metadata as well as the rows, because the unread count is a
// server-side total and cannot be derived from the current page of results.
export async function getNotificationsPage(params) {
  const response = await requestWithMeta(`/notifications${queryString(params)}`);
  return { rows: response.data || [], meta: response.meta || {} };
}

// Acknowledgement is a state change, so the API restricts it to inventory roles.
export function markNotificationRead(id) {
  return request(`/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" });
}

export function search(query) {
  return request(`/search${queryString({ q: query })}`);
}

export function getReport(type, params) {
  return request(`/reports${queryString({ type, ...params })}`);
}

// Audit logs are paginated server-side, so the pager needs meta as well as rows.
export function getAuditLogsPage(params) {
  return requestWithMeta(`/audit-logs${queryString(params)}`);
}

export function getAuditLogActions() {
  return request("/audit-logs/actions");
}

export function getAdjustments(params) {
  return request(`/adjustments${queryString(params)}`);
}

export function createAdjustment(data) {
  return request("/adjustments", { method: "POST", body: JSON.stringify(data) });
}
