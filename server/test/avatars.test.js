import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import sharp from 'sharp';
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'http://127.0.0.1:1';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
const { createApp } = await import('../src/app.js');
const { supabaseAdmin } = await import('../src/config/supabase.js');
const { normalizeAvatar, withAvatarUrls, AVATAR_MAX_BYTES } = await import('../src/services/avatars.service.js');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const fixture = () => sharp({ create: { width: 640, height: 480, channels: 3, background: '#267ab4' } });

test('image decoding and normalization', async t => {
  for (const [format, mime] of [['jpeg', 'image/jpeg'], ['png', 'image/png'], ['webp', 'image/webp']]) {
    await t.test(`${format} is decoded, resized, stripped and stored as WebP`, async () => {
      const input = await fixture().withMetadata().toFormat(format).toBuffer();
      const output = await normalizeAvatar(input, mime);
      const metadata = await sharp(output).metadata();
      assert.equal(metadata.format, 'webp');
      assert.ok(metadata.width <= 512 && metadata.height <= 512);
      assert.equal(metadata.exif, undefined);
      assert.ok(output.length < AVATAR_MAX_BYTES);
    });
  }
  await t.test('rejects unsupported, corrupt, disguised, oversized and huge-dimension files', async () => {
    const png = await fixture().png().toBuffer();
    for (const [bytes, mime, status] of [[png,'image/gif',415],[Buffer.from('not an image'),'image/png',400],[Buffer.from('<svg></svg>'),'image/png',400],[png,'image/jpeg',400],[Buffer.alloc(0),'image/png',400],[Buffer.alloc(AVATAR_MAX_BYTES+1),'image/png',413]]) {
      await assert.rejects(normalizeAvatar(bytes,mime),error=>error.statusCode===status);
    }
    const huge = await sharp({create:{width:4096,height:4096,channels:3,background:'#eee'}}).png().toBuffer();
    await assert.rejects(normalizeAvatar(huge,'image/png'),error=>error.statusCode===400);
  });
});

