import { useEffect, useRef, useState } from 'react';
import Button from './Button.jsx';

// Shared save lifecycle for inline editors. Cancel unmounts the editor and
// discards its local draft; a pending save must finish before it can be closed.
export default function EditForm({ label, validate, onSave, onSaved, onCancel, disabled, children }) {
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (pending.current || disabled) return;
    const nextErrors = validate();
    setErrors(nextErrors);
    setError(null);
    if (Object.keys(nextErrors).length) {
      setError('Please check the highlighted fields.');
      return;
    }
    pending.current = true;
    setSaving(true);
    try {
      const updated = await onSave();
      if (mounted.current) onSaved(updated);
    } catch (err) {
      if (!mounted.current) return;
      const fields = {};
      const details = Array.isArray(err.details) ? err.details : [];
      for (const detail of details) {
        const field = detail.path?.split('.')[1];
        if (field) fields[field] = [fields[field], detail.message].filter(Boolean).join(' ');
      }
      setErrors(fields);
      setError([err.message || 'Could not save changes. Please try again.', ...details.map(detail => detail.message)].filter(Boolean).join(' '));
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <form aria-label={label} onSubmit={submit} noValidate aria-busy={saving} className="my-4 rounded border border-border bg-surface p-4 sm:p-6">
      <h2 className="mb-4 text-base font-semibold text-ink">{label}</h2>
      {error && <p role="alert" className="mb-4 rounded border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</p>}
      <fieldset disabled={saving} className="min-w-0">
        <legend className="sr-only">{label} fields</legend>
        <div className="flex flex-col gap-4">{children(errors)}</div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="submit" loading={saving} disabled={disabled}>{saving ? 'Saving…' : 'Save'}</Button>
          <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>Cancel</Button>
        </div>
      </fieldset>
      {saving && <p role="status" className="mt-3 text-sm text-ink-muted">Saving changes…</p>}
    </form>
  );
}
