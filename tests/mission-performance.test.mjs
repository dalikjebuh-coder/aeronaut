import test from 'node:test';
import assert from 'node:assert/strict';
import {MISSIONS,getMission} from '../src/missions.js';
import {missionScore,missionFeedback,missionRecordKey,readMissionRecord,starsForMedal} from '../src/mission-performance.js';
import {gradeMission,medalTargets,missionProgress,recordMissionResult,recordMissionCompletion,BRNO_MISSION_IDS} from '../src/mission-progression.js';
import {landingPenalties} from '../src/mission-objectives.js';
import {RAD} from '../src/flight.js';
import {CAREER_IDS} from '../src/campaign.js';

function storage(){const values=new Map();return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),key:i=>[...values.keys()][i]??null,get length(){return values.size;}};}

test('score thresholds match stars for every mission and aircraft without adding difficulty choices',()=>{
  for(const mission of MISSIONS)for(const model of ['highWing','lowWing','airliner','fighter']){
    const targets=medalTargets(mission,model),scored=['landing','lowflight'].includes(targets.type);
    const results=scored?[0,54,55,79,80,100]:[0,targets.gold,targets.gold+.1,targets.silver,targets.silver+1,10000];
    for(const result of results){
      const score=missionScore(mission,model,result),stars=starsForMedal(gradeMission(mission,model,result));
      assert.ok(score>=0&&score<=100);
      assert.equal(score>=80?3:score>=55?2:1,stars,mission.id+' '+model+' '+result);
      const feedback=missionFeedback(mission,model,result);
      assert.ok(feedback.praise.length>10);assert.ok(feedback.advice.length>20);
    }
    assert.equal(missionScore(mission,model,NaN),null);
    assert.equal(missionScore(mission,model,-1),null);
  }
});

test('discovery awards all stars at any pace; replay never farms XP or reduces best stars',()=>{
  const store=storage();recordMissionCompletion('first-takeoff',store);recordMissionCompletion('brno-landing',store);
  const mission=getMission('brno-discovery');
  const first=recordMissionResult(mission,'highWing',7200,store);
  assert.equal(first.stars,3);assert.equal(first.xpGained,100);assert.equal(first.saved,true);
  assert.equal(recordMissionResult(mission,'highWing',1,store).xpGained,0);
  assert.equal(missionProgress(store).stars,5);
  assert.match(missionFeedback(mission,'highWing',7200).advice,/vlastním tempem/);
});

test('career continues after all aircraft unlock and persists via existing mission medals',()=>{
  const store=storage();
  assert.equal(missionProgress(store).rank,'Kadet');
  for(const id of CAREER_IDS){const mission=getMission(id);recordMissionResult(mission,'highWing',['landing','lowflight'].includes(mission.route.objective?.type)?100:1,store);}
  const progress=missionProgress(store);
  assert.equal(progress.level,4);assert.equal(progress.rank,'Šéfpilot');
  assert.equal(progress.careerLevel,6);assert.equal(progress.nextCareerXp,null);
  assert.equal(progress.stars,MISSIONS.length*3);assert.equal(progress.xp,MISSIONS.length*100);
  assert.deepEqual(missionProgress(store),progress);
  assert.equal(recordMissionResult(getMission('brno-landing'),'highWing',10,store).bestStars,3);
  assert.equal(missionProgress(store).xp,MISSIONS.length*100);
});

test('personal records compare in the right direction and separate aircraft, variants and offline mode',()=>{
  const landing=getMission('brno-landing'),time=getMission('brno');
  assert.match(missionFeedback(landing,'highWing',90,{previousBest:80}).record,/zlepšení o 10 bodů/);
  assert.match(missionFeedback(landing,'highWing',70,{previousBest:80}).record,/chybí 10 bodů/);
  assert.match(missionFeedback(time,'highWing',90,{previousBest:100}).record,/zlepšení o 00:10.0/);
  assert.match(missionFeedback(time,'highWing',110,{previousBest:100}).record,/chybí 00:10.0/);
  assert.match(missionFeedback(time,'highWing',100,{previousBest:100}).record,/Vyrovnaný/);
  assert.match(missionFeedback(time,'highWing',100).record,/První/);
  const keys=[missionRecordKey(time,'highWing','day','clear'),missionRecordKey(time,'fighter','day','clear'),missionRecordKey(time,'highWing','day','clear','demo'),missionRecordKey(getMission('brno','hard'),'highWing','day','clear')];
  assert.equal(new Set(keys).size,4);
  const store=storage();store.setItem(keys[0],100);
  assert.equal(readMissionRecord(keys[0],false,store),100);
  assert.equal(readMissionRecord(keys[2],false,store),null);
  for(const invalid of ['',' ','NaN','Infinity','-1','0']){store.setItem('bad',invalid);assert.equal(readMissionRecord('bad',false,store),null);}
  store.setItem('bad','101');assert.equal(readMissionRecord('bad',true,store),null);
  assert.equal(readMissionRecord('x',false,{getItem(){throw Error('blocked');}}),null);
});

test('landing advice identifies the actual greatest loss, and failed storage is reported',()=>{
  const mission=getMission('brno-landing'),route=mission.route,target=route.gates.at(-1);
  const previous={verticalSpeed:-.1},state={...target,heading:route.objective.heading*RAD,model:'highWing'};
  const centered=landingPenalties(route,previous,state);
  assert.ok(centered.along<.001&&centered.across<.001);
  const penalties={along:.1,across:.3,sink:.02,heading:.01};
  assert.match(missionFeedback(mission,'highWing',57,{landing:penalties}).advice,/střed dráhy/);
  assert.match(missionFeedback(mission,'highWing',57,{landing:{...penalties,sink:.4}}).advice,/zmírni klesání/);
  const blocked={getItem:()=>null,setItem(){throw Error('quota');},length:0};
  const reward=recordMissionResult(getMission('first-takeoff'),'highWing',90,blocked);
  assert.equal(reward.saved,false);assert.equal(reward.xpGained,0);
});
