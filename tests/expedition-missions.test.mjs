import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EXPEDITION_MISSIONS} from '../src/expedition-missions.js';
import {EXPEDITION_AIRPORTS} from '../src/expedition-data.js';
import {MISSIONS,getMission,missionStart} from '../src/missions.js';
import {BrnoRace,gateFrame} from '../src/brno-race.js';
import {resolveRouteSurface,routeSurfacePoints} from '../src/mission-difficulty.js';
import {missionProgress,recordMissionCompletion,recordMissionResult,BRNO_MISSION_IDS} from '../src/mission-progression.js';
import {missionRecordKey} from '../src/mission-performance.js';
import {missionRadioLine} from '../src/mission-radio.js';
import {RAD,EARTH,aircraftProfile,resolveGroundContact} from '../src/flight.js';
import {landingOffset} from '../src/mission-objectives.js';

const flat=route=>resolveRouteSurface(route,routeSurfacePoints(route).map(()=>280));
function storage(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),key:i=>[...values.keys()][i],get length(){return values.size;}};}
function stateAt(route,index,along,elapsed,model='highWing'){
  const {center,normal}=gateFrame(index,route),anchor=route.gates[0];
  return {lat:anchor.lat+(center.y+normal.y*along)/EARTH/RAD,lon:anchor.lon+(center.x+normal.x*along)/(EARTH*Math.cos(anchor.lat*RAD))/RAD,
    altitude:route.gates[index].altitude,elapsed,model,heading:(route.objective.heading??0)*RAD,speed:aircraftProfile(model).landingMin+1,verticalSpeed:-1,pitch:0,roll:0,onGround:false};
}
test('twelve world expeditions have local destination photographs, attribution and saved career rewards',()=>{
  assert.equal(EXPEDITION_MISSIONS.length,12);assert.equal(MISSIONS.length,35);
  const store=storage();
  assert.ok(EXPEDITION_MISSIONS.every(m=>!missionProgress(store).unlocked.has(m.id)));
  for(const id of BRNO_MISSION_IDS)recordMissionCompletion(id,store);
  for(const mission of EXPEDITION_MISSIONS){
    assert.ok(missionProgress(store).unlocked.has(mission.id));
    assert.ok(fs.existsSync(new URL('../src'+mission.location.image,import.meta.url)));
    assert.ok(mission.location.credit);assert.ok(mission.location.license);assert.match(mission.location.source,/commons.wikimedia.org\/wiki\/File:/);
    assert.doesNotMatch(mission.location.photoFile,/logo|\.svg$/i);
    assert.ok(mission.recommended);assert.ok(Number.isFinite(missionStart(mission).lat));
    assert.equal(recordMissionResult(mission,'highWing',mission.route.objective.type==='time'?1:100,store).bestMedal,'gold');
  }
  assert.equal(MISSIONS.length,new Set(MISSIONS.map(m=>m.id)).size);
});

test('eight real airport arrivals complete approach, physical touchdown and any required rollout for every aircraft',()=>{
  for(const id of Object.keys(EXPEDITION_AIRPORTS))for(const model of ['highWing','lowWing','airliner','fighter']){
    const mission=getMission(id,'easy',model),route=flat(mission.route),race=new BrnoRace(route);
    let time=0;race.update(stateAt(route,0,-100,time,model));
    for(let index=0;index<route.gates.length-1;index++){
      race.update(stateAt(route,index,-50,++time,model));race.update(stateAt(route,index,50,++time,model));
      assert.equal(race.next,index+1,id+' '+model);
    }
    assert.equal(race.status,'landing');
    const air={...stateAt(route,4,0,++time,model),altitude:283.1};race.update(air);
    assert.equal(race.status,'landing','airborne overflight is insufficient');
    const ground={...air,altitude:282.9,elapsed:++time};
    assert.equal(resolveGroundContact(ground,280,true),'landed');race.update(ground);
    if(route.objective.stop){
      assert.equal(race.status,'rollout');race.update({...ground,elapsed:++time,speed:0});
    }
    assert.equal(race.status,'finished',id+' '+model);assert.ok(race.score>=80);
    const {airport,objective}=route;
    assert.ok(objective.halfWidth<airport.width/2);
    const target=landingOffset(route,route.gates.at(-1),airport.threshold);
    assert.ok(target.along-objective.halfLength>0);
    assert.ok(target.along+objective.halfLength<airport.length-airport.displaced);
    assert.ok(missionRadioLine(mission).text.includes('runway'));
  }
});

test('aircraft get distinct approach geometry and records without mutating the trainer route',()=>{
  for(const id of Object.keys(EXPEDITION_AIRPORTS)){
    const trainer=getMission(id,'easy','highWing'),airliner=getMission(id,'easy','airliner');
    assert.notDeepEqual(trainer.route.gates[0],airliner.route.gates[0]);
    assert.ok(airliner.route.gates[0].clearance>trainer.route.gates[0].clearance);
    assert.ok(airliner.route.gates[0].radius>trainer.route.gates[0].radius);
    assert.deepEqual(trainer.route.gates.at(-1),airliner.route.gates.at(-1),'all aircraft still land on the physical runway');
    assert.notEqual(missionRecordKey(trainer,'highWing','day','clear'),missionRecordKey(airliner,'airliner','day','clear'));
    assert.equal(getMission(id).route,trainer.route);
  }
  assert.match(missionRadioLine(getMission('sfo-arrival')).text,/two eight right/);
  assert.match(missionRadioLine(getMission('kansai')).text,/zero six right/);
});

test('scenic expeditions complete in order and precision patrols score actual height and corridor',()=>{
  for(const mission of EXPEDITION_MISSIONS.filter(m=>!m.aircraftRoutes)){
    const route=flat(mission.route),race=new BrnoRace(route);let time=0;
    race.update(stateAt(route,0,-50,time));
    for(let index=0;index<route.gates.length;index++){
      race.update(stateAt(route,index,-50,++time),280);race.update(stateAt(route,index,50,++time),280);
      assert.equal(race.next,index+1,mission.id);
    }
    assert.equal(race.status,'finished');
    if(route.objective.type==='lowflight')assert.equal(race.score,100);
  }
});
