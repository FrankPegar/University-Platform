import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'http://127.0.0.1:1';
process.env.SUPABASE_ANON_KEY = 'test-anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service';
const { createApp } = await import('../src/app.js');
const { supabaseAdmin } = await import('../src/config/supabase.js');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const Q = '33333333-3333-4333-8333-333333333333';
const ANS = '44444444-4444-4444-8444-444444444444';
const D = '55555555-5555-4555-8555-555555555555';
const C = '66666666-6666-4666-8666-666666666666';

test('editing PATCH contracts and ownership', async t => {
  const tables = {
    questions: [{ id: Q, author_id: A, title: 'Original title', body: 'Original question body', department_id: D, department: { id: D }, author: { id: A }, question_tags: [] }],
    answers: [{ id: ANS, question_id: Q, author_id: B, author: { id: B }, body: 'Original answer', is_accepted: true }],
    profiles: [{ id: A, full_name: 'Student A', student_id: 'KEEP-A', department_id: D, course_id: C, year_level: 2 }],
  };
  let writes = [];
  let failTagDelete = false;
  mock.method(supabaseAdmin.auth, 'getUser', async token => ({ data: { user: [A, B].includes(token) ? { id: token } : null }, error: null }));
  mock.method(supabaseAdmin, 'from', table => {
    let patch, removing = false, single = false;
    const filters = [];
    return {
      select() { return this; }, eq(key, value) { filters.push([key, value]); return this; }, single() { single = true; return this; },
      update(value) { patch = value; return this; }, delete() { removing = true; return this; },
      then(resolve, reject) {
        if (table === 'question_tags') {
          assert.ok(removing);
          writes.push({ table, removing: true });
          return Promise.resolve(failTagDelete ? { error: { message: 'Tag deletion failed' } } : { error: null }).then(resolve, reject);
        }
        assert.ok(tables[table], `Unexpected table ${table}`);
        const rows = tables[table].filter(row => filters.every(([key, value]) => row[key] === value));
        if (patch) {
          writes.push({ table, patch });
          if (table === 'profiles' && ((patch.course_id || rows[0]?.course_id) !== C || (patch.department_id || rows[0]?.department_id) !== D)) {
            return Promise.resolve({ error: { code: '23503' } }).then(resolve, reject);
          }
          rows.forEach(row => Object.assign(row, patch));
        }
        return Promise.resolve(single && !rows.length ? { error: { code: 'PGRST116' } } : { data: single ? { ...rows[0] } : rows, error: null }).then(resolve, reject);
      },
    };
  });
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); mock.restoreAll(); });
  async function patch(path, body, user = A) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/${path}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user}` } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, payload: await response.json() };
  }
  await t.test('all edits require authentication and ownership, including spoofed IDs', async () => {
    for (const [path, body, wrongUser] of [[`questions/${Q}`, { title: 'Changed title', author_id: A }, B], [`answers/${ANS}`, { body: 'Changed answer', author_id: B }, A], [`profiles/${A}`, { full_name: 'Changed name', user_id: A }, B]]) {
      assert.equal((await patch(path, body, null)).status, 401);
      assert.equal((await patch(path, body, wrongUser)).status, 403);
    }
    assert.equal(writes.length, 0);
  });
  await t.test('question author edits only permitted fields; department/author remain unchanged', async () => {
    const result = await patch(`questions/${Q}`, { title: 'Edited title', body: 'Edited **question** body', tags: [], department_id: B, author_id: B });
    assert.equal(result.status, 200);
    assert.equal(result.payload.data.title, 'Edited title');
    assert.equal(tables.questions[0].department_id, D);
    assert.equal(tables.questions[0].author_id, A);
    assert.deepEqual(writes.find(w => w.table === 'questions').patch, { title: 'Edited title', body: 'Edited **question** body' });
  });
  await t.test('answer author edits Markdown while preserving acceptance and author', async () => {
    const result = await patch(`answers/${ANS}`, { body: '**Edited** answer', is_accepted: false, author_id: A }, B);
    assert.equal(result.status, 200);
    assert.equal(result.payload.data.body, '**Edited** answer');
    assert.equal(result.payload.data.is_accepted, true);
    assert.equal(tables.answers[0].author_id, B);
  });
  await t.test('profile allows supported fields but never changes student ID or ownership', async () => {
    const result = await patch(`profiles/${A}`, { full_name: 'Edited name', department_id: D, course_id: C, year_level: 8, student_id: 'ATTACK', user_id: B, id: B });
    assert.equal(result.status, 200);
    assert.equal(result.payload.data.student_id, 'KEEP-A');
    assert.equal(result.payload.data.id, A);
    assert.equal(result.payload.data.year_level, 8);
  });
  await t.test('invalid lengths/types/empty patches are rejected before writes', async () => {
    writes = [];
    for (const [path, body] of [[`questions/${Q}`, {}], [`questions/${Q}`, { department_id: D }], [`questions/${Q}`, { title: 'bad' }], [`questions/${Q}`, { tags: ['x'.repeat(31)] }], [`answers/${ANS}`, { body: 'bad' }], [`profiles/${A}`, { student_id: 'no' }], [`profiles/${A}`, { full_name: 'x' }], [`profiles/${A}`, { year_level: 9 }], [`profiles/${A}`, { year_level: '2' }]]) assert.equal((await patch(path, body)).status, 400);
    assert.equal(writes.length, 0);
  });
  await t.test('course/department constraint failures are returned without a profile change', async () => {
    const result = await patch(`profiles/${A}`, { department_id: B, course_id: C });
    assert.equal(result.status, 400);
    assert.match(result.payload.error.message, /does not belong/);
    assert.equal(tables.profiles[0].department_id, D);
  });
  await t.test('failed tag deletion must never report successful editing', async () => {
    failTagDelete = true;
    const result = await patch(`questions/${Q}`, { tags: [] });
    assert.equal(result.status, 400);
    assert.equal(result.payload.error.message, 'Tag deletion failed');
  });
});
