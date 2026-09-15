import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import MobileNav from './MobileNav.jsx';
import Topbar from './Topbar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { profile } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar />
      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setMobileNavOpen(true)} />

        <div className="flex flex-1 overflow-y-auto">
          <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
            <Outlet />
          </main>

          <aside className="hidden w-72 shrink-0 border-l border-border px-5 py-6 xl:block">
            <div className="rounded border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold text-ink">Your department</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {profile?.department?.name || 'Loading…'}
              </p>
              <p className="mt-3 text-sm text-ink-muted">
                {profile?.course?.name} · Year {profile?.year_level}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
