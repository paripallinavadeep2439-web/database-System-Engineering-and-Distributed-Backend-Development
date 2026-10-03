import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import PageHeader from "../components/layout/PageHeader";
import SearchBar from "../components/common/SearchBar";
import Button from "../components/common/Button";
import StatusBadge from "../components/common/StatusBadge";
import EmptyState from "../components/common/EmptyState";
import LoadingState from "../components/common/LoadingState";
import { formatNumber, formatINR } from "../utils/formatters";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import TransactionForm from "../components/transactions/TransactionForm";
import * as api from "../services/api";

export default function LowStock() {
  const toast = useToast();
  const { user } = useAuth();
  const canManage = ["Admin", "Inventory Manager", "Pharmacist"].includes(user?.role);
  const [medicines, setMedicines] = useState(null);
  const [query, setQuery] = useState("");
  const [purchaseFor, setPurchaseFor] = useState(null);

  useEffect(() => {
    api.getMedicines().then(setMedicines).catch(() => setMedicines([]));
  }, []);

  const lowStock = useMemo(() => {
    const list = (medicines || [])
      .filter((medicine) => medicine.stock < medicine.reorderLevel)
      .map((medicine) => {
        const shortage = medicine.reorderLevel - medicine.stock;
        const suggested = Math.max(medicine.reorderLevel * 2 - medicine.stock, medicine.reorderLevel);
        const severity = medicine.reorderLevel > 0 && medicine.stock / medicine.reorderLevel < 0.3 ? "Critical" : "Warning";
        return { ...medicine, shortage, suggested, severity };
      })
      .sort((a, b) => a.stock - b.stock);
    if (!query) return list;
    const normalized = query.toLowerCase();
    return list.filter((medicine) => `${medicine.name} ${medicine.generic}`.toLowerCase().includes(normalized));
  }, [medicines, query]);

  if (!medicines) return <LoadingState rows={4} />;
  const critical = lowStock.filter((medicine) => medicine.severity === "Critical").length;

  const submitPurchase = async (payload) => {
    try {
      await api.createPurchase(payload);
      toast.success("Purchase created", `Reorder raised for ${purchaseFor.name}.`);
      setPurchaseFor(null);
      setMedicines(await api.getMedicines());
    } catch (error) {
      toast.error("Error", error.message || "Could not create purchase.");
      throw error;
    }
  };

  return (
    <div>
      <PageHeader title="Low Stock" subtitle="Medicines running below their reorder level that need restocking." />
      <div className="summary-strip card" style={{ marginBottom: 18 }}>
        <div className="summary-item"><span className="si-label">Low Stock Items</span><span className="si-value">{lowStock.length}</span></div>
        <div className="summary-item"><span className="si-label">Critical</span><span className="si-value" style={{ color: "var(--danger)" }}>{critical}</span></div>
        <div className="summary-item"><span className="si-label">Warning</span><span className="si-value" style={{ color: "var(--warning)" }}>{lowStock.length - critical}</span></div>
        <div className="summary-item"><span className="si-label">Estimated Restock Value</span><span className="si-value">{formatINR(lowStock.reduce((sum, medicine) => sum + medicine.suggested * medicine.unitPrice, 0))}</span></div>
      </div>
      <div className="filter-bar"><SearchBar value={query} onChange={setQuery} placeholder="Search low stock items..." /></div>
      {lowStock.length === 0 ? <EmptyState title="No low stock items" subtitle="All medicines are above their reorder levels." /> : lowStock.map((medicine) => (
        <div className={`alert-row ${medicine.severity === "Critical" ? "critical" : "warning"}`} key={medicine.id}>
          <div style={{ minWidth: 180, flex: 1 }}><div style={{ fontWeight: 600 }}>{medicine.name}</div><div className="muted text-sm">{medicine.generic} · {medicine.category}</div></div>
          <div className="summary-strip"><div className="summary-item"><span className="si-label">Current Stock</span><span className="si-value" style={{ color: "var(--danger)" }}>{formatNumber(medicine.stock)}</span></div><div className="summary-item"><span className="si-label">Reorder Level</span><span className="si-value">{formatNumber(medicine.reorderLevel)}</span></div><div className="summary-item"><span className="si-label">Shortage</span><span className="si-value">{formatNumber(medicine.shortage)}</span></div><div className="summary-item"><span className="si-label">Suggested Reorder</span><span className="si-value">{formatNumber(medicine.suggested)}</span></div></div>
          <div className="flex gap-8"><StatusBadge status={medicine.severity === "Critical" ? "Critical" : "Low Stock"} />{canManage && <Button variant="outline" size="sm" icon={Plus} onClick={() => setPurchaseFor(medicine)}>Create Purchase</Button>}</div>
        </div>
      ))}
      {purchaseFor && <TransactionForm open onClose={() => setPurchaseFor(null)} onSubmit={submitPurchase} kind="purchase" initial={{ medicineId: purchaseFor.id, suggested: purchaseFor.suggested }} />}
    </div>
  );
}
