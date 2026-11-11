import {EARTH,RAD,aircraftProfile} from './flight.js';
import {LOCATIONS} from './locations.js';
import {WORLD_MISSIONS} from './world-missions.js';
import {missionVariant} from './mission-difficulty.js';

export const OBJECTIVE_NAMES={time:'Časovka',takeoff:'Vzlet',sightseeing:'Objevování',landing:'Přesné přistání',lowflight:'Nízký let'};
export const objectiveType=route=>route.objective?.type||'time';
export const usesScore=route=>['landing','lowflight'].includes(objectiveType(route));
export function discoveryMessage(route,index,result){
  const name=route.gates[index].name,count=`${index+1} / ${route.gates.length}`;
  const saved=!result?`Průlet nad ${name} potvrzen, ale místo se nepodařilo uložit do sbírky.`:
    result.saved===false?`${name} je ve sbírce pro tento let. Prohlížeč nepovolil trvalé uložení.`:
    result.isNew?`Uloženo do sbírky: ${name}.`:`Už ve sbírce: ${name}. Průlet potvrzen.`;
  const next=index===route.gates.length-1?`Všech ${route.gates.length} památek objeveno. Mise splněna! Sbírku otevřeš v menu.`:
    `Další: ${route.gates[index+1].name}. Proleť žlutým kuželem nad památkou.`;
  return `${saved} ${count} památek. ${next}`;
}
export function landingApproachMessage(route,model,index=route.gates.length-1){
  const profile=aircraftProfile(model),objective=route.objective;
  const heading=String(Math.round(objective.heading)).padStart(3,'0');
  return `Finále splněno. Přistaň ve žlutém obdélníku, směr ${heading}° (±${objective.headingTolerance}°).\n`+
    `${Math.round(profile.landingMin*3.6)}–${Math.round(profile.landingMax*3.6)} km/h · klesání do ${profile.landingSink} m/s · křídla rovně, příď téměř vodorovně.\n`+
    'Klávesou S uber výkon, těsně před zemí ↓ jemně přitáhni.'+
    (route.gates[index]?.kind==='touch-and-go'?' Po dosednutí W · plný výkon a ↓ · znovu vzlétni. Čeká tě ještě druhý okruh.':objective.stop?' Po dosednutí drž osu, stáhni výkon klávesou S a zastav před koncem dráhy.':'');
}
export function missionBrief(route){
  const objective=route.objective,type=objectiveType(route);
  if(type==='takeoff')return 'Přidej výkon klávesou W, při vzletové rychlosti jemně podrž ↓ a proleť stoupací brány. Vzlet se počítá až po odlepení od dráhy.';
  if(type==='sightseeing')return `Proleť žlutým kuželem nad každou z ${route.gates.length} památek. Stačí jediný průlet: památka se přidá do sbírky a označí se další cíl. Není třeba čekat ani zpomalovat.`;
  if(type==='landing'&&route.brief)return route.brief+' '+(route.gates.some(g=>g.kind==='touch-and-go')?'První dosednutí je povinné. Hodnotí se průměr obou přistání.':route.objective.stop?'Úspěch se započítá až po zastavení v koridoru dráhy.':'Hodnotí se přesnost a měkkost dosednutí.');
  if(type==='landing')return `${route.groundStart?'Nejprve vzlétni. ':''}Proleť naváděcí brány, uber výkon a přistaň ve vyznačeném obdélníku ve směru dráhy.${route.wind?' Počítej s bočním větrem.':''}${route.engineLimit?' Výkon motoru je omezený.':''} Hodnotí se přesnost a měkkost dosednutí.`;
  if(type==='lowflight')return (route.brief?route.brief+' ':'')+`Proleť všechny brány a mezi nimi zůstaň ${objective.minHeight}–${objective.maxHeight} m nad terénem v koridoru do ${objective.corridor} m od trasy. `+
    (objective.minimumScore?`Ke splnění potřebuješ alespoň ${objective.minimumScore} % přesného letu.`:'Hodnotí se podíl přesného letu, nikoli rychlost.');
  return (route.brief?route.brief+' ':'')+'Proleť všechny brány v pořadí. První spustí čas, poslední ho zastaví. Pauza se do času nepočítá.';
}
const levels=['easy','normal','hard'];
const brno=LOCATIONS.find(place=>place.id==='brno');
const discoveryPoints=[[49.19097222,16.60736111,'Petrov','cs:81686'],[49.194444,16.598889,'Špilberk','cs:337702'],[49.2046,16.5838,'Hvězdárna','cs:146828'],[49.24062222,16.50764889,'Přehrada','cs:27634'],[49.256667,16.461667,'Veveří','cs:26471']];
const sightseeing={id:'brno-discovery',place:'brno',location:brno,title:'Pět tváří Brna',description:'Proleť nad pěti památkami a přidej si je do sbírky. Pohodový let bez závodu s časem.',time:'evening',weather:'partly',recommended:'Hornoplošník',taskVariants:{}};
// Runway 09 threshold and true heading from Czech AIP LKTB AD 2.12:
// https://aim.rlp.cz/ais_data/aip/data/valid/a2-tb-text.pdf
// Everything else (approach heights, target zone and scoring) is authored game design.
const threshold={lat:49+9/60+10.33/3600,lon:16+40/60+33.11/3600},bearing=98*RAD;
const runwayPoint=distance=>({lat:threshold.lat+Math.cos(bearing)*distance/EARTH/RAD,lon:threshold.lon+Math.sin(bearing)*distance/(EARTH*Math.cos(threshold.lat*RAD))/RAD});
const landing={id:'brno-landing',place:'brno',location:brno,title:'Hladké přistání',description:'Přibliž se k dráze 09 v Tuřanech a přistaň přesně do vyznačené zóny.',time:'day',weather:'clear',recommended:'Hornoplošník',taskVariants:{}};
const canyonSource=WORLD_MISSIONS.find(mission=>mission.id==='grandcanyon');
const canyon={...canyonSource,id:'canyon-patrol',title:'Nízká hlídka Colorada',description:'Drž se v nízkém výškovém pásmu a sleduj říční koridor. Přesnost má přednost před rychlostí.',time:'day',weather:'clear',recommended:'Hornoplošník / Super Hornet',taskVariants:{}};
for(const [index,level] of levels.entries()){
  sightseeing.taskVariants[level]={id:`brno-discovery-${level}-v1`,radius:[450,320,220][index],altitude:700,terrainFollowing:true,objective:{type:'sightseeing'},gates:discoveryPoints.map(([lat,lon,name,placeId])=>({lat,lon,name,placeId,clearance:[450,350,260][index]}))};
  const radius=[110,80,55][index];
  landing.taskVariants[level]={id:`brno-landing-${level}-v1`,radius,altitude:650,terrainFollowing:true,objective:{type:'landing',heading:98,halfLength:[600,450,300][index],halfWidth:[27,22,16][index],headingTolerance:[25,18,12][index]},gates:[-5200,-3400,-1900,-750].map((distance,i)=>({...runwayPoint(distance),name:['Přiblížení · START','Sestup','Srovnej osu dráhy','Finále'][i],radius:Math.max(25,radius-i*20),clearance:[350,250,155,65][i]})).concat({...runwayPoint(650),name:'Přistávací zóna · CÍL',kind:'landing',radius:30,clearance:3})};
  const base=missionVariant(canyonSource,level).route;
  canyon.taskVariants[level]={...base,id:`canyon-patrol-${level}-v1`,terrainFollowing:true,radius:[90,60,35][index],objective:{type:'lowflight',minHeight:[90,55,35][index],maxHeight:[260,170,110][index],corridor:[900,550,320][index]},gates:base.gates.map(gate=>({...gate,radius:[90,60,35][index],clearance:[170,110,70][index]}))};
}
export const TASK_MISSIONS=[sightseeing,landing,canyon];
