import Avatar from '../common/Avatar.jsx';
import { Link } from 'react-router-dom';

export default function QuestionCard({ question }) {
  const preview = (question.body || '').replace(/\s+/g, ' ').trim();
  const createdAt = new Date(question.created_at);
  const hasDate = !Number.isNaN(createdAt.getTime());

  return (
    <article className="rounded border border-border bg-surface">
      <Link
        to={`/questions/${question.id}`}
        className="block min-w-0 rounded p-5 transition-colors hover:bg-bg sm:p-6"
        aria-label={question.title}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          <span>{question.vote_count} {question.vote_count === 1 ? 'vote' : 'votes'}</span>
          <span>{question.answer_count} {question.answer_count === 1 ? 'answer' : 'answers'}</span>
          {question.has_accepted_answer && (
            <span className="rounded bg-success/10 px-2 py-0.5 font-medium text-success">
              Accepted answer
            </span>
          )}
        </div>
        <h2 className="mt-2 break-words text-base font-semibold text-ink">{question.title}</h2>
        <p className="mt-2 break-words text-sm text-ink-muted">
          {preview.length > 240 ? `${preview.slice(0, 240)}…` : preview}
        </p>
        {question.tags?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {question.tags.map((tag) => (
              <span key={tag.id} className="max-w-full break-words rounded border border-border bg-bg px-2 py-0.5 text-xs text-ink-muted">
                {tag.name}
              </span>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-x-2 gap-y-1 break-words text-xs text-ink-muted">
          <Avatar name={question.author?.full_name} src={question.author?.avatar_url} size={6} />
          <span>{question.author?.full_name || 'Unknown author'}</span>
          <span aria-hidden="true">·</span>
          <span>{question.department?.name || 'Unknown department'}</span>
          {hasDate && (
            <>
              <span aria-hidden="true">·</span>
              <time dateTime={question.created_at}>
                {createdAt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
              </time>
            </>
          )}
        </div>
      </Link>
    </article>
  );
}
