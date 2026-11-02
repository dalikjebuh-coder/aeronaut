import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {flightFeedback,createTurbulence} from '../src/flight-feedback.js';
import {AIRCRAFT_PROFILES,initialFlight,stepFlight,RAD} from '../src/flight.js';

test('straight flight is steady at every speed; abrupt maneuvers produce bounded vibration',()=>{
  for(const [model,profile] of Object.entries(AIRCRAFT_PROFILES)){
    const state={...initialFlight({lat:49,lon:16,model}),elapsed:2.37,speed:profile.maxSpeed};
    for(const speed of [profile.cruiseSpeed,profile.maxSpeed]){
      const result=flightFeedback({...state,speed});assert.ok([result.heading,result.pitch,result.roll].every(value=>value===0));
    }
    stepFlight(state,{roll:1,pitch:1},.05);
    const high=flightFeedback(state);assert.ok(high.maneuver>0,model);assert.ok(Math.abs(high.pitch)>0);assert.ok(Math.abs(high.pitch)<.005);
    for(const options of [{motion:false,turbulence:1},{active:false,turbulence:1}]){
      const result=flightFeedback(state,options);assert.ok([result.heading,result.pitch,result.roll].every(value=>value===0));
    }
    const grounded=flightFeedback({...state,onGround:true},{turbulence:1});
    assert.ok([grounded.heading,grounded.pitch,grounded.roll].every(value=>value===0));
  }
});
test('gentle banking and climbing do not shake the camera; gusts shake even at normal cruise',()=>{
  const state={...initialFlight({lat:49,lon:16}),elapsed:2.37,roll:20*RAD,rollVelocity:5*RAD,pitchVelocity:1*RAD};
  const gentle=flightFeedback(state);assert.equal(gentle.maneuver,0);assert.equal(gentle.roll,0);
  const gust=flightFeedback(state,{turbulence:.6});assert.equal(gust.maneuver,0);assert.ok(Math.abs(gust.roll)>0&&Math.abs(gust.pitch)>0);
});

test('maneuver banners ignore turns and gentle vertical flight but detect steep climbs and descents for every aircraft',()=>{
  for(const [model,profile] of Object.entries(AIRCRAFT_PROFILES)){
    const state={...initialFlight({lat:49,lon:16,model}),roll:profile.maxBank*RAD,rollVelocity:2};
    assert.equal(flightFeedback(state).maneuverWarning,'',model);
    assert.equal(flightFeedback({...state,pitch:8*RAD,verticalSpeed:10}).maneuverWarning,'',model);
    assert.equal(flightFeedback({...state,pitch:-8*RAD,verticalSpeed:-10}).maneuverWarning,'',model);
    const climb={...state,pitch:profile.pitchUp*.9*RAD,verticalSpeed:20};
    const descent={...state,pitch:-profile.pitchDown*.9*RAD,verticalSpeed:-20};
    assert.equal(flightFeedback(climb).maneuverWarning,'climb',model);
    assert.equal(flightFeedback(descent).maneuverWarning,'descent',model);
    assert.equal(flightFeedback(climb,{motion:false}).maneuverWarning,'climb');
    assert.equal(flightFeedback(climb,{active:false}).maneuverWarning,'');
  }
});

test('runway acceleration and low takeoff trigger the banner, but taxiing, braking and normal flight do not',()=>{
  for(const [model,profile] of Object.entries(AIRCRAFT_PROFILES)){
    const state={...initialFlight({lat:49,lon:16,model}),onGround:true,enginePower:1,speed:profile.takeoffSpeed*.4};
    assert.equal(flightFeedback(state).maneuverWarning,'acceleration',model);
    assert.equal(flightFeedback({...state,enginePower:.4}).maneuverWarning,'');
    assert.equal(flightFeedback({...state,speed:profile.takeoffSpeed*1.4}).maneuverWarning,'');
    assert.equal(flightFeedback(state,{active:false}).maneuverWarning,'');
    const takeoff={...state,onGround:false,altitude:210,speed:profile.takeoffSpeed,pitch:8*RAD,verticalSpeed:profile.takeoffSpeed*Math.sin(8*RAD)};
    assert.equal(flightFeedback(takeoff,{ground:200}).maneuverWarning,'takeoff',model);
    assert.equal(flightFeedback({...takeoff,altitude:600},{ground:200}).maneuverWarning,'');
    assert.equal(flightFeedback({...takeoff,pitch:0,verticalSpeed:0},{ground:200}).maneuverWarning,'');
    assert.equal(flightFeedback(takeoff,{ground:200,active:false}).maneuverWarning,'');
  }
});

