import {EARTH,RAD,offsetMeters} from './flight.js';
import {gateFrame} from './brno-race.js';

export const DIFFICULTIES={
  easy:{name:'Lehká',description:'Velké kruhy, mírné zatáčky a rezerva nad terénem. Původní mise zůstávají beze změny.'},
  normal:{name:'Střední',description:'Menší kruhy, střídání výšek a výraznější změny směru.'},
  hard:{name:'Těžká',description:'Přesné průlety nízko nad povrchem, ostré zatáčky a úzké koridory. Doporučený hornoplošník nebo stíhačka.'}
};
// Authored intermediate routes, with side-to-side turns rather than scaled easy paths.
const NORMAL={
  brno:[[49.19083,16.6075,'Petrov'],[49.198,16.593,'Úbočí Špilberku'],[49.2046,16.5835,'Kraví hora'],[49.231,16.535,'Nad Bystrcí'],[49.249,16.487,'Přehrada']],
  prague:[[50.064,14.417,'Vyšehrad'],[50.078,14.407,'Smíchovský oblouk'],[50.0865,14.4114,'Karlův most'],[50.094,14.425,'Vltavský oblouk'],[50.113,14.415,'Podbaba']],
  sf:[[37.7955,-122.3937,'Přístav'],[37.812,-122.41,'Pier 39'],[37.8267,-122.423,'Alcatraz'],[37.81,-122.448,'Marina'],[37.8199,-122.4783,'Golden Gate']],
  paris:[[48.8584,2.2945,'Eiffelova věž'],[48.863,2.307,'Seina'],[48.858,2.321,'Invalidovna'],[48.863,2.336,'Tuileries'],[48.853,2.3499,'Notre-Dame']],
  nyc:[[40.8517,-73.9527,'Severní Hudson'],[40.795,-73.987,'Riverside'],[40.765,-74.005,'Intrepid'],[40.715,-74.018,'Battery Park City'],[40.6892,-74.0445,'Socha svobody']]
};
// Coordinates target open parks, water and streets; heights are resolved from the loaded 3D surface.
const HARD={
  brno:[[49.1907,16.6051,'Denisovy sady'],[49.1945,16.5966,'Západní úbočí Špilberku'],[49.2002,16.601,'Obilní trh'],[49.2047,16.5848,'Kraví hora'],[49.213,16.571,'Žabovřeské údolí']],
  prague:[[50.064,14.414,'Vltava pod Vyšehradem'],[50.0775,14.4107,'Slovanský ostrov'],[50.0835,14.4077,'Kampa'],[50.0915,14.414,'Oblouk pod Letnou'],[50.099,14.424,'Štvanice']],
  sf:[[37.823,-122.432,'Západně od Alcatrazu'],[37.81,-122.433,'Fort Mason'],[37.81,-122.455,'Crissy Field'],[37.8203,-122.47,'Nástup k mostu'],[37.8203,-122.4785,'Pod Golden Gate']],
  paris:[[48.856,2.287,'Seina u Bir-Hakeim'],[48.8588,2.301,'Quai Branly'],[48.864,2.313,'Nad Seinou'],[48.8605,2.329,'Musée d’Orsay'],[48.8565,2.339,'Pont Neuf']],
  // Follow Broadway south through Midtown; the plazas give room to line up each turn.
  nyc:[[40.758,-73.9855,'Times Square',150],[40.754,-73.9864,'Broadway v Midtownu',160],[40.7497,-73.9878,'Herald Square',155],[40.7455,-73.989,'Madison Square',165],[40.7412,-73.9897,'Flatiron / Broadway',150]]
};
function nudge(point,north,east){return{lat:point.lat+north/EARTH/RAD,lon:point.lon+east/(EARTH*Math.cos(point.lat*RAD))/RAD};}

export function missionVariant(mission,level='easy'){
  const difficulty=Object.hasOwn(DIFFICULTIES,level)?level:'easy';
  if(mission.fixedRoute)return{...mission,level:difficulty};
  if(mission.taskVariants)return{...mission,level:difficulty,route:mission.taskVariants[difficulty]};
  if(difficulty==='easy')return{...mission,level:difficulty}; // Preserve the original layout and records exactly.
  const hard=difficulty==='hard',nodes=mission.variants?.[difficulty]||(hard?HARD:NORMAL)[mission.id];
  const clearances=hard?[120,32,95,32,40]:[280,150,260,140,220];
  const radius=hard?24:90;
  const gates=nodes.map(([lat,lon,label,height],index)=>({lat,lon,name:label+(index===0?' · START':index===nodes.length-1?' · CÍL':''),radius,clearance:height??(mission.route.terrainFollowing?(hard?[180,65,160,60,100]:[600,350,550,300,450])[index]:clearances[index]),altitude:mission.route.altitude+[0,-120,60,-140,-60][index]}));
  if(hard&&mission.id==='nyc')gates.forEach(gate=>{gate.radius=70;});
  if(hard&&mission.id==='sf'){
    // Sample the water east of the span rather than the bridge deck.
    gates[4]={...gates[4],radius:18,clearance:30,surfaceReference:{lat:37.8203,lon:-122.4735},underpass:{halfLength:95,halfWidth:55,ceiling:55}};
  }
  return{...mission,level:difficulty,route:{...mission.route,id:mission.route.id+'-'+difficulty+(hard&&mission.id==='nyc'?'-v2':'-v1'),radius,gates}};
}

