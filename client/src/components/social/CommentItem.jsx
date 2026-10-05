import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../../lib/apiClient.js';
import Avatar from '../common/Avatar.jsx';
import EditForm from '../common/EditForm.jsx';

function CommentEditForm({ comment, token, onSaved, onCancel }) {
  const [body, setBody] = useState(comment.body);
  const inputId = `edit-comment-${comment.id}`;
  return (
    <EditForm compact label="Edit comment" onSaved={onSaved} onCancel={onCancel}
      validate={() => !body.trim() || body.trim().length > 1000 ? { body: 'Enter a comment between 1 and 1000 characters.' } : {}}
      onSave={() => apiClient.patch(`/comments/${encodeURIComponent(comment.id)}`, { body: body.trim() }, { token })}>
      {errors => <div>
        <label htmlFor={inputId} className="mb-1 block text-xs font-medium text-ink-muted">Comment</label>
        <textarea id={inputId} autoFocus required rows={2} maxLength={1000} value={body} onChange={event => setBody(event.target.value)}
          aria-invalid={Boolean(errors.body)} aria-describedby={errors.body ? `${inputId}-error` : undefined}
          className={`w-full rounded border bg-surface px-3 py-2 text-sm text-ink focus-visible:border-accent ${errors.body ? 'border-danger' : 'border-border'}`} />
        {errors.body && <p id={`${inputId}-error`} role="alert" className="mt-1 text-xs text-danger">{errors.body}</p>}
      </div>}
    </EditForm>
  );
}

export default function CommentItem({ comment, userId, token, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const pending = useRef(false);
  const mounted = useRef(false);
  const own = Boolean(userId && userId === comment.author?.id);
  const date = new Date(comment.created_at);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function remove() {
    if (pending.current || !own) return;
    pending.current = true;
    setDeleting(true);
    setError(null);
    try {
      await apiClient.delete(`/comments/${encodeURIComponent(comment.id)}`, { token });
      if (mounted.current) onDeleted(comment.id);
    } catch (err) {
      if (!mounted.current) return;
      // A retry after a lost successful response may find it already deleted.
      if (err.statusCode === 404) onDeleted(comment.id);
      else setError(err.message || 'Could not delete your comment. Please try again.');
    } finally {
      pending.current = false;
      if (mounted.current) setDeleting(false);
    }
  }

  const actionClass = 'font-medium hover:underline disabled:opacity-50 disabled:cursor-wait';
  return (
    <li className="py-2" data-comment-id={comment.id}>
      {own && editing ? <CommentEditForm comment={comment} token={token} onCancel={() => setEditing(false)} onSaved={updated => {
        onSaved(updated);
        setEditing(false);
      }} /> : <p className="whitespace-pre-wrap break-words text-sm text-ink">{comment.body}</p>}
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
        <Avatar name={comment.author?.full_name} src={comment.author?.avatar_url} size={6} />
        <span className="max-w-full break-words font-medium">{comment.author?.full_name || 'Unknown author'}</span>
        {comment.created_at && !Number.isNaN(date.getTime()) && <time dateTime={comment.created_at}>{date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>}
        {own && !editing && !confirming && <>
          <button type="button" aria-label="Edit comment" className={`${actionClass} text-accent`} onClick={() => setEditing(true)}>Edit</button>
          <button type="button" aria-label="Delete comment" className={`${actionClass} text-danger`} onClick={() => { setError(null); setConfirming(true); }}>Delete</button>
        </>}
      </div>
      {own && confirming && <div role="group" aria-label="Confirm comment deletion" aria-busy={deleting} className="mt-2 text-xs">
        <p className="text-ink-muted">Delete this comment? This cannot be undone.</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <button type="button" disabled={deleting} className={`${actionClass} text-danger`} onClick={remove}>{deleting ? 'Deleting…' : 'Confirm delete'}</button>
          <button type="button" disabled={deleting} className={actionClass} onClick={() => { setConfirming(false); setError(null); }}>Cancel</button>
        </div>
        {deleting && <p role="status" className="mt-1 text-ink-muted">Deleting comment…</p>}
        {error && <p role="alert" className="mt-1 text-danger">{error}</p>}
      </div>}
    </li>
  );
}
