// Run after live-mvp.browser.mjs. Reads real data; temporarily simulates a browser network outage.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const {run, students:[A,B]} = JSON.parse(await readFile(process.env.COURSEPOINT_TEST_ACCOUNTS || '/private/tmp/coursepoint-phase5f-accounts.json','utf8'));
const target = await (await fetch('http://127.0.0.1:9223/json/new?about:blank',{method:'PUT'})).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let seq=0; const pending=new Map(), errors=[], requests=[], responses=[], report=[];
ws.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Network.requestWillBeSent'&&m.params.request.url.includes(':4000/api/'))requests.push({url:m.params.request.url,method:m.params.request.method});if(m.method==='Network.responseReceived'&&m.params.response.url.includes(':4000/api/'))responses.push({url:m.params.response.url,status:m.params.response.status});});
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
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
const { questionId }=JSON.parse(await readFile('/private/tmp/coursepoint-phase5f-live-artifacts.json','utf8'));
try {
 await send('Runtime.enable');await send('Page.enable');await send('Page.bringToFront');await send('Network.enable');
 await nav('/questions/'+questionId);await detailReady();
 for(const type of ['question','answer']){await until(`document.querySelector('section[aria-label="${type} comments"] li')?.textContent.includes('MVP ${run}')`);assert.ok(await ev(`document.querySelector('section[aria-label="${type} comments"] li').textContent.includes('MVP Test Student B') && !!document.querySelector('section[aria-label="${type} comments"] time')`));await voteReady(type);}
 assert.equal(await voted('question'),false);assert.equal(await voted('answer'),true);mark('Both comments and final vote state persist in a fresh browser tab');
 const status=await ev(`(async()=>{const r=await fetch('http://localhost:4000/api/questions');return r.status;})()`);assert.equal(status,401);mark('Real backend rejects question feed without authentication');
 for(const [width,height] of [[1440,1000],[390,844]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
  await ev(`document.querySelector('article[aria-label="Answer by MVP Test Student B"]').scrollIntoView({block:'start'})`);
  assert.ok(await ev(`document.documentElement.scrollWidth<=innerWidth && document.querySelector('main').scrollWidth<=document.querySelector('main').clientWidth`));
  await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(r=>writeFile(`/private/tmp/coursepoint-phase5f-live-answer-${width}.png`,Buffer.from(r.data,'base64')));
 }
 mark('Real accepted answer, Markdown, comments and vote controls fit desktop/mobile after scrolling');
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await click('a[href="/explore"]');await feedReady();
 await textButton('Most voted');await feedReady();
 assert.ok(requests.some(r=>new URL(r.url).searchParams.get('sort')==='votes'));
 const counts=await ev(`[...document.querySelectorAll('[aria-label="Question feed"] article')].map(a=>parseInt(a.querySelector('span').textContent,10))`);assert.deepEqual(counts,[...counts].sort((a,b)=>b-a));
 await textButton('Unanswered');await feedReady();assert.ok(requests.some(r=>new URL(r.url).searchParams.get('sort')==='unanswered'));
 assert.ok(await ev(`[...document.querySelectorAll('[aria-label="Question feed"] article')].every(a=>a.textContent.includes('0 answers'))`));
 await textButton('Newest');await feedReady();mark('Real Explore sort requests and most-voted/unanswered results verified');
 // Hold the real detail request briefly to inspect loading without replacing its response.
 let held;
 const hold=({data})=>{const m=JSON.parse(data);if(m.method==='Fetch.requestPaused')held=m.params.requestId;};
 ws.addEventListener('message',hold);
 await send('Fetch.enable',{patterns:[{urlPattern:`*api/questions/${questionId}`,requestStage:'Request'}]});
 await ev(`history.pushState({},'', '/questions/${questionId}');dispatchEvent(new PopStateEvent('popstate'))`);
 await until(`document.querySelector('main')?.textContent.includes('Loading question')`);
 for(let i=0;i<50&&!held;i++)await new Promise(r=>setTimeout(r,100));assert.ok(held);
 await send('Fetch.continueRequest',{requestId:held});await send('Fetch.disable');ws.removeEventListener('message',hold);await detailReady();mark('Loading indicator appears while actual backend detail request is delayed');
 await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await ev(`history.pushState({},'', '/explore');dispatchEvent(new PopStateEvent('popstate'))`);
 await until(`document.querySelector('main')?.textContent.includes('Could not reach the server')`);
 await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await textButton('Try again');await feedReady();assert.ok(await ev(`!document.querySelector('main').textContent.includes('Could not reach the server')`));mark('Actual browser network outage shows feed error; retry reconnects to real backend');
 await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await ev(`history.pushState({},'', '/questions/${questionId}');dispatchEvent(new PopStateEvent('popstate'))`);
 await until(`document.querySelector('main')?.textContent.includes('Could not reach the server')`);
 await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await textButton('Try again');await detailReady();mark('Actual browser network outage shows detail error; retry recovers question/answers');
 assert.deepEqual(errors,[]);mark('No JavaScript runtime exceptions in resilience checks');
 await writeFile('/private/tmp/coursepoint-phase5f-live-resilience-results.json',JSON.stringify(report,null,2));
} catch(error){console.error(error.message);console.error(await ev(`({path:location.pathname,text:document.querySelector('main')?.innerText})`));process.exitCode=1;}finally{await send('Fetch.disable');await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});ws.close();}
