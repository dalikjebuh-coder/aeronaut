import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {RUNWAY_MISSIONS} from '../src/runway-missions.js';
import {getMission,missionStart} from '../src/missions.js';
import {BrnoRace,gateFrame} from '../src/brno-race.js';
import {resolveRouteSurface,routeSurfacePoints} from '../src/mission-difficulty.js';
import {EARTH,RAD,aircraftProfile,initialFlight,stepFlight,resolveGroundContact} from '../src/flight.js';
import {gradeMission,recordMissionResult,missionProgress} from '../src/mission-progression.js';

const flat=route=>resolveRouteSurface(route,routeSurfacePoints(route).map(()=>280));
function atGate(route,index,along,elapsed){
  const {center,normal}=gateFrame(index,route),origin=route.gates[0];
  return{lat:origin.lat+(center.y+normal.y*along)/EARTH/RAD,lon:origin.lon+(center.x+normal.x*along)/(EARTH*Math.cos(origin.lat*RAD))/RAD,
    altitude:route.gates[index].altitude,elapsed,speed:35,heading:98*RAD,model:'highWing',verticalSpeed:-1,onGround:false};
}
function storage(){const values=new Map();return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),key:index=>[...values.keys()][index],get length(){return values.size;}};}

test('all eight runway missions are available, illustrated and complete through the shared result flow',()=>{
  assert.equal(RUNWAY_MISSIONS.length,8);
  const store=storage();
  for(const mission of RUNWAY_MISSIONS){
    assert.ok(missionProgress(store).unlocked.has(mission.id));
    assert.ok(fs.existsSync(new URL(`../src/images/${mission.id}-mission-v1.jpg`,import.meta.url)));
    const route=flat(getMission(mission.id).route),race=new BrnoRace(route);
    let time=0;
    race.update({...atGate(route,0,-100,time++),onGround:Boolean(route.groundStart)});
    const lastApproach=route.gates.length-(route.objective.type==='landing'?1:0);
    for(let index=0;index<lastApproach;index++){
      if(route.gates[index].kind==='touch-and-go'){
        const air=atGate(route,index,0,time++);race.update(air);
        race.update({...air,onGround:true,elapsed:time++});
        assert.equal(race.touchdowns.length,1);
        continue;
      }
      race.update(atGate(route,index,-50,time++));
      race.update(atGate(route,index,50,time++));
      assert.equal(race.next,index+1,mission.id+' gate '+index);
    }
    if(route.objective.type==='landing'){
      assert.equal(race.status,'landing');
      const target=route.gates.at(-1),air={...target,altitude:283.1,elapsed:time++,speed:35,heading:98*RAD,model:'highWing',verticalSpeed:-1,onGround:false};
      race.update(air);assert.equal(race.status,'landing','flying through the zone is insufficient');
      const touchdown={...air,elapsed:time++,altitude:283};
      assert.equal(resolveGroundContact(touchdown,280,true),'landed');
      race.update(touchdown);
      if(route.objective.stop){
        assert.equal(race.status,'rollout');
        race.update({...touchdown,speed:0,elapsed:time++});
      }
      assert.ok(race.score>=55);
    }
    assert.equal(race.status,'finished');
    const result=route.objective.type==='landing'?race.score:race.elapsed(time);
    assert.ok(gradeMission(mission,'highWing',result));
    const reward=recordMissionResult(mission,'highWing',result,store);
    assert.ok(reward?.bestMedal);
    race.reset();assert.equal(race.next,0);assert.equal(race.status,'ready');
  }
  assert.equal(missionProgress(store).completed.size,8);
});

test('takeoff starts on the runway and can be flown through both gates with the trainer',()=>{
  for(const id of ['first-takeoff','short-runway']){
    const mission=getMission(id),route=flat(mission.route),start=missionStart(mission);
    const state=initialFlight({...start,altitude:283,model:'highWing',onGround:true}),race=new BrnoRace(route);
    assert.equal(state.onGround,true);assert.equal(state.speed,0);
    let lifted=false;
    for(let step=0;step<3000&&race.status!=='finished';step++){
      const pitch=state.speed>=aircraftProfile('highWing').takeoffSpeed&&state.altitude<340?1:0;
      stepFlight(state,{throttle:1,pitch},.05);
      if(!state.onGround)lifted=true;
      race.update(state,280);
    }
    assert.ok(lifted,id+' must lift off');
    assert.equal(race.status,'finished',id+' must be flyable');
  }
});

test('taxiing through the first gate cannot start a takeoff or circuit mission',()=>{
  for(const id of ['first-takeoff','short-runway','airport-circuit','repeat-circuit']){
    const route=flat(getMission(id).route),race=new BrnoRace(route);
    race.update({...atGate(route,0,-50,0),onGround:true});
    race.update({...atGate(route,0,50,1),onGround:true});
    assert.equal(race.next,0,id);
  }
});

