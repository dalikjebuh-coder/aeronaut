import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRunwayFeedback,runwayTransition} from '../src/runway-feedback.js';
import {initialFlight,stepFlight,resolveGroundContact,aircraftProfile} from '../src/flight.js';

test('wheel transitions fire once for touchdown and liftoff, never for taxi, airborne spawn or crash',()=>{
  for(const model of ['highWing','lowWing','airliner','fighter']){
    const profile=aircraftProfile(model),state=initialFlight({lat:49,lon:16,altitude:103,model});
    state.speed=(profile.landingMin+profile.landingMax)/2;state.verticalSpeed=-1;
    let before=state.onGround,contact=resolveGroundContact(state,100,true);
    assert.equal(runwayTransition(before,state,contact),'touchdown',model);
    assert.equal(runwayTransition(true,state,resolveGroundContact(state,100,true)),null);
    state.speed=profile.takeoffSpeed;state.enginePower=state.throttle=1;
    before=state.onGround;stepFlight(state,{pitch:1},.05);contact=resolveGroundContact(state,100,true);
    assert.equal(runwayTransition(before,state,contact),'liftoff',model);
    assert.equal(runwayTransition(false,state,'air'),null);
    assert.equal(runwayTransition(false,state,'crash'),null);
  }
});

test('touchdown camera pulse decays, is smaller at liftoff and respects disabled motion, pause and reset',()=>{
  const feedback=createRunwayFeedback();
  feedback.trigger('touchdown',10);
  const touchdown=feedback.sample(10.04);
  assert.ok(Math.abs(touchdown.z)>0&&Math.abs(touchdown.z)<=.24);
  assert.ok(Math.abs(touchdown.pitch)<=.004&&Math.abs(touchdown.roll)<=.0025);
  assert.deepEqual(feedback.sample(10.04,{motion:false}),{z:0,pitch:0,roll:0});
  assert.deepEqual(feedback.sample(10.04,{active:false}),{z:0,pitch:0,roll:0});
  feedback.trigger('liftoff',10);
  assert.ok(Math.abs(feedback.sample(10.04).z)<Math.abs(touchdown.z));
  assert.deepEqual(feedback.sample(11),{z:0,pitch:0,roll:0});
  feedback.trigger('touchdown',20);feedback.reset();
  assert.deepEqual(feedback.sample(20.1),{z:0,pitch:0,roll:0});
});

test('game loop announces liftoff just once and does not repeat it during the climb or pause',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8'),events=[],noop=()=>{};
  const state=initialFlight({lat:49,lon:16,altitude:103,onGround:true,model:'highWing'});
  state.speed=40;state.throttle=state.enginePower=1;
  const context=vm.createContext({state,stepFlight,resolveGroundContact,runwayTransition,input:()=>({pitch:1}),
    runwayEvent:kind=>events.push(kind),landed:noop,crash:()=>assert.fail('unexpected crash'),checkLandingSurface:noop,
    updateRace:noop,updateFlightFeedback:noop,updateCamera:noop,updateHUD:noop,requestAnimationFrame:noop,geographyGuide:null});
  vm.runInContext(`let running=true,paused=false,busy=false,lastFrame=1000,lastSurface=1000,lastHud=2000,lastTrail=0,noticeLock=Infinity,surfaceHeight=100,surfaceFlat=true,mode='demo';`+
    app.slice(app.indexOf('function tick(now){'),app.indexOf('function openDialog(')),context);
  for(let frame=1;frame<=20;frame++)vm.runInContext(`tick(${1000+frame*16})`,context);
  assert.deepEqual(events,['liftoff']);
  vm.runInContext('paused=true;tick(1500)',context);
  assert.deepEqual(events,['liftoff']);
});

test('landing result waits for the camera pulse and cannot open over a restarted or ended flight',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  for(const change of ['', 'state={}', 'running=false']){
    const timers=[],results=[],noop=()=>{};
    const context=vm.createContext({missionFeedback:()=>({score:95}),surfaceHeight:100,isRace:()=>true,objectiveType:()=> 'landing',usesScore:()=>true,
      engineAudio:{gatePassed:noop},recordMissionResult:()=>({medal:'gold'}),currentMission:()=>({}),syncControls:noop,notice:noop,
      localStorage:{setItem:noop},showMissionResult:result=>results.push(result),setTimeout:(fn,delay)=>timers.push({fn,delay})});
    vm.runInContext(`let running=true,crashed=false,state={},raceBest=null,raceBestKey='test';const race={route:{},score:95,update:()=>[{status:'finished',index:0}]};`+
      app.slice(app.indexOf('function updateRace(){'),app.indexOf('function showMissionResult('))+'updateRace();',context);
    assert.equal(results.length,0);assert.equal(timers[0].delay,900);
    if(change)vm.runInContext(change,context);
    timers[0].fn();
    assert.equal(results.length,change?0:1);
    if(!change)assert.equal(results[0].keepRadio,true);
  }
});
