import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test, mock } from 'node:test';
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'http://127.0.0.1:1';
process.env.SUPABASE_ANON_KEY = 'test-anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service';
const { createApp } = await import('../src/app.js');
const { supabaseAdmin } = await import('../src/config/supabase.js');
const A=randomUUID(), B=randomUUID(), Q=randomUUID(), ANS=randomUUID();

test('notifications authorization, counts and Q&A event delivery', async t => {
  const tables={ questions:[{id:Q,author_id:A,title:'Test question'}], answers:[{id:ANS,question_id:Q,author_id:B,body:'Original answer',is_accepted:false}], comments:[], notifications:[] };
  let failTable=null, failRead=false;
  const events=[];
  mock.method(console,'warn',()=>{});
  mock.method(supabaseAdmin.auth,'getUser',async token=>({data:{user:[A,B].includes(token)?{id:token}:null},error:null}));
  mock.method(supabaseAdmin,'from',table=>{
    assert.ok(tables[table],`Unexpected table ${table}`);
    const filters=[];let insert,patch,deleting=false,single=false,head=false,range=null;
    return {
      select(_fields,options={}){head=Boolean(options.head);return this;},eq(k,v){filters.push([k,v]);return this;},single(){single=true;return this;},
      order(){return this;},range(a,b){range=[a,b];return this;},insert(row){insert=row;return this;},update(row){patch=row;return this;},delete(){deleting=true;return this;},
      then(resolve,reject){
        const run=()=>{
          if(failRead&&!insert&&!patch&&!deleting)return {error:{message:'Read failed'}};
          if((insert||patch||deleting)&&failTable===table)return {error:{message:'Write failed',code:'TEST'}};
          if(insert){
            if(table==='notifications'&&tables.notifications.some(n=>insert.comment_id?n.comment_id===insert.comment_id:n.type===insert.type&&n.answer_id===insert.answer_id))return {error:{code:'23505'}};
            const row={id:randomUUID(),is_read:false,created_at:new Date().toISOString(),...insert};tables[table].push(row);events.push(table);return {data:single?{...row,author:{id:row.author_id},votes:[]}:null,error:null};
          }
          let rows=tables[table].filter(r=>filters.every(([k,v])=>r[k]===v));
          if(patch)rows.forEach(r=>Object.assign(r,patch));
          if(deleting)tables[table]=tables[table].filter(r=>!rows.includes(r));
          const count=rows.length;
          if(range)rows=rows.slice(range[0],range[1]+1);
          if(single&&!rows.length)return {error:{code:'PGRST116'}};
          const shape=r=>({...r,author:{id:r.author_id},actor:r.actor_id?{id:r.actor_id,full_name:'Student'}:null,question:{title:'Test question'},votes:[]});
          return {data:head?null:single?shape(rows[0]):rows.map(shape),count,error:null};
        };
        return Promise.resolve(run()).then(resolve,reject);
      },
    };
  });
  const server=createApp().listen(0,'127.0.0.1');
  await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));mock.restoreAll();});
  async function request(path,method='GET',body,user=A){
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers:{'Content-Type':'application/json',...(user?{Authorization:`Bearer ${user}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,payload:await response.json()};
  }
  await t.test('list/read/read-all/delete require verified authentication and validated IDs/pagination',async()=>{
    for(const [path,method]of [['/notifications','GET'],['/notifications/read-all','PATCH'],[`/notifications/${randomUUID()}/read`,'PATCH'],[`/notifications/${randomUUID()}`,'DELETE']])assert.equal((await request(path,method,undefined,null)).status,401);
    for(const path of ['/notifications?page=0','/notifications?limit=51',`/notifications?recipient_id=${B}`])assert.equal((await request(path)).status,400);
    assert.equal((await request('/notifications/bad/read','PATCH',{})).status,400);
    assert.equal((await request('/notifications/read-all','PATCH',{recipient_id:B})).status,400);
  });
  await t.test('four successful Q&A actions create notifications with server-derived recipients and actors',async()=>{
    assert.equal((await request(`/questions/${Q}/answers`,'POST',{body:'Student B answer',author_id:A},B)).status,201);
    assert.equal((await request('/comments','POST',{question_id:Q,body:'Question comment',author_id:A},B)).status,201);
    assert.equal((await request('/comments','POST',{answer_id:ANS,body:'Answer comment'},A)).status,201);
    assert.equal((await request(`/answers/${ANS}/accept`,'POST',{},A)).status,200);
    assert.deepEqual(tables.notifications.map(n=>[n.type,n.recipient_id,n.actor_id]),[['question_answer',A,B],['question_comment',A,B],['answer_comment',B,A],['answer_accepted',B,A]]);
    assert.ok(tables.notifications.every(n=>n.question_id===Q));
    assert.deepEqual(events.slice(0,6),['answers','notifications','comments','notifications','comments','notifications']);
  });
  await t.test('self actions, failed actions and repeated acceptance do not create notifications',async()=>{
    const before=tables.notifications.length;
    const own=await request(`/questions/${Q}/answers`,'POST',{body:'My own answer'},A);
    assert.equal(own.status,201);
    assert.equal((await request('/comments','POST',{question_id:Q,body:'My own question comment'},A)).status,201);
    assert.equal((await request('/comments','POST',{answer_id:ANS,body:'My own answer comment'},B)).status,201);
    assert.equal((await request(`/answers/${own.payload.data.id}/accept`,'POST',{},A)).status,200);
    assert.equal((await request(`/answers/${ANS}/accept`,'POST',{},B)).status,403);
    failTable='answers';assert.equal((await request(`/questions/${Q}/answers`,'POST',{body:'Failed answer'},B)).status,400);
    failTable='comments';assert.equal((await request('/comments','POST',{question_id:Q,body:'Failed comment'},B)).status,400);
    failTable=null;
    await request(`/answers/${ANS}/accept`,'POST',{},A);await request(`/answers/${ANS}/accept`,'DELETE',undefined,A);await request(`/answers/${ANS}/accept`,'POST',{},A);
    assert.equal(tables.notifications.length,before);
  });
  await t.test('delivery failure does not turn a committed Q&A write into a failed submission',async()=>{
    failTable='notifications';const before=tables.answers.length;
    assert.equal((await request(`/questions/${Q}/answers`,'POST',{body:'Committed answer'},B)).status,201);
    assert.equal(tables.answers.length,before+1);failTable=null;
  });
  await t.test('list scopes recipient and unread count covers rows beyond a page/row-return limit',async()=>{
    for(let i=0;i<1005;i++)tables.notifications.push({id:randomUUID(),recipient_id:A,actor_id:B,type:'question_answer',question_id:Q,answer_id:randomUUID(),is_read:false});
    const result=await request('/notifications?limit=1&page=2');assert.equal(result.status,200);
    assert.equal(result.payload.data.items.length,1);assert.equal(result.payload.data.unread_count,1007);assert.equal(result.payload.data.total,1007);
    assert.equal((await request('/notifications','GET',undefined,B)).payload.data.total,2);
  });
  await t.test('read/delete cannot address another recipient; read-all touches own rows only and is idempotent',async()=>{
    const own=tables.notifications.find(n=>n.recipient_id===A),other=tables.notifications.find(n=>n.recipient_id===B);
    assert.equal((await request(`/notifications/${other.id}/read`,'PATCH',{})).status,404);
    assert.equal((await request(`/notifications/${other.id}`,'DELETE')).status,404);assert.equal(other.is_read,false);
    for(let i=0;i<2;i++)assert.equal((await request(`/notifications/${own.id}/read`,'PATCH',{})).status,200);
    assert.equal((await request('/notifications')).payload.data.unread_count,1006);
    assert.equal((await request('/notifications/read-all','PATCH',{})).status,200);
    assert.equal((await request('/notifications')).payload.data.unread_count,0);assert.equal(other.is_read,false);
    assert.equal((await request(`/notifications/${own.id}`,'DELETE')).status,200);
    assert.equal((await request(`/notifications/${own.id}`,'DELETE')).status,404);
  });
  await t.test('read/write failures propagate without inventing count/read state',async()=>{
    failRead=true;assert.equal((await request('/notifications')).status,500);failRead=false;
    failTable='notifications';const other=tables.notifications.find(n=>n.recipient_id===B);
    assert.equal((await request(`/notifications/${other.id}/read`,'PATCH',{},B)).status,500);assert.equal(other.is_read,false);
    assert.equal((await request('/notifications/read-all','PATCH',{},B)).status,500);
  });
});
