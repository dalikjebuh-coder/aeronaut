import {MISSIONS,RETIRED_RUNWAY_MISSIONS} from './missions.js';
import {aircraftProfile,offsetMeters} from './flight.js';
import {CAREER_IDS,CHAPTERS,careerRank} from './campaign.js';

export const BRNO_MISSION_IDS=['brno-landing','brno-discovery','brno'];
export const AIRCRAFT_LEVELS=Object.freeze({highWing:1,lowWing:2,airliner:3,fighter:4});
export const LEVEL_XP=Object.freeze([0,100,250,450]);
export const MEDAL_NAMES=Object.freeze({bronze:'Bronz',silver:'Stříbro',gold:'Zlato'});
export const MEDAL_XP=Object.freeze({bronze:50,silver:75,gold:100});
export const PILOT_RANKS=Object.freeze(['Kadet','Pilot','Zkušený pilot','Velitel letu','Kapitán','Šéfpilot']);
export const CAREER_XP=Object.freeze([0,5,11,17,23,28]); // completed flights, kept as a public progress scale
const MEDAL_KEY='aeronaut.mission-medal.v2.';
const COMPLETED_PREFIX='aeronaut.mission-completed.v1.';
const LEGACY_LANDING=/^aeronaut\.score\.brno-landing-(easy|normal|hard)-v1\./;

function storeFor(storage){return storage??globalThis.localStorage;}
function get(key,storage){try{return storeFor(storage).getItem(key);}catch{return null;}}
function set(key,value,storage){try{storeFor(storage).setItem(key,value);return true;}catch{return false;}}
function previousLandingRecord(storage){
  try{
    const store=storeFor(storage);
    for(let index=0;index<store.length;index++){
      const key=store.key(index),value=store.getItem(key);
      if(LEGACY_LANDING.test(key)&&value!==null&&Number.isFinite(Number(value))&&Number(value)>=0)return true;
    }
  }catch{}
  return false;
}
function medalKey(id){return MEDAL_KEY+id;}
function medalRank(medal){return {bronze:1,silver:2,gold:3}[medal]||0;}
export function medalFor(id,storage){
  const saved=get(medalKey(id),storage);
  if(medalRank(saved))return saved;
  if(get(COMPLETED_PREFIX+id,storage)==='1'||id==='brno-landing'&&previousLandingRecord(storage))return'bronze';
  return null;
}
export function missionProgress(storage){
  const completed=new Set(),medals=new Map();let xp=0;
  for(const mission of MISSIONS){
    const medal=medalFor(mission.id,storage);
    if(medal){completed.add(mission.id);medals.set(mission.id,medal);xp+=MEDAL_XP[medal];}
  }
  // Keep earned XP and aircraft unlocks from missions removed from the catalog.
  for(const {id} of RETIRED_RUNWAY_MISSIONS)xp+=MEDAL_XP[medalFor(id,storage)]??0;
  const nextId=CAREER_IDS.find(id=>!completed.has(id));
  const unlocked=new Set([...completed,...(nextId?[nextId]:[])]);
  const unlockedCount=BRNO_MISSION_IDS.filter(id=>unlocked.has(id)).length;
  const level=LEVEL_XP.reduce((current,threshold,index)=>xp>=threshold?index+1:current,1);
  const careerCount=completed.size;
  const careerLevel=CAREER_XP.reduce((current,threshold,index)=>careerCount>=threshold?index+1:current,1);
  const stars=[...medals.values()].reduce((sum,medal)=>sum+medalRank(medal),0);
  return{completed,medals,unlocked,unlockedCount,total:CAREER_IDS.length,xp,level,nextLevelXp:LEVEL_XP[level]??null,
    stars,maxStars:MISSIONS.length*3,careerLevel,careerCount,rank:careerRank(completed),nextRank:PILOT_RANKS[careerLevel]??null,
    careerStartXp:CAREER_XP[careerLevel-1],nextCareerXp:CAREER_XP[careerLevel]??null,
    nextMissionId:nextId,chapters:CHAPTERS.map(chapter=>({...chapter,completed:chapter.ids.filter(id=>completed.has(id)).length}))};
}
export function isMissionUnlocked(id,storage){return missionProgress(storage).unlocked.has(id);}
export function isAircraftUnlocked(model,storage){return missionProgress(storage).level>=(AIRCRAFT_LEVELS[model]??Infinity);}

function timeTargets(mission,model){
  const gates=mission.route.gates;
  const distance=gates.slice(1).reduce((sum,gate,index)=>{
    const offset=offsetMeters(gate.lat,gate.lon,gates[index]);return sum+Math.hypot(offset.x,offset.y);
  },0);
  const cruise=aircraftProfile(model).cruiseSpeed;
  return{gold:Math.ceil(distance/(cruise*.85)+30),silver:Math.ceil(distance/(cruise*.60)+45)};
}
export function medalTargets(mission,model){
  const type=mission.route.objective?.type||'time';
  if(type==='landing'||type==='lowflight')return{type,gold:80,silver:55};
  return{type,...timeTargets(mission,model)};
}
export function gradeMission(mission,model,result){
  if(!Number.isFinite(result)||result<0)return null;
  const targets=medalTargets(mission,model);
  if(targets.type==='sightseeing')return 'gold';
  if(targets.type==='landing'||targets.type==='lowflight')return result>=targets.gold?'gold':result>=targets.silver?'silver':'bronze';
  return result<=targets.gold?'gold':result<=targets.silver?'silver':'bronze';
}
export function recordMissionResult(mission,model,result,storage){
  if(!MISSIONS.some(item=>item.id===mission.id)||!isMissionUnlocked(mission.id,storage))return null;
  const medal=gradeMission(mission,model,result);
  if(!medal)return null;
  const before=missionProgress(storage),old=medalFor(mission.id,storage);
  if(medalRank(medal)>medalRank(old))set(medalKey(mission.id),medal,storage);
  set(COMPLETED_PREFIX+mission.id,'1',storage);
  const after=missionProgress(storage);
  return{rank:after.rank,careerLevel:after.careerLevel,rankUp:after.careerLevel>before.careerLevel,chapterComplete:after.chapters.find(chapter=>chapter.ids.includes(mission.id))?.completed===after.chapters.find(chapter=>chapter.ids.includes(mission.id))?.ids.length&&!before.completed.has(mission.id),nextMissionId:after.nextMissionId,stars:medalRank(medal),bestStars:medalRank(medalFor(mission.id,storage)),saved:get(COMPLETED_PREFIX+mission.id,storage)==='1'&&medalRank(medalFor(mission.id,storage))>=medalRank(medal),medal,bestMedal:medalFor(mission.id,storage),xpGained:after.xp-before.xp,xp:after.xp,level:after.level,levelUp:after.level>before.level,
    newMissions:[...after.unlocked].filter(id=>!before.unlocked.has(id)),newAircraft:Object.keys(AIRCRAFT_LEVELS).filter(id=>AIRCRAFT_LEVELS[id]>before.level&&AIRCRAFT_LEVELS[id]<=after.level)};
}
// Kept for existing saves and callers that only know a mission was completed.
export function recordMissionCompletion(id,storage){
  if(!MISSIONS.some(mission=>mission.id===id))return false;
  const before=missionProgress(storage);
  if(!before.unlocked.has(id))return false;
  set(COMPLETED_PREFIX+id,'1',storage);
  return missionProgress(storage).unlocked.size>before.unlocked.size;
}
