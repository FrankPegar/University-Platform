import Avatar from '../common/Avatar.jsx';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiClient } from '../../lib/apiClient.js';
import Button from '../common/Button.jsx';

export default function CommentsSection({ targetType, targetId }) {
  const { session } = useAuth();
  const token = session?.access_token;
  return <CommentsThread key={`${targetType}:${targetId}:${token}`} targetType={targetType} targetId={targetId} token={token} />;
}

function CommentsThread({ targetType, targetId, token }) {
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [body, setBody] = useState('');
  const [bodyError, setBodyError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);
  const pending = useRef(false);
  const mounted = useRef(false);
  const inputRef = useRef(null);
  const inputId = `comment-${targetType}-${targetId}`;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let ignore = false;
    setResult(null);
    apiClient.get(`/${targetType === 'question' ? 'questions' : 'answers'}/${encodeURIComponent(targetId)}/comments`, { token }).then((comments) => {
      if (!ignore) setResult({ comments });
    }).catch((error) => {
      if (!ignore) setResult({ error: error.message || 'Could not load comments.' });
    });
    return () => { ignore = true; };
  }, [targetType, targetId, token, attempt]);

  async function submitComment(event) {
    event.preventDefault();
    if (pending.current || !result?.comments) return;
    const text = body.trim();
    setBodyError(null);
    setSubmitError(null);
    setNotice(null);
    if (!text || text.length > 1000) {
      setBodyError('Enter a comment between 1 and 1000 characters.');
      inputRef.current?.focus();
      return;
    }
    pending.current = true;
    setSubmitting(true);
    try {
      const comment = await apiClient.post('/comments', { [`${targetType}_id`]: targetId, body: text }, { token });
      if (!mounted.current) return;
      setResult((current) => ({ comments: [...current.comments.filter((item) => item.id !== comment.id), comment] }));
      setBody('');
      setNotice('Comment posted.');
    } catch (error) {
      if (!mounted.current) return;
      const details = Array.isArray(error.details) ? error.details : [];
      setBodyError(details.filter((detail) => detail.path === 'body.body').map((detail) => detail.message).join(' ') || null);
      setSubmitError([error.message || 'Could not post your comment.', ...details.filter((detail) => detail.path !== 'body.body').map((detail) => detail.message)].join(' '));
    } finally {
      pending.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }

  return (
    <section aria-label={`${targetType} comments`} className="mt-5 border-t border-border pt-3">
      <h3 className="mb-2 text-xs font-semibold text-ink-muted">Comments{result?.comments ? ` (${result.comments.length})` : ''}</h3>
      {!result ? (
        <p role="status" className="text-xs text-ink-muted">Loading comments…</p>
      ) : result.error ? (
        <div className="text-xs">
          <p role="alert" className="text-danger">{result.error}</p>
          <button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-1 font-medium text-accent hover:underline">Retry comments</button>
        </div>
      ) : result.comments.length === 0 ? (
        <p className="text-xs text-ink-muted">No comments yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {result.comments.map((comment) => {
            const date = new Date(comment.created_at);
            return (
              <li key={comment.id} className="py-2">
                <p className="whitespace-pre-wrap break-words text-sm text-ink">{comment.body}</p>
                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-ink-muted">
                  <Avatar name={comment.author?.full_name} src={comment.author?.avatar_url} size={6} />
                  <span className="max-w-full break-words font-medium">{comment.author?.full_name || 'Unknown author'}</span>
                  {comment.created_at && !Number.isNaN(date.getTime()) && <time dateTime={comment.created_at}>{date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <form aria-label={`Add ${targetType} comment`} onSubmit={submitComment} noValidate aria-busy={submitting} className="mt-3">
        <label htmlFor={inputId} className="mb-1 block text-xs font-medium text-ink-muted">Add a comment</label>
        <textarea
          ref={inputRef} id={inputId} required maxLength={1000} rows={2} value={body} disabled={submitting}
          onChange={(event) => { setBody(event.target.value); setBodyError(null); setSubmitError(null); setNotice(null); }}
          aria-invalid={Boolean(bodyError)} aria-describedby={bodyError ? `${inputId}-error` : `${inputId}-hint`}
          className={`w-full rounded border bg-surface px-3 py-2 text-sm text-ink focus-visible:border-accent ${bodyError ? 'border-danger' : 'border-border'}`}
        />
        {bodyError ? <p id={`${inputId}-error`} role="alert" className="mt-1 text-xs text-danger">{bodyError}</p> : <p id={`${inputId}-hint`} className="mt-1 text-xs text-ink-muted">Up to 1000 characters.</p>}
        {submitError && <p role="alert" className="mt-1 text-xs text-danger">{submitError}</p>}
        {notice && <p role="status" className="mt-1 text-xs text-success">{notice}</p>}
        <Button type="submit" variant="secondary" className="mt-2" loading={submitting} disabled={!result?.comments}>
          {submitting ? 'Posting comment…' : 'Post comment'}
        </Button>
      </form>
    </section>
  );
}
