import { PackageSearch } from "lucide-react";

export default function EmptyState({ title = "Nothing here", subtitle, icon: Icon = PackageSearch, children }) {
  return (
    <div className="empty-state">
      <div className="es-icon" aria-hidden="true">
        <Icon size={28} />
      </div>
      <div className="es-title">{title}</div>
      {subtitle && <div className="es-sub">{subtitle}</div>}
      {children}
    </div>
  );
}
