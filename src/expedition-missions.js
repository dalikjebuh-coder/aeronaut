import {EARTH,RAD} from './flight.js';
import {EXPEDITION_PLACES,EXPEDITION_AIRPORTS} from './expedition-data.js';

// Authored game scenarios on real geography, not published flight procedures.
function offset(origin,heading,along,side=0){
  const angle=heading*RAD,north=Math.cos(angle)*along-Math.sin(angle)*side,east=Math.sin(angle)*along+Math.cos(angle)*side;
  return {lat:origin.lat+north/EARTH/RAD,lon:origin.lon+east/(EARTH*Math.cos(origin.lat*RAD))/RAD};
}
const airportSpecs=[
  {id:'madeira',title:'Madeira · zatáčka nad oceánem',description:'Oblétni pobřeží, zatoč na finále dráhy 05 a vyrovnej boční vítr před dosednutím.',activity:'Pobřežní zatáčka a vítr',recommended:'Citation',time:'day',weather:'overcast',wind:{north:2,east:-3},bend:2200},
  {id:'gibraltar',title:'Gibraltar · zastav před mořem',description:'Přileť ze zálivu, přistaň na dráze 09 a zastav před čárou. Přistání bez dojezdu nestačí.',activity:'Přistání a zastavení',recommended:'Citation',time:'day',weather:'haze',stop:true,bend:650},
  {id:'stmaarten',title:'Sint Maarten · finále nad pláží',description:'Přibližuj se nad Karibikem, srovnej osu dráhy 10 a přistaň za pláží Maho bez prudkého sestupu.',activity:'Nízké přiblížení nad mořem',recommended:'Citation',time:'day',weather:'partly'},
  {id:'sfo-arrival',title:'San Francisco · přílet přes záliv',description:'Udrž dlouhé stabilní přiblížení přes záliv a měkce přistaň na dráze 28R.',activity:'Dlouhé stabilní přiblížení',recommended:'Boeing 787',time:'night',weather:'clear'},
  {id:'kansai',title:'Kansai · ostrov za soumraku',description:'Najdi letištní ostrov v Ósackém zálivu a přistaň na dráze 06R. Dlouhé finále vyžaduje včasné zpomalení.',activity:'Ostrovní přílet',recommended:'Boeing 787',time:'evening',weather:'haze',wind:{north:2,east:0}},
  {id:'innsbruck',title:'Innsbruck · údolní přílet',description:'Sleduj údolí Innu od východu, postupně klesej a po přistání na dráze 26 zastav před koncem.',activity:'Údolní sestup a dojezd',recommended:'Citation',time:'morning',weather:'partly',bend:450,stop:true},
  {id:'queenstown',title:'Queenstown · z jezera do údolí',description:'Přileť nad jezerem Wakatipu, zatoč do Franktonu a dokonči krátké finále dráhy 05.',activity:'Jezero a horská zatáčka',recommended:'Hornoplošník',time:'evening',weather:'clear',bend:1800},
  {id:'santos-dumont',title:'Santos Dumont · krátká dráha v Riu',description:'Z moře zamiř na dráhu 02R, dosedni do její první části a zastav dřív, než znovu začne voda.',activity:'Přesné dosednutí a krátký dojezd',recommended:'Hornoplošník / Citation',time:'morning',weather:'clear',stop:true}
];
const models={highWing:{scale:.65,radius:130},lowWing:{scale:1,radius:190},airliner:{scale:1.45,radius:260},fighter:{scale:1.1,radius:210}};
function airportRoute(spec,model){
  const airport=EXPEDITION_AIRPORTS[spec.id],profile=models[model],threshold=offset(airport,airport.heading,airport.displaced);
  const usable=airport.length-airport.displaced,targetAlong=Math.min(600,usable*.27),halfLength=Math.min(300,usable*.13);
  const point=(along,side=0)=>offset(threshold,airport.heading,along,side);
  const gate=(along,side,name,clearance,radius)=>({...point(along,side),name,clearance,radius});
  const bend=(spec.bend||0)*profile.scale;
  const gates=[
    gate(-8500*profile.scale,bend,'Přílet · START',650*profile.scale,profile.radius),
    gate(-5000*profile.scale,bend*.45,bend?'Zatáčka na finále':'Stabilizuj přiblížení',390*profile.scale,profile.radius*.8),
    gate(-2700*profile.scale,0,'Srovnej osu dráhy',220*profile.scale,profile.radius*.55),
    gate(-1100*profile.scale,0,'Finále',95*profile.scale,Math.max(40,profile.radius*.28)),
    {...gate(targetAlong,0,'Přistávací zóna · CÍL',3,25),kind:'landing'}
  ];
  const objective={type:'landing',heading:airport.heading,halfLength,halfWidth:Math.min(25,airport.width/2-3),headingTolerance:18};
  if(spec.stop)objective.stop={...point(usable-200),speed:2};
  return {id:`world-${spec.id}-${model}-v1`,radius:profile.radius,altitude:1000,terrainFollowing:true,gates,objective,
    airport:{...airport,threshold},wind:spec.wind,activity:spec.activity,brief:spec.description};
}
const scenicSpecs=[
  {id:'sydney-harbour',title:'Sydney · přístavní okruh',description:'Od ústí zálivu přes Harbour Bridge k Opeře. Drž klidnou výšku nad vodou a sleduj jednotlivé cíle.',activity:'Přesný let nad přístavem',recommended:'Hornoplošník',type:'lowflight',time:'night',weather:'partly',band:[130,450],corridor:750,
    nodes:[[-33.823,151.286,'Vjezd do přístavu',320],[-33.848,151.255,'Bradleys Head',290],[-33.854,151.225,'Fort Denison',270],[-33.852,151.210,'Harbour Bridge',310],[-33.858,151.215,'Opera',290]]},
  {id:'cape-peninsula',title:'Kapské Město · kolem Stolové hory',description:'Z Atlantiku přes Camps Bay ke Stolové hoře. Střídej pobřežní oblouky se stoupáním k horskému panoramatu.',activity:'Pobřežní časovka a stoupání',recommended:'Citation',type:'time',time:'evening',weather:'overcast',
    nodes:[[-33.900,18.385,'Pobřeží Atlantiku',450],[-33.942,18.371,'Clifton',400],[-33.963,18.375,'Camps Bay',430],[-33.982,18.400,'Dvanáct apoštolů',700],[-33.958,18.425,'Stolová hora',600]]},
  {id:'monument-valley',title:'Monument Valley · mezi skalními věžemi',description:'Proleť pouštní oblouky mezi stolovými horami. Drž výškové pásmo a zatáčky plánuj už před další bránou.',activity:'Nízká pouštní hlídka',recommended:'Super Hornet / Hornoplošník',type:'lowflight',time:'day',weather:'haze',band:[150,550],corridor:950,
    nodes:[[36.968,-110.120,'Pouštní nástup',350],[36.985,-110.105,'Východní oblouk',320],[36.993,-110.089,'Merrick Butte',340],[37.010,-110.088,'West Mitten',360],[37.015,-110.065,'East Mitten',350]]},
  {id:'iguazu',title:'Iguazú · nad hranou vodopádů',description:'Sleduj řeku Iguaçu k Ďáblovu chřtánu, obleť kaskády a drž výšku nad lesním porostem.',activity:'Říční hlídka a vodopády',recommended:'Hornoplošník',type:'lowflight',time:'morning',weather:'haze',band:[120,420],corridor:800,
    nodes:[[-25.663,-54.430,'Horní řeka',280],[-25.682,-54.434,'Říční ostrovy',260],[-25.696,-54.437,'Ďáblův chřtán',300],[-25.687,-54.447,'Oblouk kaskád',280],[-25.681,-54.461,'Dolní kaňon',300]]}
];
function scenicRoute(spec){
  const objective=spec.type==='lowflight'?{type:'lowflight',minHeight:spec.band[0],maxHeight:spec.band[1],corridor:spec.corridor}:{type:'time'};
  return {id:`world-${spec.id}-v1`,radius:150,altitude:1100,terrainFollowing:true,objective,activity:spec.activity,brief:spec.description,
    gates:spec.nodes.map(([lat,lon,name,clearance],index)=>({lat,lon,name:name+(index===0?' · START':index===spec.nodes.length-1?' · CÍL':''),clearance,radius:150}))};
}
export const EXPEDITION_MISSIONS=[...airportSpecs,...scenicSpecs].map(spec=>{
  const aircraftRoutes=spec.nodes?null:Object.fromEntries(Object.keys(models).map(model=>[model,airportRoute(spec,model)]));
  const route=aircraftRoutes?.highWing||scenicRoute(spec),first=route.gates[0];
  return {id:spec.id,place:spec.id,title:spec.title,description:spec.description,time:spec.time,weather:spec.weather,recommended:spec.recommended,
    fixedRoute:true,expedition:true,aircraftRoutes,route,location:{...EXPEDITION_PLACES[spec.id],lat:first.lat,lon:first.lon}};
});
