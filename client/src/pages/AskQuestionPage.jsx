import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiClient } from '../lib/apiClient.js';
import Input from '../components/common/Input.jsx';
import Select from '../components/common/Select.jsx';
import Button from '../components/common/Button.jsx';
import ErrorState from '../components/common/ErrorState.jsx';
import QuestionTagsInput from '../components/questions/QuestionTagsInput.jsx';

const FIELD_NAMES = ['title', 'body', 'department_id', 'tags'];

export default function AskQuestionPage() {
  const { profile, session } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '', body: '', department_id: profile?.department?.id || '', tags: '',
  });
  const [departmentsResult, setDepartmentsResult] = useState(null);
  const [departmentAttempt, setDepartmentAttempt] = useState(0);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const submissionPending = useRef(false);
  const departments = departmentsResult?.departments || [];
  const selectedDepartment = departments.find((department) => department.id === form.department_id);

  useEffect(() => {
    let ignore = false;
    setDepartmentsResult(null);
    apiClient.get('/departments').then((data) => {
      if (!ignore) setDepartmentsResult({ departments: data });
    }).catch((err) => {
      if (!ignore) setDepartmentsResult({ error: err.message || 'Could not load departments.' });
    });
    return () => { ignore = true; };
  }, [departmentAttempt]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submissionPending.current) return;

    const title = form.title.trim();
    const tags = [...new Set(form.tags.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
    const nextErrors = {};
    if (title.length < 5 || title.length > 200) nextErrors.title = 'Enter a title between 5 and 200 characters.';
    if (form.body.trim().length < 10) nextErrors.body = 'Enter a description of at least 10 characters.';
    if (!selectedDepartment) nextErrors.department_id = 'Select an available department.';
    if (tags.length > 10) nextErrors.tags = 'Use no more than 10 tags.';
    else if (tags.some((tag) => tag.length > 30)) nextErrors.tags = 'Each tag must be 30 characters or fewer.';

    setErrors(nextErrors);
    setSubmitError(null);
    if (Object.keys(nextErrors).length > 0) {
      setSubmitError('Please check the highlighted fields.');
      document.getElementById(Object.keys(nextErrors)[0])?.focus();
      return;
    }

    submissionPending.current = true;
    setSubmitting(true);
    try {
      const question = await apiClient.post('/questions', {
        title,
        body: form.body,
        department_id: selectedDepartment.id,
        tags,
      }, { token: session?.access_token });
      navigate(`/questions/${question.id}`, { replace: true });
    } catch (err) {
      const fieldErrors = {};
      const otherErrors = [];
      if (Array.isArray(err.details)) {
        for (const detail of err.details) {
          const field = detail.path?.split('.')[1];
          if (FIELD_NAMES.includes(field)) {
            fieldErrors[field] = [fieldErrors[field], detail.message].filter(Boolean).join(' ');
          } else if (detail.message) {
            otherErrors.push(detail.message);
          }
        }
      }
      setErrors(fieldErrors);
      setSubmitError([err.message || 'Could not post your question. Please try again.', ...otherErrors].join(' '));
    } finally {
      submissionPending.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Ask a question</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {selectedDepartment ? `Posting to ${selectedDepartment.name}` : 'Ask students across your university.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate aria-busy={submitting} className="rounded border border-border bg-surface p-6">
        {submitError && (
          <div role="alert" className="mb-4 rounded border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
            {submitError}
          </div>
        )}
        <fieldset disabled={submitting} className="min-w-0">
          <legend className="sr-only">Question details</legend>
          <div className="flex flex-col gap-4">
            <Input
              id="title"
              label="Title"
              required
              minLength={5}
              maxLength={200}
              placeholder="e.g. Why is my Express API returning 401?"
              value={form.title}
              onChange={(event) => update('title', event.target.value)}
              error={errors.title}
            />

            <div>
              <label htmlFor="body" className="mb-1.5 block text-sm font-medium text-ink">Description</label>
              <textarea
                id="body"
                required
                minLength={10}
                rows={10}
                placeholder="Describe your problem. You can write Markdown and fenced code blocks."
                value={form.body}
                onChange={(event) => update('body', event.target.value)}
                aria-invalid={Boolean(errors.body)}
                aria-describedby={errors.body ? 'body-error' : 'body-hint'}
                className={`w-full rounded border bg-surface px-3 py-2 font-mono text-sm text-ink placeholder:font-sans placeholder:text-ink-muted focus-visible:border-accent ${errors.body ? 'border-danger' : 'border-border'}`}
              />
              {errors.body ? (
                <p id="body-error" className="mt-1 text-sm text-danger">{errors.body}</p>
              ) : (
                <p id="body-hint" className="mt-1 text-sm text-ink-muted">At least 10 characters. Formatting is saved as written.</p>
              )}
            </div>

            <div>
              <Select
                id="department_id"
                label="Department"
                required
                value={selectedDepartment?.id || ''}
                onChange={(event) => update('department_id', event.target.value)}
                disabled={!departmentsResult || Boolean(departmentsResult.error) || departments.length === 0}
                error={errors.department_id}
                hint="Choose your own department or another university department."
              >
                <option value="">Select a department</option>
                {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </Select>
              {!departmentsResult ? (
                <p role="status" className="mt-2 text-sm text-ink-muted">Loading departments…</p>
              ) : departmentsResult.error ? (
                <div className="mt-2"><ErrorState message={departmentsResult.error} onRetry={() => setDepartmentAttempt((value) => value + 1)} /></div>
              ) : departments.length === 0 ? (
                <p role="status" className="mt-2 text-sm text-ink-muted">No departments are available. A department is needed to post a question.</p>
              ) : null}
            </div>

            <QuestionTagsInput value={form.tags} onChange={(value) => update('tags', value)} error={errors.tags} disabled={submitting} />
          </div>
          <Button type="submit" className="mt-6" loading={submitting} disabled={!departmentsResult || Boolean(departmentsResult.error) || departments.length === 0}>
            {submitting ? 'Posting question…' : 'Post question'}
          </Button>
        </fieldset>
        {submitting && <p role="status" className="mt-3 text-sm text-ink-muted">Posting your question…</p>}
      </form>
    </div>
  );
}
