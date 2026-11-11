// The story changes presentation and unlock order only. Flight routes, weather,
// scoring and existing save keys remain owned by the mission modules.
export const CHAPTERS=Object.freeze([
  {title:'První křídla',rank:'Kadet',award:'Pilotní průkaz',image:'/images/first-takeoff-mission-v1.jpg',intro:'Instruktorka Eva Novotná tě bere do kokpitu. Nejdřív musíš prokázat klidné ruce a vlastní úsudek.',ids:['first-takeoff','brno-landing','brno-discovery','brno','prague']},
  {title:'První služba',rank:'Pilot',award:'První služba',image:'/images/mission-fuji-v1.jpg',intro:'První skutečné lety tě zavedou za hranice domovského letiště. Posádka se učí spoléhat na tvé rozhodnutí.',ids:['fuji','giza','rio','iceland','stmaarten','kansai']},
  {title:'Za hranicí komfortu',rank:'Zkušený pilot',award:'Zkušený pilot',image:'/images/location-sf-v1.jpg',intro:'Města, noc a nízký let. Známé postupy platí, ale prostor pro chybu se zmenšuje.',ids:['sf','paris','nyc','sydney-harbour','grandcanyon','cape-peninsula']},
  {title:'Pod tlakem',rank:'Velitel letu',award:'Velitelské křídlo',image:'/images/world-madeira-v1.jpg',intro:'Přicházejí náročné přílety a těsný terén. Instruktorka už jen sleduje, jak vedeš let.',ids:['canyon-patrol','sfo-arrival','queenstown','madeira','innsbruck','monument-valley']},
  {title:'Velitelská zkouška',rank:'Kapitán',award:'Šéfpilot FlyAtlasu',image:'/images/mission-everest-v1.jpg',intro:'Pět posledních letů. Každý prověří jinou dovednost; cílem je bezpečně dovést celou kariéru do konce.',ids:['matterhorn','gibraltar','santos-dumont','iguazu','everest']}
]);
export const CAREER_IDS=Object.freeze(CHAPTERS.flatMap(chapter=>chapter.ids));
export const CHAPTER_STARTS=Object.freeze([0,...CHAPTERS.slice(0,-1).map((_,index)=>CHAPTERS.slice(0,index+1).reduce((sum,chapter)=>sum+chapter.ids.length,0))]);
export function chapterFor(id){return CHAPTERS.find(chapter=>chapter.ids.includes(id));}
export function careerPosition(id){return CAREER_IDS.indexOf(id);}
export function careerRank(completed){
  const count=CAREER_IDS.filter(id=>completed.has(id)).length;
  if(count===CAREER_IDS.length)return'Šéfpilot';
  let index=0;for(let i=1;i<CHAPTER_STARTS.length;i++)if(count>=CHAPTER_STARTS[i])index=i;
  return CHAPTERS[index].rank;
}
const SITUATIONS={
  'first-takeoff':'První kontrolní let. Eva ti předává řízení na dráze.',
  'brno-landing':'Věž potvrzuje volnou dráhu. Ukaž bezpečné dosednutí.',
  'brno-discovery':'Před prvním samostatným letem musíš poznat město z výšky.',
  brno:'Dnes letíš bez vedení. Dostaň se nad hrady a zpět na trasu.',
  prague:'První přelet mimo Brno. Vltava ti bude sloužit jako vodítko.',
  fuji:'Ranní služba začíná u Fudži. Sleduj terén a drž rytmus.',
  giza:'Pouštní orientace bez známých městských bodů.',
  rio:'Pobřeží a hory tě poprvé přinutí plánovat zatáčky dopředu.',
  iceland:'Přes vodopády se mění viditelnost. Udrž jistý kurz.',
  stmaarten:'Přílet nad pláží. Posádka čeká klidné finále.',
  kansai:'Soumrak nad mořem. Ostrovní dráhu najdi včas.',
  sf:'Ranní opar skrývá další bránu. Naviguj podle zálivu.',
  paris:'Noční Seina je úzká navigační linie. Nespěchej do zatáček.',
  nyc:'Dlouhý koridor pod zataženou oblohou prověří soustředění.',
  'sydney-harbour':'Nízký okruh nad přístavem vyžaduje přesnou výšku.',
  grandcanyon:'Skalní stěny mění měřítko. Čti trasu před sebou.',
  'cape-peninsula':'Oblétni Stolovou horu s rezervou pro návrat.',
  'canyon-patrol':'Hlídka v kaňonu. Každá odchylka od koridoru se počítá.',
  'sfo-arrival':'Přílet přes záliv. Připrav přiblížení ještě nad vodou.',
  queenstown:'Údolí se zužuje. Rozhodni se pro finále včas.',
  madeira:'Zatáčka nad oceánem a krátké srovnání na osu.',
  innsbruck:'Hory nechávají málo místa. Drž rychlost a plán.',
  'monument-valley':'Nízký let mezi skalami. Klidné řízení vyhrává.',
  matterhorn:'Alpská hrana prověří prostorovou orientaci.',
  gibraltar:'Na konci dráhy čeká moře. Dosaď přesně a zastav.',
  'santos-dumont':'Krátká městská dráha. Celý přílet musí být pod kontrolou.',
  iguazu:'Nad vodopády drž koridor i výšku bez oprav na poslední chvíli.',
  everest:'Poslední let vede do nejvyššího terénu. Všechno je na tobě.'
};
export function missionSituation(id){return SITUATIONS[id]||'Eva čeká na bezpečné dokončení letu.';}
export function masteryChallenge(mission){
  const type=mission.route.objective?.type;
  if(type==='landing'||type==='lowflight')return'Výzva mistrovství: získej 80+ bodů a překonej svůj rekord.';
  if(type==='sightseeing')return'Výzva mistrovství: objev všechna místa a překonej svůj čas.';
  return'Výzva mistrovství: dokonči trasu ve zlatém čase a překonej svůj rekord.';
}
