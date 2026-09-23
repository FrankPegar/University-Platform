import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiClient } from '../lib/apiClient.js';
import Spinner from '../components/common/Spinner.jsx';
import ErrorState from '../components/common/ErrorState.jsx';
import Avatar from '../components/common/Avatar.jsx';
import Button from '../components/common/Button.jsx';
import ProfileEditForm from '../components/profiles/ProfileEditForm.jsx';

export default function ProfilePage() {
  const { session } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);

  const loadProfile = useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient
      .get('/me', { token: session?.access_token })
      .then(setProfile)
      .catch((err) => setError(err.message || 'Could not load your profile.'))
      .finally(() => setLoading(false));
  }, [session]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Loading your profile…" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadProfile} />;
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold tracking-tight text-ink">Profile</h1>
      {editing ? (
        <ProfileEditForm profile={profile} onCancel={() => setEditing(false)} onSaved={(updated) => {
          setProfile(updated);
          setEditing(false);
        }} />
      ) : <Button type="button" variant="secondary" className="mb-4" onClick={() => setEditing(true)}>Edit Profile</Button>}

      <div className="rounded border border-border bg-surface p-6">
        <div className="flex items-center gap-4">
          <Avatar name={profile.full_name} size={10} />
          <div>
            <p className="font-semibold text-ink">{profile.full_name}</p>
            <p className="text-sm text-ink-muted">Student ID {profile.student_id}</p>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-border pt-6 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-ink-muted">Department</dt>
            <dd className="mt-1 text-sm text-ink">{profile.department?.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink-muted">Course</dt>
            <dd className="mt-1 text-sm text-ink">{profile.course?.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink-muted">Year level</dt>
            <dd className="mt-1 text-sm text-ink">Year {profile.year_level}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink-muted">Member since</dt>
            <dd className="mt-1 text-sm text-ink">
              {new Date(profile.created_at).toLocaleDateString()}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
