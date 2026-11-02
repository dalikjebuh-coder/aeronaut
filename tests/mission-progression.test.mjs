import test from 'node:test';
import assert from 'node:assert/strict';
import {BRNO_MISSION_IDS,missionProgress,isMissionUnlocked,isAircraftUnlocked,recordMissionCompletion,recordMissionResult,gradeMission,medalTargets} from '../src/mission-progression.js';
import {getMission} from '../src/missions.js';
import {RUNWAY_MISSIONS} from '../src/runway-missions.js';

function storage(){
  const values=new Map();
  return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),key:index=>[...values.keys()][index]??null,get length(){return values.size;}};
}

test('Brno missions unlock one by one after a completed flight and survive reload',()=>{
  const store=storage();
  assert.deepEqual([...missionProgress(store).unlocked],['brno-landing',...RUNWAY_MISSIONS.map(m=>m.id)]);
  assert.equal(recordMissionCompletion('brno-discovery',store),false,'a locked mission cannot skip ahead');
  assert.equal(recordMissionCompletion('prague',store),false,'world missions remain locked');
  assert.equal(recordMissionCompletion('brno-landing',store),true);
  assert.deepEqual([...missionProgress(store).unlocked],[...BRNO_MISSION_IDS.slice(0,2),...RUNWAY_MISSIONS.map(m=>m.id)]);
  assert.equal(isMissionUnlocked('brno-discovery',store),true);
  assert.equal(recordMissionCompletion('brno-landing',store),false,'replaying a completed mission does not unlock another');
  assert.equal(recordMissionCompletion('brno-discovery',store),true);
  assert.deepEqual([...missionProgress(store).unlocked],[...BRNO_MISSION_IDS,...RUNWAY_MISSIONS.map(m=>m.id)]);
  assert.equal(recordMissionCompletion('brno',store),true,'the final Brno mission opens the world');
  assert.equal(missionProgress(store).completed.has('brno'),true);
  assert.equal(isMissionUnlocked('prague',store),true);
});

test('an earlier successful Brno landing record counts toward progression',()=>{
  const store=storage();
  store.setItem('aeronaut.score.brno-landing-easy-v1.highWing.day.clear','72');
  assert.equal(missionProgress(store).completed.has('brno-landing'),true);
  assert.equal(isMissionUnlocked('brno-discovery',store),true);
  store.setItem('aeronaut.score.brno-landing-hard-v1.highWing.day.clear','invalid');
  assert.equal(isMissionUnlocked('brno',store),false);
});

test('best medals award XP once, level up, and unlock aircraft across reloads',()=>{
  const store=storage(),landing=getMission('brno-landing');
  assert.equal(isAircraftUnlocked('highWing',store),true);
  assert.equal(isAircraftUnlocked('lowWing',store),false);
  const bronze=recordMissionResult(landing,'highWing',30,store);
  assert.equal(bronze.medal,'bronze');assert.equal(bronze.xpGained,50);
  assert.deepEqual(bronze.newMissions,['brno-discovery']);
  assert.equal(recordMissionResult(landing,'highWing',30,store).xpGained,0);
  const gold=recordMissionResult(landing,'highWing',90,store);
  assert.equal(gold.medal,'gold');assert.equal(gold.xpGained,50);
  assert.deepEqual(gold.newAircraft,['lowWing']);
  assert.equal(missionProgress(store).level,2);
  assert.equal(isAircraftUnlocked('lowWing',store),true);
  assert.equal(recordMissionResult(landing,'highWing',60,store).xpGained,0);
  assert.equal(missionProgress(store).medals.get('brno-landing'),'gold');
});

test('time medals use the selected aircraft, and completing Brno opens the world',()=>{
  const store=storage();
  for(const id of BRNO_MISSION_IDS)recordMissionCompletion(id,store);
  assert.equal(missionProgress(store).xp,150);
  assert.equal(isMissionUnlocked('everest',store),true);
  const mission=getMission('prague'),targets=medalTargets(mission,'highWing');
  assert.equal(gradeMission(mission,'highWing',targets.gold),'gold');
  assert.equal(gradeMission(mission,'highWing',targets.silver),'silver');
  assert.equal(gradeMission(mission,'highWing',targets.silver+1),'bronze');
  const first=recordMissionResult(mission,'highWing',targets.silver,store);
  assert.equal(first.xpGained,75);
});
