export default function Select({ label, id, error, hint, className = '', children, ...props }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <select
        id={id}
        className={`w-full rounded border bg-surface px-3 py-2 text-sm text-ink focus-visible:border-accent ${
          error ? 'border-danger' : 'border-border'
        }`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
