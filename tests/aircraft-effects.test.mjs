import test from 'node:test';
import assert from 'node:assert/strict';
import {aircraftEffectLevels,WakeHistory} from '../src/aircraft-effects.js';
import {initialFlight,RAD} from '../src/flight.js';

test('wing vapor reacts to bank and pull-up, never to level flight or ground roll',()=>{
  for(const model of ['highWing','lowWing','airliner','fighter']){
    const s=initialFlight({lat:49,lon:16,model});
    assert.equal(aircraftEffectLevels(s).vapor,0,model);
    s.roll=45*RAD;assert(aircraftEffectLevels(s).vapor>.1,model);
    s.roll=0;s.pitchVelocity=.3;assert(aircraftEffectLevels(s).vapor>.1,model);
    s.onGround=true;assert.equal(aircraftEffectLevels(s).vapor,0,model);
  }
});

test('afterburner is restricted to the fighter at high engine power',()=>{
  for(const model of ['highWing','lowWing','airliner','fighter']){
    const s=Object.assign(initialFlight({lat:49,lon:16,model}),{enginePower:1});
    assert.equal(aircraftEffectLevels(s).afterburner,model==='fighter'?1:0,model);
    s.enginePower=.8;assert.equal(aircraftEffectLevels(s).afterburner,0,model);
    if(model==='highWing')assert.equal(aircraftEffectLevels(s).exhaust,0);
  }
});

test('long engine contrails require high altitude and a fast jet',()=>{
  const jet=Object.assign(initialFlight({lat:49,lon:16,model:'airliner'}),{enginePower:1});
  assert.equal(aircraftEffectLevels(jet).contrail,0);
  jet.altitude=10000;assert(aircraftEffectLevels(jet).contrail>.9);
  jet.onGround=true;assert.equal(aircraftEffectLevels(jet).contrail,0);
  const prop=initialFlight({lat:49,lon:16,altitude:10000,model:'highWing'});
  assert.equal(aircraftEffectLevels(prop).contrail,0);assert(aircraftEffectLevels(prop).propellerRPM>0);
});

test('wake history freezes with simulation time, expires, stays bounded and resets',()=>{
  const wake=new WakeHistory(2,32,.04);
  for(let frame=0;frame<3600;frame++)wake.emit(frame/60,{point:[0,frame,0]});
  assert(wake.samples.length<=32&&wake.samples.length>10);
  const saved=JSON.stringify(wake.samples),time=3599/60;
  for(let frame=0;frame<600;frame++){wake.trim(time);wake.emit(time,{point:[1,2,3]});}
  assert.equal(JSON.stringify(wake.samples),saved);
  wake.trim(time+3);assert.equal(wake.samples.length,0);
  wake.reset();wake.emit(0,{point:[0,0,0]});assert.equal(wake.samples.length,1);
});