test('turbulence has quiet intervals, eases in and out, and is not redrawn randomly per frame',()=>{
  let rolls=0;
  const turbulence=createTurbulence({random:()=>{rolls++;return 0;}}),state=initialFlight({lat:49,lon:16});
  const at=time=>turbulence.update({...state,elapsed:time},{weather:'clear',ground:0});
  assert.equal(at(0).active,false);assert.equal(at(59.9).active,false);assert.equal(rolls,1);
  assert.equal(at(60).started,true);assert.equal(at(60).started,false);
  const early=at(60.1),middle=at(61.5),late=at(63.9);
  assert.ok(early.intensity<middle.intensity&&late.intensity<middle.intensity);
  assert.equal(rolls,3);assert.equal(at(64).active,false);assert.equal(at(100).active,false);
  assert.equal(at(124).started,true);
});

test('gusts respect pause, ground contact, final approach and flight restart',()=>{
  const state=initialFlight({lat:49,lon:16}),turbulence=createTurbulence({random:()=>0});
  const update=(elapsed,extra={},options={})=>turbulence.update({...state,elapsed,...extra},{weather:'overcast',ground:0,...options});
  assert.equal(update(0).active,false);assert.equal(update(25).active,true);
  const before=update(25.5).intensity;
  assert.equal(update(25.5,{}, {active:false}).intensity,0);
  assert.equal(update(25.5).intensity,before);
  assert.equal(update(26,{altitude:50}).active,false);
  assert.equal(update(27).active,false);
  assert.equal(update(60,{onGround:true}).active,false);
  assert.equal(update(61).active,false);
  turbulence.reset();assert.equal(update(0).active,false);assert.equal(update(25).started,true);
  assert.equal(update(0).active,false,'rolling back simulation time also starts a new calm period');
});

test('turbulence is explained in the information panel alongside safety warnings',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8'),elements=new Map();
  const $=id=>{if(!elements.has(id))elements.set(id,{hidden:true,dataset:{},textContent:'',value:'overcast'});return elements.get(id);};
  $('notice').textContent='Pokyny k přistání';let beeps=0;
  const context=vm.createContext({$,flightFeedback,turbulence:createTurbulence({random:()=>0}),engineAudio:{stallWarning:()=>beeps++},initialFlight});
  vm.runInContext(`let running=true,paused=false,crashed=false,busy=false,cameraMotion=true,surfaceHeight=0,lastStallBeep=-Infinity,turbulenceFeedback;const state=initialFlight({lat:49,lon:16});`+
    app.slice(app.indexOf('function updateFlightFeedback(){'),app.indexOf('function input(){')),context);
  vm.runInContext('state.speed=100;state.rollVelocity=2;updateFlightFeedback()',context);
  assert.ok(vm.runInContext('flightFeedback(state).maneuver>0',context));
  assert.equal($('flightWarning').hidden,true,'turning must not show a maneuver warning');
  assert.equal($('flightWarning').textContent,'');
  vm.runInContext('state.pitch=.6;state.verticalSpeed=30;updateFlightFeedback()',context);
  assert.match($('flightWarning').textContent,/PRUDKÝ MANÉVR.*stoupání/);
  assert.equal($('flightWarning').dataset.level,'maneuver');
  vm.runInContext('state.pitch=0;state.verticalSpeed=0;state.rollVelocity=0;state.elapsed=25;updateFlightFeedback()',context);
  assert.match($('flightWarning').textContent,/TURBULENCE/);assert.equal($('flightWarning').hidden,false);
  assert.equal($('flightWarning').dataset.level,'turbulence');assert.equal($('notice').textContent,'Pokyny k přistání');
  vm.runInContext('state.speed=10;state.elapsed=25.5;updateFlightFeedback()',context);
  assert.match($('flightWarning').textContent,/PÁDOVÁ RYCHLOST.*\nTURBULENCE/);assert.equal(beeps,1);
  vm.runInContext('paused=true;updateFlightFeedback()',context);assert.equal($('flightWarning').hidden,true);
});
test('stall and low speed warnings respect aircraft profile, bank load, pause and ground contact',()=>{
  for(const [model,profile] of Object.entries(AIRCRAFT_PROFILES)){
    const state=initialFlight({lat:49,lon:16,model});
    assert.equal(flightFeedback({...state,speed:profile.stallSpeed*.95}).warning,'stall');
    assert.equal(flightFeedback({...state,speed:profile.stallSpeed*1.05}).warning,'slow');
    assert.equal(flightFeedback({...state,speed:profile.stallSpeed*1.2}).warning,'');
    assert.equal(flightFeedback({...state,speed:profile.stallSpeed*1.05,roll:Math.PI/3}).warning,'stall');
    assert.equal(flightFeedback({...state,speed:0},{active:false}).warning,'');
    assert.equal(flightFeedback({...state,speed:0,onGround:true}).warning,'');
  }
});
