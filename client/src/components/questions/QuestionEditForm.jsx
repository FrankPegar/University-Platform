import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiClient } from '../../lib/apiClient.js';
import EditForm from '../common/EditForm.jsx';
import Input from '../common/Input.jsx';
import MarkdownInput from '../common/MarkdownInput.jsx';
import QuestionTagsInput from './QuestionTagsInput.jsx';

export default function QuestionEditForm({ question, onSaved, onCancel }) {
  const { session } = useAuth();
  const [title, setTitle] = useState(question.title);
  const [body, setBody] = useState(question.body);
  const [tags, setTags] = useState((question.tags || []).map(tag => tag.name).join(', '));
  const tagNames = [...new Set(tags.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean))];
  function validate() {
    const errors = {};
    if (title.trim().length < 5 || title.trim().length > 200) errors.title = 'Enter a title between 5 and 200 characters.';
    if (body.trim().length < 10) errors.body = 'Enter a description of at least 10 characters.';
    if (tagNames.length > 10) errors.tags = 'Use no more than 10 tags.';
    else if (tagNames.some(tag => tag.length > 30)) errors.tags = 'Each tag must be 30 characters or fewer.';
    return errors;
  }
  return (
    <EditForm label="Edit question" validate={validate} onCancel={onCancel} onSaved={onSaved}
      onSave={() => apiClient.patch(`/questions/${encodeURIComponent(question.id)}`, { title: title.trim(), body, tags: tagNames }, { token: session?.access_token })}>
      {errors => <>
        <Input id="edit-question-title" label="Title" required minLength={5} maxLength={200} value={title} onChange={event => setTitle(event.target.value)} error={errors.title} />
        <MarkdownInput id="edit-question-body" label="Description" minLength={10} value={body} onChange={event => setBody(event.target.value)} error={errors.body} />
        <Input id="edit-question-department" label="Department" value={question.department?.name || ''} readOnly hint="The department cannot be changed after posting." />
        <QuestionTagsInput value={tags} onChange={setTags} error={errors.tags} />
      </>}
    </EditForm>
  );
}
