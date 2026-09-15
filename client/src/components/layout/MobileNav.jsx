import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Home', end: true },
  { to: '/ask', label: 'Ask question' },
  { to: '/profile', label: 'Profile' },
];

function linkClasses({ isActive }) {
  return `block rounded px-3 py-2 text-base font-medium transition-colors ${
    isActive ? 'bg-accent/10 text-accent' : 'text-ink-muted hover:bg-border/40 hover:text-ink'
  }`;
}

export default function MobileNav({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-surface">
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <span className="text-base font-semibold tracking-tight text-ink">Coursepoint</span>
          <button
            onClick={onClose}
            className="rounded p-1 text-ink-muted hover:bg-border/40"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3" onClick={onClose}>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClasses}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