test('crosswind causes lateral drift and emergency mission limits engine power',()=>{
  const crosswind=getMission('crosswind').route,state=initialFlight({...missionStart(getMission('crosswind')),model:'highWing',wind:crosswind.wind});
  const calm={...state,wind:null};
  stepFlight(state,{},.05);stepFlight(calm,{},.05);
  assert.ok(state.lat>calm.lat);
  const emergency=getMission('emergency-landing').route,glider=initialFlight({...missionStart(getMission('emergency-landing')),model:'highWing',engineLimit:emergency.engineLimit});
  for(let step=0;step<100;step++)stepFlight(glider,{throttle:1},.05);
  assert.equal(glider.throttle,0);assert.equal(glider.enginePower,0);
});

function flyApproach(race,end=race.route.gates.length-1){
  const route=race.route;let time=race.previous?.elapsed??0;
  if(!race.previous)race.update(atGate(route,0,-100,time));
  while(race.next<end){
    const index=race.next;
    race.update(atGate(route,index,-50,++time));
    race.update(atGate(route,index,50,++time));
    assert.equal(race.next,index+1);
  }
  return time;
}
function touch(race,time,index=race.next,sink=-1){
  const air={...atGate(race.route,index,0,time+1),verticalSpeed:sink};
  race.update(air);
  return {...air,onGround:true,elapsed:time+2};
}

test('touch and go requires a real touchdown and a new airborne departure; both landings affect score',()=>{
  const route=flat(getMission('repeat-circuit').route),race=new BrnoRace(route),index=route.gates.findIndex(g=>g.kind==='touch-and-go');
  let time=flyApproach(race,index);
  race.update(atGate(route,index,-50,++time));race.update(atGate(route,index,50,++time));
  assert.equal(race.next,index,'flying through cannot replace touchdown');
  const ground=touch(race,time,index,-2.5);time=ground.elapsed;
  assert.equal(race.update(ground)[0].status,'touch-and-go');
  const firstScore=race.score;
  assert.equal(race.next,index+1);assert.notEqual(race.status,'finished');
  race.update({...atGate(route,index+1,-50,++time),onGround:true});
  race.update({...atGate(route,index+1,50,++time),onGround:true});
  assert.equal(race.next,index+1,'taxiing cannot replace second takeoff');
  time=flyApproach(race);
  race.update(touch(race,time));
  assert.equal(race.status,'finished');assert.equal(race.touchdowns.length,2);
  assert.equal(race.score,Math.round((firstScore+race.touchdowns[1].score)/2));
  race.reset();assert.deepEqual(race.touchdowns,[]);
});

test('circuit waits for a full stop and rejects leaving the runway or overrunning the stop line',()=>{
  const route=flat(getMission('airport-circuit').route);
  for(const outcome of ['stop','overrun','side','airborne']){
    const race=new BrnoRace(route),time=flyApproach(race),ground=touch(race,time);
    race.update(ground);assert.equal(race.status,'rollout');
    assert.notEqual(race.finishedAt,ground.elapsed);
    const next={...ground,elapsed:ground.elapsed+1,speed:0};
    if(outcome==='overrun'){next.lat=route.objective.stop.lat;next.lon=route.objective.stop.lon+.001;}
    if(outcome==='side')next.lat+=.001;
    if(outcome==='airborne')next.onGround=false;
    race.update(next);assert.equal(race.status,outcome==='stop'?'finished':'failed',outcome);
  }
});

test('occupied runway approach fails on early touchdown, while a missed approach can complete',()=>{
  const route=flat(getMission('dusk-landing').route),race=new BrnoRace(route);
  race.update(atGate(route,0,-50,0));race.update(atGate(route,0,50,1));
  const ground=touch(race,1,route.gates.length-1);
  race.update(ground);assert.equal(race.status,'failed');
  race.reset();const time=flyApproach(race);race.update(touch(race,time));
  assert.equal(race.status,'finished');
});

test('engine-out trainer can physically glide through the approach and land without power',()=>{
  const mission=getMission('emergency-landing'),route=flat(mission.route),race=new BrnoRace(route);
  const state=initialFlight({...missionStart({...mission,route}),model:'highWing',engineLimit:route.engineLimit});
  race.update(state);let contact;
  for(let step=0;step<12000&&!state.onGround;step++){
    stepFlight(state,{throttle:1,pitch:Math.max(-1,Math.min(1,(-6*RAD-state.pitch)*8))},.05);
    contact=resolveGroundContact(state,280,true);race.update(state,280);
    if(contact==='crash')break;
  }
  assert.equal(state.enginePower,0);assert.equal(contact,'landed');assert.equal(race.status,'finished');
});
