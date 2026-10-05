import Avatar from '../common/Avatar.jsx';
import { lazy, Suspense, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import Button from '../common/Button.jsx';
import AnswerEditForm from './AnswerEditForm.jsx';
import Spinner from '../common/Spinner.jsx';
import CommentsSection from '../social/CommentsSection.jsx';
import VoteControl from '../social/VoteControl.jsx';

const MarkdownBody = lazy(() => import('../questions/MarkdownBody.jsx'));

export default function AnswerCard({ answer, canAccept, acceptanceDisabled, onToggleAcceptance, onEdited }) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const canEdit = Boolean(user?.id && user.id === answer.author?.id);
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
        <Avatar name={answer.author?.full_name} src={answer.author?.avatar_url} size={6} />
          <span className="break-words text-sm font-semibold text-ink">{answer.author?.full_name || 'Unknown author'}</span>
        <VoteControl targetType="answer" targetId={answer.id} initialCount={answer.vote_count} />
        {answer.is_accepted && (
          <span className="rounded bg-success/10 px-2 py-0.5 text-xs font-medium text-success">Accepted answer</span>
        )}
        {hasDate && (
          <time dateTime={answer.created_at} className="text-xs text-ink-muted">
            {date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </time>
        )}
      </div>
      {canAccept && (
        <button
          type="button"
          disabled={acceptanceDisabled}
          onClick={() => onToggleAcceptance(answer)}
          className="mb-4 rounded border border-success/40 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/10 disabled:cursor-wait disabled:opacity-50"
        >
          {answer.is_accepted ? 'Unaccept answer' : 'Accept answer'}
        </button>
      )}
      {canEdit && !editing && (
        <Button type="button" variant="secondary" className="mb-4 ml-2" disabled={acceptanceDisabled} onClick={() => setEditing(true)}>Edit answer</Button>
      )}
      {canEdit && editing ? (
        <AnswerEditForm answer={answer} disabled={acceptanceDisabled} onCancel={() => setEditing(false)} onSaved={(updated) => {
          onEdited(updated);
          setEditing(false);
        }} />
      ) : <Suspense fallback={<div role="status"><Spinner label="Loading answer body…" /></div>}>
        <MarkdownBody body={answer.body} />
      </Suspense>}
      <CommentsSection targetType="answer" targetId={answer.id} />
    </article>
  );
}
