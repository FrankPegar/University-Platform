const STORAGE_KEY = 'university_qa_session';

export function loadStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveStoredSession(session) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage can fail in private browsing - the session just won't persist.
  }
}

export function clearStoredSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}
