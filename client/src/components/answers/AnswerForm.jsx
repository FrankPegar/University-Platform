import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiClient } from '../../lib/apiClient.js';
import Button from '../common/Button.jsx';

export default function AnswerForm({ questionId, disabled, onCreated }) {
  const { session } = useAuth();
  const [body, setBody] = useState('');
  const [bodyError, setBodyError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);
  const pending = useRef(false);
  const mounted = useRef(false);
  const inputRef = useRef(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (pending.current || disabled) return;
    setBodyError(null);
    setSubmitError(null);
    setNotice(null);
    if (body.trim().length < 5) {
      setBodyError('Enter an answer of at least 5 characters.');
      inputRef.current?.focus();
      return;
    }

    pending.current = true;
    setSubmitting(true);
    try {
      const answer = await apiClient.post(`/questions/${encodeURIComponent(questionId)}/answers`, { body }, {
        token: session?.access_token,
      });
      // Navigating away must not insert an answer into a different question.
      if (!mounted.current) return;
      onCreated(answer);
      setBody('');
      setNotice('Your answer has been posted.');
    } catch (error) {
      if (!mounted.current) return;
      const details = Array.isArray(error.details) ? error.details : [];
      const bodyMessages = details.filter((detail) => detail.path === 'body.body').map((detail) => detail.message);
      const otherMessages = details.filter((detail) => detail.path !== 'body.body').map((detail) => detail.message);
      setBodyError(bodyMessages.join(' ') || null);
      setSubmitError([error.message || 'Could not post your answer. Please try again.', ...otherMessages].join(' '));
    } finally {
      pending.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }

  return (
    <form aria-label="Post an answer" onSubmit={handleSubmit} noValidate aria-busy={submitting} className="mt-6 rounded border border-border bg-surface p-5 sm:p-6">
      <h3 className="mb-4 text-base font-semibold text-ink">Your answer</h3>
      {submitError && <p role="alert" className="mb-4 rounded border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{submitError}</p>}
      {notice && <p role="status" className="mb-4 rounded border border-success/30 bg-success/5 p-3 text-sm text-success">{notice}</p>}
      <label htmlFor="answer-body" className="mb-1.5 block text-sm font-medium text-ink">Answer</label>
      <textarea
        ref={inputRef}
        id="answer-body"
        required
        minLength={5}
        rows={8}
        value={body}
        disabled={submitting}
        onChange={(event) => {
          setBody(event.target.value);
          setBodyError(null);
          setSubmitError(null);
          setNotice(null);
        }}
        placeholder="Share your explanation. You can write Markdown and fenced code blocks."
        aria-invalid={Boolean(bodyError)}
        aria-describedby={bodyError ? 'answer-body-error' : 'answer-body-hint'}
        className={`w-full rounded border bg-surface px-3 py-2 font-mono text-sm text-ink placeholder:font-sans placeholder:text-ink-muted focus-visible:border-accent ${bodyError ? 'border-danger' : 'border-border'}`}
      />
      {bodyError ? (
        <p id="answer-body-error" role="alert" className="mt-1 text-sm text-danger">{bodyError}</p>
      ) : (
        <p id="answer-body-hint" className="mt-1 text-sm text-ink-muted">At least 5 characters. Formatting is saved as written.</p>
      )}
      <Button type="submit" className="mt-4" disabled={disabled} loading={submitting}>
        {submitting ? 'Posting answer…' : 'Post answer'}
      </Button>
      {submitting && <p role="status" className="mt-3 text-sm text-ink-muted">Posting your answer…</p>}
    </form>
  );
}
