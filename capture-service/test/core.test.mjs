import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { validateScene } from '../schema.mjs';
import { Jobs } from '../jobs.mjs';
const scene = () => ({videoId:'abcdefghijk',start:10,end:12,captions:true,style:'iman',x:.5,y:.66,sync:.3,crop:true,mode:'center',words:[{w:'Teste',p:'solo',s:10,e:11}],segments:[{p:'solo',s:10,e:11}],names:{},positions:{solo:50},pair:['solo']});
test('accepts exact preview snapshot and strips untrusted fields',()=>{
  const s=scene();s.url='http://169.254.169.254';const result=validateScene(s,new Set(['iman']));assert.equal(result.url,undefined);assert.equal(result.start,10);
});
test('rejects URL injection, invalid time ranges and oversized clips',()=>{
  for(const patch of [{videoId:'https://evil'},{start:-1},{end:10},{end:131},{x:Infinity},{style:'unknown'},{mode:'split'},{words:[{w:'a',p:'solo',s:9,e:10}]}])assert.throws(()=>validateScene({...scene(),...patch},new Set(['iman'])));
});
test('queue isolates owners, serializes recordings and rejects duplicate active jobs',async()=>{
  let active=0,peak=0;
  const jobs=new Jobs({remove:async()=>{},run:async()=>{active++;peak=Math.max(active,peak);await delay(15);active--;}});
  const a=jobs.create('a',scene());assert.equal(jobs.owned(a.id,'b'),null);
  assert.throws(()=>jobs.create('a',scene()),/Aguarde/);
  const b=jobs.create('b',scene());for (let i=0;i<100 && b.state!=='ready';i++) await delay(10);assert.equal(peak,1);assert.equal(a.state,'ready');assert.equal(b.state,'ready');
});
test('cancelled and timed-out jobs cannot become ready',async()=>{
  const jobs=new Jobs({remove:async()=>{},run:async j=>{await delay(10);j.controller.abort();throw new Error('Timeout');}});
  const a=jobs.create('a',scene());const b=jobs.create('b',scene());await jobs.cancel(b);await delay(40);
  assert.equal(a.state,'failed');assert.equal(b.state,'cancelled');
});
test('expires files, removes completed payloads, limits daily work',async()=>{
  let now=1,removed=0;
  const jobs=new Jobs({remove:async()=>{removed++;},run:async()=>{},now:()=>now,ttl:10,perDay:1});
  const a=jobs.create('a',scene());await delay(10);assert.equal(a.scene,null);assert.throws(()=>jobs.create('a',scene()),/Limite/);
  now=20;await jobs.clean();assert.equal(jobs.items.size,0);assert.equal(removed,1);
});
