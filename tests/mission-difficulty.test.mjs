import test from 'node:test';
import assert from 'node:assert/strict';
import {MISSIONS,getMission,getPlayableMission,missionStart} from '../src/missions.js';
import {DIFFICULTIES,routeSurfacePoints,resolveRouteSurface,underpassSurface} from '../src/mission-difficulty.js';
import {BrnoRace,gateFrame} from '../src/brno-race.js';
import {RAD,EARTH} from '../src/flight.js';

function point(route,index,along,elapsed,vertical=0,lateral=0){
  const {center,normal,right}=gateFrame(index,route),anchor=route.gates[0];
  return{lat:anchor.lat+(center.y+normal.y*along+right.y*lateral)/EARTH/RAD,lon:anchor.lon+(center.x+normal.x*along+right.x*lateral)/(EARTH*Math.cos(anchor.lat*RAD))/RAD,altitude:(route.gates[index].altitude??route.altitude)+vertical,elapsed};
}
function prepared(mission){return resolveRouteSurface(mission.route,routeSurfacePoints(mission.route).map((_,i)=>120+i*2));}

test('easy preserves every original gate and record id; higher levels have smaller rings, new turns and varied heights',()=>{
  const ids=new Set();
  for(const base of MISSIONS.filter(mission=>!mission.taskVariants&&!mission.fixedRoute)){
    const easy=getMission(base.id,'easy'),normal=getMission(base.id,'normal'),hard=getMission(base.id,'hard');
    assert.strictEqual(easy.route,base.route);
    for(const mission of [easy,normal,hard]){
      assert.ok(DIFFICULTIES[mission.level]);assert.equal(mission.route.gates.length,5);ids.add(mission.route.id);
      if(mission.level==='easy')continue;
      assert.notDeepEqual(mission.route.gates.map(g=>[g.lat,g.lon]),base.route.gates.map(g=>[g.lat,g.lon]));
      assert.ok(new Set(mission.route.gates.map(g=>g.clearance)).size>=3);
    }
    assert.ok(normal.route.radius<easy.route.radius);assert.ok(hard.route.radius<normal.route.radius);
  }
  assert.equal(ids.size,36);
});
test('all 36 routes can start, count all five gates at their individual heights, and finish',()=>{
  for(const base of MISSIONS.filter(mission=>!mission.taskVariants&&!mission.fixedRoute))for(const level of Object.keys(DIFFICULTIES)){
    const mission=getMission(base.id,level),route=level==='easy'&&!mission.route.terrainFollowing?mission.route:prepared(mission),race=new BrnoRace(route);
    race.update({...missionStart({...mission,route}),elapsed:0});assert.equal(race.next,0);
    for(let index=0;index<5;index++){
      race.update(point(route,index,-80,index*20+2));
      race.update(point(route,index,80,index*20+4));
      assert.equal(race.next,index+1,base.id+'/'+level+'/'+index);
    }
    assert.equal(race.status,'finished');assert.ok(Math.abs(race.elapsed(1000)-80)<1e-5);
  }
});
test('each ring rejects a high or sideways miss by its own radius, including the small bridge ring',()=>{
  const route=prepared(getMission('sf','hard'));
  for(let index=0;index<5;index++){
    const gate=route.gates[index],race=new BrnoRace(route);race.next=index;
    race.update(point(route,index,-40,0,gate.radius+1));race.update(point(route,index,40,1,gate.radius+1));assert.equal(race.next,index);
    race.previous=null;race.update(point(route,index,-40,2,0,gate.radius+1));race.update(point(route,index,40,3,0,gate.radius+1));assert.equal(race.next,index);
    assert.ok(Math.abs(race.target(point(route,index,0,4,12)).height+12)<1e-5);
  }
});
test('surface preparation keeps the full ring above uneven ground and rejects missing samples without changing the source',()=>{
  const mission=getMission('brno','normal'),source=JSON.stringify(mission.route),points=routeSurfacePoints(mission.route);
  const heights=points.map((_,i)=>i%3===1?500:240),route=resolveRouteSurface(mission.route,heights);
  for(const gate of route.gates)assert.ok(gate.altitude-gate.radius>=508);
  assert.equal(JSON.stringify(mission.route),source);assert.equal(route.resolved,true);
  assert.throws(()=>resolveRouteSurface(mission.route,[undefined]));
  assert.throws(()=>resolveRouteSurface(mission.route,heights.map((h,i)=>i===4?NaN:h)));
});
test('bridge uses a nearby water reference and corrects deck sampling only inside the underpass corridor',()=>{
  const source=getMission('sf','hard').route,points=routeSurfacePoints(source),route=resolveRouteSurface(source,points.map(()=>-30)),gate=route.gates[4];
  assert.equal(points.length,13);assert.notEqual(points.at(-1).lon,gate.lon);
  assert.equal(gate.altitude,0);assert.equal(gate.radius,18);
  assert.equal(underpassSurface(route,{...gate,altitude:0},40),-30);
  assert.equal(underpassSurface(route,{...gate,altitude:30},40),40); // Above the authored underpass ceiling.
  assert.equal(underpassSurface(route,{...gate,lat:gate.lat+.01,altitude:0},40),40);
  assert.equal(underpassSurface(getMission('brno').route,{...gate,altitude:0},40),40);
});

test('new scenic missions resolve every difficulty against high terrain while keeping the original five easy courses unchanged',()=>{
  for(const id of ['everest','giza','grandcanyon','matterhorn','fuji','rio','iceland']){
    for(const level of Object.keys(DIFFICULTIES)){
      const mission=getMission(id,level),route=mission.route,points=routeSurfacePoints(route);
      assert.equal(route.terrainFollowing,true);assert.equal(points.length,15);
      assert.ok(route.gates.every(g=>Number.isFinite(g.clearance)&&g.clearance>(g.radius??route.radius)));
      const heights=points.map((_,i)=>7000+i*20),resolved=resolveRouteSurface(route,heights);
      assert.equal(resolved.resolved,true);assert.ok(resolved.altitude>7000);
      resolved.gates.forEach((g,index)=>assert.ok(g.altitude-(g.radius??resolved.radius)>Math.max(...heights.slice(index*3,index*3+3))));
      assert.equal(missionStart({...mission,route:resolved}).altitude,resolved.gates[0].altitude);
    }
  }
  for(const id of ['brno','prague','sf','paris','nyc'])assert.equal(getMission(id).route.terrainFollowing,undefined);
});

test('the mission menu uses narrower routes with terrain-skimming and bridge gates that can be crossed safely',()=>{
  for(const id of ['first-takeoff','brno-landing','brno-discovery']){
    assert.equal(getPlayableMission(id,'highWing').route,getMission(id).route);
  }
  for(const id of ['brno','prague','sf','nyc','grandcanyon','matterhorn']){
    const mission=getPlayableMission(id,'highWing'),route=prepared(mission),old=getMission(id).route;
    assert.notEqual(route.id,old.id);
    assert.ok(route.gates.every(gate=>gate.radius<old.radius));
    for(const gate of route.gates.filter(gate=>gate.groundSkim))assert.equal(gate.altitude-gate.radius,gate.surface);
    const race=new BrnoRace(route);
    for(let index=0;index<route.gates.length;index++){
      race.update(point(route,index,-30,index*20));
      race.update(point(route,index,30,index*20+1));
    }
    assert.equal(race.status,'finished',id);
  }
  assert.equal(getPlayableMission('sf','highWing').route.gates.at(-1).underpass.ceiling,55);
});
