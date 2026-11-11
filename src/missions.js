import {BRNO_ROUTE,routeStart} from './brno-race.js';
import {LOCATIONS} from './locations.js';
import {missionVariant,challengeRoute} from './mission-difficulty.js';
import {WORLD_MISSIONS} from './world-missions.js';
import {TASK_MISSIONS} from './task-missions.js';
import {RUNWAY_MISSIONS} from './runway-missions.js';
import {EXPEDITION_MISSIONS} from './expedition-missions.js';

const firstTakeoff=RUNWAY_MISSIONS.find(mission=>mission.id==='first-takeoff');
export const RETIRED_RUNWAY_MISSIONS=RUNWAY_MISSIONS.filter(mission=>mission!==firstTakeoff);

// Briefing ratings describe the published missions, independently of medals.
const introMissions=new Set(['first-takeoff','brno-discovery']);
const advancedMissions=new Set(['sf','paris','nyc','everest','matterhorn','grandcanyon','canyon-patrol','madeira','gibraltar','sfo-arrival','innsbruck','queenstown','santos-dumont','cape-peninsula','monument-valley','iguazu']);

// Designed game routes: approximate landmark positions, heights in WGS84 metres.
export const MISSIONS=[
  {id:'brno',place:'brno',title:'Nad moravskými hrady',description:'Od Petrova přes Špilberk k přehradě a hradu Veveří.',time:'day',weather:'clear',difficulty:'Úvodní trasa',route:BRNO_ROUTE},
  {id:'prague',place:'prague',title:'Zlatá Vltava',description:'Sleduj řeku od Vyšehradu až k severnímu okraji Prahy.',time:'evening',weather:'partly',difficulty:'Plynulé zatáčky',route:{id:'prague-vltava-v1',radius:200,altitude:650,gates:[
    {name:'Vyšehrad · START',lat:50.064,lon:14.417},
    {name:'Národní divadlo',lat:50.081,lon:14.411},
    {name:'Karlův most',lat:50.0865,lon:14.4114},
    {name:'Letná',lat:50.097,lon:14.417},
    {name:'Troja · CÍL',lat:50.12,lon:14.423}]}},
  {id:'sf',place:'sf',title:'Ranní záliv',description:'Z přístavu přes Alcatraz k ikonickému Golden Gate.',time:'morning',weather:'haze',difficulty:'Snížená viditelnost',route:{id:'sf-bay-v1',radius:240,altitude:650,gates:[
    {name:'Ferry Building · START',lat:37.7955,lon:-122.3937},
    {name:'Pier 39',lat:37.812,lon:-122.410},
    {name:'Alcatraz',lat:37.8267,lon:-122.423},
    {name:'Severní záliv',lat:37.836,lon:-122.45},
    {name:'Golden Gate · CÍL',lat:37.8199,lon:-122.4783}]}},
  {id:'paris',place:'paris',title:'Noční Seina',description:'Najdi cestu nad Seinou od Eiffelovy věže k Notre-Dame.',time:'night',weather:'clear',difficulty:'Noční navigace',route:{id:'paris-seine-v1',radius:200,altitude:550,gates:[
    {name:'Eiffelova věž · START',lat:48.8584,lon:2.2945},
    {name:'Pont des Invalides',lat:48.863,lon:2.31},
    {name:'Place de la Concorde',lat:48.865,lon:2.321},
    {name:'Louvre',lat:48.859,lon:2.337},
    {name:'Notre-Dame · CÍL',lat:48.853,lon:2.3499}]}},
  {id:'nyc',place:'nyc',title:'Hudson Express',description:'Podél Manhattanu až k Soše svobody pod zataženou oblohou.',time:'day',weather:'overcast',difficulty:'Dlouhá rychlá trasa',route:{id:'nyc-hudson-v1',radius:240,altitude:800,gates:[
    {name:'George Washington Bridge · START',lat:40.8517,lon:-73.9527},
    {name:'Upper West Side',lat:40.793,lon:-73.985},
    {name:'Intrepid',lat:40.765,lon:-74.005},
    {name:'Battery Park',lat:40.703,lon:-74.023},
    {name:'Socha svobody · CÍL',lat:40.6892,lon:-74.0445}]}},
  ...WORLD_MISSIONS,
  ...TASK_MISSIONS,
  firstTakeoff,
  ...EXPEDITION_MISSIONS
].map(mission=>({...mission,difficultyStars:introMissions.has(mission.id)?1:advancedMissions.has(mission.id)?3:2,
  route:mission.taskVariants?.easy||mission.route,location:mission.location||LOCATIONS.find(place=>place.id===mission.place)}));
export function getMission(id,level='easy',model='highWing'){
  const base=MISSIONS.find(mission=>mission.id===id)||RETIRED_RUNWAY_MISSIONS.find(mission=>mission.id===id)||MISSIONS[0];
  const mission=missionVariant(base,level);
  return mission.aircraftRoutes?{...mission,route:mission.aircraftRoutes[model]||mission.aircraftRoutes.highWing}:mission;
}
export function getPlayableMission(id,model){
  const lesson=['first-takeoff','brno-landing','brno-discovery'].includes(id);
  const mission=getMission(id,lesson?'easy':id==='brno'?'normal':'hard',model);
  if(lesson||RETIRED_RUNWAY_MISSIONS.some(item=>item.id===id))return mission;
  return{...mission,route:challengeRoute(mission,model)};
}
export const missionStart=mission=>({...mission.route.groundStart||routeStart(mission.route),name:mission.location.name+' · '+mission.title});
export const TIME_NAMES={morning:'Ráno',day:'Den',evening:'Podvečer',night:'Noc'};
export const WEATHER_NAMES={clear:'Jasno',partly:'Polojasno',haze:'Opar',overcast:'Zataženo'};


// Teaching order is independent of saved unlocks and mission records.
export const BRNO_LESSONS=[
  {title:'Základy letu',ids:['first-takeoff','brno-landing']},
  {title:'Navigace a objevování',ids:['brno-discovery','brno']}
];
