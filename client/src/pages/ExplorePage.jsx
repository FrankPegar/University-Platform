import { Link, useSearchParams } from 'react-router-dom';
import QuestionFeed from '../components/questions/QuestionFeed.jsx';

export default function ExplorePage() {
  const [params] = useSearchParams();
  const search = (params.get('search') || '').trim();

  return (
    <div>
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Explore</h1>
        <p className="break-words text-sm text-ink-muted">
          {search ? `University-wide results for “${search}”` : 'Questions from across the university, bringing all departments together.'}
        </p>
        {search && <Link to="/explore" className="text-sm font-medium text-accent hover:underline">Clear search</Link>}
      </div>
      <QuestionFeed search={search} />
    </div>
  );
}
