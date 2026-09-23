import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiClient } from '../../lib/apiClient.js';
import EditForm from '../common/EditForm.jsx';
import Input from '../common/Input.jsx';
import Select from '../common/Select.jsx';
import ErrorState from '../common/ErrorState.jsx';

export default function ProfileEditForm({ profile, onSaved, onCancel }) {
  const { updateProfile } = useAuth();
  const [form, setForm] = useState({ full_name: profile.full_name, department_id: profile.department?.id || '', course_id: profile.course?.id || '', year_level: String(profile.year_level) });
  const [departmentsResult, setDepartmentsResult] = useState(null);
  const [coursesResult, setCoursesResult] = useState(null);
  const [departmentAttempt, setDepartmentAttempt] = useState(0);
  const [courseAttempt, setCourseAttempt] = useState(0);
  useEffect(() => {
    let ignore = false;
    setDepartmentsResult(null);
    apiClient.get('/departments').then(data => { if (!ignore) setDepartmentsResult({ data }); })
      .catch(error => { if (!ignore) setDepartmentsResult({ error: error.message }); });
    return () => { ignore = true; };
  }, [departmentAttempt]);
  useEffect(() => {
    let ignore = false;
    setCoursesResult(null);
    if (form.department_id) {
      apiClient.get(`/departments/${encodeURIComponent(form.department_id)}/courses`).then(data => {
        if (!ignore) setCoursesResult({ departmentId: form.department_id, data });
      }).catch(error => { if (!ignore) setCoursesResult({ departmentId: form.department_id, error: error.message }); });
    }
    return () => { ignore = true; };
  }, [form.department_id, courseAttempt]);
  const courses = coursesResult?.departmentId === form.department_id ? coursesResult : null;
  const ready = Boolean(departmentsResult?.data && courses?.data);
  function update(field, value) {
    setForm(current => ({ ...current, [field]: value, ...(field === 'department_id' ? { course_id: '' } : {}) }));
  }
  function validate() {
    const errors = {};
    if (form.full_name.trim().length < 2 || form.full_name.trim().length > 120) errors.full_name = 'Enter a name between 2 and 120 characters.';
    if (!departmentsResult?.data?.some(department => department.id === form.department_id)) errors.department_id = 'Select an available department.';
    if (!courses?.data?.some(course => course.id === form.course_id)) errors.course_id = 'Select a course in this department.';
    const year = Number(form.year_level);
    if (!Number.isInteger(year) || year < 1 || year > 8) errors.year_level = 'Select a year from 1 to 8.';
    return errors;
  }
  return (
    <EditForm label="Edit profile" onSaved={onSaved} onCancel={onCancel} validate={validate} disabled={!ready}
      onSave={() => updateProfile({ full_name: form.full_name.trim(), department_id: form.department_id, course_id: form.course_id, year_level: Number(form.year_level) })}>
      {errors => <>
        <Input id="edit-profile-name" label="Full name" required minLength={2} maxLength={120} value={form.full_name} onChange={event => update('full_name', event.target.value)} error={errors.full_name} />
        <Input id="edit-profile-student-id" label="Student ID" value={profile.student_id} readOnly hint="Your student ID cannot be changed here." />
        <Select id="edit-profile-department" label="Department" required value={form.department_id} disabled={!departmentsResult?.data} onChange={event => update('department_id', event.target.value)} error={errors.department_id}>
          <option value="">Select a department</option>
          {(departmentsResult?.data || []).map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
        </Select>
        {!departmentsResult ? <p role="status" className="text-sm text-ink-muted">Loading departments…</p> : departmentsResult.error ? (
          <ErrorState message={departmentsResult.error} onRetry={() => setDepartmentAttempt(value => value + 1)} />
        ) : !departmentsResult.data.length && <p className="text-sm text-ink-muted">No departments available.</p>}
        <Select id="edit-profile-course" label="Course" required value={courses?.data?.some(course => course.id === form.course_id) ? form.course_id : ''} disabled={!courses?.data} onChange={event => update('course_id', event.target.value)} error={errors.course_id}>
          <option value="">Select a course</option>
          {(courses?.data || []).map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
        </Select>
        {form.department_id && (!courses ? <p role="status" className="text-sm text-ink-muted">Loading courses…</p> : courses.error ? (
          <ErrorState message={courses.error} onRetry={() => setCourseAttempt(value => value + 1)} />
        ) : !courses.data.length && <p className="text-sm text-ink-muted">No courses available in this department.</p>)}
        <Select id="edit-profile-year" label="Year level" required value={form.year_level} onChange={event => update('year_level', event.target.value)} error={errors.year_level}>
          <option value="">Select year level</option>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(year => <option key={year} value={year}>Year {year}</option>)}
        </Select>
      </>}
    </EditForm>
  );
}
