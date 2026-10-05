// Live browser test: uses two dedicated test accounts and creates real Q&A data.
// Credentials come from COURSEPOINT_TEST_ACCOUNTS, never from source control.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const {run, students:[A,B]} = JSON.parse(await readFile(process.env.COURSEPOINT_TEST_ACCOUNTS || '/private/tmp/coursepoint-phase5f-accounts.json','utf8'));
const target = await (await fetch('http://127.0.0.1:9223/json/new?about:blank',{method:'PUT'})).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let seq=0; const pending=new Map(), errors=[], requests=[], responses=[], report=[];
ws.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Network.requestWillBeSent'&&m.params.request.url.includes(':4000/api/'))requests.push({url:m.params.request.url,method:m.params.request.method});if(m.method==='Network.responseReceived'&&m.params.response.url.includes(':4000/api/'))responses.push({url:m.params.response.url,status:m.params.response.status});});
// Wait for the new document before interacting; a reload reply can arrive
// while the old login form is still present.
const send = (method, params = {}) => {
  let loaded = Promise.resolve();
  if (['Page.navigate', 'Page.reload'].includes(method)) {
    loaded = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { ws.removeEventListener('message', onLoad); reject(new Error('Navigation load timed out')); }, 30000);
      function onLoad({ data }) {
        if (JSON.parse(data).method === 'Page.loadEventFired') {
          clearTimeout(timer); ws.removeEventListener('message', onLoad); resolve();
        }
      }
      ws.addEventListener('message', onLoad);
    });
  }
  const response = new Promise((resolve, reject) => {
    const n = ++seq; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params }));
  });
  return Promise.all([response, loaded]).then(([result]) => result);
};
const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const until=async expression=>{for(let i=0;i<200;i++){if(await ev(`Boolean(${expression})`))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+expression);};
const nav=async path=>{await send('Page.navigate',{url:'http://localhost:5173'+path});await until(`document.readyState==='complete'`);};
const click=selector=>ev(`document.querySelector(${JSON.stringify(selector)}).click()`);
const textButton=text=>ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);
const input=(selector,value)=>ev(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const mark=label=>{report.push(label);console.log('PASS: '+label);};
const login=async student=>{await until(`!!document.querySelector('#email')`);await input('#email',student.email);await input('#password',student.password);await ev(`document.querySelector('form').requestSubmit()`);await until(`!!document.querySelector('header [aria-haspopup="menu"]')`);assert.ok(await ev(`document.querySelector('header').textContent.includes(${JSON.stringify(student.full_name)})`));};
const logout=async()=>{await click('[aria-haspopup="menu"]');await textButton('Log out');await until(`location.pathname==='/login' && !!document.querySelector('#email')`);assert.equal(await ev(`localStorage.getItem('university_qa_session')`),null);};
const feedReady=()=>until(`!!document.querySelector('[aria-label="Question feed"]') && !document.querySelector('[aria-label="Question feed"] [role="status"]')`);
const voteReady=type=>until(`!!document.querySelector('[aria-label="${type} voting"] button') && !document.querySelector('[aria-label="${type} voting"] button').disabled`);
const voted=type=>ev(`document.querySelector('[aria-label="${type} voting"] button').getAttribute('aria-pressed')==='true'`);
const detailReady=()=>until(`!!document.querySelector('#answers-heading') && !!document.querySelector('form[aria-label="Post an answer"] button') && !document.querySelector('form[aria-label="Post an answer"] button').disabled`);
import {createRequire} from 'node:module';
const requireServer=createRequire(new URL('../../server/package.json',import.meta.url));
requireServer('dotenv').config({path:new URL('../../server/.env',import.meta.url),quiet:true});
const {supabaseAdmin,supabaseAuth,createUserClient}=await import('../../server/src/config/supabase.js');
const api=(method,path,body)=>ev(`(async()=>{const {apiClient}=await import('/src/lib/apiClient.js');const token=JSON.parse(localStorage.getItem('university_qa_session')).session.access_token;try{return {status:200,data:await apiClient.${method}(${JSON.stringify(path)},${['get','delete'].includes(method)?'':JSON.stringify(body)+','}{token})};}catch(e){return {status:e.statusCode,message:e.message};}})()`);
const openNotices=async()=>{await click('a[href="/notifications"]');await until(`document.querySelector('main h1')?.textContent==='Notifications' && !document.querySelector('main [role="status"]') && !!document.querySelector('[data-notification-id]')`);};
const badge=()=>ev(`document.querySelector('a[href="/notifications"]').getAttribute('aria-label')`);
let questionId,answerId,commentId;
try {
 await send('Runtime.enable');await send('Page.enable');await send('Page.bringToFront');await send('Network.enable');
 await send('Storage.clearDataForOrigin',{origin:'http://localhost:5173',storageTypes:'local_storage'});
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await nav('/notifications');await until(`location.pathname==='/login'`);await login(B);await api('patch','/notifications/read-all',{});await logout();await login(A);await api('patch','/notifications/read-all',{});
 await nav('/ask');await until(`!!document.querySelector('#department_id') && !document.querySelector('#department_id').disabled`);
 await input('#title',`v1.4 notification verification ${run} ${Date.now()}`);await input('#body','Testing **in-app notifications** with two dedicated students.');await ev(`document.querySelector('main form').requestSubmit()`);await until(`location.pathname.startsWith('/questions/')`);await detailReady();questionId=await ev(`location.pathname.split('/').pop()`);
 async function comment(type,text){const section=`section[aria-label="${type} comments"]`;await until(`!!document.querySelector('${section} form button')&&!document.querySelector('${section} form button').disabled`);await input(`${section} form textarea`,text);await ev(`document.querySelector('${section} form').requestSubmit()`);await until(`[...document.querySelectorAll('${section} li')].some(li=>li.textContent.includes(${JSON.stringify(text)}))`);return ev(`[...document.querySelectorAll('${section} li')].find(li=>li.textContent.includes(${JSON.stringify(text)})).dataset.commentId`);}
 await comment('question','A comments on own question');assert.equal((await api('get','/notifications')).data.items.filter(n=>n.question_id===questionId).length,0);
 await logout();await login(B);await nav('/questions/'+questionId);await detailReady();await input('#answer-body','A useful answer from Student B for notification verification.');await ev(`document.querySelector('form[aria-label="Post an answer"]').requestSubmit()`);await until(`document.querySelector('main').textContent.includes('Your answer has been posted.')`);await until(`!!document.querySelector('section[aria-label="answer comments"] textarea')`);answerId=await ev(`document.querySelector('section[aria-label="answer comments"] textarea').id.replace('comment-answer-','')`);
 commentId=await comment('question','B comments on A question');await comment('answer','B comments on own answer');assert.equal((await api('get','/notifications')).data.items.filter(n=>n.question_id===questionId).length,0);
 await logout();await login(A);await openNotices();let own=(await api('get','/notifications')).data;let eventsForQuestion=own.items.filter(n=>n.question_id===questionId);
 assert.deepEqual(eventsForQuestion.map(n=>n.type).sort(),['question_answer','question_comment']);assert.ok(eventsForQuestion.every(n=>n.actor.id===B.id&&!n.is_read));assert.equal(own.unread_count,2);assert.match(await badge(),/2 unread/);mark('B answer and question comment notify A with actor/title/time; self question/answer comments do not notify');
 const opened=eventsForQuestion.find(n=>n.type==='question_answer');await click(`[data-notification-id="${opened.id}"] button`);await detailReady();await until(`document.querySelector('a[href="/notifications"]').getAttribute('aria-label').includes('1 unread')`);assert.equal(await ev(`location.pathname`),'/questions/'+questionId);
 await comment('answer','A comments on B answer');await until(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Accept answer')`);await textButton('Accept answer');await until(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Unaccept answer'&&!b.disabled)`);
 await send('Page.reload');await detailReady();assert.match(await badge(),/1 unread/);await logout();await login(A);await openNotices();assert.equal(await ev(`document.querySelector('[data-notification-id="${opened.id}"]').dataset.read`),'true');assert.match(await badge(),/1 unread/);
 await textButton('Mark all as read');await until(`document.querySelector('a[href="/notifications"]').getAttribute('aria-label')==='Notifications'`);assert.equal((await api('get','/notifications')).data.unread_count,0);mark('Opening navigates and marks read; read state/count survive refresh/login; mark-all updates count');
 // Re-acceptance is deduplicated. Own answer/accept actions also stay silent.
 await api('delete',`/answers/${answerId}/accept`);await api('post',`/answers/${answerId}/accept`,{});
 const selfAnswer=await api('post',`/questions/${questionId}/answers`,{body:'Student A own answer'});assert.equal(selfAnswer.status,200);await api('post',`/answers/${selfAnswer.data.id}/accept`,{});
 const {data:rows,error:rowError}=await supabaseAdmin.from('notifications').select('*').eq('question_id',questionId);assert.equal(rowError,null);assert.equal(rows.length,4);const bRows=rows.filter(n=>n.recipient_id===B.id);assert.deepEqual(bRows.map(n=>n.type).sort(),['answer_accepted','answer_comment']);assert.ok(bRows.every(n=>n.actor_id===A.id&&!n.is_read));mark('Answer comment and acceptance notify B; repeated acceptance and own answer/accept produce no duplicates/self notifications');
 const victim=bRows[0];assert.equal((await api('patch',`/notifications/${victim.id}/read`,{})).status,404);assert.equal((await api('delete',`/notifications/${victim.id}`)).status,404);assert.equal((await api('get',`/notifications?recipient_id=${B.id}`)).status,400);assert.ok(!(await api('get','/notifications')).data.items.some(n=>n.id===victim.id));
 const token=await ev(`JSON.parse(localStorage.getItem('university_qa_session')).session.access_token`);const userA=createUserClient(token);
 const hidden=await userA.from('notifications').select('id').eq('recipient_id',B.id);assert.equal(hidden.error,null);assert.deepEqual(hidden.data,[]);
 const update=await userA.from('notifications').update({is_read:true}).eq('id',victim.id).select('id');assert.equal(update.error,null);assert.deepEqual(update.data,[]);
 const removal=await userA.from('notifications').delete().eq('id',victim.id).select('id');assert.equal(removal.error,null);assert.deepEqual(removal.data,[]);
 const forbiddenInsert=await userA.from('notifications').insert({recipient_id:A.id,actor_id:B.id,type:'question_answer',question_id:questionId,answer_id:answerId});assert.ok(forbiddenInsert.error);
 const rewrite=await userA.from('notifications').update({actor_id:A.id,recipient_id:B.id}).eq('id',opened.id);assert.ok(rewrite.error);
 const anon=await supabaseAuth.from('notifications').select('id');assert.ok(anon.error);
 const still=await supabaseAdmin.from('notifications').select('is_read').eq('id',victim.id).single();assert.equal(still.data.is_read,false);
 const ownUpdate=await userA.from('notifications').update({is_read:true}).eq('id',opened.id).select('id');assert.equal(ownUpdate.error,null);assert.equal(ownUpdate.data.length,1);
 mark('Express and direct RLS prevent A reading/updating/deleting B notifications; client inserts/identity rewrites and anonymous reads rejected');
 await logout();await login(B);await openNotices();assert.match(await badge(),/2 unread/);assert.ok(await ev(`document.querySelector('main').textContent.includes('commented on your answer') && document.querySelector('main').textContent.includes('accepted your answer')`));await textButton('Mark all as read');await until(`document.querySelector('a[href="/notifications"]').getAttribute('aria-label')==='Notifications'`);await send('Page.reload');await until(`document.querySelector('main h1')?.textContent==='Notifications' && !document.querySelector('main [role="status"]')`);await logout();await login(B);assert.equal((await api('get','/notifications')).data.unread_count,0);mark('B sees both notifications; read-all persists through refresh and logout/login without A state leaking');
 await openNotices();await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.ok(await ev(`document.documentElement.scrollWidth<=innerWidth`));await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(r=>writeFile('/private/tmp/coursepoint-v14-notifications-mobile.png',Buffer.from(r.data,'base64')));
 // Deleting content removes related notifications rather than leaving dead links.
 await api('delete',`/comments/${commentId}`);const removedNotice=await supabaseAdmin.from('notifications').select('id').eq('comment_id',commentId);assert.deepEqual(removedNotice.data,[]);
 await logout();await login(A);assert.equal((await api('delete',`/questions/${questionId}`)).status,200);const remaining=await supabaseAdmin.from('notifications').select('id').eq('question_id',questionId);assert.deepEqual(remaining.data,[]);
 assert.deepEqual(errors,[]);mark('Mobile fits, content deletion cascades notifications, test question cleaned up, no browser runtime exceptions');
 await writeFile('/private/tmp/coursepoint-v14-live-results.json',JSON.stringify({questionId,report},null,2));
}catch(error){console.error(error.message);console.error(await ev(`({path:location.pathname,text:document.querySelector('main')?.innerText})`));process.exitCode=1;}finally{ws.close();}
