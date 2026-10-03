import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/common/Button";
import { RefreshCw, ScrollText, Search } from "lucide-react";
import { formatDate } from "../utils/formatters";
import * as api from "../services/api";

const PAGE_SIZE = 25;

export default function AuditLog() {
  const [rows, setRows] = useState(null);
  const [actions, setActions] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ action: "", entityType: "", search: "" });
  const [applied, setApplied] = useState({ action: "", entityType: "", search: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getAuditLogActions()
      .then(setActions)
      .catch(() => setActions([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError("");
    api.getAuditLogsPage({ ...applied, page, limit: PAGE_SIZE })
      .then(({ data, meta }) => {
        setRows(data);
        setTotal(meta.total ?? data.length);
        setTotalPages(Math.max(1, meta.totalPages ?? 1));
      })
      .catch((requestError) => setError(requestError.message || "Could not load the audit log."))
      .finally(() => setLoading(false));
  }, [applied, page]);

  const apply = (event) => {
    event.preventDefault();
    setPage(1);
    setApplied(filters);
  };

  const reset = () => {
    const cleared = { action: "", entityType: "", search: "" };
    setFilters(cleared);
    setApplied(cleared);
    setPage(1);
  };

  const summary = useMemo(() => {
    if (!rows) return null;
    return `${rows.length} shown · ${total} total · page ${page} of ${Math.max(1, totalPages)}`;
  }, [rows, total, totalPages, page]);

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="Every privileged action is recorded with who did it, what they changed and when."
        actions={<Button variant="ghost" icon={RefreshCw} onClick={() => setApplied({ ...applied })} disabled={loading}>Refresh</Button>}
      />

      <form className="card filter-bar" onSubmit={apply} style={{ marginBottom: 20 }}>
        <div className="form-field">
          <label className="form-label" htmlFor="audit-action">Action</label>
          <select id="audit-action" data-testid="audit-action" className="form-select filter-select" value={filters.action} onChange={(event) => setFilters({ ...filters, action: event.target.value })}>
            <option value="">All actions</option>
            {actions.map((action) => <option key={action} value={action}>{action}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="audit-entity">Entity</label>
          <select id="audit-entity" className="form-select filter-select" value={filters.entityType} onChange={(event) => setFilters({ ...filters, entityType: event.target.value })}>
            <option value="">All entities</option>
            {["User", "Medicine", "Batch", "Supplier", "Purchase", "Sale", "InventoryAdjustment"].map((entity) => <option key={entity} value={entity}>{entity}</option>)}
          </select>
        </div>
        <div className="form-field" style={{ flex: 1, minWidth: 200 }}>
          <label className="form-label" htmlFor="audit-search">Search</label>
          <input id="audit-search" className="form-input filter-select" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Actor email or action" />
        </div>
        <div className="flex gap-8" style={{ alignSelf: "flex-end" }}>
          <Button type="submit" icon={Search} disabled={loading}>Apply</Button>
          <Button type="button" variant="ghost" onClick={reset}>Reset</Button>
        </div>
      </form>

      {error && <div className="field-error" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Recorded Actions</div>
            <div className="card-sub">Credential-shaped fields in metadata are redacted by the server before they are returned.</div>
          </div>
          <div className="flex gap-8" style={{ alignItems: "center" }}>
            <ScrollText size={18} aria-hidden="true" />
            <span className="muted text-sm" data-testid="audit-summary">{summary}</span>
          </div>
        </div>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Action</th>
                <th scope="col">Entity</th>
                <th scope="col">Actor</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows === null && <tr><td colSpan="5" className="muted">Loading audit entries...</td></tr>}
              {rows !== null && rows.length === 0 && <tr><td colSpan="5" className="muted">No audit entries match these filters.</td></tr>}
              {rows !== null && rows.map((row) => (
                <tr key={row.id} data-testid="audit-row">
                  <td>{formatDate(row.createdAt)}</td>
                  <td><span className="badge">{row.action}</span></td>
                  <td>{row.entityType}{row.entityId ? ` · ${String(row.entityId).slice(-6)}` : ""}</td>
                  <td>{row.actor?.name || row.actorEmail || "System"}{row.actor?.role ? ` (${row.actor.role})` : ""}</td>
                  <td className="text-muted">{Object.keys(row.metadata || {}).length ? JSON.stringify(row.metadata) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="muted text-sm">Page {page} of {Math.max(1, totalPages)}</span>
          <div className="flex gap-8">
            <Button size="sm" variant="ghost" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading}>Previous</Button>
            <Button size="sm" variant="ghost" onClick={() => setPage((value) => value + 1)} disabled={page >= totalPages || loading}>Next</Button>
          </div>
        </div>
      </div>
      {/* Announce filter results to screen readers without stealing focus. */}
      <div className="sr-only" role="status" aria-live="polite">{loading ? "Loading audit log" : summary}</div>
    </div>
  );
}
