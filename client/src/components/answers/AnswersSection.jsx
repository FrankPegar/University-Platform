import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiClient } from '../../lib/apiClient.js';
import EmptyState from '../common/EmptyState.jsx';
import ErrorState from '../common/ErrorState.jsx';
import Spinner from '../common/Spinner.jsx';
import AnswerCard from './AnswerCard.jsx';
import AnswerForm from './AnswerForm.jsx';

function sortAnswers(answers) {
  return [...answers].sort((a, b) =>
    Number(Boolean(b.is_accepted)) - Number(Boolean(a.is_accepted)) ||
    new Date(a.created_at) - new Date(b.created_at)
  );
}

export default function AnswersSection({ questionId, questionAuthorId, initialCount, onAnswersChange }) {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [acceptingId, setAcceptingId] = useState(null);
  const [acceptError, setAcceptError] = useState(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  const currentAnswers = useRef([]);
  const canAccept = Boolean(user?.id && user.id === questionAuthorId);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  function updateAnswers(answers) {
    currentAnswers.current = sortAnswers(answers);
    setResult({ answers: currentAnswers.current });
    onAnswersChange(answers);
  }

  useEffect(() => {
    let ignore = false;
    setResult(null);
    apiClient.get(`/questions/${encodeURIComponent(questionId)}/answers`, { token }).then((answers) => {
      if (ignore) return;
      currentAnswers.current = sortAnswers(answers);
      setResult({ answers: currentAnswers.current });
      onAnswersChange(answers);
    }).catch((error) => {
      if (!ignore) setResult({ error: error.message || 'Could not load answers.' });
    });
    return () => { ignore = true; };
  }, [questionId, token, attempt, onAnswersChange]);

  function addAnswer(answer) {
    updateAnswers([...currentAnswers.current.filter((item) => item.id !== answer.id), answer]);
  }

  async function refreshAcceptance() {
    if (pending.current) return;
    pending.current = true;
    setAcceptingId('refresh');
    try {
      const answers = await apiClient.get(`/questions/${encodeURIComponent(questionId)}/answers`, { token });
      if (!mounted.current) return;
      updateAnswers(answers);
      setNeedsRefresh(false);
      setAcceptError(null);
    } catch (error) {
      if (mounted.current) setAcceptError(error.message || 'Could not refresh accepted answer status.');
    } finally {
      pending.current = false;
      if (mounted.current) setAcceptingId(null);
    }
  }

  async function toggleAcceptance(answer) {
    if (!canAccept || pending.current || needsRefresh) return;
    pending.current = true;
    setAcceptingId(answer.id);
    setAcceptError(null);
    try {
      const path = `/answers/${encodeURIComponent(answer.id)}/accept`;
      const updated = answer.is_accepted
        ? await apiClient.delete(path, { token })
        : await apiClient.post(path, {}, { token });
      if (!mounted.current) return;
      updateAnswers(currentAnswers.current.map((item) => item.id === updated.id
        ? { ...item, ...updated }
        : { ...item, is_accepted: updated.is_accepted ? false : item.is_accepted }));
    } catch (error) {
      if (!mounted.current) return;
      setAcceptError(error.message || 'Could not update accepted answer status.');
      // A failed response may follow a committed write. Read the server state
      // before allowing another mutation, including after authorization errors.
      try {
        const answers = await apiClient.get(`/questions/${encodeURIComponent(questionId)}/answers`, { token });
        if (!mounted.current) return;
        updateAnswers(answers);
      } catch {
        if (mounted.current) setNeedsRefresh(true);
      }
    } finally {
      pending.current = false;
      if (mounted.current) setAcceptingId(null);
    }
  }

  const answers = result?.answers;
  return (
    <section className="mt-8" aria-labelledby="answers-heading">
      <h2 id="answers-heading" className="mb-3 text-sm font-semibold text-ink">Answers ({answers ? answers.length : initialCount})</h2>
      {acceptError && (
        <div role="alert" className="mb-4 rounded border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          <p>{acceptError}</p>
          {needsRefresh && (
            <>
              <p className="mt-1">Refresh the answer status before trying again.</p>
              <button type="button" disabled={Boolean(acceptingId)} onClick={refreshAcceptance} className="mt-2 font-medium underline">
                Retry answer status
              </button>
            </>
          )}
        </div>
      )}
      {acceptingId && <p role="status" className="mb-3 text-sm text-ink-muted">Updating accepted answer status…</p>}
      {!result ? (
        <div role="status" className="flex justify-center py-8"><Spinner label="Loading answers…" /></div>
      ) : result.error ? (
        <div role="alert"><ErrorState message={result.error} onRetry={() => setAttempt((value) => value + 1)} /></div>
      ) : answers.length === 0 ? (
        <EmptyState title="No answers yet" description="Share your explanation below to help answer this question." />
      ) : (
        <div className="space-y-4">
          {answers.map((answer) => (
            <AnswerCard
              key={answer.id}
              answer={answer}
              canAccept={canAccept}
              acceptanceDisabled={Boolean(acceptingId) || needsRefresh}
              onToggleAcceptance={toggleAcceptance}
            />
          ))}
        </div>
      )}
      <AnswerForm questionId={questionId} disabled={!answers || Boolean(acceptingId) || needsRefresh} onCreated={addAnswer} />
    </section>
  );
}
