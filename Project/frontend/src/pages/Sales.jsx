import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import PageHeader from "../components/layout/PageHeader";
import SearchBar from "../components/common/SearchBar";
import SalesTable from "../components/transactions/SalesTable";
import TransactionForm from "../components/transactions/TransactionForm";
import Pagination from "../components/common/Pagination";
import LoadingState from "../components/common/LoadingState";
import EmptyState from "../components/common/EmptyState";
import Button from "../components/common/Button";
import * as api from "../services/api";
import { useToast } from "../contexts/ToastContext";
import { formatINR } from "../utils/formatters";
import { useAuth } from "../contexts/AuthContext";

export default function Sales() {
  const toast = useToast();
  const { user } = useAuth();
  const canSell = ["Admin", "Inventory Manager", "Pharmacist", "Sales Staff"].includes(user?.role);
  const [items, setItems] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    api.getSales().then(setItems).catch(() => setItems([]));
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    let list = [...items];
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((s) =>
        `${s.saleNo} ${s.medicine} ${s.customer} ${s.batch}`.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "All") list = list.filter((s) => s.status === statusFilter);
    return list;
  }, [items, query, statusFilter]);

  const total = filtered.reduce((s, x) => s + x.total, 0);
  const pageCount = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const safePage = Math.min(page, pageCount);
  const paginated = filtered.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

  // Refunds are restricted to the same roles that manage stock, because the
  // refund endpoint puts units back into the batch ledger.
  const canRefund = ["Admin", "Inventory Manager", "Pharmacist"].includes(user?.role);

  const submit = async (payload) => {
    try {
      const saved = await api.createSale(payload);
      setItems((prev) => [saved, ...prev]);
      toast.success("Sale recorded", `Invoice ${saved.saleNo} created successfully.`);
      setFormOpen(false);
    } catch (error) {
      toast.error("Error", error.message || "Could not record sale.");
    }
  };

  const refund = async (saleId, reason) => {
    const updated = await api.refundSale(saleId, reason);
    setItems((prev) => prev.map((sale) => (sale.id === updated.id ? updated : sale)));
    toast.success("Refund recorded", `Invoice ${updated.saleNo} returned ${updated.quantity} unit(s) to stock.`);
    return updated;
  };

  if (!items) return <LoadingState rows={4} />;

  return (
    <div>
      <PageHeader
        title="Sales"
        subtitle="Record sales transactions and customer invoices."
        actions={canSell ? <Button data-testid="sale-create" icon={Plus} onClick={() => setFormOpen(true)}>Record Sale</Button> : null}
      />

      <div className="filter-bar">
        <SearchBar value={query} onChange={setQuery} placeholder="Search sales..." />
        <select className="form-select filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
          <option value="All">All Statuses</option>
          <option value="Completed">Completed</option>
          <option value="Refunded">Refunded</option>
        </select>
        <div className="summary-item" style={{ marginLeft: "auto" }}>
          <span className="si-label">Total Sales (filtered)</span>
          <span className="si-value">{formatINR(total)}</span>
        </div>
      </div>

      {paginated.length === 0 ? (
        <EmptyState title="No sales found" subtitle="Try adjusting your search or filters." />
      ) : (
        <div className="table-wrap">
          <SalesTable items={paginated} onRefund={refund} canRefund={canRefund} />
          <Pagination
            page={safePage}
            pageCount={pageCount}
            onPage={setPage}
            total={filtered.length}
            from={(safePage - 1) * itemsPerPage + 1}
            to={Math.min(safePage * itemsPerPage, filtered.length)}
            itemsPerPage={itemsPerPage}
            onItemsPerPage={(n) => { setItemsPerPage(n); setPage(1); }}
          />
        </div>
      )}

      {canSell && <TransactionForm open={formOpen} onClose={() => setFormOpen(false)} onSubmit={submit} kind="sale" />}
    </div>
  );
}
