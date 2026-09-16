import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import Avatar from '../common/Avatar.jsx';

export default function Topbar({ onOpenMenu }) {
  const { profile, logout } = useAuth();
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setSearch(location.pathname === '/explore' ? new URLSearchParams(location.search).get('search') || '' : '');
  }, [location.pathname, location.search]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    const query = search.trim();
    navigate(query ? `/explore?${new URLSearchParams({ search: query })}` : '/explore');
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
      <button
        onClick={onOpenMenu}
        className="rounded p-1.5 text-ink-muted hover:bg-border/40 lg:hidden"
        aria-label="Open menu"
      >
        ☰
      </button>

      <form role="search" onSubmit={handleSearchSubmit} className="min-w-0 flex-1">
        <input
          type="search"
          aria-label="Search questions across the university"
          maxLength={200}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search all departments"
          className="w-full max-w-md rounded border border-border bg-bg px-3 py-1.5 text-sm text-ink placeholder:text-ink-muted focus-visible:border-accent"
        />
      </form>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded p-1 hover:bg-border/40"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <Avatar name={profile?.full_name} />
          <span className="hidden text-sm font-medium text-ink sm:inline">
            {profile?.full_name || 'Account'}
          </span>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-44 rounded border border-border bg-surface py-1 shadow-sm"
          >
            <button
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                navigate('/profile');
              }}
              className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-border/40"
            >
              Profile
            </button>
            <button
              role="menuitem"
              onClick={handleLogout}
              className="block w-full px-3 py-2 text-left text-sm text-danger hover:bg-border/40"
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
