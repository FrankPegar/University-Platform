import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Button from '../components/common/Button.jsx';
import EmptyState from '../components/common/EmptyState.jsx';

const SORT_TABS = [
  { key: 'newest', label: 'Newest' },
  { key: 'votes', label: 'Most voted' },
  { key: 'unanswered', label: 'Unanswered' },
];

export default function HomeFeedPage() {
  const { profile } = useAuth();
  const [activeSort, setActiveSort] = useState('newest');

  return (
    <div>
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          {profile?.department?.name || 'Your'} feed
        </h1>
        <p className="text-sm text-ink-muted">
          Questions from {profile?.department?.name || 'your department'} will appear here.
        </p>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded border border-border bg-surface p-1">
          {SORT_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSort(tab.key)}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                activeSort === tab.key
                  ? 'bg-accent/10 text-accent'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Button as={Link} to="/ask">
          Ask question
        </Button>
      </div>

      <EmptyState
        title="The live feed arrives in Phase 5"
        description="This page is wired for navigation and layout now. Real questions, sorting, and search will load here once the Q&A endpoints are connected."
      />
    </div>
  );
}
