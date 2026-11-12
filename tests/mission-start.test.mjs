import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {getMission,missionStart} from '../src/missions.js';
import {missionBrief,objectiveType} from '../src/task-missions.js';
import {BrnoRace} from '../src/brno-race.js';
import {routeSurfacePoints,resolveRouteSurface} from '../src/mission-difficulty.js';
import {initialFlight} from '../src/flight.js';
const C=createRequire(import.meta.url)('cesium');
const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const startCode=app.slice(app.indexOf('async function startFlight(){'),app.indexOf('function updatePauseLocation(){'));
function setup(id,{missing=false,level='easy',unlocked=true,aircraftUnlocked=true,missingCatalog=false,model='highWing',mode='google'}={}){
  const mission=getMission(id,level,model),calls=[],errors=[],stages=[],radio=[],controls=new Map(),noop=()=>{};
  const $=id=>{if(!controls.has(id))controls.set(id,{value:model,classList:{remove:noop},blur:noop});return controls.get(id);};
  const viewer={scene:{screenSpaceCameraController:{},sampleHeightMostDetailed:async points=>{calls.push(points.length);return points.map((point,index)=>({...point,height:points.length===1?6700:missing?undefined:7000+index*20}));}},camera:{lookAtTransform:noop}};
  const context=vm.createContext({C,$,missionBrief,objectiveType,geographyGuide:{ready:Promise.resolve(!missingCatalog),setMissionPlaces:()=>{}},viewer,demo:{surface:()=>100},initialFlight,BrnoRace,routeSurfacePoints,resolveRouteSurface,missionStart,currentMission:()=>mission,isRace:()=>mode==='google',isMissionUnlocked:()=>unlocked,isAircraftUnlocked:()=>aircraftUnlocked,selection:()=>missionStart(mission),prepareGoogle:async()=>true,surfaceExclusions:()=>[],exitPhotoMode:noop,setFlightMenuVisible:noop,engineAudio:{unlock:noop,setThrottle:noop,play:noop},missionRadio:{play:()=>radio.push('play')},aircraft:{resetEffects:noop},raceView:{setRoute:noop},syncControls:noop,loading:value=>stages.push(value),showError:value=>errors.push(value),applyTimeOfDay:noop,resetRace:noop,updateCamera:noop,updateHUD:noop,notice:noop,mobileControls:{reset:noop},document:{body:{classList:{add:noop,remove:noop}}},setTimeout:()=>0,mission});
  vm.runInContext(`let running=false,busy=false,mode='${mode}',missionId='${id}',missionLevel='${level}',epoch=0,paused=false,crashed=false;let origin,startup,state,surfaceHeight,surfaceFlat,trail,lastTrail,lastSurface;const keys=new Set(),race=new BrnoRace(mission.route);`+startCode,context);
  return{context,calls,errors,stages,radio,start:()=>vm.runInContext('startFlight()',context)};
}
test('a locked mission cannot start even if selected outside the menu',async()=>{
  const run=setup('prague',{unlocked:false});await run.start();
  assert.equal(vm.runInContext('running',run.context),false);
  assert.equal(run.calls.length,0);
  assert.match(run.errors[0],/zamčená/);
  assert.equal(run.radio.length,0);
});
test('an aircraft above the pilot level cannot start a flight',async()=>{
  const run=setup('brno-landing',{aircraftUnlocked:false});await run.start();
  assert.equal(vm.runInContext('running',run.context),false);
  assert.equal(run.calls.length,0);
  assert.match(run.errors[0],/odemkne/);
});
test('discovery does not start when its collection catalogue cannot be loaded',async()=>{
  const run=setup('brno-discovery',{missingCatalog:true});await run.start();
  assert.equal(vm.runInContext('running||busy',run.context),false);
  assert.match(run.errors[0],/Sbírku památek/);
  assert.equal(run.radio.length,0);
});
test('starting easy Everest loads the route surface and spawns above the mountain instead of using a city altitude',async()=>{
  const run=setup('everest');await run.start();
  assert.deepEqual(run.calls,[1,15]);assert.equal(run.errors.length,0);
  assert.equal(vm.runInContext('running',run.context),true);assert.equal(vm.runInContext('busy',run.context),false);
  assert.equal(vm.runInContext('race.route.resolved',run.context),true);assert.ok(vm.runInContext('state.altitude',run.context)>8000);
  assert.equal(run.stages.at(-1),null);
  assert.equal(run.radio.length,1);
});
test('missing mountain samples end loading and leave the menu usable without starting a flight',async()=>{
  const run=setup('everest',{missing:true});await run.start();
  assert.equal(vm.runInContext('running',run.context),false);assert.equal(vm.runInContext('busy',run.context),false);
  assert.match(run.errors[0],/Povrch trasy/);assert.equal(run.stages.at(-1),null);
  assert.equal(run.radio.length,0);
});

test('each new task and difficulty starts with its sampled objective geometry and usable aircraft state',async()=>{
  for(const id of ['brno-discovery','brno-landing','canyon-patrol'])for(const level of ['easy','normal','hard']){
    const run=setup(id,{level});await run.start();assert.equal(run.errors.length,0);
    assert.equal(vm.runInContext('running',run.context),true);assert.equal(vm.runInContext('busy',run.context),false);
    assert.equal(vm.runInContext('race.route.resolved',run.context),true);
    assert.equal(run.calls[1],id==='brno-landing'?13:id==='brno-discovery'?5:15);assert.equal(run.stages.at(-1),null);
  }
});


test('world arrivals prepare the selected aircraft approach and preserve their real runway heading',async()=>{
  for(const [id,model] of [['kansai','airliner'],['gibraltar','lowWing'],['queenstown','highWing'],['madeira','fighter']]){
    const run=setup(id,{model});await run.start();
    assert.deepEqual(run.errors,[]);assert.equal(vm.runInContext('running',run.context),true);
    assert.equal(vm.runInContext('state.model',run.context),model);
    assert.equal(vm.runInContext('race.route.id',run.context),getMission(id,'easy',model).route.id);
    assert.equal(vm.runInContext('race.route.resolved',run.context),true);
    assert.equal(vm.runInContext('race.route.airport.runway',run.context),getMission(id).route.airport.runway);
    assert.equal(run.radio.length,1);
  }
});

test('offline training starts with the same radio recording as a mission',async()=>{
  const run=setup('brno-landing',{mode:'demo'});
  await run.start();
  assert.equal(vm.runInContext('running',run.context),true);
  assert.deepEqual(run.radio,['play']);
});
