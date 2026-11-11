import {missionRecordKey,readMissionRecord,starLabel,starsForMedal} from './mission-performance.js';
import {aircraftProfile,offsetMeters} from './flight.js';
import {formatRaceTime} from './brno-race.js';
import {LOCATIONS} from './locations.js';
import {MISSIONS,getMission,getPlayableMission,TIME_NAMES,WEATHER_NAMES} from './missions.js';
import {objectiveType,OBJECTIVE_NAMES,usesScore,missionBrief} from './task-missions.js';
import {missionCaption} from './menu-copy.js';
import {AIRCRAFT_LEVELS,MEDAL_NAMES,MEDAL_XP,missionProgress,medalTargets} from './mission-progression.js';
import {createHangarShowcase} from './hangar-showcase.js';
import {renderMissionMap} from './mission-map.js';
import {CAREER_IDS,CHAPTERS,chapterFor,careerPosition,missionSituation,masteryChallenge} from './campaign.js';
let hangarShowcase;
let previewRouteId='';
const $=id=>document.getElementById(id);
export const DISPLAY_MISSIONS=CAREER_IDS.map(id=>getMission(id));
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
export function syncGameMenu({running=false,busy=false,mode='google',hasToken=false,step=1,place=LOCATIONS[0],mission=getMission(),draft=null}={}){
  const progress=missionProgress();
  for(const button of document.querySelectorAll('[data-select]')){
    const select=$(button.dataset.select),aircraft=button.dataset.select==='aircraftModel',required=AIRCRAFT_LEVELS[button.dataset.choice],locked=aircraft&&progress.level<required;
    const selected=select.value===button.dataset.choice;
    button.setAttribute('aria-pressed',String(selected));button.disabled=select.disabled||locked;
    if(aircraft){button.dataset.unlock=locked?`Úroveň ${required}`:'';button.setAttribute('aria-label',locked?`${AIRCRAFT[button.dataset.choice].name}. Odemkne se na úrovni ${required}.`:AIRCRAFT[button.dataset.choice].name);}
  }
  const model=$('aircraftModel').value,info=AIRCRAFT[model]||AIRCRAFT.lowWing;
  $('hangarName').textContent=info.name;$('hangarClass').textContent=info.category;
  $('hangarInfo').hidden=false;
  hangarShowcase?.select(model,info.name);
  $('hangarSpeed').replaceChildren(document.createTextNode(`${Math.round(aircraftProfile(model).maxSpeed*3.6)} `),Object.assign(document.createElement('small'),{textContent:'km/h'}));
  $('hangarHandling').textContent=info.handling;$('hangarAdvice').textContent=info.advice;
  const race=$('gameMode').value==='missions';
  $('pilotProgress').textContent=`${progress.rank} · ${progress.careerCount} / ${progress.total} letů · ${progress.stars} ★`;
  $('missionPilotProgress').textContent=`${progress.careerCount} / ${progress.total} bezpečně dokončeno`;
  $('missionCareerNext').textContent=progress.nextRank?`Další hodnost: ${progress.nextRank}`:'Kariéra dokončena';
  $('missionListHeading').textContent=progress.rank;
  $('careerRankBadge').src=`/images/rank-${progress.careerLevel-1}.svg`;
  $('careerRankBadge').alt=`Insignie hodnosti ${progress.rank}`;
  const levelStart=progress.careerStartXp;
  $('missionXpProgress').max=progress.nextCareerXp===null?1:progress.nextCareerXp-levelStart;
  $('missionXpProgress').value=progress.nextCareerXp===null?1:progress.careerCount-levelStart;
  $('sidebar').dataset.gameMode=race?'missions':'free';
  const type=objectiveType(mission.route),scored=usesScore(mission.route);
  const best=readMissionRecord(missionRecordKey(mission,model,$('timeOfDay').value,$('weather').value,mode),scored);
  $('racePreviewBest').textContent=scored?(best===null?'—':best+' / 100'):formatRaceTime(best);
  $('raceBestLabel').textContent=scored?'NEJLEPŠÍ HODNOCENÍ':'OSOBNÍ REKORD';
  $('missionPersonalBest').textContent=`${mode==='demo'?'Offline · ':''}Osobní rekord · ${info.name}: ${$('racePreviewBest').textContent}`;
  $('missionPersonalBest').hidden=best===null;
  $('missionObjectiveBrief').textContent=missionBrief(mission.route)+(mission.recommended?' Doporučený stroj: '+mission.recommended+'.':'');
  $('menuMapStatus').textContent=mode==='demo'?'OFFLINE TRÉNINK / SYNTETICKÁ KRAJINA':hasToken?'SVĚT / REÁLNÉ 3D MAPY':'SVĚT / PŘIPOJENÍ MAP';
  $('setupStep').hidden=step!==1;$('gameTypeStep').hidden=step!==2;$('locationStep').hidden=step!==3;
  $('sidebar').dataset.step=String(step);
  $('sidebar').style.setProperty('--destination-image',`url("${place.image||'/images/weather-haze-v1.jpg'}")`);
  for(const [id,number] of [['stepSetup',1],['stepGameType',2],['stepLocation',3]]){$(id).setAttribute('aria-current',step===number?'step':'false');$(id).disabled=busy||running;}
  $('locationBack').hidden=step===1||running;$('locationBack').disabled=busy;
  $('destinationStepLabel').textContent=race?'Mise':'Lokalita';
  $('freeAtmosphere').hidden=race;$('missionConditionsNote').hidden=!race;$('missionCards').hidden=!race;
  $('missionBrowser').hidden=!race;
  $('freeFlightSetup').hidden=race;
  $('missionModeCount').textContent=`HORIZONT · ${progress.careerCount} / ${progress.total}`;
  $('missionCount').textContent=`${progress.completed.size} / ${MISSIONS.length} splněno`;
  const nextLesson=progress.nextMissionId&&getMission(progress.nextMissionId);
  $('missionListGuidance').textContent=nextLesson?`DALŠÍ LET · ${nextLesson.title}`:'Kariéra dokončena. Můžeš zlepšovat hvězdy a rekordy.';
  const activeChapter=chapterFor(progress.nextMissionId||CAREER_IDS.at(-1));
  $('careerHero').style.setProperty('--career-image',`url("${activeChapter.image}")`);
  $('careerHeroTitle').textContent=activeChapter.title;
  $('careerHeroText').textContent=`${activeChapter.ids.filter(id=>progress.completed.has(id)).length} / ${activeChapter.ids.length} letů kapitoly`;
  $('careerHeroIndex').textContent=`KAPITOLA ${CHAPTERS.indexOf(activeChapter)+1} / ${CHAPTERS.length}`;
  $('careerHeroAward').textContent=`DALŠÍ ODZNAK · ${activeChapter.award}`;
  const nextPhoto=nextLesson&&(MISSION_PHOTOS[nextLesson.id]||nextLesson.location);
  $('careerStage').style.setProperty('--career-image',`url("${nextPhoto?.image||activeChapter.image}")`);
  $('careerStageNumber').textContent=nextLesson?`DALŠÍ LET · ${String(careerPosition(nextLesson.id)+1).padStart(2,'0')} / ${progress.total} · ${activeChapter.title}`:'HORIZONT · KARIÉRA DOKONČENA';
  $('careerStageTitle').textContent=nextLesson?.title||'Šéfpilot HORIZONTU';
  $('careerStageText').textContent=nextLesson?missionSituation(nextLesson.id):'Všechny kapitoly dokončeny. Můžeš se vrátit k oblíbeným letům.';
  const followingId=nextLesson&&CAREER_IDS.slice(careerPosition(nextLesson.id)+1).find(id=>!progress.completed.has(id));
  const following=followingId&&getMission(followingId);
  $('careerStageNextLabel').textContent=nextLesson?'PO DOKONČENÍ':'ZÍSKÁNO';
  $('careerStageNext').textContent=following?.title||'Šéfpilot HORIZONTU';
  $('careerStageMeta').textContent=following?`${following.location.name} · ${following.route.activity||OBJECTIVE_NAMES[objectiveType(following.route)]}`:nextLesson?'Poslední kariérní let':`${progress.stars} / ${progress.maxStars} hvězd`;
  $('careerStageBriefing').hidden=!nextLesson;
  for(const button of document.querySelectorAll('[data-chapter]')){
    const chapter=CHAPTERS[Number(button.dataset.chapter)],done=chapter.ids.filter(id=>progress.completed.has(id)).length;
    button.dataset.state=done===chapter.ids.length?'completed':chapter===activeChapter?'active':'locked';
    button.querySelector('small').textContent=`${done}/${chapter.ids.length}`;
  }
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
  const difficultyStars=mission.difficultyStars??2;
  $('missionDifficultyStars').textContent=starLabel(difficultyStars);
  $('missionDifficultyStars').setAttribute('aria-label',`${difficultyStars} ze 3 hvězd`);
  $('briefingAircraft').value=model;
  $('briefingAircraftImage').src=`/images/aircraft-${model}-thumb-v1.jpg`;
  for(const option of document.querySelectorAll('#briefingAircraft option')){
    const required=AIRCRAFT_LEVELS[option.value],locked=progress.level<required;
    option.disabled=locked;
    option.textContent=AIRCRAFT[option.value].name+(locked?` · odemkne se na úrovni ${required}`:'');
  }
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
  const routePreviewKey=`${mission.route.id}:${model}`;
  if(previewRouteId!==routePreviewKey){renderRoute(mission);previewRouteId=routePreviewKey;}
  $('horizonMissionDescription').textContent=missionCaption(mission);
  $('horizonMissionConditions').textContent=`${TIME_NAMES[mission.time]} · ${WEATHER_NAMES[mission.weather]}${mission.route.gustStrength?' · Silný nárazový vítr':''}`;
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
  $('missionStoryChapter').textContent=`KAPITOLA ${CHAPTERS.indexOf(chapterFor(mission.id))+1} · ${chapterFor(mission.id).title}`;
  $('missionStoryInstructor').textContent=`EVA NOVOTNÁ · ${type==='landing'?'Stabilizuj přiblížení včas a sleduj rychlost.':type==='lowflight'?'Drž výšku plynule, bez pozdních oprav.':type==='takeoff'?'Při rozjezdu drž osu dráhy, potom plynule stoupej.':'Dívej se už k další bráně a nech si prostor pro zatáčku.'}`;
  $('missionMasteryChallenge').textContent=masteryChallenge(mission);
  if(mission.training&&model!=='highWing')$('missionTaskSummary').textContent='Tento výcvik je navržený pro hornoplošník. '+$('missionTaskSummary').textContent;
  if(mission.route.objective?.minimumScore)$('missionTaskSummary').textContent+=` K dokončení je třeba alespoň ${mission.route.objective.minimumScore} % přesného letu.`;
  $('horizonMissionDescription').hidden=type!=='time'||Boolean(mission.route.brief);
  $('missionNextGuidance').hidden=unlocked;
  $('missionNextGuidance').textContent=unlocked?'':`Nejdřív bezpečně dokonči: ${getMission(progress.nextMissionId).title}`;
  if(race&&step===3&&!running){
    const startLabel=earned?earned==='gold'?'Letět znovu':'Zlepšit medaili':'Spustit misi';
    $('startButton').querySelector('span').textContent=unlocked?startLabel:'Přejít na další let';
    $('missionBriefingStart').textContent=startLabel;
    $('missionBriefingStart').disabled=$('startButton').disabled;
    $('missionBriefingActions').hidden=!unlocked;
  }else if($('missionDetails').open)$('missionDetails').close();
  for(const button of document.querySelectorAll('[data-mission]')){
    const id=button.dataset.mission,unlocked=progress.unlocked.has(id),completed=progress.completed.has(id);
    const status=completed?`${starLabel(starsForMedal(progress.medals.get(id)))} · ${MEDAL_NAMES[progress.medals.get(id)]}`:unlocked?'DALŠÍ LET':'ZAMČENO';
    button.disabled=busy||running;
    button.setAttribute('aria-pressed',String(button.dataset.mission===mission.id));
    button.setAttribute('aria-label',`${getMission(id).title}. ${unlocked?status:'Zamčeno. '+status}`);
    button.closest('.mission-option').dataset.state=completed?'completed':unlocked?'unlocked':'world-locked';
    button.querySelector('.mission-card-status').textContent=status;
  }
  $('locationCards').hidden=race;$('racePreview').hidden=!race;$('selectedLocationPanel').hidden=race||mode!=='demo';
  $('summaryMode').textContent=race?'Mise':'Volný let';$('summaryAircraft').textContent=info.name;
  $('summaryPlace').textContent=mode==='demo'?'Offline trénink':place.name;$('summaryPlace').title=place.name;
  $('summaryTime').textContent=TIME_NAMES[$('timeOfDay').value];
  $('summaryWeather').textContent=WEATHER_NAMES[$('weather').value];
  $('locationHeading').textContent=race?'HORIZONT':mode==='demo'?'Offline trénink':'Kam poletíš?';
  $('locationStepHint').textContent=race?'Pilotní kariéra · bezpečný dolet odemyká další misi.':mode==='demo'?'Trénink bez připojení k mapám.':'Vyber místo na globusu a nastav podmínky letu.';
  for(const button of document.querySelectorAll('[data-location]')){
    button.disabled=busy||running||mode==='demo'||race;
    button.setAttribute('aria-pressed',String(button.dataset.location===place.id));
  }
  const start=draft||place;
  $('chosenLocationState').textContent=draft?'ČEKÁ NA POTVRZENÍ':'VYBRANÝ START';
  $('chosenLocationName').textContent=mode==='demo'?'Tréninková krajina':start.name;
  $('chosenLocationDetails').textContent=mode==='demo'?'Smyšlené prostředí bez připojení k mapám.':`${start.lat.toFixed(5)}° / ${start.lon.toFixed(5)}°`;
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
  $('careerChapters').innerHTML=CHAPTERS.map((chapter,index)=>`<button type="button" data-chapter="${index}" aria-label="Kapitola ${index+1}: ${chapter.title}"><span>0${index+1}</span><strong>${chapter.title}</strong><small>0/${chapter.ids.length}</small></button>`).join('');
  $('missionCards').innerHTML=CHAPTERS.map((chapter,index)=>`<section class="mission-city-group career-chapter-group" aria-label="Kapitola ${index+1}: ${chapter.title}"><div class="career-chapter-banner" style="--chapter-image:url('${chapter.image}')"><span>KAPITOLA 0${index+1}</span><h3>${chapter.title}</h3><small>${chapter.award}</small></div>${chapter.ids.map(id=>{const mission=getMission(id),photo=MISSION_PHOTOS[id]||mission.location;return `<article class="mission-option"><button class="mission-card" data-mission="${mission.id}" aria-pressed="false"><img src="${photo.image}" alt="" loading="lazy" decoding="async"><span class="mission-sequence" aria-hidden="true">${String(careerPosition(id)+1).padStart(2,'0')}</span><div><strong>${mission.title}</strong><small class="mission-type">${mission.route.activity||OBJECTIVE_NAMES[objectiveType(mission.route)]} · ${mission.location.name}</small><span class="mission-card-status"></span></div><i aria-hidden="true">✓</i><span class="mission-card-lock" aria-hidden="true">⌁</span></button></article>`}).join('')}</section>`).join('');
  for(const button of document.querySelectorAll('[data-chapter]'))button.addEventListener('click',()=>{
    const first=document.querySelector(`[data-mission="${CHAPTERS[Number(button.dataset.chapter)].ids[0]}"]`);
    first?.scrollIntoView({block:'nearest',behavior:'smooth'});
  });
  $('careerMapButton').addEventListener('click',()=>$('careerMapDialog').showModal());
  $('careerStageBriefing').addEventListener('click',()=>{const next=missionProgress().nextMissionId;if(next)onMission(next,{showBriefing:true});});
  $('careerJournalButton').addEventListener('click',()=>renderCareerJournal());
  const photoSources=new Map([...LOCATIONS,...MISSIONS.map(m=>m.location)].map(place=>[place.source,place]));
  for(const place of photoSources.values()){
    const row=document.createElement('p'),source=document.createElement('a'),license=document.createElement('a');
    source.href=place.source;source.textContent=place.name+' — '+place.credit;license.href=place.licenseUrl;license.textContent=place.license;
    for(const link of [source,license]){link.target='_blank';link.rel='noopener noreferrer';}
    row.append(source,' · ',license);$('menuPhotoCredits').append(row);
  }
  for(const button of document.querySelectorAll('[data-mission]')){
    button.setAttribute('aria-haspopup','dialog');
    button.addEventListener('click',()=>{
      if(button.disabled)return;
      button.focus({preventScroll:true});
      onMission(button.dataset.mission,{showBriefing:true});
    });
    button.addEventListener('keydown',event=>{
      if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)||button.disabled)return;event.preventDefault();
      const visible=[...document.querySelectorAll('[data-mission]')].filter(option=>!option.disabled&&!option.closest('.mission-option').hidden),index=visible.indexOf(button),next=visible[(index+(['ArrowDown','ArrowRight'].includes(event.key)?1:visible.length-1))%visible.length];
      if(next){onMission(next.dataset.mission);next.focus();}
    });
  }
  for(const id of ['timeOfDay','weather'])$(id).addEventListener('change',onChange);
  for(const button of document.querySelectorAll('[data-location]'))button.addEventListener('click',()=>{if(!button.disabled)onLocation(button.dataset.location);});
  for(const button of document.querySelectorAll('[data-select]'))button.addEventListener('click',()=>{
    const select=$(button.dataset.select);if(button.disabled||select.disabled)return;
    if(select.value===button.dataset.choice&&button.dataset.select!=='aircraftModel')return;
    select.value=button.dataset.choice;select.dispatchEvent(new Event('change',{bubbles:true}));
    onChange();
  });
}

