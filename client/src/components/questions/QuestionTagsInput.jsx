import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/apiClient.js';
import Input from '../common/Input.jsx';

export default function QuestionTagsInput({ value, onChange, error, disabled }) {
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const search = value.split(',').at(-1).trim().toLowerCase().slice(0, 50);
  const selected = value.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean);

  useEffect(() => {
    let ignore = false;
    setResult(null);
    const timeout = setTimeout(() => {
      apiClient.get('/tags', { params: { search } }).then((tags) => {
        if (!ignore) setResult({ search, tags });
      }).catch((err) => {
        if (!ignore) setResult({ search, error: err.message || 'Could not load tag suggestions.' });
      });
    }, 250);
    return () => {
      ignore = true;
      clearTimeout(timeout);
    };
  }, [search, attempt]);

  function addSuggestion(name) {
    const parts = value.split(',');
    parts.pop();
    onChange([...parts.map((tag) => tag.trim()).filter(Boolean), name, ''].join(', '));
  }

  const current = result?.search === search ? result : null;
  const suggestions = current?.tags?.filter((tag) => !selected.includes(tag.name.toLowerCase())).slice(0, 8) || [];

  return (
    <div>
      <Input
        id="tags"
        label="Tags"
        placeholder="javascript, nodejs, express"
        hint="Optional. Separate tags with commas; up to 10 tags, 30 characters each."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        error={error}
        disabled={disabled}
      />
      {!current ? (
        <p role="status" className="mt-2 text-xs text-ink-muted">Loading tag suggestions…</p>
      ) : current.error ? (
        <div className="mt-2 text-xs text-ink-muted" role="status">
          <p>{current.error} You can still enter tags manually.</p>
          <button type="button" disabled={disabled} onClick={() => setAttempt((value) => value + 1)} className="mt-1 font-medium text-accent hover:underline disabled:opacity-50">
            Retry tag suggestions
          </button>
        </div>
      ) : suggestions.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="Tag suggestions">
          <span className="text-xs text-ink-muted">Suggestions:</span>
          {suggestions.map((tag) => (
            <button
              key={tag.id}
              type="button"
              disabled={disabled}
              onClick={() => addSuggestion(tag.name)}
              className="max-w-full break-words rounded border border-border bg-bg px-2 py-0.5 text-xs text-ink-muted hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {tag.name}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-ink-muted">You can enter a new tag name.</p>
      )}
    </div>
  );
}
