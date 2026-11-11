import test from 'node:test';
import assert from 'node:assert/strict';
import {initialFlight,stepFlight,resolveGroundContact,offsetMeters,validCoordinates,MAX_SPEED,MAX_SPEED_KMH,AIRCRAFT_PROFILES,aircraftProfile,selectFlightAircraft} from '../src/flight.js';
const start={lat:50,lon:14,altitude:600};
test('level northbound flight moves north without losing altitude',()=>{const s=initialFlight(start);for(let i=0;i<600;i++)stepFlight(s,{},1/60);assert(s.lat>50);assert(Math.abs(s.lon-14)<1e-8);assert.equal(s.altitude,600);assert(s.distance>500);});
test('right bank turns clockwise; up input climbs',()=>{const s=initialFlight(start);for(let i=0;i<120;i++)stepFlight(s,{roll:1,pitch:1},1/60);assert(s.heading>0);assert(s.roll>0);assert(s.altitude>600);});
test('long frame gaps cannot teleport aircraft',()=>{const s=initialFlight(start),speed=s.speed;stepFlight(s,{},60);assert(s.distance<=speed*.05+.1);assert(s.elapsed<=.05);});
test('throttle and geographic position stay bounded',()=>{const s=initialFlight({lat:0,lon:179.9999,heading:90});for(let i=0;i<1000;i++)stepFlight(s,{throttle:1},.05);assert.equal(s.throttle,1);assert(s.lon>=-180&&s.lon<=180);for(let i=0;i<1000;i++)stepFlight(s,{throttle:-1},.05);assert.equal(s.throttle,0);});
test('fighter full throttle reaches 900 km/h and never exceeds the speed limit',()=>{const s=initialFlight({...start,model:'fighter'});for(let i=0;i<90*60;i++)stepFlight(s,{throttle:1},1/60);assert(s.speed>=MAX_SPEED-.2);assert.equal(MAX_SPEED*3.6,MAX_SPEED_KMH);assert(s.speed<=MAX_SPEED);});
test('coordinate validation rejects empty numeric conversions and non-finite values',()=>{assert(validCoordinates(50,14));for(const pair of[[NaN,14],[Infinity,14],[81,0],[0,181]])assert(!validCoordinates(...pair));});
test('radar distance crosses dateline correctly',()=>{const p=offsetMeters(0,-179.999,{lat:0,lon:179.999});assert(Math.abs(p.x-222.64)<1);});
test('gentle landing becomes ground roll and allows another takeoff',()=>{const s=initialFlight({...start,altitude:103});s.speed=45;s.verticalSpeed=-2;s.pitch=-3*Math.PI/180;assert.equal(resolveGroundContact(s,100,true),'landed');assert.equal(s.altitude,103);for(let i=0;i<1500;i++)stepFlight(s,{throttle:-1},1/60);assert(s.speed<1);assert(s.onGround);for(let i=0;i<1500;i++)stepFlight(s,{throttle:1},1/60);assert(s.speed>=28);stepFlight(s,{pitch:1},1/60);assert.equal(s.onGround,false);assert(s.altitude>103);});
test('steep, fast, banked, or uneven contact remains a crash',()=>{for(const change of[{speed:65},{verticalSpeed:-7},{roll:.3},{pitch:.3}]){const s=Object.assign(initialFlight({...start,altitude:103}),{speed:45,verticalSpeed:-2},change);assert.equal(resolveGroundContact(s,100,true),'crash');}const s=Object.assign(initialFlight({...start,altitude:103}),{speed:45,verticalSpeed:-2});assert.equal(resolveGroundContact(s,100,false),'crash');});

test('every aircraft starts above stall speed and reaches its own speed ceiling',()=>{
  for(const [model,p] of Object.entries(AIRCRAFT_PROFILES)){
    const s=initialFlight({...start,model});
    assert(s.speed>p.stallSpeed,model);
    for(let i=0;i<3600;i++)stepFlight(s,{throttle:1},.05);
    assert(s.speed<=p.maxSpeed,model);
    assert(s.speed>p.maxSpeed-.2,model);
    assert(s.speed<=MAX_SPEED,model);
  }
});

