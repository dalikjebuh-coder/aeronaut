import {medalTargets} from './mission-progression.js';
import {formatRaceTime} from './brno-race.js';
import {objectiveType,usesScore} from './task-missions.js';

export const starsForMedal=medal=>({bronze:1,silver:2,gold:3}[medal]||0);
export const starLabel=count=>'★'.repeat(count)+'☆'.repeat(3-count);

// All mission types share 0–100 points and the same 55 / 80 star thresholds.
export function missionScore(mission,model,result){
  if(!Number.isFinite(result)||result<0)return null;
  if(usesScore(mission.route))return Math.round(Math.max(0,Math.min(100,result)));
  if(objectiveType(mission.route)==='sightseeing')return 100;
  const {gold,silver}=medalTargets(mission,model);
  if(result<=gold)return Math.round(80+20*(1-result/gold));
  if(result<=silver)return Math.max(55,Math.floor(80-25*(result-gold)/(silver-gold)));
  return Math.max(1,Math.floor(55*silver/result));
}

// Offline records have their own category; old online records keep their keys.
export function missionRecordKey(mission,model,time,weather,mode='google'){
  return `${usesScore(mission.route)?'aeronaut.score':'aeronaut.best'}.${mission.route.id}.${model}.${time}.${weather}${mode==='demo'?'.offline':''}`;
}
export function readMissionRecord(key,scored,storage=globalThis.localStorage){
  try{const raw=storage.getItem(key),value=Number(raw);return raw!==null&&raw.trim()!==''&&Number.isFinite(value)&&(scored?value>=0&&value<=100:value>0)?value:null;}catch{return null;}
}
export function missionFeedback(mission,model,result,{previousBest=null,landing=null}={}){
  const type=objectiveType(mission.route),score=missionScore(mission,model,result);
  if(score===null)return null;
  let praise,advice;
  if(type==='sightseeing'){
    praise=`Všech ${mission.route.gates.length} památek objeveno.`;
    advice='Tři hvězdy za objevování. Čas je jen pro tvé srovnání; leť vlastním tempem.';
  }else if(type==='landing'){
    praise=score>=80?'Přesné a měkké přistání.':'Bezpečně na zemi, mise splněna.';
    if(mission.route.objective.stop)praise='Letištní okruh dokončen. Bezpečně přistáno a zastaveno na dráze.';
    if(mission.route.gates.some(gate=>gate.kind==='touch-and-go'))praise='Dosednutí, další vzlet i závěrečné přistání zvládnuty. Body jsou průměrem obou dosednutí.';
    const tips={along:'Dosedni blíž ke středu vyznačené zóny.',across:'Před dosednutím se srovnej na střed dráhy.',sink:'Těsně nad dráhou jemně přitáhni a zmírni klesání.',heading:'Před dosednutím srovnej směr s osou dráhy.'};
    const weakest=landing&&Object.entries(landing).sort((a,b)=>b[1]-a[1])[0];
    advice=score>=80?'Skvělý základ. Zkus stejnou přesnost i v bočním větru.':tips[weakest?.[0]]||'Srovnej osu dráhy a těsně nad zemí jemně zmírni klesání.';
  }else if(type==='lowflight'){
    praise=`${score} % hodnoceného letu ve správné výšce a koridoru.`;
    advice=score>=80?'Výšku i trasu držíš jistě. Zkus přesnost udržet po celý let.':`Drž ${mission.route.objective.minHeight}–${mission.route.objective.maxHeight} m nad zemí a zatáčky začínej dřív.`;
  }else{
    praise=type==='takeoff'?'Vzlet a všechny stoupací brány zvládnuty.':'Všechny brány prolétnuty ve správném pořadí.';
    const targets=medalTargets(mission,model),next=result>targets.silver?targets.silver:targets.gold;
    advice=score>=80?'Výborné tempo. Další rekord hledej v plynulých zatáčkách.':`Pro ${result>targets.silver?'dvě':'tři'} hvězdy zkrať let o ${Math.ceil(result-next)} s. Dívej se už k další bráně.`;
  }
  const improved=previousBest===null|| (usesScore(mission.route)?result>previousBest:result<previousBest);
  const difference=previousBest===null?null:Math.abs(result-previousBest);
  const record=previousBest===null?'První osobní rekord':difference<.000001?'Vyrovnaný osobní rekord':
    `${improved?'Nový osobní rekord · zlepšení o':'Do osobního rekordu chybí'} ${usesScore(mission.route)?`${Math.round(difference)} bodů`:formatRaceTime(difference)}`;
  return{score,praise,advice,record};
}
