import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiClient } from '../lib/apiClient.js';
import Input from '../components/common/Input.jsx';
import Select from '../components/common/Select.jsx';
import Button from '../components/common/Button.jsx';
import Spinner from '../components/common/Spinner.jsx';
import ErrorState from '../components/common/ErrorState.jsx';

const YEAR_LEVELS = [1, 2, 3, 4, 5, 6];

const initialForm = {
  full_name: '',
  email: '',
  password: '',
  student_id: '',
  department_id: '',
  course_id: '',
  year_level: '',
};

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationNeeded, setConfirmationNeeded] = useState(false);

  function loadDepartments() {
    setLoadingDepartments(true);
    setLoadError(null);
    apiClient
      .get('/departments')
      .then(setDepartments)
      .catch((err) => setLoadError(err.message || 'Could not load departments.'))
      .finally(() => setLoadingDepartments(false));
  }

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    if (!form.department_id) {
      setCourses([]);
      return;
    }
    setLoadingCourses(true);
    apiClient
      .get(`/departments/${form.department_id}/courses`)
      .then(setCourses)
      .catch((err) => setLoadError(err.message || 'Could not load courses.'))
      .finally(() => setLoadingCourses(false));
  }, [form.department_id]);

  function update(field) {
    return (e) => {
      const value = e.target.value;
      setForm((f) => ({
        ...f,
        [field]: value,
        // Changing department invalidates whichever course was selected.
        ...(field === 'department_id' ? { course_id: '' } : {}),
      }));
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const { requiresEmailConfirmation } = await register({
        ...form,
        year_level: Number(form.year_level),
      });
      if (requiresEmailConfirmation) {
        setConfirmationNeeded(true);
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setSubmitError(err.message || 'Could not create your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmationNeeded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="w-full max-w-sm rounded border border-border bg-surface p-6 text-center">
          <p className="font-semibold text-ink">Check your email</p>
          <p className="mt-2 text-sm text-ink-muted">
            We sent a confirmation link to {form.email}. Confirm your address, then log in.
          </p>
          <Button as={Link} to="/login" variant="secondary" className="mt-4">
            Go to login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-lg font-semibold tracking-tight text-ink">Coursepoint</p>
          <p className="mt-1 text-sm text-ink-muted">Create your student account</p>
        </div>

        {loadingDepartments ? (
          <div className="flex justify-center rounded border border-border bg-surface p-6">
            <Spinner label="Loading departments…" />
          </div>
        ) : loadError && departments.length === 0 ? (
          <ErrorState message={loadError} onRetry={loadDepartments} />
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded border border-border bg-surface p-6"
            noValidate
          >
            {submitError && (
              <div
                role="alert"
                className="mb-4 rounded border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
              >
                {submitError}
              </div>
            )}

            <div className="flex flex-col gap-4">
              <Input
                id="full_name"
                label="Full name"
                required
                minLength={2}
                value={form.full_name}
                onChange={update('full_name')}
              />
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
                autoComplete="new-password"
                required
                minLength={8}
                hint="At least 8 characters."
                value={form.password}
                onChange={update('password')}
              />
              <Input
                id="student_id"
                label="Student ID"
                required
                placeholder="2026-00123"
                value={form.student_id}
                onChange={update('student_id')}
              />

              <Select
                id="department_id"
                label="Department"
                required
                value={form.department_id}
                onChange={update('department_id')}
              >
                <option value="" disabled>
                  Select your department
                </option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>

              <Select
                id="course_id"
                label="Course"
                required
                disabled={!form.department_id || loadingCourses}
                value={form.course_id}
                onChange={update('course_id')}
                hint={loadingCourses ? 'Loading courses…' : undefined}
              >
                <option value="" disabled>
                  {form.department_id ? 'Select your course' : 'Select a department first'}
                </option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>

              <Select
                id="year_level"
                label="Year level"
                required
                value={form.year_level}
                onChange={update('year_level')}
              >
                <option value="" disabled>
                  Select year level
                </option>
                {YEAR_LEVELS.map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </Select>
            </div>

            <Button type="submit" className="mt-6 w-full" loading={submitting}>
              Create account
            </Button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-ink-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
