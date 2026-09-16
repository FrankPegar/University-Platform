import { useEffect, useState } from 'react';
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

export default function AnswersSection({ questionId, initialCount, onAnswersChange }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false;
    setResult(null);
    apiClient.get(`/questions/${encodeURIComponent(questionId)}/answers`, { token }).then((answers) => {
      if (ignore) return;
      setResult({ answers: sortAnswers(answers) });
      onAnswersChange(answers);
    }).catch((error) => {
      if (!ignore) setResult({ error: error.message || 'Could not load answers.' });
    });
    return () => { ignore = true; };
  }, [questionId, token, attempt, onAnswersChange]);

  function addAnswer(answer) {
    const answers = sortAnswers([...(result?.answers || []).filter((item) => item.id !== answer.id), answer]);
    setResult({ answers });
    onAnswersChange(answers);
  }

  const answers = result?.answers;
  return (
    <section className="mt-8" aria-labelledby="answers-heading">
      <h2 id="answers-heading" className="mb-3 text-sm font-semibold text-ink">Answers ({answers ? answers.length : initialCount})</h2>
      {!result ? (
        <div role="status" className="flex justify-center py-8"><Spinner label="Loading answers…" /></div>
      ) : result.error ? (
        <div role="alert"><ErrorState message={result.error} onRetry={() => setAttempt((value) => value + 1)} /></div>
      ) : answers.length === 0 ? (
        <EmptyState title="No answers yet" description="Share your explanation below to help answer this question." />
      ) : (
        <div className="space-y-4">
          {answers.map((answer) => <AnswerCard key={answer.id} answer={answer} />)}
        </div>
      )}
      <AnswerForm questionId={questionId} disabled={!answers} onCreated={addAnswer} />
    </section>
  );
}
