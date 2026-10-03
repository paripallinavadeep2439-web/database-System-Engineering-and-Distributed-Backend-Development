import { useEffect, useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/common/Button";
import { useToast } from "../contexts/ToastContext";
import { FileText, Download, Eye, Printer, FileSpreadsheet } from "lucide-react";
import { REPORT_TYPES } from "../utils/constants";
import { formatINR, formatDate, daysUntil } from "../utils/formatters";
import * as api from "../services/api";

const API_TYPES = {
  [REPORT_TYPES.INVENTORY]: "inventory",
  [REPORT_TYPES.SALES]: "sales",
  [REPORT_TYPES.PURCHASE]: "purchase",
  [REPORT_TYPES.EXPIRY]: "expiry",
  [REPORT_TYPES.LOW_STOCK]: "low-stock",
  [REPORT_TYPES.SUPPLIER]: "supplier",
};

// Only the transaction-shaped reports can be narrowed to a date window. An
// inventory or low-stock report is a point-in-time snapshot, so offering a date
// filter for them would imply a history the database does not store.
const DATE_FILTERED = new Set([REPORT_TYPES.SALES, REPORT_TYPES.PURCHASE]);

const HEADERS = {
  [REPORT_TYPES.INVENTORY]: ["Medicine", "Generic", "Category", "Stock", "Reorder", "Avg Cost", "Stock Value (at Cost)", "Selling Price"],
  [REPORT_TYPES.SALES]: ["Invoice", "Medicine", "Qty", "Unit Price", "Total", "Customer", "Status", "Date"],
  [REPORT_TYPES.PURCHASE]: ["PO No", "Medicine", "Qty", "Unit Cost", "Total", "Supplier", "Status", "Date"],
  [REPORT_TYPES.EXPIRY]: ["Batch", "Medicine", "Expiry", "Qty", "Supplier", "Stock Value (at Cost)", "Days Left"],
  [REPORT_TYPES.LOW_STOCK]: ["Medicine", "Stock", "Reorder", "Shortage", "Suggested Order", "Severity"],
  [REPORT_TYPES.SUPPLIER]: ["Supplier", "Contact", "Email", "Phone", "POs", "Total Purchased", "Outstanding", "Payment Compliance %", "Status"],
};

// Date-only values are anchored to the current UTC day so a report never shows a
// batch as one day closer to expiry than the server considers it to be.
function reportDays(iso) {
  const value = daysUntil(iso);
  return Number.isFinite(value) ? value : null;
}

function buildLines(reportType, rows) {
  // Inventory value comes from the server, which computes it as
  // Batch.quantity x Batch.costPerUnit. The client never multiplies stock by the
  // selling price, so the screen, the CSV and the database cannot disagree.
  if (reportType === REPORT_TYPES.INVENTORY) return rows.map((row) => [row.name, row.generic, row.category, row.stock, row.reorderLevel, formatINR(row.avgCostPerUnit), formatINR(row.stockValue), formatINR(row.unitPrice)]);
  if (reportType === REPORT_TYPES.SALES) return rows.map((row) => [row.saleNo, row.medicine, row.quantity, formatINR(row.unitPrice), formatINR(row.total), row.customer, row.status, formatDate(row.date)]);
  if (reportType === REPORT_TYPES.PURCHASE) return rows.map((row) => [row.purchaseNo, row.medicine, row.quantity, formatINR(row.unitCost), formatINR(row.total), row.supplier, row.status, formatDate(row.date)]);
  if (reportType === REPORT_TYPES.EXPIRY) return rows.map((row) => { const days = reportDays(row.expiryDate); return [row.batchNo, row.medicineName, formatDate(row.expiryDate), row.quantity, row.supplierName, formatINR(row.stockValueAtCost), days === null ? "—" : days < 0 ? "Expired" : `${days}d`]; });
  if (reportType === REPORT_TYPES.LOW_STOCK) return rows.map((row) => [row.name, row.stock, row.reorderLevel, row.shortage, row.suggestedOrderQuantity, row.severity]);
  if (reportType === REPORT_TYPES.SUPPLIER) return rows.map((row) => [row.name, row.contact, row.email, row.phone, row.purchaseOrders, formatINR(row.totalPurchased), formatINR(row.outstanding), row.paymentCompliance, row.status]);
  return [];
}

export default function Reports() {
  const toast = useToast();
  const [reportType, setReportType] = useState(REPORT_TYPES.INVENTORY);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState(null);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");

  const dateFiltered = DATE_FILTERED.has(reportType);
  // Switching report type must not silently carry a stale window into a report
  // that has no date semantics.
  useEffect(() => {
    if (!dateFiltered) {
      setFrom("");
      setTo("");
    }
  }, [dateFiltered]);

  useEffect(() => {
    let mounted = true;
    setRows(null);
    setError("");
    const params = dateFiltered ? { from: from || undefined, to: to || undefined } : {};
    api.getReport(API_TYPES[reportType], params).then((data) => {
      if (mounted) setRows(data);
    }).catch((requestError) => {
      if (mounted) setError(requestError.message || "Could not generate report.");
    });
    return () => { mounted = false; };
  }, [reportType, dateFiltered, from, to]);

  const invalidRange = dateFiltered && from && to && from > to;
  const lines = buildLines(reportType, rows || []);
  const headers = HEADERS[reportType];
  const generate = () => {
    if (rows === null || invalidRange) return;
    setPreview(true);
    toast.success("Report generated", `${reportType} is ready for preview.`);
  };
  const exportCSV = () => {
    if (!rows) return;
    const csv = [headers, ...lines].map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${reportType.replace(/\s+/g, "_").toLowerCase()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Exported", `${reportType} exported as CSV.`);
  };
  const print = () => window.print();

  return (
    <div>
      <PageHeader title="Reports" subtitle="Generate and export inventory, sales, purchase, expiry and stock reports." />
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><div><div className="card-title">Create a Report</div><div className="card-sub">Choose a report type and generate a preview or export.</div></div></div>
        <div className="filter-bar" style={{ border: "none", padding: 0, background: "transparent" }}>
          <select data-testid="report-type" className="form-select filter-select" value={reportType} onChange={(event) => setReportType(event.target.value)} aria-label="Report type" style={{ minWidth: 200 }}>{Object.values(REPORT_TYPES).map((type) => <option key={type} value={type}>{type}</option>)}</select>
          {dateFiltered && <>
            <label className="sr-only" htmlFor="report-from">Report start date</label>
            <input id="report-from" data-testid="report-from" type="date" className="form-input filter-select" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} aria-label="Start date" />
            <label className="sr-only" htmlFor="report-to">Report end date</label>
            <input id="report-to" data-testid="report-to" type="date" className="form-input filter-select" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} aria-label="End date" />
          </>}
          <Button data-testid="report-generate" icon={FileText} onClick={generate} disabled={rows === null || invalidRange}>Generate</Button>
          <Button data-testid="report-preview-button" variant="ghost" icon={Eye} onClick={() => setPreview(true)} disabled={rows === null || invalidRange}>Preview</Button>
          <Button data-testid="report-export" variant="ghost" icon={Download} onClick={exportCSV} disabled={rows === null}>Export CSV</Button>
          <Button variant="ghost" icon={Printer} onClick={print} disabled={rows === null}>Print</Button>
        </div>
        {dateFiltered && <div className="card-sub" style={{ marginTop: 10 }}>Range is inclusive of both dates. Leave blank for all history.</div>}
        {rows !== null && <div className="summary-strip" style={{ marginTop: 14 }}><div className="summary-item"><span className="si-label">Rows</span><span className="si-value">{lines.length}</span></div>{dateFiltered && <div className="summary-item"><span className="si-label">Period</span><span className="si-value" style={{ fontSize: 14 }}>{from ? formatDate(from) : "All"} → {to ? formatDate(to) : "Latest"}</span></div>}<div className="summary-item"><span className="si-label">Generated</span><span className="si-value" style={{ fontSize: 14 }}>{formatDate(new Date().toISOString())}</span></div></div>}
        {invalidRange && <div className="field-error" style={{ marginTop: 12 }} role="alert">Start date must not be after end date.</div>}
        {error && <div className="field-error" style={{ marginTop: 12 }} role="alert">{error}</div>}
      </div>
      {preview && rows !== null ? <div data-testid="report-preview" className="card"><div className="card-header"><div><div className="card-title">{reportType} — Preview</div><div className="card-sub">PharmaStock · Medicine Stock Management &amp; Analytics Portal</div></div><div className="flex gap-8"><Button size="sm" variant="ghost" icon={FileSpreadsheet} onClick={exportCSV}>CSV</Button><Button size="sm" variant="ghost" icon={Printer} onClick={print}>Print</Button></div></div><div className="table-scroll"><table className="table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{lines.length === 0 ? <tr><td colSpan={headers.length} className="muted">No records found.</td></tr> : lines.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} className="text-muted">{cell}</td>)}</tr>)}</tbody></table></div></div> : <div className="card muted text-sm" style={{ textAlign: "center", padding: 32 }}>Select a report type and click <strong>Generate</strong> or <strong>Preview</strong> to see the output here.</div>}
    </div>
  );
}
