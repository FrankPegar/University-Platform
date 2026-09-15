import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import Input from '../components/common/Input.jsx';
import Button from '../components/common/Button.jsx';

export default function AskQuestionPage() {
  const { profile } = useAuth();
  const [form, setForm] = useState({ title: '', body: '', tags: '' });
  const [notice, setNotice] = useState(null);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    // Posting to POST /api/questions is wired in Phase 5, alongside the
    // Markdown editor and live feed this question should appear in.
    setNotice('Posting questions arrives in Phase 5. Your draft is not saved yet.');
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Ask a question</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Posting to {profile?.department?.name || 'your department'}
        </p>
      </div>

      {notice && (
        <div
          role="status"
          className="mb-4 rounded border border-accent/30 bg-accent/5 p-3 text-sm text-accent"
        >
          {notice}
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded border border-border bg-surface p-6">
        <div className="flex flex-col gap-4">
          <Input
            id="title"
            label="Title"
            required
            minLength={5}
            placeholder="e.g. Why is my Express API returning 401?"
            value={form.title}
            onChange={update('title')}
          />

          <div>
            <label htmlFor="body" className="mb-1.5 block text-sm font-medium text-ink">
              Description
            </label>
            <textarea
              id="body"
              required
              minLength={10}
              rows={10}
              placeholder="Describe your problem. Markdown and code blocks arrive in Phase 5."
              value={form.body}
              onChange={update('body')}
              className="w-full rounded border border-border bg-surface px-3 py-2 font-mono text-sm text-ink placeholder:font-sans placeholder:text-ink-muted focus-visible:border-accent"
            />
          </div>

          <Input
            id="tags"
            label="Tags"
            placeholder="javascript, nodejs, express"
            hint="Separate tags with commas."
            value={form.tags}
            onChange={update('tags')}
          />
        </div>

        <Button type="submit" className="mt-6">
          Post question
        </Button>
      </form>
    </div>
  );
}
