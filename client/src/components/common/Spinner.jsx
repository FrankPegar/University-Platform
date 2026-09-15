export default function Spinner({ label }) {
  return (
    <div className="flex items-center gap-2 text-sm text-ink-muted">
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-ink-muted border-t-accent"
        aria-hidden="true"
      />
      {label && <span>{label}</span>}
    </div>
  );
}