test('fighter responds faster than Citation, light aircraft and Boeing',()=>{
  const states=Object.keys(AIRCRAFT_PROFILES).map(model=>initialFlight({...start,model}));
  for(let i=0;i<60;i++)for(const s of states)stepFlight(s,{roll:1,pitch:1},1/60);
  const [light,citation,boeing,fighter]=states;
  assert(fighter.roll>citation.roll&&citation.roll>light.roll&&light.roll>boeing.roll);
  assert(fighter.pitch>citation.pitch&&citation.pitch>light.pitch&&light.pitch>boeing.pitch);
  const boeingRate=boeing.pitchVelocity,fighterRate=fighter.pitchVelocity;
  for(let i=0;i<60;i++)for(const s of states)stepFlight(s,{},1/60);
  assert(boeing.pitchVelocity/boeingRate>fighter.pitchVelocity/fighterRate);
});

test('Boeing has slower engine response and acceleration than Citation and fighter',()=>{
  const states=['airliner','lowWing','fighter'].map(model=>Object.assign(initialFlight({...start,model}),{speed:120,throttle:1,enginePower:.5}));
  for(let i=0;i<180;i++)for(const s of states)stepFlight(s,{},1/60);
  const [boeing,citation,fighter]=states;
  assert(boeing.enginePower<citation.enginePower&&citation.enginePower<fighter.enginePower);
  assert(boeing.speed<citation.speed&&citation.speed<fighter.speed);
});

test('all profiles can land, stop and take off at their own required speeds',()=>{
  for(const [model,p] of Object.entries(AIRCRAFT_PROFILES)){
    const s=Object.assign(initialFlight({...start,model,altitude:103}),{speed:(p.landingMin+p.landingMax)/2,verticalSpeed:-2});
    assert.equal(resolveGroundContact(s,100,true),'landed',model);
    for(let i=0;i<2400;i++)stepFlight(s,{throttle:-1},.05);
    assert(s.speed<.1&&s.onGround,model);
    for(let i=0;i<2400&&s.onGround;i++)stepFlight(s,{throttle:1,pitch:1},.05);
    assert(!s.onGround&&s.speed>=p.takeoffSpeed&&s.altitude>103,model);
    for(const speed of [p.landingMin-1,p.landingMax+1]){
      const unsafe=Object.assign(initialFlight({...start,model,altitude:103}),{speed,verticalSpeed:-2});
      assert.equal(resolveGroundContact(unsafe,100,true),'crash',model);
    }
  }
});

test('switching aircraft preserves the flight and restart uses the selected profile',()=>{
  const s=Object.assign(initialFlight({...start,model:'fighter'}),{speed:200,elapsed:10,distance:1500});
  selectFlightAircraft(s,'highWing');
  assert.equal(s.lat,start.lat);assert.equal(s.lon,start.lon);assert.equal(s.altitude,start.altitude);
  assert.equal(s.elapsed,10);assert.equal(s.distance,1500);assert.equal(s.speed,aircraftProfile('highWing').maxSpeed);
  const restarted=initialFlight({...start,model:s.model});
  assert.equal(restarted.model,'highWing');assert.equal(restarted.speed,aircraftProfile('highWing').cruiseSpeed);
  assert.equal(aircraftProfile('__proto__'),AIRCRAFT_PROFILES.lowWing);
});

test('a failed right engine reduces power, shakes the aircraft, and yaws right until corrected',()=>{
  const healthy=initialFlight(start),failed={...healthy,engineFailure:'right'};
  const corrected={...failed};
  let peakBank=0;
  for(let i=0;i<300;i++){
    stepFlight(healthy,{},1/60);
    stepFlight(failed,{},1/60);
    stepFlight(corrected,{roll:-.25},1/60);
    peakBank=Math.max(peakBank,Math.abs(failed.roll));
  }
  assert.ok(failed.enginePower<healthy.enginePower*.65&&failed.speed<healthy.speed);
  assert.ok(failed.heading>.05&&failed.lon>healthy.lon);
  assert.ok(peakBank>.01);
  const angle=Math.atan2(Math.sin(corrected.heading),Math.cos(corrected.heading));
  assert.ok(angle<failed.heading);
  assert.equal(initialFlight(start).engineFailure,undefined);
});

test('mission gusts change the flight path and attitude independently of camera effects',()=>{
  const calm=initialFlight({...start,model:'highWing'});
  const windy=initialFlight({...start,model:'highWing',gustStrength:1,wind:{north:0,east:8}});
  let peakBank=0;
  for(let i=0;i<300;i++){
    stepFlight(calm,{},1/60);stepFlight(windy,{},1/60);
    peakBank=Math.max(peakBank,Math.abs(windy.roll));
  }
  assert.ok(peakBank>.10);
  assert.ok(offsetMeters(windy.lat,windy.lon,calm).x>25);
  assert.ok(Math.abs(windy.altitude-calm.altitude)>.1);
});
