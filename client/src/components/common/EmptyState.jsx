export default function EmptyState({ title, description, action }) {
  return (
    <div className="rounded border border-dashed border-border bg-surface p-8 text-center">
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
