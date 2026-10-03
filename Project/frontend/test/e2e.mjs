import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

// Paths are derived from this file's own location so the suite runs from any
// checkout and on CI, instead of depending on one developer's machine layout.
const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backendDir = resolve(frontendDir, "..", "backend");
const apiPort = Number(process.env.E2E_API_PORT || 5011);
const webPort = Number(process.env.E2E_WEB_PORT || 5174);
const apiBase = `http://127.0.0.1:${apiPort}/api`;
const webBase = `http://127.0.0.1:${webPort}`;
const password = process.env.E2E_PASSWORD;
const mongoUri = process.env.E2E_MONGODB_URI;
const jwtSecret = process.env.E2E_JWT_SECRET || "e2e-only-secret-with-at-least-32-characters";

if (!password || !mongoUri) throw new Error("E2E_PASSWORD and E2E_MONGODB_URI are required");

// playwright-core does not download a browser, so an explicit executable is
// used when one is provided or found. Otherwise the launch falls back to
// Playwright's own registry cache, which is how CI installs Chromium.
const localChrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const chromePath = process.env.E2E_CHROME_PATH || (existsSync(localChrome) ? localChrome : "");
if (chromePath && !existsSync(chromePath)) throw new Error(`No browser executable at ${chromePath}. Set E2E_CHROME_PATH.`);

const backend = spawn(process.execPath, ["src/server.js"], {
  cwd: backendDir,
  env: { ...process.env, PORT: String(apiPort), MONGODB_URI: mongoUri, JWT_SECRET: jwtSecret, CLIENT_ORIGIN: webBase },
  stdio: ["ignore", "pipe", "pipe"],
  detached: process.platform !== "win32",
});
const frontend = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(webPort)], {
  cwd: frontendDir,
  env: { ...process.env, VITE_API_URL: apiBase },
  stdio: ["ignore", "pipe", "pipe"],
  shell: process.platform === "win32",
  detached: process.platform !== "win32",
});
// `npm run dev` spawns Vite as a grandchild, so killing only the npm wrapper
// leaves an orphan holding the pipes open and the runner never exits (which
// hangs CI until the job times out). Terminate the whole process group.
function killTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  }
}
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const passedChecks = [];
// These three live at module scope on purpose. The failure handler below runs
// outside `main()`, and the most common early failure (the API or the dev server
// never becoming ready) happens before the browser exists. Declaring them inside
// `main()` made that handler throw a ReferenceError instead of writing the
// evidence CI uploads, which is exactly when the evidence matters most.
let browser;
let page;
const consoleErrors = [];
let failedCheck = "";

function pass(name) {
  passedChecks.push(name);
  console.log(`PASS ${name}`);
}

