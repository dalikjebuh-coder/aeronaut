import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {achievementCollection,recordCloudTurbulence,recordEngineOutCompletion} from '../src/achievements.js';
import {recordMissionCompletion,recordMissionResult} from '../src/mission-progression.js';
import {getMission} from '../src/missions.js';

function memoryStorage(){
  const values=new Map();
  return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),key:index=>[...values.keys()][index]??null,get length(){return values.size;}};
}

test('badge collection is complete and does not award an unseen flight',()=>{
  const collection=achievementCollection(memoryStorage());
  assert.equal(collection.total,13);
  assert.equal(collection.earned,0);
  assert.equal(new Set(collection.items.map(item=>item.id)).size,collection.total);
  for(const item of collection.items){
    assert.ok(item.hint&&item.title);
    const source=fs.readFileSync(new URL('../src'+item.image,import.meta.url),'utf8');
    assert.match(source,/^<svg/);
    assert.doesNotMatch(source,/<rect[^>]*width="128"/);
  }
});

test('existing mission saves unlock chapter and skill badges without migrating or changing them',()=>{
  const storage=memoryStorage();
  for(const id of ['first-takeoff','brno-landing','brno-discovery','brno','prague'])recordMissionCompletion(id,storage);
  let earned=new Set(achievementCollection(storage).items.filter(item=>item.earned).map(item=>item.id));
  assert.ok(earned.has('chapter-1'));
  assert.ok(earned.has('first-flight'));
  assert.ok(!earned.has('first-gold'));
  recordMissionResult(getMission('first-takeoff'),'highWing',0,storage);
  earned=new Set(achievementCollection(storage).items.filter(item=>item.earned).map(item=>item.id));
  assert.ok(earned.has('first-gold'));
  storage.setItem('aeronaut.mission-completed.v1.innsbruck','1');
  storage.setItem('aeronaut.mission-completed.v1.sfo-arrival','1');
  earned=new Set(achievementCollection(storage).items.filter(item=>item.earned).map(item=>item.id));
  assert.ok(earned.has('hard-landing'));
  assert.ok(!earned.has('engine-out'),'an old completed mission cannot prove an actual engine failure');
  assert.ok(!earned.has('cloud-turbulence'));
});

test('turbulence badge needs an observed event and is saved only once',()=>{
  const storage=memoryStorage();
  assert.equal(recordCloudTurbulence(storage),true);
  assert.equal(recordCloudTurbulence(storage),false);
  assert.equal(achievementCollection(storage).items.find(item=>item.id==='cloud-turbulence').earned,true);
  assert.equal(recordCloudTurbulence({getItem(){return null;},setItem(){throw Error('quota');}}),false);
  assert.equal(recordEngineOutCompletion(storage),true);
  assert.equal(recordEngineOutCompletion(storage),false);
  assert.equal(achievementCollection(storage).items.find(item=>item.id==='engine-out').earned,true);
});

test('cloud turbulence is awarded after the pilot exits a real active burst',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  const code=app.slice(app.indexOf('function updateFlightFeedback(){'),app.indexOf('function input(){'));
  const storage=memoryStorage(),elements=new Map(),messages=[];
  const $=id=>{if(!elements.has(id))elements.set(id,{value:'overcast',hidden:true,textContent:'',dataset:{}});return elements.get(id);};
  const bursts=[false,true,true,false,false];
  const context=vm.createContext({$,turbulence:{update:()=>({active:bursts.shift()??false,intensity:0})},flightFeedback:()=>({warning:null,maneuverWarning:null}),recordCloudTurbulence:()=>recordCloudTurbulence(storage),badgeGallery:{refresh:()=>messages.push('refresh')},notice:message=>messages.push(message),engineAudio:{stallWarning(){}}});
  vm.runInContext('let running=true,paused=false,crashed=false,busy=false,cameraMotion=true,surfaceHeight=0,lastStallBeep=0,turbulenceFeedback,cloudTurbulenceSeen=false;const state={elapsed:10,speed:100};'+code,context);
  for(let index=0;index<5;index++)vm.runInContext('updateFlightFeedback()',context);
  assert.equal(achievementCollection(storage).items.find(item=>item.id==='cloud-turbulence').earned,true);
  assert.deepEqual(messages,['refresh','Nový odznak: Skrz turbulenci']);
});
