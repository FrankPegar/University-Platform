// Run with Vite on port 5173 and Chrome remote debugging on port 9223.
// All API responses in this suite are mocked; it does not write to Supabase.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const target = await (await fetch('http://127.0.0.1:9223/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let id = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', ({ data }) => {
  const m = JSON.parse(data);
  if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args);
});
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
    const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params }));
  });
  return Promise.all([response, loaded]).then(([result]) => result);
};
const evaluate = async expression => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
const until = async expression => { for (let i = 0; i < 80; i++) { if (await evaluate(`Boolean(${expression})`)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error('Timed out: ' + expression); };
const navigate = async path => { await send('Page.navigate', { url: 'http://127.0.0.1:5173' + path }); await until(`document.readyState === 'complete' && !!document.querySelector('main h1')`); };
const fixtureDir=process.env.COURSEPOINT_AVATAR_FIXTURES||'/private/tmp/coursepoint-v12-fixtures';
const blue=`data:image/png;base64,${(await readFile(fixtureDir+'/avatar.png')).toString('base64')}`;
const green=`data:image/webp;base64,${(await readFile(fixtureDir+'/avatar.webp')).toString('base64')}`;
const A='11111111-1111-4111-8111-111111111111';
const Q='33333333-3333-4333-8333-333333333333';
const click=text=>evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);
const choose=async file=>{const {root}=await send('DOM.getDocument');const {nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector:'#avatar-file'});await send('DOM.setFileInputFiles',{nodeId,files:[fixtureDir+'/'+file]});};
const picture='section[aria-label="Profile picture"]';
const uploads=()=>evaluate(`window.__requests.filter(r=>r.path.endsWith('/avatar')&&r.method==='POST')`);
const ready=()=>until(`!!document.querySelector('#avatar-file') && !document.querySelector('form[aria-label="Edit profile"] button[type="submit"]').disabled`);
try{
 await send('Runtime.enable');await send('Page.enable');await send('Page.bringToFront');
 await send('Storage.clearDataForOrigin',{origin:'http://127.0.0.1:5173',storageTypes:'local_storage'});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`
  localStorage.setItem('university_qa_session',JSON.stringify({session:{access_token:'avatar-token'},user:{id:'${A}'}}));
  window.__requests=[];window.__mode='';
  window.__profile=JSON.parse(sessionStorage.getItem('avatar-profile')||'null')||{id:'${A}',full_name:'Avatar Student',student_id:'KEEP-ID',department:{id:'dept',name:'Engineering'},course:{id:'course',name:'Computer Engineering'},year_level:2,created_at:'2026-09-23T00:00:00Z',avatar_path:null,avatar_url:null};
  const json=(data,status=200)=>new Response(JSON.stringify(status<400?{success:true,data}:{success:false,error:{message:data}}),{status,headers:{'Content-Type':'application/json'}});
  const original=window.fetch.bind(window);
  window.fetch=async(input,init)=>{
   const url=new URL(input,location.href),path=url.pathname;
   if(!path.startsWith('/api/'))return original(input,init);
   window.__requests.push({path,method:init.method,token:init.headers.Authorization,type:init.headers['Content-Type'],size:init.body instanceof Blob?init.body.size:null});
   if(path.endsWith('/avatar')){
    if(init.headers.Authorization!=='Bearer avatar-token')throw Error('Missing auth token');
    const mode=window.__mode;await new Promise(r=>setTimeout(r,650));
    if(mode==='error')return json('Storage upload failed. Try again.',502);
    if(mode==='network')throw TypeError('Offline');
    if(init.method==='POST'){
     if(!(init.body instanceof File))throw Error('Expected raw File body');
     window.__profile.avatar_path='${A}/avatar.webp';
     window.__profile.avatar_url=init.body.type==='image/webp'?${JSON.stringify(green)}:${JSON.stringify(blue)};
    }else{window.__profile.avatar_path=null;window.__profile.avatar_url=null;}
    sessionStorage.setItem('avatar-profile',JSON.stringify(window.__profile));
    if(mode==='lost')throw TypeError('Response lost after write');
    return json(window.__profile);
   }
   if(path==='/api/me')return json(window.__profile);
   if(path==='/api/departments')return json([{id:'dept',name:'Engineering'}]);
   if(path.endsWith('/courses'))return json([{id:'course',name:'Computer Engineering'}]);
   if(path==='/api/votes')return json({vote_count:0,has_voted:false});
   if(path.endsWith('/comments'))return json([{id:'comment',body:'A comment',author:window.__profile,created_at:'2026-09-23T00:00:00Z'}]);
   if(path.endsWith('/answers'))return json([{id:'answer',body:'An answer',author:window.__profile,vote_count:0,is_accepted:false,created_at:'2026-09-23T00:00:00Z'}]);
   const question={id:'${Q}',title:'Avatar test question',body:'Question body',author:window.__profile,department:window.__profile.department,tags:[],vote_count:0,answer_count:1,has_accepted_answer:false,created_at:'2026-09-23T00:00:00Z'};
   if(path==='/api/questions')return json({items:[question],total:1,page:1,limit:20});
   return json(question);
  };
 `});
 await navigate('/profile');await until(`document.querySelector('main').textContent.includes('Avatar Student')`);
 assert.equal(await evaluate(`!!document.querySelector('header img')`),false);await click('Edit Profile');await ready();
 for(const [file,message]of [['invalid.svg','Choose a JPG'],['oversized.png','2 MB or smaller']]){await choose(file);await until(`document.querySelector('${picture} [role="alert"]')?.textContent.includes(${JSON.stringify(message)})`);assert.equal((await uploads()).length,0);}
 await choose('avatar.png');await until(`!!document.querySelector('img[alt="Selected profile picture preview"]')`);assert.ok(await evaluate(`document.querySelector('form[aria-label="Edit profile"] button[type="submit"]').disabled`));await click('Discard picture');await ready();assert.equal((await uploads()).length,0);
 await choose('avatar.png');await click('Cancel');await until(`!document.querySelector('#avatar-file')`);assert.equal((await uploads()).length,0);
 console.log('PASS: no-image initials, invalid/oversized input, preview, discard and Cancel without uploading');
 await click('Edit Profile');await ready();await evaluate(`(()=>{const e=document.querySelector('#edit-profile-name');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Unsaved profile draft');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await choose('avatar.png');
 await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Upload picture').click();[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Upload picture').click()`);
 await until(`document.querySelector('${picture}').textContent.includes('Updating profile picture')`);
 assert.ok(await evaluate(`document.querySelector('form[aria-label="Edit profile"] button[type="submit"]').disabled && [...document.querySelectorAll('button')].find(b=>b.textContent==='Cancel').disabled`));
 await until(`document.querySelector('${picture}').textContent.includes('Profile picture updated.')`);await until(`document.querySelector('header img')?.naturalWidth>0`);assert.equal((await uploads()).length,1);assert.equal((await uploads())[0].type,'image/png');assert.equal(await evaluate(`document.querySelector('#edit-profile-name').value`),'Unsaved profile draft');
 await choose('avatar.webp');await click('Upload picture');await until(`document.querySelector('header img')?.src===${JSON.stringify(green)} && !document.querySelector('#avatar-file').disabled`);assert.equal(await evaluate(`window.__profile.avatar_path`),`${A}/avatar.webp`);
 await click('Cancel');await send('Page.reload');await until(`document.querySelector('header img')?.naturalWidth>0`);assert.ok(await evaluate(`document.querySelector('main').textContent.includes('Avatar Student')`));
 console.log('PASS: authenticated raw-file upload, pending lock, profile-draft preservation, replacement and reload persistence');
 await navigate('/');await until(`document.querySelector('article img')?.naturalWidth>0`);await navigate('/questions/'+Q);await until(`document.querySelectorAll('main img').length>=4 && [...document.querySelectorAll('main img')].every(i=>i.naturalWidth>0)`);
 console.log('PASS: feed/question author, answer author and question/answer comment images share Avatar renderer');
 await navigate('/profile');await click('Edit Profile');await ready();await evaluate(`window.__mode='error'`);await click('Remove picture');await until(`document.querySelector('${picture} [role="alert"]')`);assert.ok(await evaluate(`!!document.querySelector('header img')`));await evaluate(`window.__mode=''`);await click('Remove picture');await until(`document.querySelector('${picture}').textContent.includes('Profile picture removed.')`);assert.equal(await evaluate(`!!document.querySelector('header img')`),false);
 await choose('avatar.png');await evaluate(`window.__mode='network'`);await click('Upload picture');await until(`document.querySelector('${picture} [role="alert"]')?.textContent.includes('Could not reach')`);assert.ok(await evaluate(`!!document.querySelector('img[alt="Selected profile picture preview"]')`));
 await evaluate(`window.__mode='lost'`);await click('Upload picture');await until(`document.querySelector('${picture} [role="alert"]')?.textContent.includes('Could not reach') && !document.querySelector('#avatar-file').disabled`);assert.equal(await evaluate(`window.__profile.avatar_path`),`${A}/avatar.webp`);await evaluate(`window.__mode=''`);await click('Remove picture');await until(`document.querySelector('${picture}').textContent.includes('Profile picture removed.')`);assert.equal(await evaluate(`window.__profile.avatar_path`),null);
 console.log('PASS: deletion errors preserve picture; network errors retain preview; removal recovers uncertain first upload');
 await choose('avatar.png');await click('Upload picture');await until(`document.querySelector('${picture}').textContent.includes('Profile picture updated.')`);await evaluate(`window.__profile.avatar_url='data:image/png;base64,bm90LWFuLWltYWdl';sessionStorage.setItem('avatar-profile',JSON.stringify(window.__profile))`);await send('Page.reload');await until(`!!document.querySelector('header') && !document.querySelector('header img')`);assert.ok(await evaluate(`document.querySelector('header [aria-haspopup="menu"]').textContent.includes('AS')`));await click('Edit Profile');await ready();await choose('avatar.webp');await click('Upload picture');await until(`document.querySelector('header img')?.naturalWidth>0`);
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.ok(await evaluate(`document.documentElement.scrollWidth<=innerWidth`));assert.deepEqual(errors,[]);
 console.log('PASS: failed-image initials recover on new image, mobile layout fits, no JavaScript runtime errors');
}finally{ws.close();}
