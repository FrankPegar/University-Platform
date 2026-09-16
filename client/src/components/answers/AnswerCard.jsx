import { lazy, Suspense } from 'react';
import Spinner from '../common/Spinner.jsx';

const MarkdownBody = lazy(() => import('../questions/MarkdownBody.jsx'));

export default function AnswerCard({ answer }) {
  const date = new Date(answer.created_at);
  const hasDate = answer.created_at && !Number.isNaN(date.getTime());

  return (
    <article
      aria-label={`Answer by ${answer.author?.full_name || 'Unknown author'}`}
      className={`min-w-0 rounded border bg-surface p-5 sm:p-6 ${
        answer.is_accepted ? 'border-success/50 ring-1 ring-success/20' : 'border-border'
      }`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="break-words text-sm font-semibold text-ink">{answer.author?.full_name || 'Unknown author'}</span>
        <span className="text-xs text-ink-muted">{answer.vote_count} {answer.vote_count === 1 ? 'vote' : 'votes'}</span>
        {answer.is_accepted && (
          <span className="rounded bg-success/10 px-2 py-0.5 text-xs font-medium text-success">Accepted answer</span>
        )}
        {hasDate && (
          <time dateTime={answer.created_at} className="text-xs text-ink-muted">
            {date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </time>
        )}
      </div>
      <Suspense fallback={<div role="status"><Spinner label="Loading answer body…" /></div>}>
        <MarkdownBody body={answer.body} />
      </Suspense>
    </article>
  );
}
