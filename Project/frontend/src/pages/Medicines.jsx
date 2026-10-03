import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import PageHeader from "../components/layout/PageHeader";
import SearchBar from "../components/common/SearchBar";
import MedicineTable from "../components/medicines/MedicineTable";
import MedicineForm from "../components/medicines/MedicineForm";
import Pagination from "../components/common/Pagination";
import ConfirmDialog from "../components/common/ConfirmDialog";
import LoadingState from "../components/common/LoadingState";
import EmptyState from "../components/common/EmptyState";
import Button from "../components/common/Button";
import * as api from "../services/api";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import { MEDICINE_CATEGORIES } from "../utils/constants";

export default function Medicines() {
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManage = ["Admin", "Inventory Manager", "Pharmacist"].includes(user?.role);
  const [items, setItems] = useState(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getMedicines().then(setItems).catch(() => setItems([]));
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    let list = [...items];
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((m) =>
        `${m.name} ${m.generic} ${m.category} ${m.manufacturer}`.toLowerCase().includes(q)
      );
    }
    if (category !== "All") list = list.filter((m) => m.category === category);
    list.sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [items, query, category, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const safePage = Math.min(page, pageCount);
  const paginated = filtered.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (m) => {
    setEditing(m);
    setFormOpen(true);
  };

  const submitForm = async (payload) => {
    try {
      const saved = editing ? await api.updateMedicine(editing.id, payload) : await api.createMedicine(payload);
      setItems((prev) => editing ? prev.map((item) => item.id === editing.id ? saved : item) : [saved, ...prev]);
      toast.success(editing ? "Updated" : "Added", editing ? "Medicine updated successfully." : "Medicine added successfully.");
      setFormOpen(false);
    } catch (error) {
      toast.error("Error", error.message || "Could not save medicine.");
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api.deleteMedicine(deleting.id);
      setItems((prev) => prev.filter((m) => m.id !== deleting.id));
      toast.success("Deleted", "Medicine removed.");
      setDeleting(null);
    } catch {
      toast.error("Error", "Could not delete medicine.");
    }
    setBusy(false);
  };

  if (!items) return <LoadingState rows={4} />;

  return (
    <div>
      <PageHeader
        title="Medicines"
        subtitle="Manage your pharmaceutical product catalogue and stock levels."
        actions={canManage ? <Button icon={Plus} onClick={openAdd}>Add Medicine</Button> : null}
      />

      <FilterControls
        query={query}
        setQuery={setQuery}
        category={category}
        setCategory={setCategory}
      />

      {paginated.length === 0 ? (
        <EmptyState title="No medicines found" subtitle="Try adjusting your search or filters." />
      ) : (
        <div className="table-wrap">
          <MedicineTable
            items={paginated}
            onView={(m) => navigate(`/medicines/${m.id}`)}
            onEdit={canManage ? openEdit : undefined}
            onDelete={canManage ? setDeleting : undefined}
            onSort={handleSort}
            sortKey={sortKey}
            sortDir={sortDir}
          />
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

      {canManage && <MedicineForm open={formOpen} onClose={() => setFormOpen(false)} onSubmit={submitForm} initial={editing} />}

      <ConfirmDialog
        open={!!deleting}
        title="Delete medicine?"
        message={deleting ? `Remove "${deleting.name}" from the catalogue? This cannot be undone.` : ""}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        loading={busy}
      />
    </div>
  );
}

function FilterControls({ query, setQuery, category, setCategory }) {
  return (
    <div className="filter-bar">
      <SearchBar value={query} onChange={setQuery} placeholder="Search medicines..." />
      <select className="form-select filter-select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
        <option value="All">All Categories</option>
        {MEDICINE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}
