import {EARTH,RAD} from './flight.js';
import {LOCATIONS} from './locations.js';

// Game routes around Brno-Tuřany runway 09. Distances are metres from its threshold.
const brno=LOCATIONS.find(place=>place.id==='brno');
const threshold={lat:49+9/60+10.33/3600,lon:16+40/60+33.11/3600};
const heading=98,angle=heading*RAD;
function point(along,side=0){
  const north=Math.cos(angle)*along-Math.sin(angle)*side;
  const east=Math.sin(angle)*along+Math.cos(angle)*side;
  return{lat:threshold.lat+north/EARTH/RAD,lon:threshold.lon+east/(EARTH*Math.cos(threshold.lat*RAD))/RAD};
}
function gate(along,side,name,clearance=180,radius=115){return{...point(along,side),name,clearance,radius};}
const landingZone={...gate(650,0,'Přistávací zóna · CÍL',3,30),kind:'landing'};
const final=[gate(-3400,0,'Přiblížení',300),gate(-1900,0,'Srovnej osu',170,95),gate(-750,0,'Finále',75,65),landingZone];
const circuit=[gate(2500,0,'Po vzletu · START',220,135),gate(2900,1900,'Odletová zatáčka',330,155),gate(-3800,1900,'Po větru',360,170),gate(-4300,350,'Base leg',300,150),...final];
const specs=[
  {id:'first-takeoff',title:'První vzlet',description:'Rozjeď se po dráze 09, jemně přitáhni a proleť dvě stoupací brány.',kind:'takeoff',start:120,gates:[gate(1600,0,'Odlepení · START',95,105),gate(2700,0,'Stoupání · CÍL',210,135)]},
  {id:'first-landing',title:'První přistání',description:'Sleduj finále dráhy 09 a měkce dosedni do žluté zóny.',kind:'landing',gates:[gate(-1900,0,'Krátké finále · START',170,115),...final.slice(2)]},
  {id:'airport-circuit',title:'Letištní okruh',description:'Vzlétnout, obletět letiště, přistát a zastavit před koncem dráhy. Dosednutím úkol nekončí.',kind:'landing',stop:{end:2500,speed:2},start:120,gates:circuit},
  {id:'crosswind',title:'Boční vítr',description:'Přileť z boku, zatoč na krátké finále a vyrovnej snos před dosednutím.',kind:'landing',wind:{east:0,north:6},gates:[gate(-3600,-2300,'Boční přílet · START',360,155),gate(-2300,-1500,'Zatáčka proti větru',260,130),...final.slice(1)]},
  {id:'short-runway',title:'Krátká dráha',description:'Vzlétnout musíš s kratším rozjezdem. Včas naber rychlost a stoupej.',kind:'takeoff',start:1100,gates:[gate(2250,0,'Odlepení · START',85,110),gate(3000,0,'Bezpečná výška · CÍL',180,145)]},
  {id:'dusk-landing',title:'Přistání za soumraku',description:'Dráha je při prvním náletu obsazená. Přidej výkon, přeleť ji bez dosednutí a vrať se na druhé přiblížení.',kind:'landing',time:'evening',gates:[gate(-2600,0,'Obsazená dráha · START',240,110),gate(-800,0,'Nepřistávej · přidej výkon',110,60),gate(1700,0,'Průlet bez dotyku',240,100),...circuit.slice(1)]},
  {id:'repeat-circuit',title:'Opakovaný okruh',description:'Dosedni do zóny, hned znovu přidej výkon a vzlétni. Po druhém okruhu přistaň; hodnotí se obě dosednutí.',kind:'landing',start:120,gates:[...circuit.slice(0,-1),{...landingZone,name:'Dosedni a znovu vzlétni',kind:'touch-and-go'},gate(2500,0,'Znovu ve vzduchu',210,130),...circuit.slice(1)]},
  {id:'emergency-landing',title:'Nouzové přistání',description:'Motor nepracuje. Z výškové rezervy doklouzej bez okliky rovnou na dráhu; na další nálet nemáš výkon.',kind:'landing',engineLimit:0,gates:[gate(-2600,0,'Motor vysazen · START',440,160),gate(-1200,0,'Hospodař s výškou',230,140),landingZone]}
];
export const RUNWAY_MISSIONS=specs.map(spec=>{
  const route={id:`${spec.id}-${spec.kind==='takeoff'?'v1':'v2'}`,radius:120,altitude:650,terrainFollowing:true,
    objective:spec.kind==='landing'?{type:'landing',heading,halfLength:550,halfWidth:28,headingTolerance:25}:{type:'takeoff'},
    gates:spec.gates.map(g=>({...g})),brief:spec.description,activity:({'first-landing':'Základy dosednutí','airport-circuit':'Okruh a zastavení',crosswind:'Boční přílet ve větru','dusk-landing':'Přerušené přiblížení','repeat-circuit':'Dosednutí a další vzlet','emergency-landing':'Let bez motoru'})[spec.id]};
  if(spec.start!==undefined)route.groundStart={...point(spec.start),heading};
  if(spec.wind)route.wind=spec.wind;
  if(spec.engineLimit!==undefined)route.engineLimit=spec.engineLimit;
  if(spec.stop)route.objective.stop={...point(spec.stop.end),speed:spec.stop.speed};
  return{id:spec.id,place:'brno',location:brno,title:spec.title,description:spec.description,time:spec.time||'day',weather:spec.wind?'haze':'clear',recommended:'Hornoplošník',fixedRoute:true,training:true,route};
});
