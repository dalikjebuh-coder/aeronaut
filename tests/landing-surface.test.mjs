import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {landingSurfaceFlat} from '../src/landing-surface.js';
import {runwayTransition} from '../src/runway-feedback.js';
import {AIRCRAFT_PROFILES,RAD,initialFlight,offsetMeters,resolveGroundContact,stepFlight,landingFailureReason} from '../src/flight.js';

const origin={lat:49.15,lon:16.69};
const terrain=fn=>(lat,lon)=>{const {x,y}=offsetMeters(lat,lon,origin);return fn(x,y);};

test('all aircraft can touch down on a gently sloping runway with small map errors',()=>{
  const sample=terrain((x,y)=>100+x*.01+y*.015+.3*Math.sin(x));
  for(const [model,profile] of Object.entries(AIRCRAFT_PROFILES)){
    for(const heading of [0,37,98,220]){
      const state=Object.assign(initialFlight({...origin,model,heading,altitude:103.15}),{speed:(profile.landingMin+profile.landingMax)/2,pitch:-2*RAD});
      state.enginePower=state.throttle=Math.pow((state.speed-profile.idleSpeed)/(profile.maxSpeed-profile.idleSpeed),2/3);
      let contact;
      for(let i=0;i<100&&!state.onGround;i++){
        stepFlight(state,{},.05);
        const ground=sample(state.lat,state.lon);
        contact=resolveGroundContact(state,ground,landingSurfaceFlat(state,ground,sample));
        assert.notEqual(contact,'crash',`${model}, heading ${heading}`);
      }
      assert.equal(contact,'landed',`${model}, heading ${heading}`);
    }
  }
});

test('Boeing wheels can use a runway even when samples at the wingtips would fall off it',()=>{
  const heading=98*RAD,state={...origin,heading,model:'airliner'};
  const sample=terrain((x,y)=>Math.abs(x*Math.cos(heading)-y*Math.sin(heading))<20?100:95);
  assert.equal(landingSurfaceFlat(state,100,sample),true);
});

test('a missing neighbouring map sample defers contact until the surface is known',()=>{
  const state=Object.assign(initialFlight({...origin,altitude:103}),{speed:45,verticalSpeed:-2});
  const flat=landingSurfaceFlat(state,100,()=>undefined);
  assert.equal(flat,undefined);
  assert.equal(resolveGroundContact(state,100,flat),'unknown');
  assert.equal(state.onGround,false);
  assert.equal(resolveGroundContact(state,100,landingSurfaceFlat(state,100,()=>100)),'landed');
});

test('steep slopes, ledges and hard touchdowns still fail',()=>{
  const state=Object.assign(initialFlight({...origin,altitude:103}),{speed:45,verticalSpeed:-2});
  for(const sample of [terrain((x,y)=>100+y*.4),terrain((x,y)=>x>2?110:100)]){
    assert.equal(landingSurfaceFlat(state,100,sample),false);
    assert.equal(resolveGroundContact({...state},100,false),'crash');
  }
  assert.equal(resolveGroundContact({...state,verticalSpeed:-8},100,true),'crash');
  assert.match(landingFailureReason({...state,verticalSpeed:-8},true),/klesání/);
  assert.match(landingFailureReason({...state,speed:100},true),/vysoká rychlost/);
});

test('application surface queries exclude aircraft light and trail primitives',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  const airplane={},lights={},trails={},clouds={};
  const context=vm.createContext({aircraft:{entities:{values:[airplane]},surfacePrimitives:[lights,trails]},weatherEffects:{primitives:[clouds]},geographyGuide:null,raceView:null,startMarker:null});
  vm.runInContext(app.slice(app.indexOf('function surfaceExclusions(){'),app.indexOf('function terrainSample(')),context);
  assert.deepEqual(Array.from(vm.runInContext('surfaceExclusions()',context)),[clouds,airplane,lights,trails]);
});

test('touchdown refreshes a stale surface decision even before the sampling interval expires',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  let refreshed=0,landings=0,crashes=0;const events=[];
  const noop=()=>{};
  const context=vm.createContext({stepFlight:noop,input:()=>({}),resolveGroundContact,landingFailureReason,runwayTransition,runwayEvent:kind=>events.push(kind),
    landed:()=>landings++,crash:()=>crashes++,checkLandingSurface:()=>{refreshed++;vm.runInContext('surfaceFlat=true',context);},
    updateRace:noop,updateFlightFeedback:noop,updateCamera:noop,updateHUD:noop,requestAnimationFrame:noop,geographyGuide:null,
    document:{body:{classList:{contains:()=>true}}}
  });
  vm.runInContext(`let running=true,paused=false,busy=false,crashed=false,lastFrame=1000,lastSurface=1000,lastHud=1016,lastTrail=0,noticeLock=Infinity,surfaceHeight=100,surfaceFlat=false,mode='demo';
    const state={model:'lowWing',altitude:103,speed:45,verticalSpeed:-2,pitch:0,roll:0,elapsed:0};`+
    app.slice(app.indexOf('function tick(now){'),app.indexOf('function openDialog(')),context);
  vm.runInContext('tick(1016)',context);
  assert.equal(refreshed,1);
  assert.equal(landings,1);
  assert.equal(crashes,0);
  vm.runInContext('tick(1032)',context);
  assert.deepEqual(events,['touchdown']);
});
