import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiClient } from '../lib/apiClient.js';
import Button from '../components/common/Button.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import ErrorState from '../components/common/ErrorState.jsx';
import Spinner from '../components/common/Spinner.jsx';
import AnswersSection from '../components/answers/AnswersSection.jsx';
import CommentsSection from '../components/social/CommentsSection.jsx';
import VoteControl from '../components/social/VoteControl.jsx';
import QuestionEditForm from '../components/questions/QuestionEditForm.jsx';

// Load the renderer only when a question is opened, keeping feeds lightweight.
const MarkdownBody = lazy(() => import('../components/questions/MarkdownBody.jsx'));

function readableDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function QuestionDetailPage() {
  const { id } = useParams();
  const { session, user } = useAuth();
  const token = session?.access_token;
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [editingKey, setEditingKey] = useState(null);
  const requestKey = JSON.stringify([id, token]);

  const handleAnswersChange = useCallback((answers) => {
    setResult((current) => {
      if (current?.key !== requestKey || !current.question) return current;
      return {
        ...current,
        question: {
          ...current.question,
          answer_count: answers.length,
          has_accepted_answer: answers.some((answer) => answer.is_accepted),
        },
      };
    });
  }, [requestKey]);

  useEffect(() => {
    let ignore = false;
    setResult(null);
    apiClient.get(`/questions/${encodeURIComponent(id)}`, { token }).then((question) => {
      if (!ignore) setResult({ key: requestKey, question });
    }).catch((error) => {
      if (!ignore) setResult({ key: requestKey, error });
    });
    return () => { ignore = true; };
  }, [id, token, requestKey, attempt]);

  const current = result?.key === requestKey ? result : null;
  if (!current) {
    return <div role="status" className="flex justify-center py-12"><Spinner label="Loading question…" /></div>;
  }

  if (current.error?.statusCode === 404) {
    return (
      <div>
        <h1 className="mb-6 text-xl font-semibold tracking-tight text-ink">Question not found</h1>
        <EmptyState
          title="This question is unavailable"
          description="It may have been removed, or the link may be incorrect."
          action={<Button as={Link} to="/explore" variant="secondary">Explore questions</Button>}
        />
      </div>
    );
  }

  if (current.error) {
    return (
      <div>
        <h1 className="mb-6 text-xl font-semibold tracking-tight text-ink">Could not load question</h1>
        <div role="alert"><ErrorState message={current.error.message} onRetry={() => setAttempt((value) => value + 1)} /></div>
      </div>
    );
  }

  const question = current.question;
  const createdDate = readableDate(question.created_at);
  const updatedDate = readableDate(question.updated_at);
  const wasUpdated = updatedDate && new Date(question.updated_at) > new Date(question.created_at);

  return (
    <div>
      <article className="min-w-0 rounded border border-border bg-surface p-5 sm:p-6">
        <h1 className="break-words text-xl font-semibold tracking-tight text-ink">{question.title}</h1>
        <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1 break-words text-sm text-ink-muted">
          <span>{question.author?.full_name || 'Unknown author'}</span>
          <span aria-hidden="true">·</span>
          <span>{question.department?.name || 'Unknown department'}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
          {createdDate && <span>Asked <time dateTime={question.created_at}>{createdDate}</time></span>}
          {wasUpdated && <span>Updated <time dateTime={question.updated_at}>{updatedDate}</time></span>}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
          <VoteControl targetType="question" targetId={question.id} initialCount={question.vote_count} />
          <span>{question.answer_count} {question.answer_count === 1 ? 'answer' : 'answers'}</span>
          {question.has_accepted_answer ? (
            <span className="rounded bg-success/10 px-2 py-0.5 text-xs font-medium text-success">Accepted answer</span>
          ) : (
            <span className="text-xs">No accepted answer yet</span>
          )}
        </div>

        {user?.id && user.id === question.author?.id && editingKey !== requestKey && (
          <Button type="button" variant="secondary" className="mt-4" onClick={() => setEditingKey(requestKey)}>Edit question</Button>
        )}
        {editingKey === requestKey && user?.id === question.author?.id ? (
          <QuestionEditForm key={requestKey} question={question} onCancel={() => setEditingKey(null)} onSaved={(updated) => {
            setResult(previous => previous?.key === requestKey ? {
              ...previous,
              question: { ...previous.question, title: updated.title, body: updated.body, tags: updated.tags, updated_at: updated.updated_at },
            } : previous);
            setEditingKey(null);
          }} />
        ) : <div className="mt-6 border-t border-border pt-6">
          <Suspense fallback={<div role="status"><Spinner label="Loading question body…" /></div>}>
            <MarkdownBody key={question.id} body={question.body} />
          </Suspense>
        </div>}

        {question.tags?.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2" aria-label="Question tags">
            {question.tags.map((tag) => (
              <span key={tag.id} className="max-w-full break-words rounded border border-border bg-bg px-2 py-0.5 text-xs text-ink-muted">
                {tag.name}
              </span>
            ))}
          </div>
        )}
        <CommentsSection targetType="question" targetId={question.id} />
      </article>

      <AnswersSection
        questionAuthorId={question.author?.id}
        key={requestKey}
        questionId={question.id}
        initialCount={question.answer_count}
        onAnswersChange={handleAnswersChange}
      />
    </div>
  );
}
