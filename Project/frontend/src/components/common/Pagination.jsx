import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({ page, pageCount, onPage, total, from, to, itemsPerPage, onItemsPerPage }) {
  if (pageCount <= 1) return null;

  const pages = [];
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  const end = Math.min(pageCount, start + 4);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="pagination">
      <div className="pagination-info">
        Showing {from}–{to} of {total} entries
        {onItemsPerPage && (
          <select
            className="form-select"
            style={{ width: "auto", marginLeft: 12, padding: "5px 28px 5px 10px" }}
            value={itemsPerPage}
            onChange={(e) => onItemsPerPage(Number(e.target.value))}
            aria-label="Items per page"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </select>
        )}
      </div>
      <div className="pagination-controls">
        <button className="page-btn" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>
        {pages.map((p) => (
          <button key={p} className={`page-btn ${p === page ? "active" : ""}`} onClick={() => onPage(p)}>
            {p}
          </button>
        ))}
        <button className="page-btn" onClick={() => onPage(page + 1)} disabled={page >= pageCount} aria-label="Next page">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
