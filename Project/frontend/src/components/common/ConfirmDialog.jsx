import { AlertTriangle } from "lucide-react";
import Modal from "./Modal";
import Button from "./Button";

export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
  loading,
}) {
  return (
    <Modal open={open} onClose={onCancel} title="Confirmation" size="sm">
      <div style={{ padding: 8 }}>
        <div className="confirm-icon-wrap">
          <AlertTriangle size={26} />
        </div>
        <div className="confirm-title">{title}</div>
        {message && <div className="confirm-message">{message}</div>}
        <div className="flex gap-12" style={{ justifyContent: "center" }}>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={loading}>
            {loading ? "Please wait..." : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
