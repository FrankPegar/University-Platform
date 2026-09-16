import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/apiClient.js';
import EmptyState from '../components/common/EmptyState.jsx';
import ErrorState from '../components/common/ErrorState.jsx';
import Select from '../components/common/Select.jsx';
import Spinner from '../components/common/Spinner.jsx';
import QuestionFeed from '../components/questions/QuestionFeed.jsx';

export default function DepartmentsPage() {
  const [params, setParams] = useSearchParams();
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const selectedId = params.get('department_id') || '';
  const selectedDepartment = result?.departments?.find((department) => department.id === selectedId);

  useEffect(() => {
    let ignore = false;
    setResult(null);
    apiClient.get('/departments').then((departments) => {
      if (!ignore) setResult({ departments });
    }).catch((error) => {
      if (!ignore) setResult({ error: error.message || 'Could not load departments.' });
    });
    return () => { ignore = true; };
  }, [attempt]);

  function selectDepartment(event) {
    const departmentId = event.target.value;
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (departmentId) next.set('department_id', departmentId);
      else next.delete('department_id');
      next.delete('page');
      return next;
    });
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Departments</h1>
        <p className="text-sm text-ink-muted">
          Find communities across the university, including departments beyond your own.
        </p>
      </div>
      {!result ? (
        <div role="status" className="flex justify-center py-12"><Spinner label="Loading departments…" /></div>
      ) : result.error ? (
        <ErrorState message={result.error} onRetry={() => setAttempt((value) => value + 1)} />
      ) : result.departments.length === 0 ? (
        <EmptyState title="No departments available" description="University departments will appear here when available." />
      ) : (
        <>
          <Select id="feed-department" label="Department" className="mb-6" value={selectedDepartment?.id || ''} onChange={selectDepartment}>
            <option value="">Select a department</option>
            {result.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </Select>
          {selectedDepartment ? (
            <QuestionFeed departmentId={selectedDepartment.id} />
          ) : (
            <EmptyState title={selectedId ? 'Department unavailable' : 'Choose a department'} description="Select a department above to view its questions." />
          )}
        </>
      )}
    </div>
  );
}
