import { ChevronRight } from "lucide-react";

export default function PageHeader({ title, description, breadcrumbs, actions, children }) {
  return (
    <div className="page-header animate-in">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="page-breadcrumb" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="page-crumb">
                {i > 0 && <ChevronRight className="sep" size={13} />}
                {crumb}
              </span>
            ))}
          </nav>
        )}
        <h1 className="ph-title">{title}</h1>
        {description && <p className="ph-sub">{description}</p>}
        {children}
      </div>
      {actions && <div className="ph-actions">{actions}</div>}
    </div>
  );
}
