export default function LoadingState({ rows = 3, style }) {
  return (
    <div aria-label="Loading" aria-busy="true" style={style}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton skeleton-card" style={{ marginBottom: 14 }} />
      ))}
    </div>
  );
}
