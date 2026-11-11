import test from 'node:test';
import assert from 'node:assert/strict';
import {getMission,getPlayableMission,missionStart} from '../src/missions.js';
import {TASK_MISSIONS,objectiveType,usesScore,missionBrief,discoveryMessage} from '../src/task-missions.js';
import {routeSurfacePoints,resolveRouteSurface} from '../src/mission-difficulty.js';
import {BrnoRace,gateFrame} from '../src/brno-race.js';
import {landingResult,lowFlightValid,discoveryCone,inDiscoveryArea} from '../src/mission-objectives.js';
import {RAD,EARTH,resolveGroundContact,aircraftProfile} from '../src/flight.js';

const levels=['easy','normal','hard'];
const prepared=(id,level)=>{const mission=getMission(id,level),route=resolveRouteSurface(mission.route,routeSurfacePoints(mission.route).map(()=>277));return{mission,route};};

test('passing all gates is insufficient when the scored portion falls below the mission minimum',()=>{
  const {route:source}=getPlayableMission('canyon-patrol','highWing');
  const route=resolveRouteSurface(source,routeSurfacePoints(source).map(()=>277));
  for(const [surface,status] of [[277,'finished'],[0,'failed']]){
    const race=new BrnoRace(route);let elapsed=0,events;
    for(let index=0;index<route.gates.length;index++){
      race.update(point(route,index,-30,elapsed+=.05),surface);
      events=race.update(point(route,index,30,elapsed+=.05),surface);
    }
    assert.equal(race.status,status);
    assert.equal(events.at(-1).status,status);
    if(status==='failed')assert.match(race.taskHint,/55 %/);
  }
});
function point(route,index,along,elapsed){
  const {center,normal}=gateFrame(index,route),anchor=route.gates[0];
  return{lat:anchor.lat+(center.y+normal.y*along)/EARTH/RAD,lon:anchor.lon+(center.x+normal.x*along)/(EARTH*Math.cos(anchor.lat*RAD))/RAD,altitude:route.gates[index].altitude,elapsed,model:'highWing',speed:35,heading:98*RAD,verticalSpeed:-1,roll:0,pitch:0,onGround:false};
}
function approach(route){
  const race=new BrnoRace(route);let elapsed=0;
  race.update({...missionStart({route,location:{name:'Test'},title:'Test'}),elapsed});
  for(let index=0;index<4;index++){
    race.update(point(route,index,-50,elapsed+=.05));race.update(point(route,index,50,elapsed+=.05));
  }
  return{race,elapsed};
}
test('three task types have independent ids, descriptions, recommended aircraft and three playable variants',()=>{
  const ids=new Set();
  for(const base of TASK_MISSIONS)for(const level of levels){
    const {mission,route}=prepared(base.id,level);ids.add(route.id);
    assert.equal(mission.level,level);assert.equal(route.gates.length,5);assert.ok(mission.recommended);
    assert.ok(missionBrief(route).length>60);assert.notEqual(objectiveType(route),'time');
    assert.equal(usesScore(route),objectiveType(route)!=='sightseeing');
    assert.ok(route.gates.every(gate=>Number.isFinite(gate.altitude)));assert.ok(missionStart({...mission,route}).altitude>277);
  }
  assert.equal(ids.size,9);
});
test('discovery needs one flyover at any speed, ignores pause and taxiing, and completes every difficulty',()=>{
  for(const level of levels){
    const {route}=prepared('brno-discovery',level),race=new BrnoRace(route);let elapsed=0;
    const state={...route.gates[0],elapsed,model:'fighter',onGround:false,speed:250};
    race.update({...state,lat:state.lat-.02});
    assert.deepEqual(race.update(state),[]);assert.equal(race.next,0,'paused time cannot collect a place');
    race.update({...state,onGround:true,elapsed:elapsed+=.05});assert.equal(race.next,0);
    for(let index=0;index<5;index++){
      const events=race.update({...route.gates[index],speed:250,onGround:false,elapsed:elapsed+=.05});
      assert.equal(race.next,index+1,level+' '+index);assert.equal(events.length,1);
      assert.equal(events[0].status,index===4?'finished':'discovered');
    }
    assert.equal(race.status,'finished');race.reset();assert.equal(race.next,0);
    assert.doesNotMatch(missionBrief(route),/vydrž|pod \d+ km/);
  }
});
test('fast passes through a cone count between samples, while distant teleports and wrong heights do not',()=>{
  const {route}=prepared('brno-discovery','easy'),gate=route.gates[0],cone=discoveryCone(route,gate);
  const at=(east,altitude,time)=>({...gate,lon:gate.lon+east/EARTH/Math.cos(gate.lat*RAD)/RAD,altitude,elapsed:time,speed:250,onGround:false});
  const before=at(-550,gate.altitude,0),after=at(550,gate.altitude,5);
  assert.equal(inDiscoveryArea(route,0,before),false);assert.equal(inDiscoveryArea(route,0,after),false);
  assert.equal(inDiscoveryArea(route,0,after,before),true);
  assert.equal(inDiscoveryArea(route,0,{...after,elapsed:.05},before),false);
  assert.equal(inDiscoveryArea(route,0,at(0,cone.surface+cone.height+1,1)),false);
  assert.equal(inDiscoveryArea(route,0,at(0,cone.surface+cone.minHeight-1,1)),false);
  const race=new BrnoRace(route);race.update(before);assert.equal(race.update(after)[0].status,'discovered');assert.equal(race.next,1);
});
test('discovery messages confirm collection and give the next concrete action',()=>{
  const {route}=prepared('brno-discovery','easy');
  const message=discoveryMessage(route,0,{isNew:true,saved:true});
  assert.match(message,/Uloženo do sbírky: Petrov/);assert.match(message,/1 \/ 5/);assert.match(message,/Další: Špilberk/);assert.match(message,/žlutým kuželem/);
  assert.match(discoveryMessage(route,0,{isNew:false,saved:true}),/Už ve sbírce/);
  assert.match(discoveryMessage(route,4,{isNew:true,saved:true}),/Mise splněna/);
  assert.match(discoveryMessage(route,0,{saved:false}),/nepovolil trvalé uložení/);
});
test('landing waits after approach gates, rejects flying through the goal, then finishes on a valid physical touchdown',()=>{
  for(const level of levels){
    const {route}=prepared('brno-landing',level),{race,elapsed}=approach(route);
    assert.equal(race.status,'landing');assert.equal(race.next,4);assert.equal(route.gates[4].altitude,280);
    const target={...point(route,4,0,elapsed+.05),altitude:280.1,verticalSpeed:-1};race.update(target);
    assert.equal(race.status,'landing');
    const touchdown={...target,elapsed:elapsed+.1,altitude:279.9};
    assert.equal(resolveGroundContact(touchdown,277,true),'landed');
    const events=race.update(touchdown);assert.equal(events[0].status,'finished');assert.ok(race.score>=80);assert.equal(race.next,5);
    assert.equal(race.target(touchdown),null);
  }
});
test('landing cannot be completed before approach, by taxiing into target or by touching down sideways/outside the zone',()=>{
  const {route}=prepared('brno-landing','hard'),target=point(route,4,0,1),ground={...target,onGround:true};
  const race=new BrnoRace(route);race.update({...target,elapsed:0});race.update(ground);assert.notEqual(race.status,'finished');
  assert.equal(landingResult(route,ground,ground),null);
  assert.equal(landingResult(route,target,{...ground,heading:0}),null);
  assert.equal(landingResult(route,target,{...ground,lat:ground.lat+.01}),null);
  const centered=landingResult(route,target,ground);
  assert.ok(centered>landingResult(route,{...target,verticalSpeed:-aircraftProfile('highWing').landingSink},ground));
});
test('low flight judges actual height and route corridor; pause and missing terrain never award points',()=>{
  const {route}=prepared('canyon-patrol','easy'),state={...point(route,0,0,0),altitude:447};
  assert.equal(lowFlightValid(route,state,277),true);
  assert.equal(lowFlightValid(route,{...state,altitude:900},277),false);
  assert.equal(lowFlightValid(route,{...state,lat:state.lat+.1},277),false);
  assert.equal(lowFlightValid(route,state,undefined),false);
  const race=new BrnoRace(route);race.status='racing';race.startedAt=0;race.next=1;race.previous=state;
  race.update({...state,elapsed:.05},277);assert.equal(race.score,100);
  race.update({...state,elapsed:.05},277);assert.equal(race.judgedSeconds,.05);
  race.update({...state,elapsed:.1},undefined);assert.equal(race.score,50);
  race.reset();assert.equal(race.score,0);assert.equal(race.judgedSeconds,0);
});
test('every low flight variant completes in order with a stable score after finish',()=>{
  for(const level of levels){
    const {route}=prepared('canyon-patrol',level),race=new BrnoRace(route);let elapsed=0;
    for(let index=0;index<5;index++){
      race.update(point(route,index,-50,elapsed+=.05),277);race.update(point(route,index,50,elapsed+=.05),277);
      assert.equal(race.next,index+1);
    }
    assert.equal(race.status,'finished');assert.equal(race.score,100);
    race.update({...point(route,4,0,elapsed+1),altitude:900},undefined);assert.equal(race.score,100);
  }
});
