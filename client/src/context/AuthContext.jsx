import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient, ApiError } from '../lib/apiClient.js';
import { loadStoredSession, saveStoredSession, clearStoredSession } from '../lib/session.js';

const AuthContext = createContext(null);

// status: 'loading' | 'authenticated' | 'unauthenticated'
export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [session, setSession] = useState(null); // { access_token, refresh_token }
  const [user, setUser] = useState(null); // { id, email }
  const [profile, setProfile] = useState(null); // profiles row (with department/course)

  const applySession = useCallback(async (nextSession, nextUser) => {
    setSession(nextSession);
    setUser(nextUser);
    saveStoredSession({ session: nextSession, user: nextUser });

    try {
      const me = await apiClient.get('/me', { token: nextSession.access_token });
      setProfile(me);
      setStatus('authenticated');
    } catch (err) {
      // Token came back invalid/expired almost immediately - treat as logged out.
      clearStoredSession();
      setSession(null);
      setUser(null);
      setProfile(null);
      setStatus('unauthenticated');
      throw err;
    }
  }, []);

  useEffect(() => {
    const stored = loadStoredSession();
    if (!stored?.session?.access_token) {
      setStatus('unauthenticated');
      return;
    }

    apiClient
      .get('/me', { token: stored.session.access_token })
      .then((me) => {
        setSession(stored.session);
        setUser(stored.user);
        setProfile(me);
        setStatus('authenticated');
      })
      .catch(() => {
        clearStoredSession();
        setStatus('unauthenticated');
      });
  }, []);

  const login = useCallback(
    async ({ email, password }) => {
      const result = await apiClient.post('/auth/login', { email, password });
      await applySession(result.session, result.user);
    },
    [applySession]
  );

  const register = useCallback(
    async (payload) => {
      const result = await apiClient.post('/auth/register', payload);
      if (result.session?.access_token) {
        await applySession(result.session, result.user);
        return { requiresEmailConfirmation: false };
      }
      // Supabase project has email confirmation turned on - no session yet.
      return { requiresEmailConfirmation: true };
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    try {
      if (session?.access_token) {
        await apiClient.post('/auth/logout', {}, { token: session.access_token });
      }
    } catch {
      // Best-effort - still clear local state even if the server call fails.
    } finally {
      clearStoredSession();
      setSession(null);
      setUser(null);
      setProfile(null);
      setStatus('unauthenticated');
    }
  }, [session]);

  const value = useMemo(
    () => ({ status, session, user, profile, login, register, logout }),
    [status, session, user, profile, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export { ApiError };