function renderCareerJournal(){
  const progress=missionProgress(),model=$('aircraftModel').value;
  $('careerJournalRank').textContent=`${progress.rank} · ${progress.careerCount} / ${progress.total} letů`;
  $('careerJournalBadges').innerHTML=CHAPTERS.map((chapter,index)=>{
    const earned=chapter.ids.every(id=>progress.completed.has(id));
    return `<div class="career-badge" data-earned="${earned}"><img src="/images/rank-${index+1}.svg" alt=""><strong>${chapter.award}</strong><small>Kapitola ${index+1} · ${earned?'získáno':'čeká'}</small></div>`;
  }).join('');
  $('careerJournalFlights').innerHTML=CAREER_IDS.map((id,index)=>{
    const mission=getPlayableMission(id,model),medal=progress.medals.get(id),scored=usesScore(mission.route);
    const best=readMissionRecord(missionRecordKey(mission,model,mission.time,mission.weather,'google'),scored);
    return `<li><span>${String(index+1).padStart(2,'0')} · ${mission.title}</span><strong>${medal?starLabel(starsForMedal(medal)):'—'}</strong><small>${best===null?'Bez rekordu':scored?`${best} / 100 bodů`:formatRaceTime(best)}</small></li>`;
  }).join('');
  $('careerJournal').showModal();
}

function renderRoute(mission){
  const {route}=mission,gates=route.gates;
  $('raceRouteMap').innerHTML=renderMissionMap(mission);
  $('raceRouteStops').innerHTML=gates.map((g,index)=>{
    const name=g.name.replace(' · START','').replace(' · CÍL','');
    const height=g.kind==='landing'?'DOSEDNUTÍ':g.clearance!==undefined?`${Math.round(g.clearance)} m nad povrchem`:`${Math.round(g.altitude??route.altitude)} m WGS84`;
    const phase=index===0?'START':index===gates.length-1?'CÍL':'';
    return `<li><span class="route-stop-main"><b>${String(index+1).padStart(2,'0')}</b><strong>${name}</strong></span><span class="route-stop-meta"><small>${height}</small>${phase?`<em>${phase}</em>`:''}</span></li>`;
  }).join('');
  const distance=gates.slice(1).reduce((sum,g,i)=>{const d=offsetMeters(g.lat,g.lon,gates[i]);return sum+Math.hypot(d.x,d.y);},0);
  $('raceRouteLength').textContent=`${(distance/1000).toFixed(1)} km`;
}
