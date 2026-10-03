import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import SearchBar from "../components/common/SearchBar";
import StatusBadge from "../components/common/StatusBadge";
import EmptyState from "../components/common/EmptyState";
import LoadingState from "../components/common/LoadingState";
import { formatDate, formatNumber, daysUntil } from "../utils/formatters";
import { useNavigate } from "react-router-dom";
import * as api from "../services/api";

const BUCKETS = [
  { key: "expired", label: "Expired", min: -Infinity, max: -1, tone: "status-danger" },
  { key: "within7", label: "Within 7 days", min: 0, max: 7, tone: "status-danger" },
  { key: "within15", label: "Within 15 days", min: 8, max: 15, tone: "status-warning" },
  { key: "within30", label: "Within 30 days", min: 16, max: 30, tone: "status-warning" },
  { key: "within60", label: "Within 60 days", min: 31, max: 60, tone: "status-info" },
];

export default function Expiry() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [query, setQuery] = useState("");
  const [bucket, setBucket] = useState("all");

  useEffect(() => {
    api.getBatches().then(setItems).catch(() => setItems([]));
  }, []);

  const enriched = useMemo(() => (items || []).map((batch) => ({ ...batch, daysLeft: daysUntil(batch.expiryDate) })), [items]);
  const filtered = useMemo(() => {
    let list = enriched;
    if (bucket !== "all") {
      const selected = BUCKETS.find((item) => item.key === bucket);
      list = list.filter((item) => item.daysLeft >= selected.min && item.daysLeft <= selected.max);
    }
    if (query) {
      const normalized = query.toLowerCase();
      list = list.filter((item) => `${item.batchNo} ${item.medicineName} ${item.supplierName}`.toLowerCase().includes(normalized));
    }
    return list;
  }, [enriched, bucket, query]);

  if (!items) return <LoadingState rows={4} />;
  const counts = Object.fromEntries(BUCKETS.map((item) => [item.key, enriched.filter((batch) => batch.daysLeft >= item.min && batch.daysLeft <= item.max).length]));
  const activeFiltered = filtered.filter((item) => item.daysLeft <= 60 || item.daysLeft < 0);
  return (
    <div>
      <PageHeader title="Expiry Monitoring" subtitle="Track and act on batches nearing their expiry date." />
      <div className="summary-strip card" style={{ marginBottom: 18 }}>{BUCKETS.map((item) => <button key={item.key} className={`date-range-btn ${bucket === item.key ? "active" : ""}`} onClick={() => setBucket(bucket === item.key ? "all" : item.key)} style={{ boxShadow: "none" }}><span className={`status-badge ${item.tone}`}>{counts[item.key]}</span> {item.label}</button>)}</div>
      <div className="filter-bar"><SearchBar value={query} onChange={setQuery} placeholder="Search batch or medicine..." /><select className="form-select filter-select" value={bucket} onChange={(event) => setBucket(event.target.value)} aria-label="Filter by expiry window"><option value="all">All Windows</option>{BUCKETS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></div>
      {activeFiltered.length === 0 ? <EmptyState title="No matching batches" subtitle="No batches fall within the selected expiry window." /> : <div className="table-wrap"><div className="table-scroll"><table className="table"><thead><tr><th>Batch</th><th>Medicine</th><th>Expiry Date</th><th>Quantity</th><th>Supplier</th><th>Days Remaining</th><th>Action</th></tr></thead><tbody>{activeFiltered.map((batch) => { const expired = batch.daysLeft < 0; return <tr key={batch.id}><td className="cell-primary">{batch.batchNo}</td><td><div className="cell-primary" style={{ cursor: "pointer" }} onClick={() => navigate(`/medicines/${batch.medicineId}`)}>{batch.medicineName}</div></td><td className={expired ? "muted" : ""}>{formatDate(batch.expiryDate)}</td><td>{formatNumber(batch.quantity)}</td><td className="text-muted">{batch.supplierName}</td><td><span className={`status-badge ${expired || batch.daysLeft <= 7 ? "status-danger" : batch.daysLeft <= 30 ? "status-warning" : "status-success"}`}>{expired ? "Expired" : `${batch.daysLeft} days`}</span></td><td>{expired ? <StatusBadge status="Expired" /> : <StatusBadge status={batch.daysLeft <= 30 ? "Near Expiry" : "Active"} />}</td></tr>; })}</tbody></table></div></div>}
    </div>
  );
}
