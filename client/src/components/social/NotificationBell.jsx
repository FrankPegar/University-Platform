import { Link } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationsContext.jsx';

export default function NotificationBell() {
  const { result, error, refresh } = useNotifications();
  const count = result?.unread_count;
  return <Link to="/notifications" onClick={refresh} aria-label={`Notifications${count ? `, ${count} unread` : ''}${error ? ', refresh unavailable' : ''}`}
    className="relative shrink-0 rounded p-2 text-ink-muted hover:bg-border/40">
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </svg>
    {Boolean(count) && <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-4 rounded-full bg-accent px-1 text-center text-xs font-semibold text-white">{count > 99 ? '99+' : count}</span>}
    {error && !count && <span aria-hidden="true" className="absolute right-0 top-0 text-xs text-danger">!</span>}
  </Link>;
}