const challengeDetails={
  prague:{skim:[1,2],brief:'Sestup k Vltavě a proleť nízko podél nábřeží. Před zatáčkami zpomal.'},
  sf:{brief:'Sestup nad vodu. Poslední brána vede pod středním rozpětím Golden Gate.'},
  paris:{skim:[2,4],brief:'V noci sleduj Seinu. Nízké brány tě povedou těsně nad řekou.'},
  nyc:{brief:'Leť po Broadway mezi mrakodrapy přes Times Square, Herald Square a Flatiron. Široké brány a plynulá trasa ti dávají čas na korekce.'},
  matterhorn:{skim:[2,3],wind:{north:-4,east:6},gustStrength:.85,brief:'Pod hřebenem se drž u svahu. V horských poryvech průběžně koriguj náklon i výšku.'},
  grandcanyon:{skim:[1,3],brief:'Sestup ke Coloradu a proleť nízko mezi skalními stěnami. Další zatáčku si připrav před branou.'},
  'canyon-patrol':{minimumScore:55,brief:'Sleduj řeku v úzkém výškovém pásmu i mezi branami. Připrav si další zatáčku předem.'},
  madeira:{wind:{north:6,east:-8},gustStrength:1,brief:'U pobřeží fouká silný nárazový vítr. Před dráhou 05 srovnej osu a průběžně vyrovnávej snos.'},
  innsbruck:{wind:{north:-3,east:-5},gustStrength:.8,brief:'V údolí Innu čekej silné poryvy. Udrž řízený sestup a po dosednutí zastav před koncem dráhy.'},
  'sfo-arrival':{engineFailureAfterGate:1,brief:'Při nočním příletu s náhradními díly se ozve varování motoru. Hlídej rychlost a dokonči přiblížení na dráhu 28R.'},
  'cape-peninsula':{engineFailureAfterGate:1,brief:'Mapuješ pobřeží u Stolové hory a motor začíná kolísat. Než zamíříš ke svahu, připrav si výškovou rezervu.'},
  'monument-valley':{skim:[1,2,3],minimumScore:55,brief:'Proleť nízko mezi skalními věžemi a zůstaň v koridoru i při stoupání k poslední bráně.'},
  iguazu:{wind:{north:5,east:4},gustStrength:.75,brief:'Nad kaskádami čekej boční nárazy. Drž výšku a koriguj snos podél řeky.'}
};

export function challengeRoute(mission,model){
  const {route}=mission,details=challengeDetails[mission.id]||{};
  const {skim,minimumScore,...scenario}=details;
  const type=route.objective?.type;
  const aircraftScale=model==='airliner'?1.45:model==='lowWing'?1.15:1;
  const radiusScale=(mission.fixedRoute ? .58 : 1)*aircraftScale;
  const gates=route.gates.map((gate,index)=>{
    if(gate.kind==='landing'||gate.kind==='touch-and-go'||gate.underpass)return gate;
    const radius=Math.round((gate.radius??route.radius)*radiusScale);
    if(skim?.includes(index))return{...gate,radius,clearance:radius,groundSkim:true};
    return{...gate,radius};
  });
  let objective=route.objective;
  if(type==='landing'){
    objective={...objective,halfLength:objective.halfLength*.75,halfWidth:objective.halfWidth*.8,headingTolerance:13};
  }else if(type==='lowflight'){
    const {minHeight,maxHeight,corridor}=objective;
    const rockSlalom=mission.id==='monument-valley';
    objective={...objective,minHeight:rockSlalom?20:minHeight,maxHeight:rockSlalom?240:maxHeight,
      corridor:Math.round(corridor*(mission.fixedRoute ? .56 : .8)),minimumScore:minimumScore??40};
  }
  return{...route,...scenario,id:route.id+'-challenge-v1',terrainFollowing:true,objective,gates};
}

// Sample across each gate so its opening clears terrain even on uneven ground.
export function routeSurfacePoints(route){
  return route.gates.flatMap((gate,index)=>{
    if(['landing','touch-and-go'].includes(gate.kind)||route.objective?.type==='sightseeing')return[{lat:gate.lat,lon:gate.lon}];
    if(gate.surfaceReference)return[{...gate.surfaceReference}];
    const {right}=gateFrame(index,route),radius=gate.radius??route.radius;
    return[nudge(gate,0,0),nudge(gate,-right.y*radius,-right.x*radius),nudge(gate,right.y*radius,right.x*radius)];
  });
}
export function resolveRouteSurface(route,heights){
  let cursor=0;
  const gates=route.gates.map(gate=>{
    const count=gate.surfaceReference||['landing','touch-and-go'].includes(gate.kind)||route.objective?.type==='sightseeing'?1:3,samples=heights.slice(cursor,cursor+=count);
    if(samples.length!==count||samples.some(value=>!Number.isFinite(value)))throw new Error('Povrch trasy není dostupný');
    const surface=Math.max(...samples),radius=gate.radius??route.radius;
    const minimumClearance=radius+(gate.groundSkim?0:8);
    return{...gate,surface,altitude:surface+(['landing','touch-and-go'].includes(gate.kind)?3:Math.max(gate.clearance,minimumClearance))};
  });
  return{...route,gates,altitude:gates[0].altitude,resolved:true};
}
// A top-down height query sees the bridge deck even when flying below it.
// Only the authored centre-span corridor uses the measured nearby water level.
export function underpassSurface(route,state,sampledSurface){
  for(const [index,gate] of route.gates.entries()){
    if(!gate.underpass||!Number.isFinite(gate.surface))continue;
    const offset=offsetMeters(state.lat,state.lon,gate),{normal,right}=gateFrame(index,route),pass=gate.underpass;
    if(Math.abs(offset.x*normal.x+offset.y*normal.y)<=pass.halfLength&&Math.abs(offset.x*right.x+offset.y*right.y)<=pass.halfWidth&&state.altitude<gate.surface+pass.ceiling)return gate.surface;
  }
  return sampledSurface;
}
