import test from 'node:test';
import assert from 'node:assert/strict';
import {CAREER_IDS,CHAPTERS} from '../src/campaign.js';
import {missionProgress,isMissionUnlocked,isAircraftUnlocked,recordMissionCompletion,recordMissionResult,gradeMission,medalTargets} from '../src/mission-progression.js';
import {MISSIONS,getMission} from '../src/missions.js';

function storage(){const values=new Map();return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),key:index=>[...values.keys()][index]??null,get length(){return values.size;}};}

test('FlyAtlas has each active mission exactly once, and a safe finish opens the next flight',()=>{
  assert.equal(CAREER_IDS.length,28);assert.equal(new Set(CAREER_IDS).size,28);
  assert.deepEqual(new Set(CAREER_IDS),new Set(MISSIONS.map(mission=>mission.id)));
  assert.deepEqual(CHAPTERS.map(chapter=>chapter.ids.length),[5,6,6,6,5]);
  const store=storage();assert.deepEqual([...missionProgress(store).unlocked],['first-takeoff']);
  assert.equal(recordMissionCompletion('prague',store),false);
  for(const id of CAREER_IDS){assert.equal(isMissionUnlocked(id,store),true,id);recordMissionCompletion(id,store);}
  const progress=missionProgress(store);
  assert.equal(progress.careerCount,28);assert.equal(progress.rank,'Šéfpilot');
  assert.equal(progress.nextMissionId,undefined);assert.equal(progress.unlocked.size,28);
});

test('old medals and records migrate by reading their existing keys without rewriting them',()=>{
  const store=storage();
  store.setItem('aeronaut.mission-medal.v2.prague','gold');
  store.setItem('aeronaut.mission-completed.v1.brno','1');
  store.setItem('aeronaut.score.brno-landing-easy-v1.highWing.day.clear','72');
  const progress=missionProgress(store);
  assert.equal(progress.completed.has('prague'),true);
  assert.equal(progress.completed.has('brno'),true);
  assert.equal(progress.completed.has('brno-landing'),true);
  assert.equal(progress.nextMissionId,'first-takeoff');
  assert.equal(progress.unlocked.has('prague'),true,'earned missions remain playable');
  assert.equal(progress.xp,200);
  assert.equal(store.getItem('aeronaut.mission-medal.v2.prague'),'gold');
});

test('retired runway medals still count for aircraft XP but not active career',()=>{
  const store=storage();store.setItem('aeronaut.mission-medal.v2.airport-circuit','gold');
  store.setItem('aeronaut.mission-completed.v1.crosswind','1');
  const progress=missionProgress(store);
  assert.equal(progress.xp,150);assert.equal(progress.careerCount,0);
  assert.equal(isAircraftUnlocked('lowWing',store),true);
  assert.equal(isMissionUnlocked('airport-circuit',store),false);
  assert.equal(recordMissionResult(getMission('airport-circuit'),'highWing',100,store),null);
});

test('medals improve mastery and aircraft XP without gating career or farming rewards',()=>{
  const store=storage(),takeoff=getMission('first-takeoff');
  const bronze=recordMissionResult(takeoff,'highWing',9999,store);
  assert.equal(bronze.medal,'bronze');assert.equal(bronze.xpGained,50);
  assert.deepEqual(bronze.newMissions,['brno-landing']);
  assert.equal(bronze.nextMissionId,'brno-landing');
  assert.equal(recordMissionResult(takeoff,'highWing',9999,store).xpGained,0);
  const targets=medalTargets(takeoff,'highWing');
  assert.equal(gradeMission(takeoff,'highWing',targets.gold),'gold');
  const gold=recordMissionResult(takeoff,'highWing',targets.gold,store);
  assert.equal(gold.xpGained,50);assert.deepEqual(gold.newAircraft,['lowWing']);
  assert.equal(missionProgress(store).nextMissionId,'brno-landing');
});

test('rank depends on safe mission count, so eight flights cannot award Captain',()=>{
  const store=storage();
  for(const id of CAREER_IDS.slice(0,8))recordMissionCompletion(id,store);
  assert.equal(missionProgress(store).rank,'Pilot');
  for(const id of CAREER_IDS.slice(8,23))recordMissionCompletion(id,store);
  assert.equal(missionProgress(store).rank,'Kapitán');
});

test('the fifth successful flight earns a chapter badge and reveals the next chapter',()=>{
  const store=storage();for(const id of CAREER_IDS.slice(0,4))recordMissionCompletion(id,store);
  const mission=getMission(CAREER_IDS[4]),reward=recordMissionResult(mission,'highWing',9999,store);
  assert.equal(reward.chapterComplete,true);assert.equal(reward.rankUp,true);
  assert.equal(reward.rank,'Pilot');assert.equal(reward.nextMissionId,CAREER_IDS[5]);
  assert.deepEqual(reward.newMissions,[CAREER_IDS[5]]);
  assert.equal(recordMissionResult(mission,'highWing',9999,store).chapterComplete,false);
});
