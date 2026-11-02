import test from 'node:test';
import assert from 'node:assert/strict';
import {BrnoRace} from '../src/brno-race.js';
import {MISSIONS,getMission,missionStart} from '../src/missions.js';
import {missionRadarState,missionBearingCue,cardinalDirection,drawMissionRadar} from '../src/mission-radar.js';
import {RAD} from '../src/flight.js';
const route={id:'radar-course',altitude:1000,radius:90,gates:[{name:'Start',lat:0,lon:0},{name:'East',lat:0,lon:.01,altitude:1100,radius:24},{name:'North',lat:.01,lon:.01,altitude:900}]};
const state={lat:0,lon:-.004,altitude:1000,heading:0,elapsed:0};

test('flight heading has an immediately readable compass direction',()=>{
  assert.equal(cardinalDirection(0),'SEVER');
  assert.equal(cardinalDirection(Math.PI/2),'VÝCHOD');
  assert.equal(cardinalDirection(7*Math.PI/4),'SEVEROZÁPAD');
  assert.equal(cardinalDirection(2*Math.PI),'SEVER');
});

test('every mission target stays visible from spawn and far off course; the aircraft remains at the centre',()=>{
  for(const base of MISSIONS)for(const level of ['easy','normal','hard']){
    const mission=getMission(base.id,level),race=new BrnoRace(mission.route),start=missionStart(mission);
    for(const aircraft of [{...start,heading:start.heading*RAD},{...start,lat:start.lat-.4,lon:start.lon+.3,heading:0}]){
      const nav=missionRadarState(race,aircraft),target=nav.gates.find(gate=>gate.active);
      assert.equal(nav.gates.length,mission.route.gates.length);assert.ok(target&&!target.outside,base.id+'/'+level);
      assert.ok(Math.hypot(target.x-nav.cx,target.y-nav.cy)<=nav.radius*.8);
      assert.ok(nav.gates.every(g=>Number.isFinite(g.x)&&Number.isFinite(g.y)&&Math.hypot(g.x-nav.cx,g.y-nav.cy)<=nav.radius+1e-6));
      assert.deepEqual(nav.project(aircraft),{x:110,y:90,rawX:110,rawY:90,outside:false});
    }
  }
});
test('auto zoom makes small courses readable and still shows the direction of distant gates',()=>{
  const race=new BrnoRace(route),close=missionRadarState(race,state),far=missionRadarState(race,{...state,lon:-.8});
  assert.ok(close.range<=2000);assert.ok(far.range>close.range);
  const veryFar=new BrnoRace({...route,gates:[route.gates[0],{name:'Far',lat:20,lon:20}]});
  const nav=missionRadarState(veryFar,state);assert.equal(nav.gates[1].outside,true);assert.ok(nav.gates[1].x>nav.cx&&nav.gates[1].y<nav.cy);
});
test('turn arrow is relative to the aircraft while the radar is north-up, including the date line',()=>{
  const race=new BrnoRace(route),north=missionRadarState(race,state),east=missionRadarState(race,{...state,heading:Math.PI/2}),south=missionRadarState(race,{...state,heading:Math.PI});
  assert.equal(north.turn,'Vpravo 90°');assert.ok(Math.abs(north.angle-Math.PI/2)<1e-8);assert.equal(east.turn,'Před tebou');assert.equal(south.turn,'Vlevo 90°');
  const across=new BrnoRace({...route,gates:[{name:'Across',lat:0,lon:-179.999},route.gates[1]]});
  const nav=missionRadarState(across,{...state,lon:179.999,heading:Math.PI/2});
  assert.equal(nav.turn,'Před tebou');assert.ok(nav.target.distance<230);assert.ok(nav.gates[0].x>nav.cx);
});
test('crossing a gate immediately changes the highlighted target and uses that gate’s own altitude',()=>{
  const race=new BrnoRace(route);race.update({...state,lon:-.001});race.update({...state,lon:.001,elapsed:1});
  const nav=missionRadarState(race,{...state,lon:.001,altitude:1000,heading:Math.PI/2});
  assert.equal(nav.next,1);assert.equal(nav.gates[0].passed,true);assert.equal(nav.gates[0].active,false);assert.equal(nav.gates[1].active,true);
  assert.equal(nav.target.name,'East');assert.equal(nav.altitudeCue,'Stoupej 100 m');
  assert.equal(missionRadarState(race,{...state,altitude:1110}).altitudeCue,'Klesej 10 m');
  assert.equal(missionRadarState(race,{...state,altitude:1105}).altitudeCue,'Výška správně');
  const cue=missionBearingCue(nav);
  assert.equal(cue.gate,'BOD 2 / 3 · East');
  assert.equal(cue.turn,'Před tebou');
  assert.match(cue.detail,/m · Stoupej 100 m$/);
});
test('finishing or crashing removes the guidance arrow and restarting restores the first gate',()=>{
  const race=new BrnoRace(route);race.next=3;race.status='finished';
  const finished=missionRadarState(race,state);assert.equal(finished.target,null);assert.equal(missionBearingCue(finished),null);assert.equal(finished.complete,true);assert.ok(finished.gates.every(g=>g.passed&&!g.active));
  race.reset();race.fail();assert.equal(missionRadarState(race,state).target,null);assert.equal(missionRadarState(race,state).failed,true);
  race.reset();assert.equal(missionRadarState(race,state).gates[0].active,true);
});
test('canvas renders numbered circles and north-up orientation without leaking transforms',()=>{
  const labels=[],arcs=[];let saves=0;
  const ctx=new Proxy({save(){saves++;},restore(){saves--;assert.ok(saves>=0);},fillText(value){labels.push(value);},arc(...args){arcs.push(args);}}, {get:(object,key)=>object[key]||(()=>{})});
  const race=new BrnoRace(getMission('giza','hard').route),nav=missionRadarState(race,{...missionStart(getMission('giza','hard')),heading:0});
  drawMissionRadar(ctx,nav,[{lat:29.97,lon:31.14}]);
  for(const label of ['N','E','W','S','1','2','3','4','5'])assert.ok(labels.includes(label));
  assert.equal(saves,0);assert.ok(arcs.every(args=>args.every(Number.isFinite)));assert.ok(arcs.some(args=>args[2]===13));
});
