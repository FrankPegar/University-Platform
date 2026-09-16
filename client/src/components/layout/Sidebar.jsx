import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from './navigation.js';

function linkClasses({ isActive }) {
  return `block rounded px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-accent/10 text-accent' : 'text-ink-muted hover:bg-border/40 hover:text-ink'
  }`;
}

export default function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-surface lg:flex lg:flex-col">
      <div className="flex h-14 items-center border-b border-border px-4">
        <span className="text-base font-semibold tracking-tight text-ink">Coursepoint</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={linkClasses}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border p-3 text-xs text-ink-muted">
        Coursepoint MVP — one university, one community.
      </div>
    </aside>
  );
}
