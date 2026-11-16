import { AlertCircle, ArrowRight, RefreshCw, Search } from "lucide-react";
export function Notice({ children, success = false }) {
  if (!children) return null;
  return (
    <div
      className={`notice ${success ? "notice-success" : ""}`}
      role={success ? "status" : "alert"}
    >
      <AlertCircle size={18} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
export function EmptyState({ title, children, action, onAction }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Search size={25} aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action && (
        <button className="btn btn-secondary" onClick={onAction}>
          {action}
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
export function Loading({ label = "Loading your workspace…" }) {
  return (
    <div className="loading-state" role="status">
      <RefreshCw size={20} className="animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
export function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Results pages">
      <button
        className="btn btn-secondary"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button
        className="btn btn-secondary"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
