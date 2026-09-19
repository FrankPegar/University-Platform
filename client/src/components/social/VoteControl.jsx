import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiClient } from '../../lib/apiClient.js';

export default function VoteControl({ targetType, targetId, initialCount }) {
  const { session } = useAuth();
  const token = session?.access_token;
  return <VoteButton key={`${targetType}:${targetId}:${token}`} targetType={targetType} targetId={targetId} initialCount={initialCount} token={token} />;
}

function VoteButton({ targetType, targetId, initialCount, token }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(false);
  const mounted = useRef(false);
  const target = { [`${targetType}_id`]: targetId };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    apiClient.get('/votes', { token, params: { [`${targetType}_id`]: targetId } }).then((data) => {
      if (!ignore) setState(data);
    }).catch((err) => {
      if (!ignore) { setState(null); setError(err.message || 'Could not load vote status.'); }
    }).finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [targetType, targetId, token, attempt]);

  async function toggleVote() {
    if (pending.current || loading || !state) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    let actionError = null;
    try {
      if (state.has_voted) await apiClient.delete('/votes', { token, body: target });
      else await apiClient.post('/votes', target, { token });
      if (!mounted.current) return;
      // Apply only confirmed writes; the read below reconciles other tabs/users.
      setState({ has_voted: !state.has_voted, vote_count: Math.max(0, state.vote_count + (state.has_voted ? -1 : 1)) });
    } catch (err) {
      actionError = err.message || 'Could not update your vote.';
      if (mounted.current) setError(actionError);
    }
    try {
      if (!mounted.current) return;
      const current = await apiClient.get('/votes', { token, params: target });
      if (mounted.current) setState(current);
    } catch {
      if (mounted.current) {
        // A timed-out write may have reached the server. Do not guess its state.
        setState(null);
        setError(`${actionError || 'The vote was saved.'} Could not verify vote status. Retry to refresh it.`);
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const count = state?.vote_count ?? (loading ? initialCount : null);
  return (
    <div className="text-xs" role="group" aria-label={`${targetType} voting`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-ink-muted" aria-live="polite">{count ?? '—'} {count === 1 ? 'vote' : 'votes'}</span>
        <button
          type="button"
          disabled={loading || busy || !state}
          onClick={toggleVote}
          aria-pressed={Boolean(state?.has_voted)}
          aria-label={state?.has_voted ? `Remove vote from ${targetType}` : `Upvote ${targetType}`}
          className={`rounded border px-2 py-1 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${state?.has_voted ? 'border-accent/30 bg-accent/10 text-accent' : 'border-border text-ink-muted hover:border-accent hover:text-accent'}`}
        >
          {busy ? 'Updating…' : state?.has_voted ? 'Remove vote' : 'Upvote'}
        </button>
        {loading && <span role="status" className="text-ink-muted">Checking vote…</span>}
      </div>
      {error && <p role="alert" className="mt-1 max-w-prose break-words text-danger">{error}</p>}
      {!state && !loading && !busy && (
        <button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-1 font-medium text-accent hover:underline">Retry vote status</button>
      )}
    </div>
  );
}
