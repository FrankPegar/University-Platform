import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { apiClient } from '../lib/apiClient.js';

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const { user, session } = useAuth();
  const token = session?.access_token;
  return <NotificationStore key={`${user?.id}:${token}`} token={token}>{children}</NotificationStore>;
}

function NotificationStore({ token, children }) {
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(false);
  const sequence = useRef(0);
  const pending = useRef(false);
  const failedAction = useRef(null);

  const refresh = useCallback(async () => {
    if (!token || pending.current) return;
    const request = ++sequence.current;
    setLoading(true);
    try {
      const data = await apiClient.get('/notifications', { token, params: { page, limit: 20 } });
      if (!Array.isArray(data?.items) || !Number.isInteger(data.unread_count)) throw new Error('Could not load notifications. Please try again.');
      if (mounted.current && request === sequence.current) {
        setResult(data);
        setError(null);
      }
    } catch (err) {
      if (mounted.current && request === sequence.current) setError(err.message);
    } finally {
      if (mounted.current && request === sequence.current) setLoading(false);
    }
  }, [page, token]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; sequence.current++; };
  }, []);
  useEffect(() => {
    refresh();
    const onFocus = () => { if (document.visibilityState === 'visible') refresh(); };
    const timer = setInterval(onFocus, 30000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      sequence.current++;
    };
  }, [refresh]);

  async function markRead(id = null) {
    if (pending.current) return;
    pending.current = true;
    sequence.current++; // Older polling responses cannot undo a successful read.
    setBusy(true);
    setActionError(null);
    try {
      await apiClient.patch(id ? `/notifications/${encodeURIComponent(id)}/read` : '/notifications/read-all', {}, { token });
      if (!mounted.current) return;
      setResult(current => current && ({ ...current,
        unread_count: id ? Math.max(0, current.unread_count - (current.items.some(item => item.id === id && !item.is_read) ? 1 : 0)) : 0,
        items: current.items.map(item => !id || item.id === id ? { ...item, is_read: true } : item),
      }));
      failedAction.current = null;
    } catch (err) {
      if (mounted.current) {
        failedAction.current = { id };
        setActionError(err.message || 'Could not mark notifications as read.');
      }
    } finally {
      pending.current = false;
      if (mounted.current) {
        setBusy(false);
        refresh(); // Reconcile new arrivals and responses lost after a committed write.
      }
    }
  }

  return <NotificationsContext.Provider value={{ result, page, setPage, loading, error, actionError, busy, refresh, markRead,
    retryAction: () => { if (failedAction.current) markRead(failedAction.current.id); } }}>
    {children}
  </NotificationsContext.Provider>;
}

export const useNotifications = () => useContext(NotificationsContext);
