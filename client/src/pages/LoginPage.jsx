import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Input from '../components/common/Input.jsx';
import Button from '../components/common/Button.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(form);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Could not log in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-lg font-semibold tracking-tight text-ink">Coursepoint</p>
          <p className="mt-1 text-sm text-ink-muted">Log in to your department community</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded border border-border bg-surface p-6"
          noValidate
        >
          {error && (
            <div
              role="alert"
              className="mb-4 rounded border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
            >
              {error}
            </div>
          )}

          <div className="flex flex-col gap-4">
            <Input
              id="email"
              type="email"
              label="Email"
              autoComplete="email"
              required
              value={form.email}
              onChange={update('email')}
            />
            <Input
              id="password"
              type="password"
              label="Password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={update('password')}
            />
          </div>

          <Button type="submit" className="mt-6 w-full" loading={loading}>
            Log in
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-ink-muted">
          New here?{' '}
          <Link to="/register" className="font-medium text-accent hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
