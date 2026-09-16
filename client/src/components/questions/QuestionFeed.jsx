import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiClient } from '../../lib/apiClient.js';
import Button from '../common/Button.jsx';
import EmptyState from '../common/EmptyState.jsx';
import ErrorState from '../common/ErrorState.jsx';
import Spinner from '../common/Spinner.jsx';
import QuestionCard from './QuestionCard.jsx';

const SORT_TABS = [
  { key: 'newest', label: 'Newest' },
  { key: 'votes', label: 'Most voted' },
  { key: 'unanswered', label: 'Unanswered' },
];
const PAGE_SIZE = 20;

export default function QuestionFeed({ departmentId, search = '' }) {
  const { session } = useAuth();
  const [params, setParams] = useSearchParams();
  const sort = SORT_TABS.some((tab) => tab.key === params.get('sort')) ? params.get('sort') : 'newest';
  const requestedPage = Number(params.get('page') || 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const token = session?.access_token;
  const requestKey = JSON.stringify([departmentId, search, sort, page, token]);
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false;
    setResult(null);
    apiClient.get('/questions', {
      token,
      params: { department_id: departmentId, search, sort, page, limit: PAGE_SIZE },
    }).then((data) => {
      if (!ignore) setResult({ key: requestKey, data });
    }).catch((error) => {
      if (!ignore) setResult({ key: requestKey, error: error.message || 'Could not load questions.' });
    });
    // A slow response from a previous filter must not replace the current feed.
    return () => { ignore = true; };
  }, [departmentId, search, sort, page, token, requestKey, attempt]);

  function changeSort(nextSort) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('sort', nextSort);
      next.delete('page');
      return next;
    });
  }

  function changePage(nextPage) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (nextPage === 1) next.delete('page');
      else next.set('page', String(nextPage));
      return next;
    });
  }

  const current = result?.key === requestKey ? result : null;
  const totalPages = current?.data ? Math.max(1, Math.ceil(current.data.total / PAGE_SIZE)) : 1;

  return (
    <section aria-label="Question feed">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Sort questions" className="flex flex-wrap gap-1 rounded border border-border bg-surface p-1">
          {SORT_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => changeSort(tab.key)}
              aria-pressed={sort === tab.key}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                sort === tab.key ? 'bg-accent/10 text-accent' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Button as={Link} to="/ask">Ask question</Button>
      </div>
      {!current ? (
        <div role="status" className="flex justify-center py-12"><Spinner label="Loading questions…" /></div>
      ) : current.error ? (
        <ErrorState message={current.error} onRetry={() => setAttempt((value) => value + 1)} />
      ) : (
        <>
          {current.data.items.length === 0 ? (
            <EmptyState
              title={search ? 'No matching questions' : sort === 'unanswered' ? 'No unanswered questions' : 'No questions yet'}
              description={page > 1 ? 'There are no questions on this page. Return to the first page to continue browsing.' : search ? 'Try a different search or sorting option.' : 'Questions matching this feed will appear here.'}
              action={page > 1 ? <Button variant="secondary" onClick={() => changePage(1)}>First page</Button> : undefined}
            />
          ) : (
            <div className="space-y-4">
              {current.data.items.map((question) => <QuestionCard key={question.id} question={question} />)}
            </div>
          )}
          {(totalPages > 1 || page > 1) && (
            <nav aria-label="Feed pagination" className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <Button variant="secondary" disabled={page <= 1} onClick={() => changePage(page - 1)}>Previous</Button>
              <span className="text-sm text-ink-muted">Page {page} of {totalPages}</span>
              <Button variant="secondary" disabled={page >= totalPages} onClick={() => changePage(page + 1)}>Next</Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
