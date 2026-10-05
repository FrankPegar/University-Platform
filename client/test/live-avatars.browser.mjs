// Real avatar flow. Supabase administrative reads below run only in Node, never in the browser bundle.
// Live browser test: uses two dedicated test accounts and creates real Q&A data.
// Credentials come from COURSEPOINT_TEST_ACCOUNTS, never from source control.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const {run, students:[A,B]} = JSON.parse(await readFile(process.env.COURSEPOINT_TEST_ACCOUNTS || '/private/tmp/coursepoint-v12-accounts.json','utf8'));
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
const {supabaseAdmin,createUserClient}=await import('../../server/src/config/supabase.js');
const fixtureDir=process.env.COURSEPOINT_AVATAR_FIXTURES||'/private/tmp/coursepoint-v12-fixtures';
const {questionId}=JSON.parse(await readFile('/private/tmp/coursepoint-phase5f-live-artifacts.json','utf8'));
const pathFor=student=>`${student.id}/avatar.webp`;
const picture='section[aria-label="Profile picture"]';
const openProfile=async()=>{await nav('/profile');await until(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Edit Profile')`);await textButton('Edit Profile');await until(`!!document.querySelector('#avatar-file')&&!document.querySelector('form[aria-label="Edit profile"] button[type="submit"]').disabled`);};
const choose=async file=>{const {root}=await send('DOM.getDocument');const {nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector:'#avatar-file'});await send('DOM.setFileInputFiles',{nodeId,files:[fixtureDir+'/'+file]});};
const upload=async file=>{await choose(file);await until(`!!document.querySelector('img[alt="Selected profile picture preview"]')`);await textButton('Upload picture');await until(`document.querySelector('${picture}').textContent.includes('Profile picture updated.')`);await until(`document.querySelector('header img')?.naturalWidth>0`);};
const remove=async()=>{await textButton('Remove picture');await until(`document.querySelector('${picture}').textContent.includes('Profile picture removed.')`);assert.equal(await ev(`!!document.querySelector('header img')`),false);};
const list=async student=>{const {data,error}=await supabaseAdmin.storage.from('avatars').list(student.id);assert.equal(error,null);return data.map(item=>item.name);};
const bytes=async student=>{const {data,error}=await supabaseAdmin.storage.from('avatars').createSignedUrl(pathFor(student),60);assert.equal(error,null);const response=await fetch(data.signedUrl+'&test='+Date.now()+'-'+Math.random());assert.equal(response.status,200);return Buffer.from(await response.arrayBuffer());};
const me=()=>ev(`(async()=>{const {apiClient}=await import('/src/lib/apiClient.js');return await apiClient.get('/me',{token:JSON.parse(localStorage.getItem('university_qa_session')).session.access_token});})()`);
try{
 await send('Runtime.enable');await send('Page.enable');await send('Page.bringToFront');await send('Network.enable');
 await send('Storage.clearDataForOrigin',{origin:'http://localhost:5173',storageTypes:'local_storage'});
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await nav('/login');await login(A);await openProfile();if(await ev(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Remove picture')`))await remove();assert.equal(await ev(`!!document.querySelector('header img')`),false);
 const before=requests.filter(r=>r.method==='POST'&&r.url.endsWith('/avatar')).length;
 for(const [file,message]of [['invalid.svg','Choose a JPG'],['oversized.png','2 MB or smaller']]){await choose(file);await until(`document.querySelector('${picture} [role="alert"]')?.textContent.includes(${JSON.stringify(message)})`);}
 assert.equal(requests.filter(r=>r.method==='POST'&&r.url.endsWith('/avatar')).length,before);
 await choose('corrupt.png');await textButton('Upload picture');await until(`document.querySelector('${picture} [role="alert"]')?.textContent.includes('could not be read')`);assert.deepEqual(await list(A),[]);mark('Invalid type/oversize blocked in browser; disguised corrupt PNG rejected by real backend with no stored object');
 await input('#edit-profile-name','Unsaved avatar test draft');await upload('avatar.png');assert.equal(await ev(`document.querySelector('#edit-profile-name').value`),'Unsaved avatar test draft');assert.deepEqual(await list(A),['avatar.webp']);let profile=await me();assert.equal(profile.avatar_path,pathFor(A));assert.ok(profile.avatar_url.includes('/object/sign/avatars/'));assert.ok(!profile.avatar_url.includes('/object/public/'));const first=await bytes(A);const firstUrl=profile.avatar_url;mark('Student A uploads PNG via browser; header/profile refresh, private signed URL and one normalized stored object verified');
 await upload('avatar.jpeg');profile=await me();assert.equal(profile.avatar_path,pathFor(A));assert.notEqual(profile.avatar_url,firstUrl);assert.deepEqual(await list(A),['avatar.webp']);assert.notDeepEqual(await bytes(A),first);mark('JPEG replacement changes image at the same path without extra objects or stale URL');
 await textButton('Cancel');await send('Page.reload');await until(`document.querySelector('header img')?.naturalWidth>0`);await until(`document.querySelector('main').textContent.includes('MVP Test Student A')`);await logout();await login(A);await until(`document.querySelector('header img')?.naturalWidth>0`);await feedReady();await until(`document.querySelector('a[href="/questions/${questionId}"] img')?.naturalWidth>0`);await click(`a[href="/questions/${questionId}"]`);await detailReady();await until(`document.querySelector('main article img')?.naturalWidth>0`);mark('A picture persists after refresh/login and renders on Home cards and question author');
 await logout();await login(B);await openProfile();if(await ev(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Remove picture')`))await remove();await upload('avatar.webp');assert.deepEqual(await list(B),['avatar.webp']);const originalB=await bytes(B);mark('Student B uploads WebP successfully');
 // Re-login A through the backend for a fresh token after UI logout revoked its session.
 const authResponse=await fetch('http://localhost:4000/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:A.email,password:A.password})});
 assert.equal(authResponse.status,200);const token=(await authResponse.json()).data.session.access_token;
 const studentA=createUserClient(token),webp=await readFile(fixtureDir+'/avatar.webp');
 for(const method of ['POST','DELETE']){const response=await fetch(`http://localhost:4000/api/profiles/${B.id}/avatar`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'image/webp'},body:method==='POST'?webp:undefined});assert.equal(response.status,403);}
 const attack=await studentA.storage.from('avatars').upload(pathFor(B),webp,{upsert:true,contentType:'image/webp'});assert.ok(attack.error,'RLS must reject replacing B object');
 const extra=await studentA.storage.from('avatars').upload(`${A.id}/extra.webp`,webp,{contentType:'image/webp'});assert.ok(extra.error,'RLS must reject unbounded extra filenames');
 await studentA.storage.from('avatars').remove([pathFor(B)]);assert.deepEqual(await bytes(B),originalB,'Storage delete must not remove B object');
 const wrongReference=await studentA.from('profiles').update({avatar_path:pathFor(B)}).eq('id',A.id);assert.ok(wrongReference.error,'DB must reject cross-user avatar reference');
 assert.deepEqual(await list(A),['avatar.webp']);assert.deepEqual(await list(B),['avatar.webp']);
 const publicRead=await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/public/avatars/${pathFor(B)}`);assert.ok(publicRead.status>=400);
 mark('A cannot upload/delete B avatar through Express or direct Storage; extra paths and cross-user DB references rejected; bucket has no public access');
 await nav('/questions/'+questionId);await detailReady();await until(`document.querySelectorAll('main article img').length>=4 && [...document.querySelectorAll('main article img')].every(img=>img.naturalWidth>0)`);mark('Real question, answer, question-comment and answer-comment authors display their pictures');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.ok(await ev(`document.documentElement.scrollWidth<=innerWidth`));await openProfile();await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(r=>writeFile('/private/tmp/coursepoint-v12-avatar-mobile.png',Buffer.from(r.data,'base64')));mark('Mobile avatar controls fit existing layout');
 await remove();assert.deepEqual(await list(B),[]);assert.equal((await me()).avatar_path,null);await send('Page.reload');await until(`!!document.querySelector('header')&&!document.querySelector('header img')`);await logout();await login(B);await until(`!!document.querySelector('header')&&!document.querySelector('header img')`);await nav('/questions/'+questionId);await detailReady();await until(`!!document.querySelector('section[aria-label="answer comments"] li')`);assert.equal(await ev(`!!document.querySelector('article[aria-label="Answer by MVP Test Student B"] img')`),false);assert.equal(await ev(`!!document.querySelector('section[aria-label="question comments"] li img')`),false);mark('Removal deletes B object/reference; initials persist after reload/login and on authored content');
 await logout();await login(A);await openProfile();await remove();assert.deepEqual(await list(A),[]);assert.equal((await me()).avatar_path,null);mark('A avatar removed; no test avatar objects remain for either student');
 assert.deepEqual(errors,[]);mark('No browser JavaScript runtime exceptions');await writeFile('/private/tmp/coursepoint-v12-live-results.json',JSON.stringify({questionId,report},null,2));
}catch(error){console.error(error.message);console.error(await ev(`({path:location.pathname,text:document.querySelector('main')?.innerText})`));process.exitCode=1;}finally{ws.close();}