async function waitForServer(url, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      if (backend.exitCode !== null || frontend.exitCode !== null) throw new Error("A server exited before becoming ready");
    }
    await new Promise((resolve_) => setTimeout(resolve_, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function api(path, options = {}) {
  const response = await fetch(apiBase + path, options);
  const body = await response.json();
  if (!response.ok || body.success === false) throw new Error(`${path} ${response.status} ${JSON.stringify(body)}`);
  return body.data;
}

async function apiStatus(path, options = {}) {
  const response = await fetch(apiBase + path, options);
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

function auth(token, json = false) {
  return { ...(json ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${token}` };
}

function day(offset) {
  const value = new Date();
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

async function waitForOption(select, value) {
  await select.locator(`option[value="${value}"]`).waitFor({ state: "attached" });
}

async function waitForApi(page, predicate, action) {
  const responsePromise = page.waitForResponse(predicate, { timeout: 10000 });
  await action();
  const response = await responsePromise;
  // A successful write answers 200 or 201 depending on whether it created a row.
  assert.ok([200, 201].includes(response.status()), `unexpected status ${response.status()}`);
  return response.json();
}

async function loginPage(page, email) {
  await page.goto(`${webBase}/login`);
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/dashboard");
}

// The suite writes to whatever database it is pointed at, so it refuses to run
// against anything other than a database name that exists to be thrown away. CI
// seeds this database immediately before the run for the same reason.
if (!/e2e|test/i.test(mongoUri)) throw new Error("E2E_MONGODB_URI must point at a disposable database (name containing e2e or test)");
async function main() {
  await waitForServer(`${apiBase}/health`);
  await waitForServer(webBase);
  const login = await api("/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "admin@pharmastock.in", password }) });
  const supplier = await api("/suppliers", { method: "POST", headers: auth(login.token, true), body: JSON.stringify({ name: `E2E Supplier ${suffix}`, contact: "E2E Tester", status: "Active" }) });
  const medicine = await api("/medicines", { method: "POST", headers: auth(login.token, true), body: JSON.stringify({ name: `E2E Medicine ${suffix}`, generic: "E2E Generic", category: "Other", manufacturer: "E2E Manufacturer", unitPrice: 5, reorderLevel: 1 }) });

  // Batches are created EMPTY by contract; stock can only arrive through a
  // purchase (or an adjustment). Creating one with a quantity must be refused,
  // which is asserted below before the legitimate route is used.
  const rejectedBatch = await apiStatus("/batches", {
    method: "POST",
    headers: auth(login.token, true),
    body: JSON.stringify({ batchNo: `E2E-REJECT-${suffix}`, medicineId: medicine.id, supplierId: supplier.id, manufactureDate: day(-20), expiryDate: day(30), quantity: 100, costPerUnit: 2 }),
  });
  assert.equal(rejectedBatch.status, 400);
  assert.equal(rejectedBatch.body.error.code, "BATCH_STOCK_IMMUTABLE");
  pass("Batch stock cannot be created directly");

  async function newBatch(batchNo, expiryOffset) {
    return api("/batches", { method: "POST", headers: auth(login.token, true), body: JSON.stringify({ batchNo, medicineId: medicine.id, supplierId: supplier.id, manufactureDate: day(-20), expiryDate: day(expiryOffset) }) });
  }
  async function receive(batch, quantity, cost) {
    return api("/purchases", { method: "POST", headers: auth(login.token, true), body: JSON.stringify({ medicineId: medicine.id, supplierId: supplier.id, batchId: batch.id, quantity, unitCost: cost, status: "Paid" }) });
  }

  const batchA = await newBatch(`E2E-A-${suffix}`, 30);
  const batchB = await newBatch(`E2E-B-${suffix}`, 90);
  const purchaseBatch = await newBatch(`E2E-P-${suffix}`, 120);
  await receive(batchA, 100, 2);
  await receive(batchB, 200, 3);
  await receive(purchaseBatch, 10, 2);

  const expiredMedicine = await api("/medicines", { method: "POST", headers: auth(login.token, true), body: JSON.stringify({ name: `E2E Expired ${suffix}`, generic: "E2E Expired Generic", category: "Other", manufacturer: "E2E Manufacturer", unitPrice: 1, reorderLevel: 1 }) });
  const expiredBatch = await api("/batches", { method: "POST", headers: auth(login.token, true), body: JSON.stringify({ batchNo: `E2E-EXPIRED-${suffix}`, medicineId: expiredMedicine.id, supplierId: supplier.id, manufactureDate: day(-60), expiryDate: day(-1) }) });
  // An expired batch cannot receive a purchase, so stock is seeded through a
  // positive adjustment, which is the other audited way quantity can change.
  await api("/adjustments", { method: "POST", headers: auth(login.token, true), body: JSON.stringify({ medicineId: expiredMedicine.id, batchId: expiredBatch.id, quantityDelta: 500, reason: "E2E expired stock fixture" }) });

browser = await chromium.launch({ ...(chromePath ? { executablePath: chromePath } : {}), headless: true });
  const context = await browser.newContext();
  page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error" && !/status of 409/.test(message.text())) consoleErrors.push(message.text()); });

  const dashboardResponse = page.waitForResponse((response) => response.url().includes("/api/dashboard") && response.request().method() === "GET");
  await loginPage(page, "admin@pharmastock.in");
  const dashboardBody = await dashboardResponse;
  assert.equal(dashboardBody.status(), 200);
  assert.ok((await dashboardBody.json()).data.kpis);
  await page.getByText("Total Medicines", { exact: true }).waitFor();
  await page.getByText("Sales Trend", { exact: true }).waitFor();
  pass("Login");
  pass("Dashboard");

  await page.getByRole("link", { name: "Medicines", exact: true }).click();
  await page.waitForURL("**/medicines");
  await page.getByPlaceholder("Search medicines...").fill(medicine.name);
  await page.getByText(medicine.name, { exact: true }).first().waitFor();
  await page.getByText(medicine.name, { exact: true }).first().click();
  await page.waitForURL(`**/medicines/${medicine.id}`);
  await page.getByText(medicine.generic, { exact: false }).first().waitFor();
  pass("Medicines");

  await page.getByRole("link", { name: "Medicines", exact: true }).click();
  await page.getByRole("link", { name: "Suppliers", exact: true }).click();
  await page.waitForURL("**/suppliers");
  await page.getByPlaceholder("Search suppliers...").fill(supplier.name);
  await page.getByText(supplier.name, { exact: true }).first().click();
  await page.getByRole("dialog", { name: supplier.name }).waitFor({ state: "visible" });
  await page.getByRole("dialog", { name: supplier.name }).getByText("Contact", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Close dialog" }).click();
  pass("Suppliers");

  await page.getByRole("link", { name: "Batches", exact: true }).click();
  await page.waitForURL("**/batches");
  await page.getByPlaceholder("Search batch or medicine...").fill(batchA.batchNo);
  const batchRow = page.getByRole("row").filter({ hasText: batchA.batchNo });
  await batchRow.getByText("100", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Expiry", exact: true }).click();
  await page.waitForURL("**/expiry");
  await page.getByPlaceholder("Search batch or medicine...").fill(expiredBatch.batchNo);
  const expiredRow = page.getByRole("row").filter({ hasText: expiredBatch.batchNo });
  await expiredRow.getByText("Expired", { exact: true }).first().waitFor();
  pass("Batches");

  // ---- Purchase through the UI, including a part payment -------------------
  await page.getByRole("link", { name: "Purchases", exact: true }).click();
  await page.waitForURL("**/purchases");
  await page.getByTestId("purchase-create").click();
  const purchaseDialog = page.getByRole("dialog", { name: "Record Purchase" });
  await purchaseDialog.waitFor({ state: "visible" });
  const purchaseMedicine = purchaseDialog.getByTestId("transaction-medicine");
  await waitForOption(purchaseMedicine, medicine.id);
  await purchaseMedicine.selectOption(medicine.id);
  const purchaseBatchSelect = purchaseDialog.getByTestId("transaction-batch");
  await waitForOption(purchaseBatchSelect, purchaseBatch.id);
  await purchaseBatchSelect.selectOption(purchaseBatch.id);
  const purchaseSupplier = purchaseDialog.getByTestId("transaction-supplier");
  await waitForOption(purchaseSupplier, supplier.id);
  await purchaseSupplier.selectOption(supplier.id);
  await purchaseDialog.getByTestId("transaction-quantity").fill("5");
  await purchaseDialog.getByTestId("transaction-unit-price").fill("2");
  await purchaseDialog.getByTestId("transaction-paid-amount").count();
  await purchaseDialog.locator("#paymentStatus").selectOption("Partially Paid");
  await purchaseDialog.getByTestId("transaction-paid-amount").fill("4");
  await purchaseDialog.getByTestId("transaction-submit").click();
  await purchaseDialog.waitFor({ state: "hidden" });
  const purchases = await api(`/purchases?medicineId=${medicine.id}`, { headers: auth(login.token) });
  const partial = purchases.find((row) => row.batchId === purchaseBatch.id && row.quantity === 5);
  assert.ok(partial, "the UI purchase was not persisted");
  assert.equal(partial.status, "Partially Paid");
  assert.equal(partial.paidAmount, 4);
  assert.equal(partial.outstanding, 6);
  const purchasedBatch = (await api("/batches", { headers: auth(login.token) })).find((row) => row.id === purchaseBatch.id);
  assert.equal(purchasedBatch.quantity, 15);
  pass("Purchase");
  pass("Part payment recorded with outstanding balance");

  // A part payment that is not strictly between zero and the total is refused by
  // the client before anything is sent to the server.
  await page.getByTestId("purchase-create").click();
  const invalidPart = page.getByRole("dialog", { name: "Record Purchase" });
  const invalidMedicine = invalidPart.getByTestId("transaction-medicine");
  await waitForOption(invalidMedicine, medicine.id);
  await invalidMedicine.selectOption(medicine.id);
  await invalidPart.getByTestId("transaction-batch").selectOption(purchaseBatch.id);
  await invalidPart.getByTestId("transaction-supplier").selectOption(supplier.id);
  await invalidPart.getByTestId("transaction-quantity").fill("4");
  await invalidPart.getByTestId("transaction-unit-price").fill("2");
  await invalidPart.locator("#paymentStatus").selectOption("Partially Paid");
  await invalidPart.getByTestId("transaction-paid-amount").fill("8");
  await invalidPart.getByTestId("transaction-submit").click();
  await invalidPart.getByText("Enter an amount above 0 and below the total", { exact: false }).waitFor();
  await invalidPart.getByTestId("transaction-cancel").click();
  const rejectedPartial = await apiStatus("/purchases", {
    method: "POST",
    headers: auth(login.token, true),
    body: JSON.stringify({ medicineId: medicine.id, supplierId: supplier.id, batchId: purchaseBatch.id, quantity: 4, unitCost: 2, status: "Partially Paid", paidAmount: 8 }),
  });
  assert.equal(rejectedPartial.status, 400);
  pass("Part payment validated against the purchase total");

  // ---- Sale, FEFO, and the guards ------------------------------------------
  await page.getByRole("link", { name: "Sales", exact: true }).click();
  await page.waitForURL("**/sales");
  await page.getByTestId("sale-create").click();
  const saleDialog = page.getByRole("dialog", { name: "Record Sale" });
  await saleDialog.waitFor({ state: "visible" });
  const saleMedicine = saleDialog.getByTestId("transaction-medicine");
  await waitForOption(saleMedicine, medicine.id);
  await saleMedicine.selectOption(medicine.id);
  await saleDialog.getByTestId("transaction-customer").fill("E2E Customer");
  await saleDialog.getByTestId("transaction-quantity").fill("150");
  await saleDialog.getByTestId("transaction-submit").click();
  await saleDialog.waitFor({ state: "hidden" });
  const sales = await api("/sales", { headers: auth(login.token) });
  const sale = sales.find((row) => row.customer === "E2E Customer" && row.medicineId === medicine.id);
  assert.ok(sale);
  assert.deepEqual(sale.allocations.map((allocation) => [allocation.batchNo, allocation.quantity]), [[batchA.batchNo, 100], [batchB.batchNo, 50]]);
  const postSaleBatches = await api("/batches", { headers: auth(login.token) });
  assert.equal(postSaleBatches.find((row) => row.id === batchA.id).quantity, 0);
  assert.equal(postSaleBatches.find((row) => row.id === batchB.id).quantity, 150);
  assert.equal(postSaleBatches.find((row) => row.id === expiredBatch.id).quantity, 500);
  pass("Sale");
  pass("FEFO");

  const beforeInsufficient = await api("/batches", { headers: auth(login.token) });
  await page.getByTestId("sale-create").click();
  const insufficientDialog = page.getByRole("dialog", { name: "Record Sale" });
  await insufficientDialog.getByTestId("transaction-medicine").selectOption(medicine.id);
  await insufficientDialog.getByTestId("transaction-customer").fill("E2E Insufficient");
  await insufficientDialog.getByTestId("transaction-quantity").fill("999999");
  await insufficientDialog.getByTestId("transaction-submit").click();
  await page.getByRole("status").filter({ hasText: "Insufficient available stock" }).waitFor();
  await insufficientDialog.getByTestId("transaction-cancel").click();
  const afterInsufficient = await api("/batches", { headers: auth(login.token) });
  assert.deepEqual(afterInsufficient.map((row) => [row.id, row.quantity]), beforeInsufficient.map((row) => [row.id, row.quantity]));
  pass("Insufficient stock");

  await page.getByTestId("sale-create").click();
  const expiredDialog = page.getByRole("dialog", { name: "Record Sale" });
  const expiredSaleMedicine = expiredDialog.getByTestId("transaction-medicine");
  await waitForOption(expiredSaleMedicine, expiredMedicine.id);
  await expiredSaleMedicine.selectOption(expiredMedicine.id);
  await expiredDialog.getByTestId("transaction-customer").fill("E2E Expired");
  await expiredDialog.getByTestId("transaction-quantity").fill("1");
  await expiredDialog.getByTestId("transaction-submit").click();
  await page.getByRole("status").filter({ hasText: "Insufficient available stock" }).waitFor();
  await expiredDialog.getByTestId("transaction-cancel").click();
  assert.equal((await api("/batches", { headers: auth(login.token) })).find((row) => row.id === expiredBatch.id).quantity, 500);
  pass("Expired stock");

  // ---- Refund returns stock to the exact batches that supplied it -----------
  await page.getByTestId(`refund-${sale.saleNo}`).click();
  const refundDialog = page.getByTestId("refund-confirm");
  await refundDialog.waitFor();
  await refundDialog.locator(`#refund-reason-${sale.id}`).fill("E2E damaged on delivery");
  await refundDialog.getByRole("button", { name: "Confirm Refund" }).click();
  await page.waitForResponse((response) => response.url().includes(`/sales/${sale.id}/refund`) && response.request().method() === "POST");
  const refunded = (await api(`/sales/${sale.id}`, { headers: auth(login.token) }));
  assert.equal(refunded.status, "Refunded");
  assert.ok(refunded.refundedAt);
  const afterRefund = await api("/batches", { headers: auth(login.token) });
  assert.equal(afterRefund.find((row) => row.id === batchA.id).quantity, 100);
  assert.equal(afterRefund.find((row) => row.id === batchB.id).quantity, 200);
  const refundAudit = await api("/audit-logs?action=SALE_REFUND", { headers: auth(login.token) });
  assert.ok(refundAudit.some((row) => row.entityId === sale.id), "the refund is missing from the audit log");
  assert.ok(refundAudit.some((row) => String(row.metadata?.reason || "").includes("damaged")), "the refund reason was not audited");
  pass("Refund restores the original batches");

  // Refunding again is a conflict, not a second stock movement.
  const secondRefund = await apiStatus(`/sales/${sale.id}/refund`, { method: "POST", headers: auth(login.token, true), body: JSON.stringify({}) });
  assert.equal(secondRefund.status, 409);
  pass("Duplicate refund refused");

  // ---- Inventory adjustment page -------------------------------------------
  await page.getByRole("link", { name: "Adjustments", exact: true }).click();
  await page.waitForURL("**/adjustments");
  await page.getByRole("button", { name: "New Adjustment" }).click();
  const adjustMedicine = page.getByTestId("adjust-medicine");
  await waitForOption(adjustMedicine, medicine.id);
  await adjustMedicine.selectOption(medicine.id);
  const adjustBatch = page.getByTestId("adjust-batch");
  await waitForOption(adjustBatch, batchB.id);
  await adjustBatch.selectOption(batchB.id);
  await page.getByTestId("adjust-delta").fill("-7");
  await page.getByTestId("adjust-reason").selectOption({ label: "Damaged in storage" });
  await page.getByTestId("adjust-note").fill("counted during E2E run");
  const adjustmentResponse = waitForApi(page, (response) => response.url().includes("/api/adjustments") && response.request().method() === "POST", () => page.getByTestId("adjust-submit").click());
  const adjustmentBody = await adjustmentResponse;
  assert.equal(adjustmentBody.data.quantityBefore, 200);
  assert.equal(adjustmentBody.data.quantityDelta, -7);
  assert.equal(adjustmentBody.data.quantityAfter, 193);
  await page.getByTestId("adjustment-row").first().waitFor();
  pass("Inventory adjustment");

  // ---- Audit log -------------------------------------------------------------
  await page.getByRole("link", { name: "Audit Log", exact: true }).click();
  await page.waitForURL("**/audit-log");
  await page.getByTestId("audit-summary").waitFor();
  // Filters are staged locally and only applied on submit, so the request is
  // driven by clicking Apply rather than by the select itself.
  await page.getByTestId("audit-action").selectOption({ value: "INVENTORY_ADJUSTMENT" });
  const auditFilter = await waitForApi(page, (response) => response.url().includes("/api/audit-logs") && response.url().includes("action=INVENTORY_ADJUSTMENT"), () => page.getByRole("button", { name: "Apply" }).click());
  assert.ok(auditFilter.data.some((row) => row.action === "INVENTORY_ADJUSTMENT"));
  await page.getByTestId("audit-row").first().waitFor();
  pass("Audit log");

  // ---- Analytics -------------------------------------------------------------
  await page.getByRole("link", { name: "Analytics", exact: true }).click();
  await page.waitForURL("**/analytics");
  await page.getByTestId("analytics-revenue").waitFor();
  await page.getByTestId("analytics-cogs").waitFor();
  await page.getByTestId("analytics-gross-profit").waitFor();
  await page.getByTestId("analytics-gross-margin").waitFor();
  const rangeValues = [];
  for (const range of ["7D", "30D", "90D", "6M", "1Y"]) {
    const body = await waitForApi(page, (response) => response.url().includes("/api/analytics") && response.url().includes("from="), () => page.getByTestId(`analytics-range-${range}`).click());
    assert.ok(body.data.summary);
    rangeValues.push(body.data.summary.revenue);
  }
  assert.ok(new Set(rangeValues).size > 1);
  pass("Analytics");

  // ---- Reports, including an explicit date range ---------------------------
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await page.waitForURL("**/reports");
  const reportTypes = [["Sales Report", "sales"], ["Inventory Report", "inventory"], ["Purchase Report", "purchase"], ["Expiry Report", "expiry"], ["Low Stock Report", "low-stock"], ["Supplier Report", "supplier"]];
for (const [label] of reportTypes) {
    await page.getByTestId("report-type").selectOption({ label });
    await page.getByTestId("report-generate").click();
    await page.getByText(`${label} — Preview`, { exact: true }).waitFor();
  }
  await page.getByTestId("report-type").selectOption({ label: "Sales Report" });
  await page.getByTestId("report-from").fill(day(-1));
  await page.getByTestId("report-to").fill(day(1));
  // Selecting the type fires an unfiltered request, so the predicate must also
  // require the date bounds; otherwise an in-flight unfiltered response can be
  // captured and the range assertion below fails for the wrong reason.
  const ranged = (response) => response.url().includes("/api/reports") && response.url().includes("type=sales") && response.url().includes(`from=${day(-1)}`) && response.url().includes(`to=${day(1)}`);
  const rangedResponse = await page.waitForResponse(ranged, { timeout: 15000 });
  assert.equal(rangedResponse.status(), 200);
  const todayOnly = await rangedResponse.json();
  assert.ok(todayOnly.data.every((row) => new Date(row.date) >= new Date(`${day(-1)}T00:00:00Z`)), "the date filter let an out-of-range row through");
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("report-export").click();
  const download = await downloadPromise;
  assert.ok(download.suggestedFilename().endsWith(".csv"));
  pass("Reports");
  pass("Report date filter");

// ---- Notifications are a shared, role-guarded review queue ---------------
  // Driven through the UI rather than by calling the endpoint directly, so the
  // panel's "Mark reviewed" control is covered too. The panel and this query
  // return the same rows in the same order, so the unread alert found here is the
  // one rendered at the top of the panel.
  const alerts = await api("/notifications?limit=20", { headers: auth(login.token) });
  const pending = alerts.find((alert) => !alert.read);
  assert.ok(pending, "an unreviewed alert is required for the acknowledgement check");
  await page.getByRole("button", { name: /Notifications/ }).click();
  const ackButton = page.getByTestId(`acknowledge-${pending.id}`);
  await ackButton.waitFor();
  const ackResponse = await waitForApi(page, (response) => response.url().includes(`/api/notifications/${pending.id}/read`) && response.request().method() === "PATCH", () => ackButton.click());
  assert.equal(ackResponse.data.read, true);
  assert.equal(ackResponse.data.acknowledgedByEmail, "admin@pharmastock.in");
  assert.ok(ackResponse.data.acknowledgedAt);
  // The reviewer is recorded server-side, so the trail is the proof, not the UI.
  // There is no single-notification read endpoint, so the row is re-read from the
  // list the panel itself uses.
  const afterAck = await api("/notifications?limit=20", { headers: auth(login.token) });
  const reviewed = afterAck.find((alert) => alert.id === pending.id);
  assert.ok(reviewed, "the acknowledged alert disappeared from the feed");
  assert.equal(reviewed.read, true);
  assert.equal(reviewed.acknowledgedByEmail, "admin@pharmastock.in");
  assert.ok(reviewed.acknowledgedAt);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Close notifications" }).click();
  pass("Notification acknowledgement records the reviewer");

  // ---- RBAC ------------------------------------------------------------------
  const viewerContext = await browser.newContext();
  const viewerPage = await viewerContext.newPage();
  await loginPage(viewerPage, "sateesh@pharmastock.in");
  await viewerPage.getByRole("link", { name: "Purchases", exact: true }).click();
  await viewerPage.waitForURL("**/purchases");
  assert.equal(await viewerPage.getByTestId("purchase-create").count(), 0);
  const viewerStatuses = await viewerPage.evaluate(async (base) => {
    const token = window.localStorage.getItem("pharmastock.token");
    // A GET may not carry a body, so only the write calls send one.
    const write = (path, method) => fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: "{}" });
    const read = (path) => fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    return {
      purchase: (await write("/purchases", "POST")).status,
      adjustment: (await write("/adjustments", "POST")).status,
      notification: (await write("/notifications/000000000000000000000000", "PATCH")).status,
      audit: (await read("/audit-logs")).status,
    };
  }, apiBase);
  assert.equal(viewerStatuses.purchase, 403);
  assert.equal(viewerStatuses.adjustment, 403);
  assert.equal(viewerStatuses.notification, 403);
  assert.equal(viewerStatuses.audit, 403);
  await viewerContext.close();
  pass("RBAC");

  await page.getByTestId("account-menu").click();
  await page.getByTestId("logout").click();
  await page.waitForURL("**/login");
  await page.goto(`${webBase}/dashboard`);
  await page.waitForURL("**/login");
  pass("Logout");
  assert.equal(consoleErrors.length, 0, consoleErrors.join("\n"));
  console.log(`TOTAL TESTS ${passedChecks.length + 1}`);
  console.log(`PASSED ${passedChecks.length}`);
  console.log("FAILED 0");
  console.log("Browser E2E VERIFIED: YES");
}

try {
  await main();
} catch (error) {
  failedCheck = error instanceof Error ? error.message : String(error);
  console.error(`FAILED ${failedCheck}`);
  console.log(`TOTAL TESTS ${passedChecks.length + 1}`);
  console.log(`PASSED ${passedChecks.length}`);
  console.log("FAILED 1");
  console.log("Browser E2E VERIFIED: NO");
  process.exitCode = 1;
  // Write failure evidence so CI can upload a real artifact instead of an
  // empty directory: a summary log plus a screenshot of the failing page. The
  // whole writer is guarded so a failure while collecting evidence can never
  // replace the real test failure as the reported cause.
  const resultsDir = resolve(frontendDir, "test-results");
  try {
    mkdirSync(resultsDir, { recursive: true });
    const report = [
      "PharmaStock E2E failure report",
      `when: ${new Date().toISOString()}`,
      `web: ${webBase}`,
      `api: ${apiBase}`,
      `browser opened: ${browser ? "yes" : "no"}`,
      "passed checks:",
      ...passedChecks.map((check) => `  - ${check}`),
      "failure:",
      ...failedCheck.split("\n").map((entry) => `  ${entry}`),
      "console errors:",
      ...(consoleErrors.length ? consoleErrors.map((entry) => `  ${entry}`) : ["  none"]),
    ].join("\n");
    writeFileSync(resolve(resultsDir, "e2e-failure.log"), `${report}\n`);
    // A screenshot is best effort; the log file is the authoritative artifact.
    if (page) await page.screenshot({ path: resolve(resultsDir, "e2e-failure.png"), fullPage: true });
  } catch (evidenceError) {
    console.error(`Could not write failure evidence: ${evidenceError.message}`);
  }
} finally {
  if (browser) await browser.close();
  killTree(backend);
  killTree(frontend);
}
