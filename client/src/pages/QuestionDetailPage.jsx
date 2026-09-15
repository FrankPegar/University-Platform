import { useParams } from 'react-router-dom';
import EmptyState from '../components/common/EmptyState.jsx';

export default function QuestionDetailPage() {
  const { id } = useParams();

  return (
    <div>
      <div className="rounded border border-border bg-surface p-6">
        <div className="flex gap-4">
          <div className="flex w-10 shrink-0 flex-col items-center gap-1 text-ink-muted">
            <button
              disabled
              className="rounded border border-border p-1.5 disabled:opacity-40"
              aria-label="Upvote"
            >
              ▲
            </button>
            <span className="text-sm font-medium">–</span>
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold tracking-tight text-ink">
              Question detail (id: {id})
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              This page is scaffolded with the question layout — vote control, tags, author info,
              answers, and comments. Live content, answering, commenting, voting, and accepted
              answers connect to the API in Phase 5.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {['javascript', 'nodejs', 'express'].map((tag) => (
                <span
                  key={tag}
                  className="rounded border border-border bg-bg px-2 py-0.5 text-xs text-ink-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-ink">Answers</h2>
        <EmptyState
          title="Answers connect in Phase 5"
          description="Answer listing, posting, and marking an accepted answer will be wired up next."
        />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-ink">Comments</h2>
        <EmptyState
          title="Comments connect in Phase 5"
          description="Comment listing and posting will be wired up next."
        />
      </div>
    </div>
  );
}
