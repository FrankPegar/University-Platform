import assert from 'node:assert/strict';
import { test, mock } from 'node:test';

// All database/auth calls are mocked; never connect to a configured project.
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'http://127.0.0.1:1';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
const { createApp } = await import('../src/app.js');
const { supabaseAdmin } = await import('../src/config/supabase.js');

const questionId = '11111111-1111-4111-8111-111111111111';
const answerId = '22222222-2222-4222-8222-222222222222';

test('authenticated vote state and existing POST/DELETE contracts', async (t) => {
  let votes = [];
  let dbError = null;
  let dbCalls = 0;
  mock.method(supabaseAdmin.auth, 'getUser', async (token) => ({
    data: { user: ['alice', 'bob'].includes(token) ? { id: token } : null }, error: null,
  }));
  mock.method(supabaseAdmin, 'from', (table) => {
    assert.equal(table, 'votes');
    dbCalls++;
    const filters = [];
    let operation = 'read';
    let payload;
    let options;
    let limit = 1000;
    const query = {
      select(_columns, opts) { options = opts; return this; },
      eq(key, value) { filters.push([key, value]); return this; },
      limit(value) { limit = value; return this; },
      insert(value) { operation = 'insert'; payload = value; return this; },
      delete() { operation = 'delete'; return this; },
      single() { return this; },
      then(resolve, reject) {
        let result;
        if (dbError) result = { data: null, error: { message: dbError } };
        else if (operation === 'insert') {
          const duplicate = votes.some(v => v.user_id === payload.user_id && v.question_id === payload.question_id && v.answer_id === payload.answer_id);
          if (duplicate) result = { error: { code: '23505' } };
          else { const row = { ...payload, id: 'vote-' + votes.length }; votes.push(row); result = { data: row }; }
        } else {
          const matched = votes.filter(v => filters.every(([key, value]) => v[key] === value));
          if (operation === 'delete') votes = votes.filter(v => !matched.includes(v));
          result = { data: options?.head ? null : matched.slice(0, limit).map(v => ({ id: v.id })), count: matched.length };
        }
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return query;
  });
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); mock.restoreAll(); });
  const base = `http://127.0.0.1:${server.address().port}/api/votes`;
  async function request({ query = '', method = 'GET', body, user = 'alice' } = {}) {
    const response = await fetch(base + query, {
      method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, payload: await response.json() };
  }
  await t.test('requires a verified session', async () => {
    for (const user of [null, 'invalid']) assert.equal((await request({ user, query: `?question_id=${questionId}` })).status, 401);
    assert.equal(dbCalls, 0);
  });
  await t.test('requires exactly one valid target', async () => {
    for (const query of ['', '?question_id=bad', `?question_id=${questionId}&answer_id=${answerId}`]) assert.equal((await request({ query })).status, 400);
    assert.equal(dbCalls, 0);
  });
  await t.test('returns zero/unvoted for empty targets', async () => {
    for (const query of [`?question_id=${questionId}`, `?answer_id=${answerId}`]) {
      assert.deepEqual((await request({ query })).payload.data, { vote_count: 0, has_voted: false });
    }
  });
  await t.test('uses verified identity, distinguishes targets, and exposes no voter IDs', async () => {
    votes = [
      { id: 'q-bob', question_id: questionId, answer_id: null, user_id: 'bob' },
      { id: 'a-alice', question_id: null, answer_id: answerId, user_id: 'alice' },
    ];
    assert.deepEqual((await request({ query: `?question_id=${questionId}&user_id=bob` })).payload.data, { vote_count: 1, has_voted: false });
    assert.deepEqual((await request({ query: `?question_id=${questionId}`, user: 'bob' })).payload.data, { vote_count: 1, has_voted: true });
    assert.deepEqual((await request({ query: `?answer_id=${answerId}` })).payload.data, { vote_count: 1, has_voted: true });
  });
  await t.test('counts beyond the database returned-row limit and finds the viewer vote', async () => {
    votes = Array.from({ length: 2005 }, (_, i) => ({ id: String(i), question_id: questionId, user_id: i === 2004 ? 'alice' : 'other-' + i }));
    assert.deepEqual((await request({ query: `?question_id=${questionId}` })).payload.data, { vote_count: 2005, has_voted: true });
  });
  await t.test('propagates database errors without inventing vote state', async () => {
    dbError = 'Database unavailable';
    const result = await request({ query: `?question_id=${questionId}` });
    assert.equal(result.status, 400); assert.equal(result.payload.error.message, dbError);
    dbError = null;
  });
  await t.test('POST conflicts and DELETE ownership/404 behavior stay unchanged for both targets', async () => {
    for (const body of [{ question_id: questionId }, { answer_id: answerId }]) {
      votes = [];
      assert.equal((await request({ method: 'POST', body: { ...body, user_id: 'bob' } })).status, 201);
      assert.equal(votes[0].user_id, 'alice');
      assert.equal((await request({ method: 'POST', body })).status, 409);
      assert.equal((await request({ method: 'DELETE', body, user: 'bob' })).status, 404);
      assert.equal(votes.length, 1);
      assert.equal((await request({ method: 'DELETE', body })).status, 200);
      assert.equal(votes.length, 0);
      assert.equal((await request({ method: 'DELETE', body })).status, 404);
    }
  });
});
