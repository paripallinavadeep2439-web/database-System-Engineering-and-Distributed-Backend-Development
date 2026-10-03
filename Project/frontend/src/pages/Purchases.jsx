import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import PageHeader from "../components/layout/PageHeader";
import SearchBar from "../components/common/SearchBar";
import PurchaseTable from "../components/transactions/PurchaseTable";
import TransactionForm from "../components/transactions/TransactionForm";
import Pagination from "../components/common/Pagination";
import LoadingState from "../components/common/LoadingState";
import EmptyState from "../components/common/EmptyState";
import Button from "../components/common/Button";
import * as api from "../services/api";
import { useToast } from "../contexts/ToastContext";
import { formatINR } from "../utils/formatters";
import { useAuth } from "../contexts/AuthContext";

export default function Purchases() {
  const toast = useToast();
  const { user } = useAuth();
  const canManage = ["Admin", "Inventory Manager", "Pharmacist"].includes(user?.role);
  const [items, setItems] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    api.getPurchases().then(setItems).catch(() => setItems([]));
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    let list = [...items];
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((p) =>
        `${p.purchaseNo} ${p.supplier} ${p.medicine} ${p.batch}`.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "All") list = list.filter((p) => p.status === statusFilter);
    return list;
  }, [items, query, statusFilter]);

  const total = filtered.reduce((s, p) => s + p.total, 0);
  const pageCount = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const safePage = Math.min(page, pageCount);
  const paginated = filtered.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

  const submit = async (payload) => {
    try {
      const saved = await api.createPurchase(payload);
      setItems((prev) => [saved, ...prev]);
      toast.success("Purchase recorded", `PO ${saved.purchaseNo} recorded successfully.`);
      setFormOpen(false);
    } catch (error) {
      toast.error("Error", error.message || "Could not record purchase.");
    }
  };

  if (!items) return <LoadingState rows={4} />;

  return (
    <div>
      <PageHeader
        title="Purchases"
        subtitle="Record and track purchase orders from your suppliers."
        actions={canManage ? <Button data-testid="purchase-create" icon={Plus} onClick={() => setFormOpen(true)}>Record Purchase</Button> : null}
      />

      <div className="filter-bar">
        <SearchBar value={query} onChange={setQuery} placeholder="Search purchases..." />
        <select className="form-select filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by payment status">
          <option value="All">All Statuses</option>
          <option value="Paid">Paid</option>
          <option value="Pending">Pending</option>
          <option value="Partially Paid">Partially Paid</option>
        </select>
        <div className="summary-item" style={{ marginLeft: "auto" }}>
          <span className="si-label">Total Purchases (filtered)</span>
          <span className="si-value">{formatINR(total)}</span>
        </div>
      </div>

      {paginated.length === 0 ? (
        <EmptyState title="No purchases found" subtitle="Try adjusting your search or filters." />
      ) : (
        <div className="table-wrap">
          <PurchaseTable items={paginated} />
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

      {canManage && <TransactionForm open={formOpen} onClose={() => setFormOpen(false)} onSubmit={submit} kind="purchase" />}
    </div>
  );
}
