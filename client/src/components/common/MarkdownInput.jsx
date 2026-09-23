export default function MarkdownInput({ id, label, value, onChange, minLength, error }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">{label}</label>
      <textarea
        id={id} required minLength={minLength} rows={10} value={value} onChange={onChange}
        aria-invalid={Boolean(error)} aria-describedby={`${id}-${error ? 'error' : 'hint'}`}
        className={`w-full rounded border bg-surface px-3 py-2 font-mono text-sm text-ink placeholder:font-sans placeholder:text-ink-muted focus-visible:border-accent ${error ? 'border-danger' : 'border-border'}`}
      />
      {error ? <p id={`${id}-error`} className="mt-1 text-sm text-danger">{error}</p> : (
        <p id={`${id}-hint`} className="mt-1 text-sm text-ink-muted">At least {minLength} characters. You can write Markdown and fenced code blocks.</p>
      )}
    </div>
  );
}
