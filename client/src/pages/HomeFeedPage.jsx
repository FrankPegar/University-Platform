import { useAuth } from '../context/AuthContext.jsx';
import ErrorState from '../components/common/ErrorState.jsx';
import QuestionFeed from '../components/questions/QuestionFeed.jsx';

export default function HomeFeedPage() {
  const { profile } = useAuth();

  return (
    <div>
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          {profile?.department?.name || 'Your'} feed
        </h1>
        <p className="text-sm text-ink-muted">
          Questions from {profile?.department?.name || 'your department'}.
        </p>
      </div>
      {profile?.department?.id ? (
        <QuestionFeed departmentId={profile.department.id} />
      ) : (
        <ErrorState message="Your department could not be found. Reload the page to refresh your profile." />
      )}
    </div>
  );
}
