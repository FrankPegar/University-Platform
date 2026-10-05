import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationsContext.jsx';
import Avatar from '../components/common/Avatar.jsx';
import Button from '../components/common/Button.jsx';
import ErrorState from '../components/common/ErrorState.jsx';

const actions = {
  question_answer: 'answered your question',
  question_comment: 'commented on your question',
  answer_comment: 'commented on your answer',
  answer_accepted: 'accepted your answer',
};

export default function NotificationsPage() {
  const { result, page, setPage, loading, error, busy, refresh, markRead } = useNotifications();
  const navigate = useNavigate();
  const current = result?.page === page ? result : null;
  return <section aria-label="Notifications">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-semibold text-ink">Notifications</h1>
      <Button variant="secondary" disabled={busy || !result?.unread_count} loading={busy} onClick={() => markRead()}>Mark all as read</Button>
    </div>
    {loading && <p role="status" className="mb-3 text-sm text-ink-muted">Loading notifications…</p>}
    {error && <ErrorState message={error} onRetry={refresh} />}
    {current && !current.items.length && <p className="rounded border border-border bg-surface p-5 text-sm text-ink-muted">{page === 1 ? 'No notifications yet.' : 'No more notifications.'}</p>}
    {current && current.items.length > 0 && <ul className="divide-y divide-border overflow-hidden rounded border border-border bg-surface">
      {current.items.map(item => <li key={item.id} data-notification-id={item.id} data-read={item.is_read}>
        <button type="button" disabled={busy} onClick={() => {
          navigate(`/questions/${encodeURIComponent(item.question_id)}`);
          if (!item.is_read) markRead(item.id);
        }} className={`flex w-full items-start gap-3 p-4 text-left hover:bg-border/30 disabled:opacity-60 ${item.is_read ? '' : 'bg-accent/5'}`}>
          <Avatar name={item.actor?.full_name} src={item.actor?.avatar_url} size={8} />
          <span className="min-w-0 flex-1">
            <span className={`block break-words text-sm text-ink ${item.is_read ? '' : 'font-semibold'}`}>
              {item.actor?.full_name || 'A student'} {actions[item.type] || 'updated your question'}{item.question?.title ? `: ${item.question.title}` : '.'}
            </span>
            <time dateTime={item.created_at} className="mt-1 block text-xs text-ink-muted">{new Date(item.created_at).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
            {!item.is_read && <span className="mt-1 block text-xs font-medium text-accent">Unread</span>}
          </span>
        </button>
      </li>)}
    </ul>}
    <div className="mt-4 flex items-center justify-between gap-3">
      <Button variant="secondary" disabled={page === 1 || loading || busy} onClick={() => setPage(value => value - 1)}>Newer</Button>
      <span className="text-xs text-ink-muted">Page {page}</span>
      <Button variant="secondary" disabled={!current || page * current.limit >= current.total || loading || busy} onClick={() => setPage(value => value + 1)}>Older</Button>
    </div>
  </section>;
}
