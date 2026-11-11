import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {RAD,initialFlight} from '../src/flight.js';
import {CAREER_IDS} from '../src/campaign.js';
import {getMission} from '../src/missions.js';
import {MEDAL_NAMES,recordMissionCompletion,recordMissionResult} from '../src/mission-progression.js';
import {starsForMedal} from '../src/mission-performance.js';

const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const code=app.slice(app.indexOf('function continueFreeFlight(){'),app.indexOf('function restart(){'));
function setup(onGround){
  const elements=new Map(),events=[];
  const $=id=>{if(!elements.has(id))elements.set(id,{hidden:false,value:'',focus:()=>events.push('focus:'+id)});return elements.get(id);};
  $('gameMode').value='missions';$('timeOfDay').value='evening';$('weather').value='haze';
  const state={lat:32.69,lon:-16.78,altitude:onGround?53:900,heading:1.25,model:'highWing',onGround,speed:onGround?0:32,elapsed:246,throttle:0,enginePower:0,engineLimit:0,wind:{north:2,east:-3},verticalSpeed:0};
  const race={status:'finished',score:87,update:()=>{throw Error('finished mission must not keep judging free flight');}};
  const context=vm.createContext({$,RAD,state,race,initialFlight,
    currentMission:()=>({location:{name:'Madeira'}}),isRace:()=>$('gameMode').value==='missions',
    geographyGuide:{setMissionPlaces:ids=>events.push(['places',...ids])},missionRadio:{stop:()=>events.push('radio stopped')},
    updateLandingNotice:()=>{},syncControls:()=>events.push('sync'),updateHUD:()=>events.push('hud'),
    pauseFlight:value=>vm.runInContext('paused='+value,context),notice:text=>events.push(text)
  });
  vm.runInContext("let running=true,crashed=false,paused=true,freeConditions={time:'day',weather:'clear'},locationKey='brno',customLocation=null,startup={lat:49,lon:16};"+code,context);
  return {context,state,race,$,events};
}

test('result keeps one career action and quiet retry, mission list, and free-flight actions',()=>{
  const html=fs.readFileSync(new URL('../src/index.html',import.meta.url),'utf8');
  const actions=html.match(/<div class="mission-result-actions">(.*?)<\/div><\/div>/s)[1];
  assert.deepEqual([...actions.matchAll(/<button id="([^"]+)"[^>]*>([^<]+)<\/button>/g)].map(m=>[m[1],m[2]]),[
    ['resultNext','Další mise'],
    ['resultRetry','Zkusit znovu'],['resultMenu','Zpět na mise'],['resultContinue','Volný let']
  ]);
  assert.match(app,/\$\('resultContinue'\)\.onclick=continueFreeFlight/);
  assert.match(app,/\$\('resultRetry'\)\.onclick=restart/);
  assert.match(app,/\$\('resultMenu'\)\.onclick=\(\)=>\{endFlight\(\);setMenuStep\(3\);\}/);
  assert.match(app,/\$\('resultNext'\)\.onclick=/);
  const result=html.match(/<div id="missionResult"[\s\S]*?<div id="pauseOverlay"/)[0];
  for(const id of ['resultScore','resultXp','resultRecord','resultFeedback','resultInstructor','resultCareer','resultPerformance'])assert.doesNotMatch(result,new RegExp(`id="${id}"`));
});

