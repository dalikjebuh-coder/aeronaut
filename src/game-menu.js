import {missionRecordKey,readMissionRecord,starLabel,starsForMedal} from './mission-performance.js';
import {aircraftProfile,offsetMeters} from './flight.js';
import {formatRaceTime} from './brno-race.js';
import {LOCATIONS} from './locations.js';
import {MISSIONS,getMission,TIME_NAMES,WEATHER_NAMES,BRNO_LESSONS} from './missions.js';
import {objectiveType,OBJECTIVE_NAMES,usesScore,missionBrief} from './task-missions.js';
import {missionCaption} from './menu-copy.js';
import {BRNO_MISSION_IDS,AIRCRAFT_LEVELS,MEDAL_NAMES,MEDAL_XP,missionProgress,medalTargets} from './mission-progression.js';
import {createHangarShowcase} from './hangar-showcase.js';
import {renderMissionMap} from './mission-map.js';
let aircraftChosen=false,hangarShowcase;
export const hasSelectedAircraft=()=>aircraftChosen;
let previewRouteId='';
const $=id=>document.getElementById(id);
const lessonIds=BRNO_LESSONS.flatMap(chapter=>chapter.ids);
const DISPLAY_MISSIONS=[...lessonIds.map(id=>getMission(id)),...MISSIONS.filter(mission=>!lessonIds.includes(mission.id))];
const chapterStarts=new Map(BRNO_LESSONS.map(chapter=>[chapter.ids[0],chapter.title]));
const CITY_GROUPS=Map.groupBy?Map.groupBy(DISPLAY_MISSIONS,mission=>mission.location.name):DISPLAY_MISSIONS.reduce((groups,mission)=>{
  const city=mission.location.name;if(!groups.has(city))groups.set(city,[]);groups.get(city).push(mission);return groups;
},new Map());
// The other missions use their existing destination photo. These two local photos
// give the three Brno missions different images without adding new downloads.
const MISSION_PHOTOS={
  'brno-discovery':{name:'Petrov',image:'/images/places/wiki-cs-81686.jpg',credit:'Michal Klajban',source:'https://commons.wikimedia.org/wiki/File:Brno,_katedr%C3%A1la_sv._Petra_a_Pavla.jpg',license:'CC BY-SA 3.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0'},
  brno:{name:'Hrad Veveří',image:'/images/places/wiki-cs-26471.jpg',credit:'Dominik Matus',source:'https://commons.wikimedia.org/wiki/File:Hrad_Veve%C5%99%C3%AD_-_leteck%C3%BD_pohled_05_upraveny.jpg',license:'CC BY-SA 3.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0'},
  ...Object.fromEntries(['first-takeoff','first-landing','airport-circuit','crosswind','short-runway','dusk-landing','repeat-circuit','emergency-landing'].map(id=>[id,{name:'Ilustrace letištního provozu',image:`/images/${id}-mission-v1.jpg`,credit:'Ilustrační obrázek vytvořený AI',source:'',license:'',licenseUrl:'',generated:true}]))
};
const AIRCRAFT={
  highWing:{name:'Hornoplošník',category:'LEHKÝ VRTULOVÝ LETOUN',handling:'Klidná',advice:'Pro první let. Klidné reakce a pomalejší tempo.'},
  lowWing:{name:'Citation',category:'BUSINESS JET',handling:'Vyvážená',advice:'Dobrý začátek i pro časovku. Svižný, ale dobře čitelný stroj.'},
  airliner:{name:'Boeing 787',category:'DOPRAVNÍ LETOUN',handling:'Setrvačná',advice:'Pro trpělivé piloty. Zatáčky i změny rychlosti plánuj s předstihem.'},
  fighter:{name:'Super Hornet',category:'F/A-18E/F / STÍHACÍ LETOUN',handling:'Velmi obratná',advice:'Pro zkušenější piloty. Rychlé reakce a výrazné zrychlení.'}
};
export function syncGameMenu({running=false,busy=false,mode='google',hasToken=false,step=1,place=LOCATIONS[0],mission=getMission()}={}){
  const progress=missionProgress();
  for(const button of document.querySelectorAll('[data-select]')){
    const select=$(button.dataset.select),aircraft=button.dataset.select==='aircraftModel',required=AIRCRAFT_LEVELS[button.dataset.choice],locked=aircraft&&progress.level<required;
    const selected=select.value===button.dataset.choice&&(!aircraft||aircraftChosen);
    button.setAttribute('aria-pressed',String(selected));button.disabled=select.disabled||locked;
    if(aircraft){button.dataset.unlock=locked?`Úroveň ${required}`:'';button.setAttribute('aria-label',locked?`${AIRCRAFT[button.dataset.choice].name}. Odemkne se na úrovni ${required}.`:AIRCRAFT[button.dataset.choice].name);}
  }
  const model=$('aircraftModel').value,info=AIRCRAFT[model]||AIRCRAFT.lowWing;
  $('hangarName').textContent=aircraftChosen?info.name:'Prázdný hangár';$('hangarClass').textContent=aircraftChosen?info.category:'VYBER SVŮJ STROJ';
  $('hangarInfo').hidden=!aircraftChosen;
  if(aircraftChosen)hangarShowcase?.select(model,info.name);
  $('hangarSpeed').replaceChildren(document.createTextNode(`${Math.round(aircraftProfile(model).maxSpeed*3.6)} `),Object.assign(document.createElement('small'),{textContent:'km/h'}));
  $('hangarHandling').textContent=info.handling;$('hangarAdvice').textContent=info.advice;
  const race=$('gameMode').value==='missions';
  $('pilotProgress').textContent=`${progress.rank} · ${progress.xp} XP · ${progress.stars} / ${progress.maxStars} ★${progress.nextCareerXp===null?'':` · dalších ${progress.nextCareerXp-progress.xp} XP: ${progress.nextRank}`}`;
  $('missionPilotProgress').textContent=`${progress.rank} · ${progress.stars} / ${progress.maxStars} ★ · ${progress.xp} XP`;
  $('missionCareerNext').textContent=progress.nextRank?`Ještě ${progress.nextCareerXp-progress.xp} XP → ${progress.nextRank}`:'Nejvyšší pilotní hodnost';
  const levelStart=progress.careerStartXp;
  $('missionXpProgress').max=progress.nextCareerXp===null?1:progress.nextCareerXp-levelStart;
  $('missionXpProgress').value=progress.nextCareerXp===null?1:progress.xp-levelStart;
  $('sidebar').dataset.gameMode=race?'missions':'free';
  const type=objectiveType(mission.route),scored=usesScore(mission.route);
  const best=readMissionRecord(missionRecordKey(mission,model,$('timeOfDay').value,$('weather').value,mode),scored);
  $('racePreviewBest').textContent=scored?(best===null?'—':best+' / 100'):formatRaceTime(best);
  $('raceBestLabel').textContent=scored?'NEJLEPŠÍ HODNOCENÍ':'OSOBNÍ REKORD';
  $('missionPersonalBest').textContent=`${mode==='demo'?'Offline · ':''}Osobní rekord · ${info.name}: ${$('racePreviewBest').textContent}`;
  $('missionObjectiveLabel').textContent=(mission.route.activity||OBJECTIVE_NAMES[type]).toUpperCase();
  $('missionObjectiveBrief').textContent=missionBrief(mission.route)+(mission.recommended?' Doporučený stroj: '+mission.recommended+'.':'');
  $('menuMapStatus').textContent=mode==='demo'?'OFFLINE TRÉNINK / SYNTETICKÁ KRAJINA':hasToken?'SVĚT / REÁLNÉ 3D MAPY':'SVĚT / PŘIPOJENÍ MAP';
  $('setupStep').hidden=step!==1;$('gameTypeStep').hidden=step!==2;$('locationStep').hidden=step!==3;
  $('sidebar').dataset.step=String(step);
  $('sidebar').style.setProperty('--destination-image',`url("${place.image||'/images/weather-haze-v1.jpg'}")`);
  for(const [id,number] of [['stepSetup',1],['stepGameType',2],['stepLocation',3]]){$(id).setAttribute('aria-current',step===number?'step':'false');$(id).disabled=busy||running||number>1&&!aircraftChosen;}
  $('locationBack').hidden=step===1||running;$('locationBack').disabled=busy;
  $('destinationStepLabel').textContent=race?'Mise':'Lokalita';
  $('freeAtmosphere').hidden=race;$('missionConditionsNote').hidden=!race;$('missionCards').hidden=!race;
  $('missionBrowser').hidden=!race;
  $('freeFlightSetup').hidden=race;
  $('missionModeCount').textContent=`PILOT · ÚROVEŇ ${progress.level}`;
  $('missionCount').textContent=`${progress.completed.size} / ${MISSIONS.length} splněno`;
  const nextLesson=DISPLAY_MISSIONS.find(item=>progress.unlocked.has(item.id)&&!progress.completed.has(item.id));
  $('missionListGuidance').textContent=nextLesson?`Další doporučená mise: ${nextLesson.title}.`:'Všechny mise dokončeny. Zlepšuj své medaile a rekordy.';
  const level=mission.level||'easy',diameters=mission.route.gates.map(gate=>2*(gate.radius??mission.route.radius));
  $('missionDifficultyHint').textContent='Sleduj žluté brány v pořadí. Plynulý průlet je rychlejší.';
  const low=Math.min(...diameters),high=Math.max(...diameters);
  $('missionDifficultyStats').textContent=`Průměr kruhů: ${low===high?low:low+'–'+high} m · ${mission.route.gates.length} ${mission.route.gates.length<5?'brány':'bran'}`;
  $('missionRouteChallenge').textContent=level==='hard'?({brno:'Nízké průlety parky a údolím, střídání svahů a ostré změny směru.',prague:'Těsně nad Vltavou, mezi ostrovy a městskými nábřežími.',sf:'Sestup k vodě a závěrečný průlet pod hlavním rozpětím Golden Gate.',paris:'Noční sestupy nad Seinou a prudší zatáčky mezi nábřežími.',nyc:'Městský slalom po Broadwayi mezi vysokými budovami.'}[mission.id]||mission.challenge):level==='normal'?'Nová trasa se střídáním stoupání, klesání a zatáček. Výšky se při startu přizpůsobí povrchu mapy.':mission.route.terrainFollowing?'Vyhlídková trasa s velkými kruhy a větší rezervou nad terénem. Výšky se nastaví podle načteného povrchu.':'Dokonči trasu a zlepšuj čas pro vyšší medaili.';
  if(type!=='time'){
    $('missionDifficultyHint').textContent=type==='sightseeing'?'Proleť každým kuželem. Stačí jeden průlet, bez čekání a omezení rychlosti.':type==='landing'?'Přistaň ve vyznačené zóně správným směrem a bezpečnou rychlostí.':type==='takeoff'?'Rozjeď se po dráze, vzlétni a proleť stoupací brány.':'Drž správnou výšku a koridor mezi branami.';
    $('missionRouteChallenge').textContent=missionBrief(mission.route);
    $('missionDifficultyStats').textContent=type==='landing'?`Zóna ${mission.route.objective.halfLength*2} × ${mission.route.objective.halfWidth*2} m · směr ±${mission.route.objective.headingTolerance}°`:type==='sightseeing'?`5 památek · průlet kuželem · automatické uložení do sbírky`:type==='takeoff'?`${mission.route.gates.length} stoupací brány · vzlet z dráhy`:`Výška ${mission.route.objective.minHeight}–${mission.route.objective.maxHeight} m · koridor ±${mission.route.objective.corridor} m`;
  }
  $('racePreviewTitle').textContent=mission.title;
  $('racePreviewPlace').textContent=mission.location.name.toUpperCase()+' / NÁHLED TRASY';
  $('racePreviewConditions').textContent=`${TIME_NAMES[mission.time]} · ${WEATHER_NAMES[mission.weather]} · pevné podmínky`;
  const photo=MISSION_PHOTOS[mission.id]||mission.location;
  $('missionPhoto').src=photo.image;
  $('missionPhoto').alt=`${photo.name} – tematický obrázek mise ${mission.title}`;
  $('missionPhotoLabel').textContent=photo.name;
  $('missionPhotoSource').href=photo.source;$('missionPhotoSource').textContent=photo.credit;
  $('missionPhotoLicense').href=photo.licenseUrl;$('missionPhotoLicense').textContent=photo.license;
  $('missionPhotoCreditTitle').textContent=photo.source?'Foto':'Ilustrace';
  $('missionPhotoSource').hidden=Boolean(photo.generated);
  $('missionPhotoGeneratedCredit').hidden=!photo.generated;
  $('missionPhotoLicenseSeparator').hidden=!photo.license;
  $('missionPhotoLicense').hidden=!photo.license;
  if(previewRouteId!==mission.route.id){renderRoute(mission);previewRouteId=mission.route.id;}
  $('horizonMissionPlace').textContent=mission.location.name;
  $('horizonMissionDescription').textContent=missionCaption(mission);
  $('horizonMissionConditions').textContent=`${TIME_NAMES[mission.time]} · ${WEATHER_NAMES[mission.weather]}${mission.training?' · Výcvik pro hornoplošník':mission.expedition?' · Doporučeno: '+mission.recommended:''}`;
  $('horizonMissionLength').textContent=$('raceRouteLength').textContent;
  const targets=medalTargets(mission,model),earned=progress.medals.get(mission.id);
  const unlocked=progress.unlocked.has(mission.id);
  $('missionDetails').dataset.state=unlocked?earned?'completed':'ready':'locked';
  $('missionRewardXp').textContent=earned==='gold'?'100 XP získáno':`Až +${MEDAL_XP.gold-(MEDAL_XP[earned]||0)} XP`;
  for(const medal of ['bronze','silver','gold'])$(`mission${medal[0].toUpperCase()+medal.slice(1)}Xp`).textContent=`${MEDAL_XP[medal]} XP`;
  $('missionStars').textContent=starLabel(starsForMedal(earned));
  $('missionStars').setAttribute('aria-label',`${starsForMedal(earned)} ze 3 hvězd`);
  $('missionMedalHint').textContent=`${earned?`Nejlepší medaile: ${MEDAL_NAMES[earned]}. `:'Medaile zatím nezískána. '}${type==='sightseeing'?'Tři hvězdy za všechna místa. Bez časového limitu.':scored?'Zlato od 80 bodů · stříbro od 55 · bronz za dokončení.':`Zlato do ${formatRaceTime(targets.gold)} · stříbro do ${formatRaceTime(targets.silver)} · bronz za dokončení.${type==='sightseeing'?' Bez časového limitu pro splnění.':''}`}`;
  $('missionBestMedal').textContent=earned?`Získáno: ${MEDAL_NAMES[earned]}`:'Zatím bez medaile';
  $('missionBronzeTarget').textContent='Dokonči misi';
  $('missionSilverTarget').textContent=type==='sightseeing'?'Všechna místa = 3 ★':scored?'Od 55 bodů':`Do ${formatRaceTime(targets.silver)}`;
  $('missionGoldTarget').textContent=type==='sightseeing'?`Všech ${mission.route.gates.length} památek`:scored?'Od 80 bodů':`Do ${formatRaceTime(targets.gold)}`;
  for(const medal of document.querySelectorAll('.mission-medal'))medal.dataset.earned=String(({bronze:1,silver:2,gold:3}[earned]||0)>=({bronze:1,silver:2,gold:3}[medal.dataset.medal]||0));
  $('missionTaskSummary').textContent=mission.route.brief|| (type==='landing'?'Proleť naváděcí brány a měkce přistaň ve vyznačené zóně.':type==='takeoff'?'Vzleť z dráhy a proleť stoupací brány.':type==='sightseeing'?'Objev 5 památek průletem žlutými kužely.':type==='lowflight'?`Proleť 5 bran ve výšce ${mission.route.objective.minHeight}–${mission.route.objective.maxHeight} m nad terénem.`:`Proleť ${mission.route.gates.length} bran v pořadí. Rozhoduje tvůj čas.`);
  if(mission.training&&model!=='highWing')$('missionTaskSummary').textContent='Tento výcvik je navržený pro hornoplošník. '+$('missionTaskSummary').textContent;
  const brnoIndex=BRNO_MISSION_IDS.indexOf(mission.id);
  $('missionNextGuidance').hidden=unlocked&&(Boolean(earned)||brnoIndex<0);
  $('missionNextGuidance').textContent=!unlocked?brnoIndex>0?`Nejdřív splň: ${getMission(BRNO_MISSION_IDS[brnoIndex-1]).title}`:'Svět odemkneš dokončením Brna.':brnoIndex===BRNO_MISSION_IDS.length-1?'Odemkneš mise po celém světě.':brnoIndex>=0?`Odemkneš: ${getMission(BRNO_MISSION_IDS[brnoIndex+1]).title}`:'';
  if(race&&step===3&&!running){$('startButton').querySelector('span').textContent=unlocked?earned?earned==='gold'?'Letět znovu':'Zlepšit medaili':'Spustit misi':'Pokračovat v Brně';}
  for(const button of document.querySelectorAll('[data-mission]')){
    const id=button.dataset.mission,index=BRNO_MISSION_IDS.indexOf(id),unlocked=progress.unlocked.has(id),completed=progress.completed.has(id);
    const status=completed?`${starLabel(starsForMedal(progress.medals.get(id)))} · ${MEDAL_NAMES[progress.medals.get(id)]}`:unlocked?'Připraveno':index<0?'Dokonči Brno':`Po: ${getMission(BRNO_MISSION_IDS[index-1]).title}`;
    button.disabled=busy||running;
    button.setAttribute('aria-pressed',String(button.dataset.mission===mission.id));
    button.setAttribute('aria-label',`${getMission(id).title}. ${unlocked?status:'Zamčeno. '+status}`);
    button.closest('.mission-option').dataset.state=completed?'completed':unlocked?'unlocked':index<0?'world-locked':'brno-locked';
    button.querySelector('.mission-card-status').textContent=status;
  }
  $('locationCards').hidden=race;$('racePreview').hidden=!race;$('selectedLocationPanel').hidden=race;
  $('customLocationButton').disabled=busy||running||race||mode==='demo';
  $('summaryMode').textContent=race?'Mise':'Volný let';$('summaryAircraft').textContent=aircraftChosen?info.name:'Vyber letadlo';
  $('summaryPlace').textContent=mode==='demo'?'Offline trénink':place.name;$('summaryPlace').title=place.name;
  $('summaryTime').textContent={morning:'Ráno',day:'Den',evening:'Podvečer',night:'Noc'}[$('timeOfDay').value];
  $('summaryWeather').textContent={clear:'Jasno',haze:'Opar',overcast:'Zataženo'}[$('weather').value];
  $('locationHeading').textContent=race?'Mise v Brně':mode==='demo'?'Offline trénink':'Kam poletíš?';
  $('locationStepHint').textContent=race?'Plň mise, zlepšuj medaile a postupně odemykej další lety.':mode==='demo'?'Trénink bez připojení k mapám.':'Vyber místo a podmínky letu.';
  for(const button of document.querySelectorAll('[data-location]')){
    button.disabled=busy||running||mode==='demo'||race;
    button.setAttribute('aria-pressed',String(button.dataset.location===place.id));
  }
  $('chosenLocationName').textContent=mode==='demo'?'Tréninková krajina':place.name;
  $('chosenLocationDetails').textContent=mode==='demo'?'Smyšlené prostředí bez připojení k mapám.':`${place.lat.toFixed(5)}° / ${place.lon.toFixed(5)}°`;
  $('menuEnd').hidden=!running;
  $('startButton').setAttribute('aria-busy',String(busy));
}
export function initGameMenu(onChange,onLocation,onMission){
  hangarShowcase=createHangarShowcase({stage:$('hangarStage'),image:$('hangarPhoto'),previous:$('hangarPreviousPhoto'),empty:$('hangarEmpty'),status:$('hangarStatus')});
  for(const button of document.querySelectorAll('[data-hangar-view]'))button.addEventListener('click',()=>{
    hangarShowcase.setView(button.dataset.hangarView);
    for(const option of document.querySelectorAll('[data-hangar-view]'))option.setAttribute('aria-pressed',String(option.dataset.hangarView===hangarShowcase.view));
  });
  $('locationCards').innerHTML=LOCATIONS.map((place,index)=>`<article class="location-option"><button class="location-card" data-location="${place.id}" aria-pressed="false"><img src="${place.image}" alt="" loading="lazy" decoding="async"><span class="location-number">0${index+1}</span><div><small>${place.country}</small><strong>${place.name}</strong><p>${place.description}</p></div><i aria-hidden="true">✓</i></button><small class="location-credit">Foto: <a href="${place.source}" target="_blank" rel="noreferrer">${place.credit}</a> · <a href="${place.licenseUrl}" target="_blank" rel="noreferrer">${place.license}</a></small></article>`).join('');
  $('missionCards').innerHTML=[...CITY_GROUPS].map(([city,missions])=>`<section class="mission-city-group" aria-label="${city}"><h3 class="mission-group-label">${city}${city==='Brno'?' · začni tady':''}<span>${missions.length}</span></h3>${missions.map(mission=>`${chapterStarts.has(mission.id)?`<h4 class="mission-chapter-label">${chapterStarts.get(mission.id)}</h4>`:''}<article class="mission-option"><button class="mission-card" data-mission="${mission.id}" aria-pressed="false"><span class="mission-sequence" aria-hidden="true">${String(DISPLAY_MISSIONS.findIndex(item=>item.id===mission.id)+1).padStart(2,'0')}</span><div><strong>${mission.title}</strong><small class="mission-type">${mission.route.activity||OBJECTIVE_NAMES[objectiveType(mission.route)]}</small><span class="mission-card-status"></span></div><i aria-hidden="true">✓</i><span class="mission-card-lock" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span></button></article>`).join('')}</section>`).join('');
  const photoSources=new Map([...LOCATIONS,...MISSIONS.map(m=>m.location)].map(place=>[place.source,place]));
  for(const place of photoSources.values()){
    const row=document.createElement('p'),source=document.createElement('a'),license=document.createElement('a');
    source.href=place.source;source.textContent=place.name+' — '+place.credit;license.href=place.licenseUrl;license.textContent=place.license;
    for(const link of [source,license]){link.target='_blank';link.rel='noopener noreferrer';}
    row.append(source,' · ',license);$('menuPhotoCredits').append(row);
  }
  for(const button of document.querySelectorAll('[data-mission]')){
    button.addEventListener('click',()=>{if(!button.disabled)onMission(button.dataset.mission);});
    button.addEventListener('keydown',event=>{
      if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)||button.disabled)return;event.preventDefault();
      const visible=[...document.querySelectorAll('[data-mission]')].filter(option=>!option.disabled&&!option.closest('.mission-option').hidden),index=visible.indexOf(button),next=visible[(index+(['ArrowDown','ArrowRight'].includes(event.key)?1:visible.length-1))%visible.length];
      if(next){onMission(next.dataset.mission);next.focus();}
    });
  }
  $('customLocationButton').addEventListener('click',()=>{if(!$('customLocationButton').disabled)onLocation('custom');});
  for(const id of ['timeOfDay','weather'])$(id).addEventListener('change',onChange);
  for(const button of document.querySelectorAll('[data-location]'))button.addEventListener('click',()=>{if(!button.disabled)onLocation(button.dataset.location);});
  for(const button of document.querySelectorAll('[data-select]'))button.addEventListener('click',()=>{
    const select=$(button.dataset.select);if(button.disabled||select.disabled)return;
    const aircraft=button.dataset.select==='aircraftModel';
    if(select.value===button.dataset.choice&&!aircraft)return;
    if(aircraft)aircraftChosen=true;
    select.value=button.dataset.choice;select.dispatchEvent(new Event('change',{bubbles:true}));
    onChange();
  });
}

function renderRoute(mission){
  const {route}=mission,gates=route.gates;
  $('raceRouteMap').innerHTML=renderMissionMap(mission);
  $('raceRouteStops').innerHTML=gates.map(g=>`<li>${g.name.replace(' · START','').replace(' · CÍL','')}<span><small>${g.kind==='landing'?'DOSEDNUTÍ':g.clearance!==undefined?g.clearance+' m nad povrchem':(g.altitude??route.altitude)+' m WGS84'}</small>${g===gates[0]?'START':g===gates.at(-1)?'CÍL':''}</span></li>`).join('');
  const distance=gates.slice(1).reduce((sum,g,i)=>{const d=offsetMeters(g.lat,g.lon,gates[i]);return sum+Math.hypot(d.x,d.y);},0);
  $('raceRouteLength').textContent=`${(distance/1000).toFixed(1)} km`;
}
