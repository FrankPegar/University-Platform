import assert from 'node:assert/strict';
import { test, mock } from 'node:test';

// Isolated HTTP contract checks: never use a real Supabase project.
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'http://127.0.0.1:1';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
const { createApp } = await import('../src/app.js');
const { supabaseAdmin } = await import('../src/config/supabase.js');
const questionId = '11111111-1111-4111-8111-111111111111';
const firstId = '22222222-2222-4222-8222-222222222222';
const secondId = '33333333-3333-4333-8333-333333333333';

test('accepted answers HTTP authorization and state transitions', async (t) => {
  const answers = [firstId, secondId].map(id => ({ id, question_id: questionId, author_id: 'bob', body: 'An answer', author: { id: 'bob' }, votes: [], is_accepted: false }));
  let writes = 0;
  let failWrite = false;
  mock.method(supabaseAdmin.auth, 'getUser', async token => ({ data: { user: ['alice', 'bob'].includes(token) ? { id: token } : null }, error: null }));
  mock.method(supabaseAdmin, 'from', table => {
    if (table === 'notifications') return { insert: async () => ({ error: null }) };
    assert.ok(['questions', 'answers'].includes(table));
    const filters = [];
    let payload, single = false;
    return {
      select() { return this; },
      eq(key, value) { filters.push([key, value]); return this; },
      single() { single = true; return this; },
      update(value) { payload = value; return this; },
      then(resolve, reject) {
        const rows = table === 'questions' ? [{ id: questionId, author_id: 'alice' }] : answers;
        const matched = rows.filter(row => filters.every(([key, value]) => row[key] === value));
        if (payload) {
          writes++;
          if (failWrite) return Promise.resolve({ error: { message: 'Write unavailable' } }).then(resolve, reject);
          matched.forEach(row => Object.assign(row, payload));
        }
        return Promise.resolve(single && !matched.length ? { error: { code: 'PGRST116' } } : { data: single ? { ...matched[0] } : matched.map(row => ({ ...row })), error: null }).then(resolve, reject);
      },
    };
  });
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); mock.restoreAll(); });
  async function request(id = firstId, method = 'POST', user = 'alice') {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/answers/${id}/accept`, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user}` } : {}) }, body: JSON.stringify({ user_id: 'alice' }) });
    return { status: response.status, payload: await response.json() };
  }
  await t.test('requires a verified user and valid answer ID', async () => {
    for (const method of ['POST', 'DELETE']) {
      assert.equal((await request(firstId, method, null)).status, 401);
      assert.equal((await request(firstId, method, 'invalid')).status, 401);
      assert.equal((await request('bad-id', method)).status, 400);
    }
    assert.equal(writes, 0);
  });
  await t.test('answer author cannot accept/unaccept or spoof question author', async () => {
    for (const method of ['POST', 'DELETE']) assert.equal((await request(firstId, method, 'bob')).status, 403);
    assert.equal(writes, 0);
  });
  await t.test('question author accepts, switches, unaccepts and re-accepts', async () => {
    assert.equal((await request()).payload.data.is_accepted, true);
    assert.equal((await request(secondId)).payload.data.is_accepted, true);
    assert.deepEqual(answers.map(a => a.is_accepted), [false, true]);
    assert.equal((await request(secondId, 'DELETE')).payload.data.is_accepted, false);
    assert.deepEqual(answers.map(a => a.is_accepted), [false, false]);
    assert.equal((await request(secondId)).payload.data.is_accepted, true);
  });
  await t.test('missing answers and database errors return clean errors', async () => {
    assert.equal((await request('44444444-4444-4444-8444-444444444444')).status, 404);
    failWrite = true;
    const result = await request();
    assert.equal(result.status, 500);
    assert.equal(result.payload.error.message, 'Write unavailable');
    assert.deepEqual(answers.map(a => a.is_accepted), [false, true]);
  });
});
