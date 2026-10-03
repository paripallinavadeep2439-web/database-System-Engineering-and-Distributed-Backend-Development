import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";

const ICONS = {
  success: { Icon: CheckCircle2, cls: "toast-success-icon" },
  error: { Icon: AlertCircle, cls: "toast-error-icon" },
  warning: { Icon: AlertTriangle, cls: "toast-warning-icon" },
  info: { Icon: Info, cls: "toast-info-icon" },
};

export default function ToastStack() {
  const { toasts, remove } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" role="region" aria-label="Notifications">
      {toasts.map((t) => {
        const { Icon, cls } = ICONS[t.type] || ICONS.info;
        return (
          <div key={t.id} className={`toast ${t.type}`} role="status">
            <span className={`toast-icon ${cls}`}>
              <Icon size={18} />
            </span>
            <div style={{ flex: 1 }}>
              {t.title && <div className="toast-title">{t.title}</div>}
              {t.message && <div className="toast-message">{t.message}</div>}
            </div>
            <button className="icon-btn" onClick={() => remove(t.id)} aria-label="Dismiss">
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