test('avatar HTTP ownership, storage lifecycle and failure recovery', async t => {
  const profiles = new Map([A,B].map(id=>[id,{id,full_name:id===A?'Alice':'Bob',student_id:'KEEP',avatar_path:null,updated_at:'2026-09-23T00:00:00Z'}]));
  const objects = new Map();
  const calls = [];
  let dbError = false, storageError = false, signError = false;
  const originalFetch = globalThis.fetch;
  mock.method(globalThis,'fetch',async(input,init)=>{
    const url = new URL(typeof input==='string'?input:input.url);
    if(url.origin!=='http://127.0.0.1:1')return originalFetch(input,init);
    const headers = new Headers(init.headers);
    assert.equal(headers.get('apikey'),'test-anon-key');
    const viewer = headers.get('authorization')?.replace('Bearer ','');
    assert.ok([A,B].includes(viewer));
    const path = decodeURIComponent(url.pathname.replace('/storage/v1/object/avatars/',''));
    const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
    calls.push({method:init.method,path,viewer});
    if(storageError)return response({message:'Storage unavailable',statusCode:'503'},503);
    if(init.method==='DELETE'){
      const {prefixes}=JSON.parse(init.body);
      assert.deepEqual(prefixes,[`${viewer}/avatar.webp`]);
      prefixes.forEach(key=>objects.delete(key));return response([]);
    }
    assert.equal(path,`${viewer}/avatar.webp`);
    assert.equal(headers.get('x-upsert'),'true');
    assert.equal(headers.get('content-type'),'image/webp');
    objects.set(path,Buffer.from(init.body));
    return response({Id:'object-id',Key:`avatars/${path}`});
  });
  mock.method(supabaseAdmin.auth,'getUser',async token=>({data:{user:[A,B].includes(token)?{id:token}:null},error:null}));
  mock.method(supabaseAdmin.storage,'from',bucket=>{
    assert.equal(bucket,'avatars');
    return {createSignedUrls:async(paths,expires)=>{
      assert.equal(expires,3600);
      return signError?{error:{message:'Signing failed'}}:{data:paths.map(path=>({path,signedUrl:`https://storage.example.test/${path}?token=temporary`}))};
    }};
  });
  mock.method(supabaseAdmin,'from',table=>{
    assert.equal(table,'profiles');let id,patch;
    return {select(){return this;},eq(key,value){assert.equal(key,'id');id=value;return this;},single(){return this;},update(value){patch=value;return this;},then(resolve,reject){
      if(dbError&&patch)return Promise.resolve({error:{message:'DB unavailable'}}).then(resolve,reject);
      if(patch)Object.assign(profiles.get(id),patch);
      return Promise.resolve({data:{...profiles.get(id)},error:null}).then(resolve,reject);
    }};
  });
  const server=createApp().listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));mock.restoreAll();});
  const png=await fixture().png().toBuffer();
  async function request({id=A,user=A,method='POST',body=png,type='image/png',query=''}={}){
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/profiles/${id}/avatar${query}`,{method,headers:{...(user?{Authorization:`Bearer ${user}`} : {}),'Content-Type':type},body:method==='POST'?body:undefined});
    return {status:response.status,payload:await response.json()};
  }
  await t.test('unauthenticated and cross-student uploads/deletes cannot reach Storage',async()=>{
    for(const method of ['POST','DELETE']){
      assert.equal((await request({user:null,method})).status,401);
      assert.equal((await request({user:'invalid',method})).status,401);
      assert.equal((await request({id:B,user:A,method})).status,403);
    }
    assert.equal(calls.length,0);
  });
  await t.test('rejects invalid MIME, corrupt bytes and over-2MB requests before Storage',async()=>{
    assert.equal((await request({type:'image/svg+xml'})).status,415);
    assert.equal((await request({body:Buffer.from('fake png')})).status,400);
    assert.equal((await request({body:Buffer.alloc(AVATAR_MAX_BYTES+1)})).status,413);
    assert.equal(calls.length,0);
  });
  await t.test('upload and cross-format replacement use verified ID, one object and signed profile URLs',async()=>{
    let result=await request({query:`?user_id=${B}&avatar_path=${B}/avatar.webp`});
    assert.equal(result.status,200);assert.equal(result.payload.data.avatar_path,`${A}/avatar.webp`);
    assert.match(result.payload.data.avatar_url,/token=temporary&v=/);
    assert.equal(profiles.get(B).avatar_path,null);
    const first=objects.get(`${A}/avatar.webp`);
    const jpeg=await sharp({create:{width:20,height:20,channels:3,background:'#d60'}}).jpeg().toBuffer();
    result=await request({body:jpeg,type:'image/jpeg'});assert.equal(result.status,200);assert.equal(objects.size,1);assert.notDeepEqual(objects.get(`${A}/avatar.webp`),first);
    assert.equal(profiles.get(A).student_id,'KEEP');
  });
  await t.test('storage failure leaves profile reference alone; deletion is retryable and idempotent',async()=>{
    storageError=true;assert.equal((await request({method:'DELETE'})).status,502);assert.equal(profiles.get(A).avatar_path,`${A}/avatar.webp`);assert.equal(objects.size,1);
    storageError=false;assert.equal((await request({method:'DELETE'})).status,200);assert.equal(objects.size,0);assert.equal(profiles.get(A).avatar_path,null);
    assert.equal((await request({method:'DELETE'})).status,200);
  });
  await t.test('DB failures leave at most one recoverable object; remove cleans interrupted upload',async()=>{
    dbError=true;assert.equal((await request()).status,502);assert.equal(objects.size,1);assert.equal(profiles.get(A).avatar_path,null);
    dbError=false;assert.equal((await request()).status,200);assert.equal(objects.size,1);
    dbError=true;assert.equal((await request({method:'DELETE'})).status,502);assert.equal(objects.size,0);
    dbError=false;assert.equal((await request({method:'DELETE'})).status,200);assert.equal(profiles.get(A).avatar_path,null);
  });
  await t.test('missing/invalid paths and image service failure keep profiles readable with fallback',async()=>{
    assert.deepEqual(await withAvatarUrls([null,undefined,{id:A,avatar_path:`${B}/avatar.webp`}]),[null,undefined,{id:A,avatar_path:`${B}/avatar.webp`,avatar_url:null}]);
    signError=true;assert.equal((await request()).status,200);
    assert.equal((await withAvatarUrls([profiles.get(A)]))[0].avatar_url,null);
  });
});
