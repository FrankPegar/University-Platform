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
const ids = ['55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666'];

test('comment edit/delete HTTP contracts and ownership', async t => {
  let rows = ids.map((id, i) => ({ id, author_id: B, author: { id: B, full_name: 'Student B' }, question_id: i ? null : Q, answer_id: i ? ANS : null, body: 'Original comment', created_at: '2026-10-05T00:00:00Z' }));
  let failRead = false, failWrite = false, vanish = false;
  const writes = [];
  mock.method(supabaseAdmin.auth, 'getUser', async token => ({ data: { user: [A, B].includes(token) ? { id: token } : null }, error: null }));
  mock.method(supabaseAdmin, 'from', table => {
    assert.equal(table, 'comments');
    const filters = [];
    let patch, deleting = false, single = false;
    return {
      select() { return this; }, eq(key, value) { filters.push([key, value]); return this; },
      single() { single = true; return this; }, update(value) { patch = value; return this; }, delete() { deleting = true; return this; },
      then(resolve, reject) {
        let matches = rows.filter(row => filters.every(([key, value]) => row[key] === value));
        const writing = patch || deleting;
        if (writing) {
          writes.push({ patch, deleting, filters });
          if (failWrite) return Promise.resolve({ error: { message: 'Write unavailable' } }).then(resolve, reject);
          if (vanish) matches = [];
          if (patch) matches.forEach(row => Object.assign(row, patch));
          if (deleting) rows = rows.filter(row => !matches.includes(row));
        } else if (failRead) return Promise.resolve({ error: { message: 'Read unavailable' } }).then(resolve, reject);
        return Promise.resolve(single && !matches.length ? { error: { code: 'PGRST116' } } : { data: single ? { ...matches[0] } : matches, error: null }).then(resolve, reject);
      },
    };
  });
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); mock.restoreAll(); });
  async function request(method, id, body, user = B) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/comments/${id}`, {
      method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, payload: await response.json() };
  }
  await t.test('requires authentication and author ownership on both targets; spoofed identities do not help', async () => {
    for (const id of ids) for (const method of ['PATCH', 'DELETE']) {
      const body = { body: 'Changed', author_id: B, user_id: B };
      assert.equal((await request(method, id, body, null)).status, 401);
      assert.equal((await request(method, id, body, A)).status, 403);
    }
    assert.equal(writes.length, 0);
  });
  await t.test('rejects empty/whitespace, oversized, missing or non-string bodies and invalid IDs', async () => {
    for (const body of [{}, { author_id: B }, { body: '' }, { body: ' \n ' }, { body: 'x'.repeat(1001) }, { body: 4 }, { body: null }]) {
      assert.equal((await request('PATCH', ids[0], body)).status, 400);
    }
    for (const method of ['PATCH', 'DELETE']) assert.equal((await request(method, 'invalid', { body: 'Valid body' })).status, 400);
    assert.equal(writes.length, 0);
  });
  await t.test('author edits body only on question and answer comments with canonical author/avatar response', async () => {
    for (const id of ids) {
      const before = { ...rows.find(row => row.id === id) };
      const result = await request('PATCH', id, { body: '  Plain **text** <script>example</script>  ', author_id: A, user_id: A, id: Q, question_id: ANS, answer_id: Q, created_at: 'changed' });
      assert.equal(result.status, 200);
      assert.deepEqual(writes.at(-1).patch, { body: 'Plain **text** <script>example</script>' });
      assert.ok(writes.at(-1).filters.some(([key, value]) => key === 'author_id' && value === B));
      for (const key of ['id', 'question_id', 'answer_id', 'created_at']) assert.equal(result.payload.data[key], before[key]);
      assert.equal(result.payload.data.author.id, B);
      assert.equal(result.payload.data.author.avatar_url, null);
    }
  });
  await t.test('missing comments, read/write failures and disappearance during save return errors', async () => {
    for (const method of ['PATCH', 'DELETE']) assert.equal((await request(method, Q, { body: 'Valid body' })).status, 404);
    failRead = true;
    for (const method of ['PATCH', 'DELETE']) assert.equal((await request(method, ids[0], { body: 'Valid body' })).status, 500);
    failRead = false; failWrite = true;
    const before = rows[0].body;
    for (const method of ['PATCH', 'DELETE']) assert.equal((await request(method, ids[0], { body: 'Valid body' })).status, 400);
    assert.equal(rows.length, 2); assert.equal(rows[0].body, before);
    failWrite = false; vanish = true;
    assert.equal((await request('PATCH', ids[0], { body: 'Valid body' })).status, 404);
    vanish = false;
  });
  await t.test('only the author deletes both targets; repeat requests report not found', async () => {
    for (const id of ids) {
      const result = await request('DELETE', id);
      assert.equal(result.status, 200);
      assert.deepEqual(result.payload.data, { deleted: true });
      assert.ok(writes.at(-1).filters.some(([key, value]) => key === 'author_id' && value === B));
      assert.equal((await request('DELETE', id)).status, 404);
      assert.equal((await request('PATCH', id, { body: 'Cannot revive' })).status, 404);
    }
    assert.equal(rows.length, 0);
  });
});