test('result shows the flown grade, a real promotion, and only a newly unlocked mission',()=>{
  const values=new Map(),store={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),key:i=>[...values.keys()][i]??null,get length(){return values.size;}};
  for(const id of CAREER_IDS.slice(0,4))recordMissionCompletion(id,store);
  const mission=getMission('prague'),first=recordMissionResult(mission,'highWing',9999,store);
  const stars=Array.from({length:3},()=>({dataset:{}})),elements=new Map();
  const $=id=>{
    if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',dataset:{},classList:{toggle(){},remove(){},add(){}},setAttribute(name,value){this[name]=value;},querySelectorAll:()=>stars,focus(){this.focused=true;},offsetWidth:520});
    return elements.get(id);
  };
  const context=vm.createContext({$,pauseFlight(){},currentMission:()=>mission,starsForMedal,MEDAL_NAMES,getMission});
  const code=app.slice(app.indexOf('function showMissionResult('),app.indexOf('function syncControls('));
  vm.runInContext(code,context);
  context.reward=first;vm.runInContext('showMissionResult({reward})',context);
  assert.equal($('resultTitle').textContent,'Zlatá Vltava');
  assert.deepEqual(stars.map(star=>star.dataset.earned),['true','false','false']);
  assert.equal($('resultPromotion').hidden,false);
  assert.equal($('resultPromotionTitle').textContent,'Pilot');
  assert.equal($('resultRankInsignia').src,'/images/rank-1.svg');
  assert.equal($('resultUnlocks').textContent,'Odemčena mise: Ranní Fudži');
  assert.equal($('resultNext').textContent,'Další mise: Ranní Fudži →');
  assert.equal($('resultNext').focused,true);
  const replay=recordMissionResult(mission,'highWing',0,store);
  context.reward=replay;vm.runInContext('showMissionResult({reward})',context);
  assert.deepEqual(stars.map(star=>star.dataset.earned),['true','true','true']);
  assert.equal($('resultPromotion').hidden,true);
  assert.equal($('resultUnlocks').hidden,true);
  assert.equal($('resultNext').hidden,false);
});

test('next and back actions open the intended mission screens',()=>{
  const elements=new Map(),events=[],$=id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);};
  const context=vm.createContext({$,continueFreeFlight(){},restart(){},endFlight(){events.push('end')},setMenuStep(step){events.push(['step',step])},chooseMission(id,options){events.push(['mission',id,options.showBriefing])},missionProgress:()=>({nextMissionId:'fuji'})});
  const code=app.slice(app.indexOf("$('resultContinue').onclick="),app.indexOf("$('photoButton').onclick="));
  vm.runInContext(code,context);
  $('resultNext').onclick();assert.deepEqual(events,['end',['step',3],['mission','fuji',true]]);
  events.length=0;$('resultMenu').onclick();assert.deepEqual(events,['end',['step',3]]);
});

test('continuing preserves airborne or parked aircraft, conditions and earned result; engine power becomes available',()=>{
  for(const onGround of [false,true]){
    const run=setup(onGround),before={...run.state};vm.runInContext('continueFreeFlight()',run.context);
    assert.equal(run.$('gameMode').value,'free');assert.equal(run.$('missionResult').hidden,true);
    assert.equal(vm.runInContext('running',run.context),true);assert.equal(vm.runInContext('paused',run.context),false);
    assert.deepEqual(run.state,{...before,engineLimit:1},'the live flight is neither reset nor teleported');
    assert.equal(run.race.score,87);assert.equal(run.race.status,'finished');
    assert.equal(vm.runInContext('locationKey',run.context),'custom');
    assert.equal(vm.runInContext('customLocation.name',run.context),'Madeira');
    assert.equal(vm.runInContext('freeConditions.time',run.context),'evening');
    assert.equal(vm.runInContext('freeConditions.weather',run.context),'haze');
    const restarted=vm.runInContext('initialFlight(startup)',run.context);
    assert.equal(restarted.lat,before.lat);assert.equal(restarted.lon,before.lon);
    assert.equal(restarted.onGround,onGround);assert.equal(restarted.engineLimit,1);
    assert.ok(Math.abs(restarted.heading-before.heading)<1e-10);
    assert.ok(run.events.includes('radio stopped'));assert.ok(run.events.includes('focus:panelButton'));
    vm.runInContext('continueFreeFlight()',run.context);
    assert.equal(run.events.filter(item=>item==='radio stopped').length,1,'double click cannot run the transition twice');
  }
});

test('free-flight continuation is unavailable before completion, after leaving flight or after a crash',()=>{
  for(const change of ["race.status='racing'","running=false","crashed=true","$('missionResult').hidden=true"]){
    const run=setup(false);vm.runInContext(change+';continueFreeFlight()',run.context);
    assert.equal(run.$('gameMode').value,'missions');assert.equal(run.state.engineLimit,0);assert.deepEqual(run.events,[]);
  }
});
