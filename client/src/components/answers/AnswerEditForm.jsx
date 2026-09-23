import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiClient } from '../../lib/apiClient.js';
import EditForm from '../common/EditForm.jsx';
import MarkdownInput from '../common/MarkdownInput.jsx';

export default function AnswerEditForm({ answer, onSaved, onCancel, disabled }) {
  const { session } = useAuth();
  const [body, setBody] = useState(answer.body);
  return (
    <EditForm label="Edit answer" disabled={disabled} onCancel={onCancel} onSaved={onSaved}
      validate={() => body.trim().length < 5 ? { body: 'Enter an answer of at least 5 characters.' } : {}}
      onSave={() => apiClient.patch(`/answers/${encodeURIComponent(answer.id)}`, { body }, { token: session?.access_token })}>
      {errors => <MarkdownInput id={`edit-answer-${answer.id}`} label="Answer" minLength={5} value={body} onChange={event => setBody(event.target.value)} error={errors.body} />}
    </EditForm>
  );
}
