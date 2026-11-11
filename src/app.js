import {missionRecordKey,readMissionRecord,starsForMedal} from './mission-performance.js';
import {RAD,EARTH,initialFlight,stepFlight,resolveGroundContact,landingFailureReason,offsetMeters,aircraftProfile,selectFlightAircraft} from './flight.js';
import {createDemo,createAircraft,DEMO_ORIGIN,demoHeight} from './world.js';
import {createCityLabels} from './city-labels.js';
import {createEngineAudio} from './engine-audio.js';
import {createRunwayFeedback,runwayTransition} from './runway-feedback.js';
import {captureScenePhoto,photoFilename} from './photo-export.js';
import {BrnoRace,formatRaceTime} from './brno-race.js';
import {createRaceView} from './race-view.js';
import {missionRadarState,cardinalDirection,drawMissionRadar,radarDistance} from './mission-radar.js';
import {initGameMenu,syncGameMenu,DISPLAY_MISSIONS} from './game-menu.js';
import {LOCATIONS,selectedPlace} from './locations.js';
import {MISSIONS,getMission,getPlayableMission,missionStart} from './missions.js';
import {createDestinationGlobe} from './destination-globe.js';
import {isMissionUnlocked,isAircraftUnlocked,recordMissionResult,MEDAL_NAMES,missionProgress} from './mission-progression.js';
import {routeSurfacePoints,resolveRouteSurface,underpassSurface} from './mission-difficulty.js';
import {createLocationSearch} from './location-search.js';
import {objectiveType,usesScore,missionBrief,landingApproachMessage,discoveryMessage} from './task-missions.js';
import {flightFeedback,createTurbulence} from './flight-feedback.js';
import {FLIGHT_CAMERA_MODES,flightCameraPose,crashCameraPose} from './flight-camera.js';
import {landingSurfaceFlat} from './landing-surface.js';
import {createCrashEffect} from './crash-effect.js';
import {createGeographyGuide} from './geography-guide.js';
import {achievementCollection,createAchievementGallery,recordCloudTurbulence,recordEngineOutCompletion} from './achievements.js';
import {createWeatherEffects,cloudVolumeShader} from './weather-effects.js';
import {installFlightUiLayout} from './flight-ui-layout.js';
const $=id=>document.getElementById(id);
const C=window.Cesium;
const engineAudio=createEngineAudio();
const missionRadio=engineAudio.radio;
const turbulence=createTurbulence();
const runwayFeedback=createRunwayFeedback();
let turbulenceFeedback={intensity:0,active:false};
const TOKEN_STORAGE_KEY='aeronaut.cesiumIonToken';
const MODEL_STORAGE_KEY='aeronaut.aircraftModel';
const DAYLIGHT_STORAGE_KEY='aeronaut.timeOfDay';
const WEATHER_STORAGE_KEY='aeronaut.weather';
const FLIGHT_CAMERA_STORAGE_KEY='aeronaut.flightCamera';
let daylightTint,locationSearch,geographyGuide,badgeGallery,crashEffect,weatherEffects,destinationGlobe;
let searchCredits=[],searchPreviewCredits=[];
const race=new BrnoRace();
let raceView,raceBest=null,raceBestKey='';
let cloudTurbulenceSeen=false;
let missionId='first-takeoff',freeConditions={time:'day',weather:'clear'};
const currentMission=()=>getPlayableMission(missionId,$('aircraftModel').value);
const isRace=()=>$('gameMode').value==='missions';
const DAYLIGHT_PRESETS={
  morning:{hour:6.5,color:[1,.9,.78],intensity:1.7,sky:-.07,tint:[.98,.92,.85]},
  day:{hour:12,color:[1,1,1],intensity:2,sky:0,tint:[1,1,1]},
  evening:{hour:17.72,color:[1,.68,.43],intensity:1.45,sky:-.15,tint:[.98,.84,.74]},
  night:{hour:0,color:[.58,.7,1],intensity:.7,sky:-.65,tint:[.3,.37,.55]}
};
const WEATHER_PRESETS={
  clear:{density:.00012,visualDensity:.15,light:1,sky:0,saturation:1,skySaturation:0,tint:[1,1,1]},
  partly:{density:.00018,visualDensity:.2,light:.96,sky:0,saturation:1,skySaturation:0,tint:[1,1,1]},
  haze:{density:.0013,visualDensity:.5,light:.94,sky:-.03,saturation:.85,skySaturation:-.35,tint:[.98,.98,.96]},
  overcast:{density:.00065,visualDensity:.35,light:.72,sky:-.15,saturation:.65,skySaturation:-.95,tint:[.86,.89,.93]}
};
function readSavedToken(){try{return localStorage.getItem(TOKEN_STORAGE_KEY)||'';}catch{return'';}}
function saveToken(value){try{if(value)localStorage.setItem(TOKEN_STORAGE_KEY,value);else localStorage.removeItem(TOKEN_STORAGE_KEY);return true;}catch{return false;}}
function readSavedModel(){try{const saved=localStorage.getItem(MODEL_STORAGE_KEY);return isAircraftUnlocked(saved)?saved:'highWing';}catch{return'highWing';}}
function saveModel(value){try{localStorage.setItem(MODEL_STORAGE_KEY,value);}catch{}}
let menuStep=1,locationKey='brno',customLocation=null,mapDraft=null;
const randomStartPlaces=[...new Map([...MISSIONS.map(mission=>mission.location),...LOCATIONS].map(place=>[place.name,place])).values()];
const RADAR_RANGE=20000;
let viewer,demo,aircraft,cityLabels,tileset,mode='google',ionToken=window.AERONAUT_CONFIG?.cesiumIonToken||readSavedToken(),state=initialFlight({...DEMO_ORIGIN}),origin={...DEMO_ORIGIN},running=false,paused=false,crashed=false,busy=false,epoch=0;
let keys=new Set(),touch=new Set(),lastFrame=0,lastHud=0,lastLabels=0,lastSurface=0,surfaceHeight=0,surfaceFlat=false,trail=[],lastTrail=0,noticeTimer,noticeLock=0;
let cameraMotion=!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,lastStallBeep=-Infinity;
try{const saved=localStorage.getItem('aeronaut.cameraMotion');if(saved!==null)cameraMotion=saved==='true';}catch{}
let flightCameraMode='chase';
try{const saved=localStorage.getItem(FLIGHT_CAMERA_STORAGE_KEY);if(FLIGHT_CAMERA_MODES.includes(saved))flightCameraMode=saved;}catch{}
let inspectHeading=0,inspectElevation=.3,inspectDistance=110;
let flightOrbit=null;
const photo={active:false,clean:false,roll:0,savedFov:0,savedLabels:false,saving:false,drag:null,session:0,url:null};
let startup={...DEMO_ORIGIN,altitude:600,heading:0};
const loading=(text)=>{$('loading').hidden=!text;if(text){$('loading').querySelector('strong').textContent=text;$('loading').querySelector('p').textContent=mode==='google'?'Načítání online 3D map může chvíli trvat.':'Vytváření tréninkové krajiny';}};
function showError(text){$('formError').textContent=text;$('formError').hidden=!text;}
function notice(text,duration=4000){clearTimeout(noticeTimer);delete $('notice').dataset.landing;$('notice').textContent=text;$('notice').hidden=false;noticeLock=performance.now()+duration;if(Number.isFinite(duration))noticeTimer=setTimeout(()=>{$('notice').hidden=true;},duration);}
function withTimeout(promise,milliseconds,message){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>{const error=new Error(message);error.code='TIMEOUT';reject(error);},milliseconds);})]).finally(()=>clearTimeout(timer));}
function googleLoadError(error){if(error?.code==='TIMEOUT')return'Načítání mapy vypršelo. Zkontroluj připojení a nastavení tokenu Cesium ion.';const text=String(error?.message||''),status=Number(error?.statusCode||error?.status||error?.response?.status||text.match(/\b(401|403|404)\b/)?.[1]);if(status===401)return'Cesium ion token odmítl (401). Zkontroluj, že je celý a aktivní. V Allowed URLs nastav přesně zobrazenou adresu aplikace bez „/*“.';if(status===403)return'Token byl rozpoznán, ale nemá přístup k Google Photorealistic 3D Tiles. Povol scope assets:read a přístup k assetu 2275207.';if(status===404)return'Google Photorealistic 3D Tiles (asset 2275207) není v účtu aktivní. Přidej ho v Cesium ion a zkus to znovu.';return'Mapy se nepodařilo připojit přes Cesium ion. Ověř token, scope assets:read, přístup k assetu 2275207 a Allowed URLs.';}
function syncSoundButton(){const button=$('soundButton');if(!button)return;button.setAttribute('aria-pressed',String(engineAudio.enabled));button.setAttribute('aria-label',engineAudio.enabled?'Vypnout zvuk':'Zapnout zvuk');}
function toggleSound(){engineAudio.toggle();if(!engineAudio.enabled)missionRadio.stop();syncSoundButton();}
function updateAircraftHandling(){
  const profile=aircraftProfile($('aircraftModel').value),kmh=value=>Math.round(value*3.6);
  $('aircraftHandling').textContent=`${profile.description}. Maximum ${kmh(profile.maxSpeed)} km/h, vzlet od ${kmh(profile.takeoffSpeed)} km/h.`;
  $('landingLimits').textContent=`Na rovné ploše lze s vybraným letadlem přistát při ${kmh(profile.landingMin)}–${kmh(profile.landingMax)} km/h, klesání do ${profile.landingSink} m/s a téměř vodorovných křídlech. Vzlet od ${kmh(profile.takeoffSpeed)} km/h.`;
}
function applyTimeOfDay(place=running?state:selection()){
  if(!viewer||!Number.isFinite(place.lon))return;
  const choice=$('timeOfDay').value;
  const preset=Object.hasOwn(DAYLIGHT_PRESETS,choice)?DAYLIGHT_PRESETS[choice]:DAYLIGHT_PRESETS.day;
  // Fix local solar time, independent of the computer's timezone and flight duration.
  viewer.clock.shouldAnimate=false;
  viewer.clock.currentTime=C.JulianDate.fromDate(new Date(Date.UTC(2026,8,22)+(preset.hour-place.lon/15)*3600000));
  const weatherChoice=$('weather').value;
  const weather=Object.hasOwn(WEATHER_PRESETS,weatherChoice)?WEATHER_PRESETS[weatherChoice]:WEATHER_PRESETS.clear;
  const lightOptions={color:new C.Color(...preset.color),intensity:preset.intensity*weather.light};
  if(choice==='night'){
    // Keep the visible Moon and the night lighting in the same direction.
    const enu=C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(place.lon,place.lat));
    const moonDirection=C.Matrix4.multiplyByPointAsVector(enu,new C.Cartesian3(-.83,.48,.20),new C.Cartesian3());
    C.Cartesian3.normalize(moonDirection,moonDirection);
    daylightTint.uniforms.moonDirection=moonDirection;
    viewer.scene.light=new C.DirectionalLight({...lightOptions,direction:C.Cartesian3.negate(moonDirection,new C.Cartesian3())});
  }else viewer.scene.light=new C.SunLight(lightOptions);
  viewer.scene.globe.enableLighting=true;
  viewer.scene.globe.dynamicAtmosphereLightingFromSun=true;
  viewer.scene.atmosphere.dynamicLighting=C.DynamicAtmosphereLightingType.SUNLIGHT;
  viewer.scene.skyAtmosphere.brightnessShift=preset.sky+weather.sky;
  viewer.scene.skyAtmosphere.saturationShift=weather.skySaturation;
  viewer.scene.fog.density=weather.density;
  viewer.scene.fog.visualDensityScalar=weather.visualDensity;
  // The evening sky pass draws its own disk and glow behind the terrain.
  if(viewer.scene.sun)viewer.scene.sun.show=choice!=='night'&&choice!=='evening'&&weatherChoice!=='overcast';
  weatherEffects?.setConditions(weatherChoice,choice);
  // Photogrammetry contains baked daylight; tint it along with the scene.
  daylightTint.uniforms.tint=new C.Cartesian3(...preset.tint.map((value,index)=>value*weather.tint[index]));
  daylightTint.uniforms.saturation=weather.saturation;
  daylightTint.uniforms.sunset=choice==='evening'&&weatherChoice!=='overcast'?1:0;
  daylightTint.uniforms.eveningHaze=choice==='evening'?1:0;
  daylightTint.uniforms.nightHaze=choice==='night'?1:0;
  const nightSky=choice==='night'&&weatherChoice!=='overcast'?1:0;
  daylightTint.uniforms.stars=nightSky;
  daylightTint.uniforms.moon=nightSky;
  const daylightHaze={clear:0.36,partly:0.44};
  daylightTint.uniforms.daylightHaze=choice==='day'||choice==='morning'?(daylightHaze[weatherChoice]??0):0;
  daylightTint.uniforms.sunsetClouds=weatherChoice==='partly'?1:weatherChoice==='haze'?.65:.18;
  daylightTint.enabled=true;
  viewer.scene.requestRender();
}
function selection(){return mode==='demo'?{...DEMO_ORIGIN,name:'Tréninková krajina'}:isRace()?{...missionStart(currentMission())}:selectedPlace(locationKey,customLocation);}
function resetRace(){
  turbulence.reset();turbulenceFeedback={intensity:0,active:false};
  cloudTurbulenceSeen=false;
  runwayFeedback.reset();
  race.reset();race.update(state);
  raceBestKey=missionRecordKey(currentMission(),state.model,$('timeOfDay').value,$('weather').value,mode);
  raceBest=readMissionRecord(raceBestKey,usesScore(race.route));
}
function updateLandingNotice(){
  const active=running&&isRace()&&!crashed&&((race.status==='landing'||race.route.gates[race.next]?.kind==='touch-and-go')&&!state.onGround||race.status==='rollout');
  const element=$('notice');
  if(active){
    if(element.hidden){notice((race.status==='rollout'?race.taskHint:landingApproachMessage(race.route,state.model,race.next)),Infinity);element.dataset.landing='true';}
    else if(element.dataset.landing)element.textContent=(race.status==='rollout'?race.taskHint:landingApproachMessage(race.route,state.model,race.next));
  }else if(element.dataset.landing){element.hidden=true;delete element.dataset.landing;}
}
function updateRace(){
  if(!isRace()||crashed)return;
  for(const event of race.update(state,surfaceHeight)){
    const discovery=objectiveType(race.route)==='sightseeing';
    const collected=discovery?geographyGuide.collectPlace(race.route.gates[event.index].placeId):null;
    engineAudio.gatePassed(event.status==='finished');
    if(event.status==='finished'){
      const scored=usesScore(race.route),result=scored?race.score:race.elapsed(state.elapsed),record=raceBest===null||(scored?result>raceBest:result<raceBest);
      const badgesBefore=new Set(achievementCollection().items.filter(badge=>badge.earned).map(badge=>badge.id));
      const reward=recordMissionResult(currentMission(),state.model,result);
      if(reward?.saved&&state.engineFailure)recordEngineOutCompletion();
      const newAchievements=reward?.saved?achievementCollection().items.filter(badge=>badge.earned&&!badgesBefore.has(badge.id)):[];
      if(reward?.saved)badgeGallery?.refresh();
      if(record){raceBest=result;try{localStorage.setItem(raceBestKey,String(result));}catch{}}
      syncControls();
      const completion=discovery?discoveryMessage(race.route,event.index,collected):'Mise dokončena!';
      notice(completion,10000);
      const summary={reward,newAchievements};
      if(objectiveType(race.route)==='landing'){
        // Let the camera pulse finish before the result pauses flight.
        const completedState=state;
        setTimeout(()=>{if(running&&!crashed&&state===completedState)showMissionResult({...summary,keepRadio:true});},900);
      }else showMissionResult(summary);
    }else if(['touch-and-go','rollout','failed'].includes(event.status)){notice(race.taskHint,Infinity);if(event.status==='rollout')$('notice').dataset.landing='true';}
    else if(event.status==='discovered')notice(discoveryMessage(race.route,event.index,collected),6500);
    else if(event.status==='landing'){notice((race.status==='rollout'?race.taskHint:landingApproachMessage(race.route,state.model,race.next)),Infinity);$('notice').dataset.landing='true';}
    else if(event.index===race.route.engineFailureAfterGate){
      state.engineFailure=state.model==='highWing'?'single':'right';
      notice(state.engineFailure==='right'?'Posádka hlásí výpadek pravého motoru. Koriguj směr doleva a hlídej rychlost.':'Motor ztratil část výkonu. Udrž rychlost a vyhni se prudkému stoupání.',7000);
    }
    else notice(event.index===0?(objectiveType(race.route)==='time'?'Start! Čas běží.':'Úkol zahájen. Sleduj další žlutý bod.'):`Brána ${event.index+1} splněna · další: ${race.route.gates[race.next].name}`,3000);
  }
}
function showMissionResult({reward,keepRadio=false,newAchievements=[]}){
  pauseFlight(true,keepRadio);
  const medal=reward?.medal||'bronze';
  $('resultTitle').textContent=currentMission().title;
  const stars=starsForMedal(medal);
  $('resultMedal').setAttribute('aria-label',`${stars} ze 3 hvězd · ${MEDAL_NAMES[medal]}`);
  $('resultMedal').dataset.medal=medal;
  $('resultMedal').querySelectorAll('.result-star').forEach((star,index)=>{star.dataset.earned=String(index<stars);});
  $('resultMedalName').textContent=MEDAL_NAMES[medal];
  $('resultSaveWarning').hidden=reward?.saved!==false;
  const achievement=newAchievements[0];
  $('resultAchievement').hidden=!achievement;
  if(achievement){$('resultAchievementImage').src=achievement.image;$('resultAchievementTitle').textContent=achievement.title;$('resultAchievementExtra').textContent=newAchievements.length>1?`+ další ${newAchievements.length-1} ve sbírce`:'';}
  const promoted=reward?.rankUp&&reward.saved;
  $('resultPromotion').hidden=!promoted;
  if(promoted){
    $('resultPromotionTitle').textContent=reward.rank;
    $('resultRankInsignia').src=`/images/rank-${reward.careerLevel-1}.svg`;
  }
  const nextReady=reward?.nextMissionId&&reward.nextMissionId!==currentMission().id&&reward.saved!==false;
  $('resultNext').hidden=!nextReady;
  if(nextReady)$('resultNext').textContent=`Další mise: ${getMission(reward.nextMissionId).title} →`;
  const unlocked=reward?.saved&&reward.newMissions?.[0];
  $('resultUnlocks').hidden=!unlocked;
  if(unlocked)$('resultUnlocks').textContent=`Odemčena mise: ${getMission(unlocked).title}`;
  $('resultMenu').classList.toggle('primary',!nextReady);
  const dialog=$('missionResult');dialog.hidden=false;
  dialog.classList.remove('result-animate');
  void dialog.offsetWidth;
  dialog.classList.add('result-animate');
  $(nextReady?'resultNext':'resultMenu').focus({preventScroll:true});
}
function syncControls({keepGlobeView=false}={}){
  const freeGlobe=menuStep===3&&!running&&!isRace()&&mode==='google';
  if(!freeGlobe)mapDraft=null;
  for(const id of ['connectionButton','demoMode','googleMode'])$(id).disabled=busy;
  for(const id of ['demoMode','googleMode'])$(id).setAttribute('aria-pressed',String(mode===(id==='demoMode'?'demo':'google')));
  $('startButton').disabled=busy||!viewer;
  $('startButton').querySelector('span').textContent=running?(crashed?'Nový pokus':'Pokračovat v letu'):menuStep===1?'Vybrat typ hry':menuStep===2?(isRace()?'Vybrat misi':'Vybrat lokalitu'):mode==='demo'?'Spustit offline trénink':isRace()?'Spustit misi':mapDraft?'Potvrdit start':'Vzlétnout';
  $('gameMode').disabled=busy||running;
  $('aircraftModel').disabled=busy||(running&&isRace());
  for(const id of ['timeOfDay','weather'])$(id).disabled=busy||isRace();
  if(raceView)raceView.show=isRace()&&mode==='google';
  $('keyStatus').textContent=ionToken?'Připojeno':'Připojit mapy';
  document.body.classList.toggle('mission-flight',running&&isRace());
  $('radarMissionGuide').hidden=!isRace();
  $('radarLegend').hidden=!isRace();
  $('radarOrientation').hidden=!isRace();
  $('sceneTitle').textContent=mode==='demo'?'Trénink':isRace()?currentMission().location.name+' · mise':`${selection().name} · volný let`;
  $('sceneSubtitle').textContent=mode==='demo'?'SYNTETICKÁ KRAJINA':`${selection().lat.toFixed(3)}° / ${selection().lon.toFixed(3)}°`;
  $('sourceLabel').textContent=mode==='demo'?'TRÉNINKOVÁ KRAJINA • SYNTETICKÁ':'GOOGLE 3D • NÁZVY MĚST: GEONAMES';
  const mission=currentMission();
  const place=isRace()?{...mission.location,...missionStart(mission)}:selectedPlace(locationKey,customLocation);
  syncGameMenu({running,busy,mode,hasToken:Boolean(ionToken),step:menuStep,place,mission,draft:mapDraft});
  const missionGlobe=false; // HORIZONT uses one focused next-flight choice; the globe belongs to free flight.
  destinationGlobe?.sync({
    host:missionGlobe?$('missionGlobeHost'):freeGlobe?$('freeGlobeHost'):null,
    mission:missionGlobe?mission:null,place,draft:mapDraft,
    progress:missionGlobe?missionProgress():null,busy,keepView:keepGlobeView
  });
  $('cancelStartDraft').hidden=!mapDraft;
  $('cancelStartDraft').disabled=busy;
  $('locationSearch').hidden=mode!=='google'||isRace();
  locationSearch?.refresh();
}
function clearLocationPreviewCredits(){
  for(const credit of searchPreviewCredits)viewer.scene.frameState.creditDisplay.removeStaticCredit(credit);
  searchPreviewCredits=[];
}
function showLocationSearchCredits(results){
  clearLocationPreviewCredits();
  for(const result of results)for(const credit of C.GeocoderService.getCreditsFromResult(result)||[]){
    if([...searchCredits,...searchPreviewCredits].some(existing=>existing.id===credit.id))continue;
    viewer.scene.frameState.creditDisplay.addStaticCredit(credit);searchPreviewCredits.push(credit);
  }
}
function clearLocationCredits(){
  for(const credit of searchCredits)viewer.scene.frameState.creditDisplay.removeStaticCredit(credit);
  searchCredits=[];
}
function useSearchLocation(place){
  mapDraft=null;
  clearLocationCredits();
  searchCredits=C.GeocoderService.getCreditsFromResult(place.result)||[];
  for(const credit of searchCredits)viewer.scene.frameState.creditDisplay.addStaticCredit(credit);
  locationKey='custom';customLocation={lat:place.lat,lon:place.lon,name:place.name};
  showError('');syncControls();overview();$('startButton').focus({preventScroll:true});
}
function overview(){
  if(!viewer)return;
  const p=selection(),route=isRace()?currentMission().route:null,height=mode==='demo'?demoHeight(p.lat,p.lon):route?.terrainFollowing?Math.max(350,route.altitude-(route.gates[0].clearance||0)):350;
  applyTimeOfDay(p);
  viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);
  viewer.camera.lookAt(C.Cartesian3.fromDegrees(p.lon,p.lat,height),new C.HeadingPitchRange(-25*RAD,-35*RAD,7200));
  viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);
  if(cityLabels)cityLabels.update(p.lat,p.lon);
}
function resetScene(){
  demo.source.show=mode==='demo';viewer.terrainProvider=mode==='demo'?demo.terrain:new C.EllipsoidTerrainProvider();
  viewer.scene.globe.show=mode==='demo';if(tileset)tileset.show=mode==='google';
  if(cityLabels){cityLabels.source.show=mode==='google';cityLabels.update(selection().lat,selection().lon);}
}
function endFlight(){
  crashEffect?.clear();
  $('missionResult').hidden=true;
  geographyGuide?.setMissionPlaces?.([]);
  stopInspectDrag();flightOrbit=null;exitPhotoMode();$('flightWarning').hidden=true;
  menuStep=1;running=false;paused=false;crashed=false;updateLandingNotice();keys.clear();touch.clear();$('flightUI').hidden=true;setFlightMenuVisible(false);
  $('pauseOverlay').classList.remove('crashed');
  engineAudio.stop();
  missionRadio.stop();
  document.body.classList.remove('flying','panel-hidden');if(aircraft)aircraft.show=false;
  if(viewer)viewer.scene.screenSpaceCameraController.enableInputs=true;
  syncControls();overview();
}
function setMode(next){
  if(busy)return;
  if(next==='demo'&&isRace()){$('gameMode').value='free';$('timeOfDay').value=freeConditions.time;$('weather').value=freeConditions.weather;}
  endFlight();mode=next;epoch++;resetScene();syncControls();overview();showError('');
  if(next==='google'&&ionToken)prepareGoogle();
  else if(next==='google')notice('Pro skutečné lokality připoj mapy v nastavení.',4000);
}
async function prepareGoogle(){
  if(!ionToken){openDialog('connectionDialog');return false;}
  if(tileset)return true;
  const token=++epoch;busy=true;syncControls();loading('Připojuji Google 3D…');
  try{
    const resource=await withTimeout(C.IonResource.fromAssetId(2275207,{accessToken:ionToken}),30000,'Připojení k Cesium ion vypršelo.');
    const tilesPromise=C.Cesium3DTileset.fromUrl(resource,{maximumScreenSpaceError:12,cacheBytes:256*1024*1024,maximumCacheOverflowBytes:128*1024*1024,showCreditsOnScreen:true});
    let tiles;
    try{tiles=await withTimeout(tilesPromise,45000,'Načítání Google 3D map trvá příliš dlouho.');}
    catch(error){tilesPromise.then(lateTiles=>lateTiles.destroy()).catch(()=>{});throw error;}
    if(token!==epoch){tiles.destroy();return false;}
    tileset=viewer.scene.primitives.add(tiles);tileset.show=mode==='google';
    tileset.tileFailed.addEventListener(()=>{if(mode==='google')notice('Část mapy se nepodařilo načíst. Zkontroluj připojení, kvótu Cesium ion a oprávnění tokenu.',7000);});
    resetScene();overview();return true;
  }catch(error){
    if(token===epoch)showError(googleLoadError(error));
    return false;
  }finally{if(token===epoch){busy=false;loading(null);syncControls();}}
}
async function startFlight(){
  if(busy)return;
  if(running){closeGameMenu();return;}
  if(!isAircraftUnlocked($('aircraftModel').value)){showError('Toto letadlo se odemkne na vyšší úrovni pilota.');return;}
  if(isRace()&&!isMissionUnlocked(missionId)){showError('Tato mise je zatím zamčená. Dokonči předchozí brněnské mise.');return;}
  if(isRace()&&mode!=='google'){showError('Mise vyžadují připojené Google 3D mapy.');return;}
  exitPhotoMode();
  engineAudio.unlock();
  if(mode==='google'&&!(await prepareGoogle()))return;
  const p=selection(),token=++epoch;
  busy=true;syncControls();if(running){paused=true;keys.clear();touch.clear();}
  let ground=mode==='demo'?demo.surface(p.lat,p.lon):undefined;
  if(mode==='google'){
    loading('Zjišťuji výšku místa startu…');
    try{
      const result=await Promise.race([viewer.scene.sampleHeightMostDetailed([C.Cartographic.fromDegrees(p.lon,p.lat)],surfaceExclusions()),new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),20000))]);
      ground=result[0].height;
      if(!Number.isFinite(ground))throw new Error('No surface');
    }catch{if(token===epoch){showError('Nepodařilo se načíst povrch zvoleného místa. Nech mapu chvíli načítat a zkus start znovu.');busy=false;loading(null);syncControls();if(running)pauseFlight(true);}return;}
  }
  if(token!==epoch)return;
  if(isRace()&&currentMission().route.terrainFollowing){
    loading('Připravuji výšky průletových bran…');
    try{
      const route=currentMission().route,points=routeSurfacePoints(route).map(point=>C.Cartographic.fromDegrees(point.lon,point.lat));
      const samples=await Promise.race([viewer.scene.sampleHeightMostDetailed(points,surfaceExclusions()),new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),15000))]);
      if(token!==epoch)return;
      const prepared=resolveRouteSurface(route,samples.map(point=>point.height));race.setRoute(prepared);raceView.setRoute(prepared);
    }catch{if(token===epoch){showError('Povrch trasy se nepodařilo načíst. Zkus start znovu nebo jiné místo; dostupnost 3D detailů závisí na pokrytí map.');busy=false;loading(null);syncControls();}return;}
  }
  if(isRace()&&objectiveType(race.route)==='sightseeing'){
    loading('Připravuji sbírku památek…');
    const ready=await geographyGuide.ready;
    if(token!==epoch)return;
    if(!ready){showError('Sbírku památek se nepodařilo načíst. Obnov stránku a zkus misi znovu.');busy=false;loading(null);return;}
  }
  geographyGuide.setMissionPlaces(isRace()&&objectiveType(race.route)==='sightseeing'?race.route.gates.map(gate=>gate.placeId):[]);
  applyTimeOfDay(p);
  origin={lat:p.lat,lon:p.lon};startup={...origin,altitude:ground+450,heading:300,model:$('aircraftModel').value};
  if(isRace()){
    const start=missionStart({...currentMission(),route:race.route});
    startup.altitude=race.route.groundStart?ground+3:Math.max(start.altitude,ground+80);
    startup.heading=start.heading;startup.onGround=Boolean(race.route.groundStart);
    startup.wind=race.route.wind||null;startup.engineLimit=race.route.engineLimit??1;
    startup.gustStrength=race.route.gustStrength??0;
  }
  state=initialFlight(startup);aircraft.resetEffects();surfaceHeight=ground;surfaceFlat=false;trail=[];lastTrail=0;lastSurface=0;running=true;paused=false;crashed=false;busy=false;keys.clear();touch.clear();
  resetRace();
  $('pauseOverlay').classList.remove('crashed');
  engineAudio.setThrottle(state.enginePower,state.speed);engineAudio.play();
  missionRadio.play();
  viewer.scene.screenSpaceCameraController.enableInputs=false;viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);aircraft.show=true;
  $('flightUI').hidden=false;setFlightMenuVisible(false);document.body.classList.add('flying','panel-hidden');
  
  loading(null);syncControls();updateCamera();updateHUD();$('startButton').blur();notice(isRace()?missionBrief(race.route):'Jsi ve vzduchu. Šipkami řídíš, W / S mění výkon.',isRace()?9000:5000);
}
function updatePauseLocation(){
  const {lat,lon}=state;
  const valid=Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180;
  $('pauseLocation').hidden=!valid;
  if(!valid){$('pauseMapsLink').removeAttribute('href');return;}
  $('pauseCoordinates').textContent=`${Math.abs(lat).toFixed(5)}° ${lat<0?'j. š.':'s. š.'} · ${Math.abs(lon).toFixed(5)}° ${lon<0?'z. d.':'v. d.'}`;
  $('pauseMapsLink').href='https://www.google.com/maps/search/?'+new URLSearchParams({api:'1',query:`${lat.toFixed(5)},${lon.toFixed(5)}`});
  $('pauseDemoNote').hidden=mode!=='demo';
}
function setFlightMenuVisible(visible){
  $('pauseOverlay').hidden=!visible;
  $('panelButton').setAttribute('aria-expanded',String(visible));
  $('panelButton').setAttribute('aria-label',visible?'Zavřít herní menu':'Otevřít herní menu');
  document.body.classList.toggle('flight-menu-open',visible);
  $('pauseHint').hidden=true;
}
function toggleFlightMenu(){
  if(!running||photo.active||!$('missionResult').hidden)return;
  if(!$('pauseOverlay').hidden){if(!crashed)pauseFlight(false);return;}
  if(!paused&&!crashed)pauseFlight(true);
  setFlightMenuVisible(true);$('resumeButton').focus({preventScroll:true});
}
function stopInspectDrag(){
  const drag=photo.drag;photo.drag=null;
  document.body.classList.remove('photo-dragging');
  const container=$('cesiumContainer');
  if(drag&&container.hasPointerCapture(drag.id))container.releasePointerCapture(drag.id);
}
function pauseFlight(value=!paused,keepRadio=false){
  if(!running||crashed)return;stopInspectDrag();if(!value)exitPhotoMode();paused=value;keys.clear();touch.clear();if(!paused)setFlightMenuVisible(false);$('pauseHint').hidden=!paused||!$('pauseOverlay').hidden;
  $('flightWarning').hidden=true;
  if(paused){engineAudio.pause();if(!keepRadio)missionRadio.stop();}else engineAudio.play();
  $('pauseOverlay').classList.remove('crashed');
  $('pauseTitle').textContent='Let pozastaven';$('pauseText').textContent='Tažením myši se rozhlédni, kolečkem přibližuj.';$('pauseEyebrow').textContent='HERNÍ MENU';$('resumeButton').innerHTML='Pokračovat v letu <kbd>Esc</kbd>';
  if(paused){updatePauseLocation();inspectHeading=state.heading;inspectElevation=.3;inspectDistance=Math.max(110,(aircraft.chaseDistance||48)*2);aircraft.show=true;}
  else aircraft.show=true;
  updateCamera();
}
function syncPhotoControls(){
  const minimum=Math.max(18,(aircraft.chaseDistance||48)*.4);
  $('photoDistance').value=100*Math.log(inspectDistance/minimum)/Math.log(2500/minimum);
  $('photoDistanceValue').textContent=`${Math.round(inspectDistance)} m`;
  $('photoFovValue').textContent=`${$('photoFov').value}°`;
  $('photoRollValue').textContent=`${photo.roll}°`;
}
function setPhotoControlsHidden(hidden){
  if(!photo.active)return;
  photo.clean=hidden;
  $('photoPanel').hidden=hidden;$('photoRestoreControls').hidden=!hidden;
  document.body.classList.toggle('photo-clean',hidden);
}
function enterPhotoMode(){
  if(!running||crashed||busy||photo.active)return;
  if(!paused)pauseFlight(true);
  stopInspectDrag();photo.active=true;photo.clean=false;photo.roll=0;photo.session++;
  photo.savedFov=viewer.camera.frustum.fov;photo.savedLabels=Boolean(cityLabels?.source.show);
  $('photoFov').value=Math.round(photo.savedFov/RAD);$('photoRoll').value=0;
  $('photoAircraft').checked=true;$('photoLabels').checked=photo.savedLabels;
  $('photoLabelsRow').hidden=mode!=='google';
  $('photoCapture').disabled=photo.saving;
  $('photoStatus').textContent='Enter uloží snímek. Esc tě vrátí do pauzy.';
  document.body.classList.add('photo-mode');setPhotoControlsHidden(false);
  aircraft.show=true;viewer.resize();syncPhotoControls();updateCamera();
  $('photoCapture').focus({preventScroll:true});
}
function exitPhotoMode(){
  if(!photo.active)return;
  stopInspectDrag();photo.active=false;photo.session++;
  viewer.camera.frustum.fov=photo.savedFov;
  if(cityLabels)cityLabels.source.show=photo.savedLabels;
  aircraft.show=running;
  document.body.classList.remove('photo-mode','photo-clean','photo-dragging');
  $('photoPanel').hidden=true;$('photoRestoreControls').hidden=true;
  viewer.resize();updateCamera();
}
function resetPhotoCamera(){
  if(!photo.active)return;
  inspectHeading=state.heading;inspectElevation=.3;inspectDistance=Math.max(110,(aircraft.chaseDistance||48)*2);
  photo.roll=0;$('photoRoll').value=0;$('photoFov').value=Math.round(photo.savedFov/RAD);
  viewer.camera.frustum.fov=photo.savedFov;syncPhotoControls();updateCamera();
}
async function savePhoto(){
  if(!photo.active||photo.saving)return;
  photo.saving=true;$('photoCapture').disabled=true;$('photoStatus').textContent='Připravuji snímek…';
  const session=photo.session;
  try{
    const {blob,width,height}=await captureScenePhoto(viewer,{google:mode==='google',cityLabels:Boolean(cityLabels?.source.show),model:state.model,showAircraft:$('photoAircraft').checked});
    if(!photo.active||session!==photo.session)return;
    if(photo.url)URL.revokeObjectURL(photo.url);
    photo.url=URL.createObjectURL(blob);
    const link=$('photoDownloadLink');link.href=photo.url;link.download=photoFilename();link.hidden=false;link.click();
    $('photoStatus').textContent=`Snímek je připravený (${width} × ${height}).`;
  }catch{
    if(photo.active&&session===photo.session)$('photoStatus').textContent='Snímek se nepodařilo připravit. Zkus to znovu po načtení mapy.';
  }finally{photo.saving=false;$('photoCapture').disabled=false;}
}
function crash(reason){
  if(crashed)return;
  stopInspectDrag();
  if(isRace())race.fail();
  paused=true;crashed=true;$('pauseHint').hidden=true;engineAudio.pause();missionRadio.stop();keys.clear();touch.clear();setFlightMenuVisible(false);$('pauseOverlay').classList.add('crashed');$('pauseEyebrow').textContent='ZPÁTKY NA ZEMI';$('pauseTitle').textContent='Kontakt s povrchem';$('pauseText').textContent='Další pokus začíná zase bezpečně ve vzduchu.';$('resumeButton').textContent='Zkusit let znovu';
  $('flightWarning').hidden=true;updatePauseLocation();
  if(reason)$('pauseText').textContent=reason;
  aircraft.show=false;aircraft.resetEffects();
  engineAudio.explosion();
  if(crashEffect)crashEffect.play({lat:state.lat,lon:state.lon,altitude:Number.isFinite(surfaceHeight)?surfaceHeight+1:state.altitude,size:(aircraft.chaseDistance||48)*.16,wind:state.wind,onReady:()=>{if(running&&crashed)setFlightMenuVisible(true);}});
  else setFlightMenuVisible(true);
}
function surfaceExclusions(){return [...(weatherEffects?.primitives||[]),...aircraft.entities.values,...(aircraft.surfacePrimitives||[]),...(geographyGuide?.source.entities.values||[]),...(raceView?.entities.values||[])];}
function terrainSample(lat,lon){return mode==='demo'?demo.surface(lat,lon):viewer.scene.sampleHeight(C.Cartographic.fromDegrees(lon,lat),surfaceExclusions());}
function checkLandingSurface(){
  const sampled=terrainSample(state.lat,state.lon);
  const ground=isRace()?underpassSurface(race.route,state,sampled):sampled;
  surfaceHeight=Number.isFinite(ground)?ground:undefined;
  surfaceFlat=undefined;
  if(!Number.isFinite(ground)||state.altitude-ground>25&&!state.onGround)return;
  surfaceFlat=landingSurfaceFlat(state,ground,terrainSample);
}
function landed(){notice('Přistál jsi. Sniž výkon klávesou S; pro vzlet přidej W a při rozjezdu podrž ↓.',6500);}
function runwayEvent(kind,sinkRate){
  const strength=kind==='touchdown'?Math.min(1,.5+Math.abs(sinkRate)/8):.75;
  runwayFeedback.trigger(kind,state.elapsed,strength);
  missionRadio.play();
}
function continueFreeFlight(){
  if(!running||crashed||!isRace()||$('missionResult').hidden||race.status!=='finished')return;
  const place=currentMission().location;
  // Keep the live aircraft state and scenery; only the mission restrictions end.
  $('missionResult').hidden=true;
  $('gameMode').value='free';
  freeConditions={time:$('timeOfDay').value,weather:$('weather').value};
  locationKey='custom';customLocation={lat:state.lat,lon:state.lon,name:place.name};
  state.engineLimit=1;
  delete state.engineFailure;
  if(state.gustStrength){state.gustStrength=0;state.gustIntensity=0;state.wind=null;}
  startup={lat:state.lat,lon:state.lon,altitude:state.altitude,heading:state.heading/RAD,model:state.model,onGround:state.onGround,wind:state.wind,engineLimit:1};
  geographyGuide?.setMissionPlaces?.([]);
  missionRadio.stop();updateLandingNotice();
  syncControls();pauseFlight(false);updateHUD();
  $('panelButton').focus({preventScroll:true});
  notice('Pokračuješ ve volném letu. W / S mění výkon; můžeš znovu vzlétnout nebo pokračovat v cestě.',6000);
}
function restart(){if(!running)return;$('missionResult').hidden=true;crashEffect?.clear();engineAudio.pause();state=initialFlight({...startup,model:$('aircraftModel').value});flightOrbit=null;aircraft.resetEffects();resetRace();trail=[];lastTrail=0;lastSurface=0;crashed=false;pauseFlight(false);missionRadio.play();updateCamera();updateHUD();}
function updateOrbitCamera(pos,heading,elevation,distance,roll=0,minimumHeight=-Infinity){
  const horizontal=distance*Math.cos(elevation);
  const height=Math.max(minimumHeight,distance*Math.sin(elevation));
  const enu=C.Transforms.eastNorthUpToFixedFrame(pos);
  const offset=new C.Cartesian3(-Math.sin(heading)*horizontal,-Math.cos(heading)*horizontal,height);
  const camera=C.Matrix4.multiplyByPoint(enu,offset,new C.Cartesian3());
  viewer.camera.setView({destination:camera,orientation:{heading,pitch:-Math.atan2(height,horizontal),roll}});
}
function updateCamera(){
  const {lat,lon,altitude}=state;
  const targetAltitude=crashed&&Number.isFinite(surfaceHeight)?surfaceHeight+(aircraft.chaseDistance||48)*.09:altitude;
  const pos=C.Cartesian3.fromDegrees(lon,lat,targetAltitude);
  if(paused&&!crashed){
    updateOrbitCamera(pos,inspectHeading,inspectElevation,inspectDistance,photo.active?photo.roll*RAD:0);
    return;
  }
  if(!crashed&&flightOrbit){
    const {headingOffset,elevation,distance}=flightOrbit;
    const minimumHeight=Number.isFinite(surfaceHeight)?surfaceHeight+1-altitude:-Infinity;
    updateOrbitCamera(pos,state.heading+headingOffset,elevation,distance,0,minimumHeight);
    return;
  }
  if(!crashed&&flightCameraMode==='roof'){
    viewer.camera.setView(aircraft.roofCameraView());
    return;
  }
  const vibration=flightFeedback(state,{active:running&&!paused&&!crashed&&!busy,motion:cameraMotion,turbulence:turbulenceFeedback.intensity});
  const runway=runwayFeedback.sample(state.elapsed,{active:running&&!paused&&!crashed&&!busy,motion:cameraMotion});
  vibration.pitch+=runway.pitch;vibration.roll+=runway.roll;
  const enu=C.Transforms.eastNorthUpToFixedFrame(pos);
  const pose=crashed?crashCameraPose(state,aircraft.chaseDistance||48):flightCameraPose(state,aircraft.chaseDistance||48,flightCameraMode,vibration);
  pose.offset.z+=runway.z;
  const offset=new C.Cartesian3(pose.offset.x,pose.offset.y,pose.offset.z);
  const camera=C.Matrix4.multiplyByPoint(enu,offset,new C.Cartesian3());
  viewer.camera.setView({destination:camera,orientation:pose.orientation});
}
function updateHUD(){
  updateLandingNotice();
  $('speedDisplay').textContent=Math.round(state.speed*3.6);$('altitudeDisplay').textContent=Math.round(state.altitude).toLocaleString('cs-CZ');
  engineAudio.setThrottle(state.enginePower,state.speed);
  $('climbDisplay').textContent=(state.verticalSpeed>=0?'+':'')+state.verticalSpeed.toFixed(1);$('throttleDisplay').textContent=Math.round(state.throttle*100);$('powerFill').style.height=`${state.throttle*100}%`;
  $('headingDisplay').textContent=`${String(Math.round(state.heading/RAD)%360).padStart(3,'0')}°`;
  $('headingCardinal').textContent=cardinalDirection(state.heading);
  $('timeDisplay').textContent=`${String(Math.floor(state.elapsed/60)).padStart(2,'0')}:${String(Math.floor(state.elapsed%60)).padStart(2,'0')}`;$('distanceDisplay').textContent=`${(state.distance/1000).toFixed(1)} km`;
  drawRadar();
}
function drawRadar(){
  if(isRace()){
    const nav=missionRadarState(race,state),history=trail.map(point=>({lat:origin.lat+point.y/EARTH/RAD,lon:origin.lon+point.x/(EARTH*Math.cos(origin.lat*RAD))/RAD}));
    drawMissionRadar($('radar').getContext('2d'),nav,history);
    $('radarRange').textContent=radarDistance(nav.range);
    $('radarNextGate').textContent=nav.target?`${objectiveType(race.route)==='sightseeing'?'DALŠÍ PAMÁTKA':'DALŠÍ BOD'} ${nav.next+1} / ${nav.total}`:nav.complete?'MISE DOKONČENA':'POKUS UKONČEN';
    $('radarNextName').textContent=nav.target?.name||(nav.complete?'Cíl! Trasa dokončena.':'R · nový pokus');
    $('radarTargetDirection').textContent=nav.target?nav.turn:'';
    $('radarTargetDistance').textContent=nav.target?radarDistance(nav.target.distance):'';
    $('radarTargetHeight').textContent=nav.target?nav.altitudeCue:'';
    $('radarDirectionArrow').hidden=!nav.target;
    $('radarDirectionArrow').style.transform=`rotate(${nav.angle}rad)`;
    $('radarMissionTimer').textContent=usesScore(race.route)?`${race.score} / 100`:objectiveType(race.route)==='sightseeing'?`${race.next} / ${nav.total}`:formatRaceTime(race.elapsed(state.elapsed));
    $('radar').setAttribute('aria-label',nav.target?`Další brána ${nav.next+1}: ${nav.target.name}, ${nav.turn}, ${radarDistance(nav.target.distance)}, ${nav.altitudeCue}. Sever je nahoře.`:'Průletová trasa mise');
    return;
  }
  $('radarRange').textContent='20 km';
  $('radar').setAttribute('aria-label','Orientační plán letu, sever je nahoře');
  const ctx=$('radar').getContext('2d'),w=220,h=180,cx=110,cy=90,range=RADAR_RANGE,scale=72/range;
  ctx.clearRect(0,0,w,h);ctx.strokeStyle='#a0b98426';ctx.lineWidth=1;
  for(const r of[24,48,72]){ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();}
  ctx.beginPath();ctx.moveTo(cx,8);ctx.lineTo(cx,172);ctx.moveTo(28,cy);ctx.lineTo(192,cy);ctx.stroke();
  ctx.font='9px sans-serif';ctx.fillStyle='#b6cba8';ctx.textAlign='center';ctx.fillText('N',cx,9);
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,77,0,Math.PI*2);ctx.clip();ctx.strokeStyle='#d8ef8d99';ctx.lineWidth=1.6;ctx.beginPath();
  trail.forEach((p,i)=>{const x=cx+p.x*scale,y=cy-p.y*scale;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();
  const p=offsetMeters(state.lat,state.lon,origin);ctx.translate(cx+p.x*scale,cy-p.y*scale);ctx.rotate(state.heading);ctx.fillStyle='#e4f99e';ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(5,6);ctx.lineTo(0,3);ctx.lineTo(-5,6);ctx.closePath();ctx.fill();ctx.restore();
}
function updateFlightFeedback(){
  const active=running&&!paused&&!crashed&&!busy;
  turbulenceFeedback=turbulence.update(state,{active,weather:$('weather').value,ground:surfaceHeight});
  if(active&&$('weather').value==='overcast'&&turbulenceFeedback.active)cloudTurbulenceSeen=true;
  else if(active&&cloudTurbulenceSeen){cloudTurbulenceSeen=false;if(recordCloudTurbulence()){badgeGallery?.refresh();notice('Nový odznak: Skrz turbulenci',4000);}}
  const {warning,maneuverWarning}=flightFeedback(state,{active,motion:cameraMotion,turbulence:turbulenceFeedback.intensity,ground:surfaceHeight});
  const maneuverText={climb:'výrazné stoupání.',descent:'výrazné klesání.',acceleration:'zrychlení při rozjezdu.',takeoff:'vzlet a počáteční stoupání.'}[maneuverWarning];
  const gusting=active&&state.gustIntensity>.25;
  const failure=active&&state.engineFailure;
  const condition=gusting?'SILNÉ PORYVY · koriguj směr a náklon.':turbulenceFeedback.active?'TURBULENCE · krátké poryvy vzduchu, udržuj směr letu.':maneuverText?'PRUDKÝ MANÉVR · '+maneuverText:'';
  const engineWarning=failure==='right'?'PRAVÝ MOTOR VYSAZEN · koriguj doleva':failure==='single'?'ZTRÁTA VÝKONU MOTORU · hlídej rychlost':'';
  const warningText=warning==='stall'?'PÁDOVÁ RYCHLOST · přidej výkon a sniž stoupání':warning==='slow'?'NÍZKÁ RYCHLOST · přidej výkon':'';
  $('flightWarning').hidden=!warningText&&!condition&&!engineWarning;
  $('flightWarning').dataset.level=warning||(failure?'engine':gusting||turbulenceFeedback.active?'turbulence':maneuverWarning?'maneuver':'');
  const message=[warningText,engineWarning,condition].filter(Boolean).join('\n');
  if($('flightWarning').textContent!==message)$('flightWarning').textContent=message;
  if(warning==='stall'&&(state.elapsed<lastStallBeep||state.elapsed-lastStallBeep>1.8)){
    engineAudio.stallWarning();lastStallBeep=state.elapsed;
  }
}
function input(){return{roll:Number(keys.has('ArrowRight')||keys.has('KeyD')||touch.has('right'))-Number(keys.has('ArrowLeft')||keys.has('KeyA')||touch.has('left')),pitch:Number(keys.has('ArrowDown')||touch.has('pitchUp'))-Number(keys.has('ArrowUp')||touch.has('pitchDown')),throttle:Number(keys.has('KeyW')||touch.has('powerUp'))-Number(keys.has('KeyS')||touch.has('powerDown'))};}
function tick(now){
  const dt=lastFrame?(now-lastFrame)/1000:0;lastFrame=now;
  if(running&&!paused&&!busy){
    const wasOnGround=Boolean(state.onGround);
    stepFlight(state,input(),dt);
    const atTouchdown=!state.onGround&&Number.isFinite(surfaceHeight)&&state.altitude<=surfaceHeight+5;
    if(atTouchdown||now-lastSurface>(state.onGround||Number.isFinite(surfaceHeight)&&state.altitude-surfaceHeight<35?100:Math.max(40,250*80/Math.max(state.speed,15)))){
      lastSurface=now;
      checkLandingSurface();
      if(now>noticeLock){
        if(mode==='google'&&!Number.isFinite(surfaceHeight))notice('Povrch se ještě načítá. Detekce kolizí je dočasně nedostupná.',3000);
      }
    }
    const sinkRate=state.verticalSpeed,contact=resolveGroundContact(state,surfaceHeight,surfaceFlat);
    if(contact==='landed')landed();else if(contact==='crash')crash(landingFailureReason(state,surfaceFlat));
    const transition=runwayTransition(wasOnGround,state,contact);
    if(transition)runwayEvent(transition,sinkRate);
    updateRace();updateFlightFeedback();
    if(state.elapsed-lastTrail>1){trail.push(offsetMeters(state.lat,state.lon,origin));if(trail.length>1800)trail.shift();lastTrail=state.elapsed;}
    if(mode==='google'&&cityLabels&&now-lastLabels>1200){lastLabels=now;cityLabels.update(state.lat,state.lon);}
    updateCamera();if(now-lastHud>100){lastHud=now;updateHUD();}
  }
  geographyGuide?.update(state,{active:running&&mode==='google',paused:paused||busy||crashed,ground:surfaceHeight,auto:true,visible:!photo.active&&document.body.classList.contains('panel-hidden')});
  requestAnimationFrame(tick);
}
function openDialog(id){if(running&&!paused)pauseFlight(true);keys.clear();touch.clear();$(id).showModal();}
async function init(){
  try{
    if(!C)throw new Error('Cesium missing');
    C.Ion.defaultAccessToken='';
    viewer=new C.Viewer('cesiumContainer',{scene3DOnly:true,baseLayer:false,baseLayerPicker:false,geocoder:false,animation:false,timeline:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,shouldAnimate:false,skyBox:false,shadows:false,contextOptions:{webgl:{alpha:false}}});
    // skyBox:false also omits Cesium's default Sun primitive.
    viewer.scene.sun=new C.Sun();
    viewer.scene.sun.glowFactor=1.4;
    viewer.scene.sunBloom=true;
    weatherEffects=createWeatherEffects(viewer,()=>running);
    installFlightUiLayout({document});
    viewer.scene.globe.baseColor=C.Color.fromCssColorString('#7a9466');viewer.scene.globe.enableLighting=false;viewer.scene.globe.depthTestAgainstTerrain=true;
    viewer.scene.backgroundColor=C.Color.fromCssColorString('#a4c3ca');viewer.scene.fog.density=0.00012;viewer.resolutionScale=Math.min(devicePixelRatio,1.5)/devicePixelRatio;
    viewer.scene.skyAtmosphere.show=true;viewer.scene.screenSpaceCameraController.minimumZoomDistance=30;
    viewer.scene.renderError.addEventListener(()=>{loading('3D zobrazení se zastavilo');$('loading').querySelector('p').textContent='Zkus obnovit stránku v prohlížeči s podporou WebGL. Pokud problém trvá, zavři ostatní 3D aplikace.';});
    daylightTint=viewer.scene.postProcessStages.add(new C.PostProcessStage({
      name:'aeronaut_daylight',
      uniforms:{
        tint:new C.Cartesian3(1,1,1),saturation:1,sunset:0,sunsetClouds:0,eveningHaze:0,daylightHaze:0,nightHaze:0,
        stars:0,moon:0,moonDirection:new C.Cartesian3(1,0,0),
        moonTexture:'/vendor/Assets/Textures/moonSmall.jpg',
        cloudCount:()=>weatherEffects.volume.count,
        cloudCenters:()=>weatherEffects.volume.centers,
        cloudShapes:()=>weatherEffects.volume.shapes,
        cloudUp:()=>weatherEffects.volume.up
      },
      fragmentShader:`
        uniform sampler2D colorTexture;
        uniform sampler2D depthTexture;
        uniform vec3 tint;
        uniform float saturation;
        uniform float sunset;
        uniform float sunsetClouds;
        uniform float eveningHaze;
        uniform float daylightHaze;
        uniform float nightHaze;
        uniform float stars;
        uniform float moon;
        uniform vec3 moonDirection;
        uniform sampler2D moonTexture;
        ${cloudVolumeShader}
        in vec2 v_textureCoordinates;

        float sunsetWarmth(vec3 ray,vec3 up,vec3 sunAzimuth){
          vec3 horizontal=ray-dot(ray,up)*up;
          float towardSun=dot(horizontal,sunAzimuth)/max(length(horizontal),0.001);
          return smoothstep(-0.18,0.75,towardSun);
        }

        vec3 nightHorizonColor(){
          return vec3(0.66,0.71,0.72)*tint;
        }

        vec3 renderDistanceHaze(vec3 terrain,float depth){
          vec4 eye=czm_windowToEyeCoordinates(gl_FragCoord.xy,depth);
          vec3 offset=eye.xyz/eye.w;
          float distanceToTerrain=length(offset);
          if(nightHaze>0.0){
            float haze=0.98*(1.0-exp(-max(distanceToTerrain-2200.0,0.0)/13000.0));
            return mix(terrain,nightHorizonColor(),haze);
          }
          if(daylightHaze>0.0){
            float haze=daylightHaze*(1.0-exp(-max(distanceToTerrain-2800.0,0.0)/16500.0));
            return mix(terrain,vec3(0.66,0.75,0.80)*tint,haze);
          }
          // Keep nearby ground clear and soften distant contrast without hiding the terrain.
          float haze=0.94*(1.0-exp(-max(distanceToTerrain-1800.0,0.0)/10800.0));
          vec3 ray=czm_inverseViewRotation*normalize(offset);
          vec3 sun=czm_inverseViewRotation*czm_sunDirectionEC;
          vec3 up=normalize(czm_viewerPositionWC);
          vec3 sunAzimuth=normalize(sun-dot(sun,up)*up);
          float warmth=sunsetWarmth(ray,up,sunAzimuth)*sunset;
          vec3 hazeColor=mix(vec3(0.57,0.51,0.47),vec3(0.73,0.44,0.32),warmth);
          // Carry the red sky tint into the distant haze directly below it.
          float redHaze=smoothstep(0.22,0.90,warmth)*smoothstep(-0.16,-0.025,dot(ray,up));
          hazeColor=mix(hazeColor,vec3(0.79,0.32,0.24),redHaze);
          return mix(terrain,hazeColor,haze);
        }

        vec3 renderSunset(vec3 sky,vec2 uv){
          vec4 eye=czm_inverseProjection*vec4(uv*2.0-1.0,1.0,1.0);
          vec3 ray=czm_inverseViewRotation*normalize(eye.xyz);
          vec3 sun=czm_inverseViewRotation*czm_sunDirectionEC;
          vec3 up=normalize(czm_viewerPositionWC);
          float height=dot(ray,up);
          float sunHeight=dot(sun,up);
          float horizon=smoothstep(-0.035,0.012,height);
          float alignment=max(0.0,dot(ray,sun));
          vec3 sunAzimuth=normalize(sun-sunHeight*up);
          float warmHalf=sunsetWarmth(ray,up,sunAzimuth);
          float nearSun=pow(alignment,170.0);
          float upperSky=smoothstep(0.025,0.64,height);
          vec3 orange=mix(vec3(0.92,0.21,0.065),vec3(1.0,0.62,0.24),upperSky);
          vec3 color=mix(sky,orange,warmHalf*horizon*(1.0-upperSky)*0.86);
          color=mix(color,vec3(1.0,0.53,0.13),nearSun*horizon*0.7);

          // Use angular coordinates so wisps keep their proportions across the sky.
          vec3 across=cross(up,sunAzimuth);
          float azimuth=atan(dot(ray,across),dot(ray,sunAzimuth));
          vec3 cloudPoint=vec3(azimuth*12.0,height*110.0,2.4);
          float wisps=0.65*cloudNoise(cloudPoint)
                     +0.25*cloudNoise(cloudPoint*2.6)
                     +0.10*cloudNoise(cloudPoint*6.4);
          float cloud=smoothstep(0.46,0.65,wisps)*warmHalf*horizon*(1.0-upperSky)*sunsetClouds;
          vec3 cloudColor=mix(vec3(0.24,0.12,0.13),vec3(0.70,0.30,0.16),nearSun*0.7);
          color=mix(color,cloudColor,cloud*0.68);

          // Angular size keeps the disk round at different fields of view.
          float angle=acos(clamp(dot(ray,sun),-1.0,1.0));
          float disk=1.0-smoothstep(0.0075,0.0096,angle);
          float halo=exp(-angle*43.0);
          float visible=smoothstep(-0.01,0.003,sunHeight);
          color=mix(color,vec3(1.0,0.67,0.20),halo*visible*(1.0-cloud*0.65)*0.82);
          return mix(color,vec3(1.0,0.94,0.63),disk*visible*(1.0-cloud*0.55));
        }

        vec3 renderNightSky(vec3 sky,vec2 uv){
          vec4 eye=czm_inverseProjection*vec4(uv*2.0-1.0,1.0,1.0);
          vec3 ray=czm_inverseViewRotation*normalize(eye.xyz);
          float elevation=dot(ray,normalize(czm_viewerPositionWC));
          float horizon=smoothstep(0.005,0.20,elevation);
          sky*=mix(1.0,0.58,smoothstep(0.0,0.65,elevation));
          sky=mix(nightHorizonColor(),sky,smoothstep(-0.015,0.12,elevation));
          if(stars>0.0){
            vec2 coordinates=vec2(atan(ray.y,ray.x)/czm_twoPi+0.5,
                                  asin(clamp(ray.z,-1.0,1.0))/czm_pi+0.5);
            vec2 grid=coordinates*vec2(260.0,130.0);
            vec2 cell=floor(grid);
            vec3 seed=vec3(mod(cell.x,260.0),cell.y,19.0);
            float random=cloudHash(seed);
            vec2 center=0.2+0.6*vec2(cloudHash(seed+4.0),cloudHash(seed+9.0));
            float pixel=clamp(length(fwidth(grid))*0.65,0.012,0.085);
            float radius=mix(0.012,0.042,random*random);
            float star=1.0-smoothstep(radius,radius+pixel,length(fract(grid)-center));
            sky+=vec3(0.74,0.85,1.0)*star*smoothstep(0.78,1.0,random)*horizon*0.64;
          }
          if(moon>0.0){
            float alignment=dot(ray,moonDirection);
            float angle=acos(clamp(alignment,-1.0,1.0));
            float disk=1.0-smoothstep(0.0108,0.0120,angle);
            sky+=vec3(0.19,0.29,0.42)*exp(-angle*39.0)*horizon;
            if(disk>0.0){
              vec3 right=normalize(cross(vec3(0.0,0.0,1.0),moonDirection));
              vec3 up=cross(moonDirection,right);
              vec2 face=vec2(dot(ray,right),dot(ray,up))/0.0118;
              float front=sqrt(max(0.0,1.0-dot(face,face)));
              vec2 lunarUV=vec2(atan(face.x,front)/czm_twoPi+0.5,
                                asin(clamp(face.y,-1.0,1.0))/czm_pi+0.5);
              float surface=texture(moonTexture,lunarUV).r;
              vec3 moonlight=vec3(0.77,0.87,0.98)*mix(0.57,1.15,surface);
              sky=mix(sky,moonlight,disk*horizon);
            }
          }
          return sky;
        }

        void main(){
          vec4 color=texture(colorTexture,v_textureCoordinates);
          float gray=dot(color.rgb,vec3(0.2126,0.7152,0.0722));
          vec3 rgb=mix(vec3(gray),color.rgb,saturation)*tint;
          float depth=texture(depthTexture,v_textureCoordinates).r;
          if(sunset>0.0 && depth>=1.0){
            rgb=renderSunset(rgb,v_textureCoordinates);
          }else if(nightHaze>0.0 && depth>=1.0){
            rgb=renderNightSky(rgb,v_textureCoordinates);
          }else if((eveningHaze>0.0||daylightHaze>0.0||nightHaze>0.0) && depth<1.0){
            rgb=renderDistanceHaze(rgb,depth);
          }
          if(cloudCount>0){
            rgb=renderCloudVolumes(rgb,v_textureCoordinates,depth,tint);
          }
          out_FragColor=vec4(rgb,color.a);
        }`
    }));
    daylightTint.enabled=false;
    try{const saved=localStorage.getItem(DAYLIGHT_STORAGE_KEY);$('timeOfDay').value=Object.hasOwn(DAYLIGHT_PRESETS,saved)?saved:'day';}catch{$('timeOfDay').value='day';}
    $('timeOfDay').onchange=()=>{try{localStorage.setItem(DAYLIGHT_STORAGE_KEY,$('timeOfDay').value);}catch{}applyTimeOfDay();};
    try{const saved=localStorage.getItem(WEATHER_STORAGE_KEY);$('weather').value=Object.hasOwn(WEATHER_PRESETS,saved)?saved:'clear';}catch{$('weather').value='clear';}
    $('weather').onchange=()=>{try{localStorage.setItem(WEATHER_STORAGE_KEY,$('weather').value);}catch{}applyTimeOfDay();};
    raceView=createRaceView(viewer,race,()=>state);
    demo=createDemo(viewer);demo.boundary.show=false;aircraft=createAircraft(viewer,()=>state,()=>surfaceHeight,(lat,lon)=>mode==='demo'?viewer.scene.sampleHeight(C.Cartographic.fromDegrees(lon,lat),surfaceExclusions())??demo.surface(lat,lon):terrainSample(lat,lon));cityLabels=createCityLabels(viewer);
    crashEffect=createCrashEffect(viewer);
    geographyGuide=createGeographyGuide(viewer,{document,onPause:()=>{if(running&&!paused&&!crashed)pauseFlight(true);}});
    badgeGallery=createAchievementGallery(document,{onPause:()=>{if(running&&!paused&&!crashed)pauseFlight(true);}});
    cityLabels.ready.then(ready=>{if(ready&&mode==='google')cityLabels.update(selection().lat,selection().lon);});
    $('aircraftModel').value=readSavedModel();
    $('aircraftModel').onchange=()=>{const choice=$('aircraftModel').value;if(!isAircraftUnlocked(choice)){$('aircraftModel').value='highWing';return;}saveModel(choice);aircraft.selectModel(choice);engineAudio.setModel(choice);selectFlightAircraft(state,choice);updateAircraftHandling();if(isRace()&&!running)applyMission();if(running){lastSurface=0;updateCamera();updateHUD();notice('Letové vlastnosti odpovídají vybranému letadlu.',3000);}};
    $('aircraftModel').addEventListener('change',()=>syncControls());
    aircraft.selectModel($('aircraftModel').value);
    engineAudio.setModel($('aircraftModel').value);
    selectFlightAircraft(state,$('aircraftModel').value);updateAircraftHandling();
    resetScene();syncControls();overview();syncSoundButton();
    $('cesiumContainer').addEventListener('pointerdown',event=>{
      if(!running||crashed||busy||photo.drag||event.button!==0||event.target!==viewer.canvas)return;
      event.preventDefault();photo.drag={id:event.pointerId,x:event.clientX,y:event.clientY};
      $('cesiumContainer').setPointerCapture(event.pointerId);document.body.classList.add('photo-dragging');
    });
    for(const name of ['pointerup','pointercancel','lostpointercapture'])$('cesiumContainer').addEventListener(name,event=>{
      if(photo.drag?.id===event.pointerId)stopInspectDrag();
    });
    $('cesiumContainer').addEventListener('pointermove',event=>{
      if(!running||crashed||busy||photo.drag?.id!==event.pointerId)return;
      const rect=$('cesiumContainer').getBoundingClientRect();
      if(!rect.width||!rect.height)return;
      const turn=(event.clientX-photo.drag.x)/rect.width*2*Math.PI;
      const tilt=(event.clientY-photo.drag.y)/rect.height*Math.PI;
      if(!turn&&!tilt)return;
      if(paused){
        inspectHeading-=turn;
        inspectElevation=Math.max(.03,Math.min(1.35,inspectElevation+tilt));
      }else{
        if(!flightOrbit){
          // A roof mount is too close for an orbit. Start that gesture at chase distance.
          const mode=flightCameraMode==='roof'?'chase':flightCameraMode;
          const {offset,orientation}=flightCameraPose(state,aircraft.chaseDistance||48,mode);
          const horizontal=Math.hypot(offset.x,offset.y);
          flightOrbit={
            headingOffset:orientation.heading-state.heading,
            elevation:Math.atan2(offset.z,horizontal),
            distance:Math.hypot(horizontal,offset.z)
          };
        }
        flightOrbit.headingOffset=(flightOrbit.headingOffset-turn)%(2*Math.PI);
        flightOrbit.elevation=Math.max(-1.5,Math.min(Math.PI/2,flightOrbit.elevation+tilt));
      }
      photo.drag.x=event.clientX;
      photo.drag.y=event.clientY;
      updateCamera();
    });
    $('cesiumContainer').addEventListener('wheel',event=>{
      if(!running||!paused||crashed||busy)return;
      event.preventDefault();
      const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?800:1);
      const minDistance=Math.max(18,(aircraft.chaseDistance||48)*.4);
      inspectDistance=Math.max(minDistance,Math.min(2500,inspectDistance*Math.exp(delta*.0015)));
      if(photo.active)syncPhotoControls();
      updateCamera();
    },{passive:false});
    locationSearch=createLocationSearch({C,document,
      canSearch:()=>!busy&&!running&&menuStep===3&&mode==='google'&&!isRace(),
      getToken:()=>ionToken,
      request:query=>withTimeout(new C.IonGeocoderService({scene:viewer.scene,accessToken:ionToken}).geocode(query),12000,'Vyhledávání vypršelo.'),
      onPick:useSearchLocation,onNeedToken:()=>openDialog('connectionDialog'),
      onResults:showLocationSearchCredits,onClear:clearLocationPreviewCredits});
    destinationGlobe=createDestinationGlobe({C,root:$('destinationGlobe'),
      missions:DISPLAY_MISSIONS,
      onMission:id=>chooseMission(id,{showBriefing:true,keepGlobeView:true}),onPoint:previewStart});
    initGameMenu(syncControls,chooseLocation,chooseMission);syncControls();loading(null);requestAnimationFrame(tick);if(ionToken)prepareGoogle();
  }catch(error){console.error('Aeronaut initialization failed:',error);loading('3D prostředí se nepodařilo spustit');$('loading').querySelector('p').textContent='Při spuštění nastala chyba. Obnov stránku; pokud se chyba opakuje, dej mi vědět. Podrobnosti jsou v konzoli prohlížeče.';$('loading').querySelector('.spinner').hidden=true;}
}
$('demoMode').onclick=()=>{$('connectionDialog').close();setMode('demo');};$('googleMode').onclick=()=>{$('connectionDialog').close();setMode('google');};
$('startButton').onclick=()=>{if(running)closeGameMenu();else if(menuStep<3)setMenuStep(menuStep+1);else if(isRace()&&!isMissionUnlocked(missionId))chooseMission(missionProgress().nextMissionId||'first-takeoff',{showBriefing:true});else if(mapDraft)confirmStartDraft();else startFlight();};$('resumeButton').onclick=()=>crashed?restart():pauseFlight(false);$('restartButton').onclick=restart;$('endButton').onclick=endFlight;$('soundButton').onclick=toggleSound;
$('resultContinue').onclick=continueFreeFlight;$('resultRetry').onclick=restart;$('resultMenu').onclick=()=>{endFlight();setMenuStep(3);};
$('resultNext').onclick=()=>{const next=missionProgress().nextMissionId;if(!next)return;endFlight();setMenuStep(3);chooseMission(next,{showBriefing:true});};
$('photoButton').onclick=enterPhotoMode;$('photoExit').onclick=exitPhotoMode;
$('photoReset').onclick=resetPhotoCamera;$('photoCapture').onclick=savePhoto;
$('photoHideControls').onclick=()=>setPhotoControlsHidden(true);$('photoRestoreControls').onclick=()=>setPhotoControlsHidden(false);
$('cameraMotion').checked=cameraMotion;
$('cameraMotion').onchange=()=>{cameraMotion=$('cameraMotion').checked;try{localStorage.setItem('aeronaut.cameraMotion',String(cameraMotion));}catch{}updateCamera();};
function syncFlightCameraButtons(){document.querySelectorAll('[data-flight-camera]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.flightCamera===flightCameraMode)));}
function setFlightCameraMode(selected){
  if(!FLIGHT_CAMERA_MODES.includes(selected))return;
  stopInspectDrag();
  flightOrbit=null;
  flightCameraMode=selected;
  try{localStorage.setItem(FLIGHT_CAMERA_STORAGE_KEY,selected);}catch{}
  syncFlightCameraButtons();
  updateCamera();
}
function cycleFlightCamera(){
  setFlightCameraMode(FLIGHT_CAMERA_MODES[(FLIGHT_CAMERA_MODES.indexOf(flightCameraMode)+1)%FLIGHT_CAMERA_MODES.length]);
  notice('Kamera: '+({chase:'Za letadlem',distant:'Z dálky',overhead:'Shora',front:'Zepředu',cinematic:'Filmová kamera',roof:'Nad kabinou'})[flightCameraMode],1500);
}
syncFlightCameraButtons();
document.querySelectorAll('[data-flight-camera]').forEach(button=>button.onclick=()=>setFlightCameraMode(button.dataset.flightCamera));
$('photoDistance').oninput=()=>{if(!photo.active)return;const minimum=Math.max(18,(aircraft.chaseDistance||48)*.4);inspectDistance=minimum*Math.pow(2500/minimum,Number($('photoDistance').value)/100);syncPhotoControls();updateCamera();};
$('photoFov').oninput=()=>{if(!photo.active)return;viewer.camera.frustum.fov=Number($('photoFov').value)*RAD;syncPhotoControls();updateCamera();};
$('photoRoll').oninput=()=>{if(!photo.active)return;photo.roll=Number($('photoRoll').value);syncPhotoControls();updateCamera();};
$('photoAircraft').onchange=()=>{if(photo.active)aircraft.show=$('photoAircraft').checked;};
$('photoLabels').onchange=()=>{if(photo.active&&cityLabels){cityLabels.source.show=mode==='google'&&$('photoLabels').checked;if(cityLabels.source.show)cityLabels.update(state.lat,state.lon);}};
$('gameMode').onchange=()=>{
  if(running||busy)return;
  race.reset();
  locationSearch?.cancel();
  if(isRace()){freeConditions={time:$('timeOfDay').value,weather:$('weather').value};applyMission();}
  else{$('timeOfDay').value=freeConditions.time;$('weather').value=freeConditions.weather;applyTimeOfDay();}
  if(isRace()&&mode!=='google')setMode('google');
  else{syncControls();overview();}
};
function applyMission(){
  const mission=currentMission();race.setRoute(mission.route);raceView?.setRoute(mission.route);
  $('timeOfDay').value=mission.time;$('weather').value=mission.weather;applyTimeOfDay();
}
function chooseMission(id,{showBriefing=false,keepGlobeView=false}={}){
  if(busy||running||!isRace())return;
  missionId=id;applyMission();showError('');syncControls({keepGlobeView});overview();
  if(showBriefing)openMissionBriefing();
}
function openMissionBriefing(){
  if($('careerMapDialog').open)$('careerMapDialog').close();
  $('missionMore').open=true;
  openDialog('missionDetails');
  $('missionDetails').querySelector('.mission-briefing-body').scrollTop=0;
}
function setMenuStep(step){
  if(busy||running)return;
  menuStep=step;showError('');syncControls();$('sidebar').scrollTo({top:0,behavior:'instant'});
}
function chooseLocation(key){
  if(busy||running||isRace())return;
  locationSearch?.cancel();
  mapDraft=null;
  clearLocationCredits();locationKey=key;showError('');syncControls();overview();
}
function previewStart(place){
  if(busy||running||isRace()||mode!=='google'||menuStep!==3)return;
  mapDraft=place;
  showError('');syncControls();
}
function confirmStartDraft(){
  if(!mapDraft||busy||running||isRace()||mode!=='google'||menuStep!==3)return;
  locationSearch?.cancel();clearLocationCredits();
  locationKey='custom';customLocation=mapDraft;mapDraft=null;
  showError('');syncControls();overview();
}
function cancelStartDraft(){
  if(!mapDraft||busy)return;
  mapDraft=null;
  syncControls();
  destinationGlobe.centerOn(selectedPlace(locationKey,customLocation));
}
$('randomStart').onclick=()=>{
  const current=mapDraft||selectedPlace(locationKey,customLocation);
  const choices=randomStartPlaces.filter(place=>place.lat!==current.lat||place.lon!==current.lon);
  const place=choices[Math.floor(Math.random()*choices.length)];
  previewStart(place);
  if(mapDraft===place)destinationGlobe.centerOn(place);
};
$('cancelStartDraft').onclick=()=>{
  cancelStartDraft();
  $('randomStart').focus({preventScroll:true});
};
$('globeMissionDetails').onclick=openMissionBriefing;
$('missionBriefingStart').onclick=()=>{
  $('missionDetails').close();
  $('startButton').click();
};
$('briefingAircraft').onchange=()=>{
  const chosen=$('briefingAircraft').value;
  if(!isAircraftUnlocked(chosen)){$('briefingAircraft').value=$('aircraftModel').value;return;}
  $('aircraftModel').value=chosen;
  $('aircraftModel').dispatchEvent(new Event('change',{bubbles:true}));
};
$('globeMissionList').onclick=()=>{
  $('missionCards').focus({preventScroll:true});
  $('missionListHeading').scrollIntoView({block:'start'});
};
$('locationBack').onclick=()=>setMenuStep(menuStep-1);
$('stepSetup').onclick=()=>setMenuStep(1);$('stepGameType').onclick=()=>setMenuStep(2);$('stepLocation').onclick=()=>setMenuStep(3);
function closeGameMenu(){
  if(!running||!$('missionResult').hidden)return;
  document.body.classList.add('panel-hidden');
  if(crashed)restart();else if(paused)pauseFlight(false);
}
$('menuEnd').onclick=endFlight;
$('panelButton').onclick=toggleFlightMenu;
$('flightMenuClose').onclick=()=>{if(crashed)endFlight();else pauseFlight(false);};
$('fullscreenButton').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{notice('Tento prohlížeč nepovoluje celou obrazovku.');}};
$('helpButton').onclick=()=>openDialog('helpDialog');$('connectionButton').onclick=()=>openDialog('connectionDialog');
$('referrerHint').textContent=location.origin;
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>button.closest('dialog').close());
$('keyForm').onsubmit=event=>{event.preventDefault();const value=$('ionToken').value.trim();if(!value){$('ionToken').focus();return;}ionToken=value;locationSearch?.cancel();const stored=saveToken($('rememberToken').checked?value:'');if(!stored)notice('Prohlížeč nepovolil uložení tokenu. Pro tento let připojení funguje.',5000);$('ionToken').value='';epoch++;if(tileset){viewer.scene.primitives.remove(tileset);tileset=undefined;}if(running)endFlight();$('connectionDialog').close();syncControls();if(mode==='google')prepareGoogle();else setMode('google');};
$('forgetKey').onclick=()=>{locationSearch?.cancel();ionToken='';saveToken('');$('ionToken').value='';epoch++;busy=false;if(tileset){viewer.scene.primitives.remove(tileset);tileset=undefined;}$('connectionDialog').close();setMode('demo');notice('Cesium ion token byl odstraněn z tohoto prohlížeče.');};
window.addEventListener('keydown',event=>{
  if(running&&!$('missionResult').hidden){if(event.code==='KeyR'&&!event.repeat){event.preventDefault();restart();}else if(['Escape','Space','KeyP','KeyF'].includes(event.code))event.preventDefault();return;}
  if(event.code==='Escape'&&!running&&menuStep>1&&!document.querySelector('dialog[open]')){event.preventDefault();if(mapDraft)cancelStartDraft();else setMenuStep(menuStep-1);return;}
  if(event.code==='Escape'&&!photo.active&&!document.querySelector('dialog[open]')&&running){event.preventDefault();if(event.repeat)return;toggleFlightMenu();return;}
  if(photo.active&&['Escape','KeyF'].includes(event.code)){
    event.preventDefault();if(!event.repeat){exitPhotoMode();($('pauseOverlay').hidden?$('panelButton'):$('photoButton')).focus({preventScroll:true});}return;
  }
  const code=event.code;
  if(photo.active){
    if(event.repeat)return;
    if(code==='KeyH'){event.preventDefault();setPhotoControlsHidden(!photo.clean);}
    else if(code==='Enter'&&!['BUTTON','A'].includes(document.activeElement?.tagName)){event.preventDefault();savePhoto();}
    else if(code==='KeyP'||code==='Space'&&!['BUTTON','A','INPUT'].includes(document.activeElement?.tagName)){event.preventDefault();pauseFlight(false);}
    return;
  }
  if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)||document.querySelector('dialog[open]'))return;
  if(event.key==='?'){event.preventDefault();openDialog('helpDialog');return;}
  if(!running||!document.body.classList.contains('panel-hidden'))return;
  if(code==='KeyC'){
    if(event.ctrlKey||event.metaKey||event.altKey)return;
    event.preventDefault();
    if(!event.repeat&&!paused&&!crashed&&!busy)cycleFlightCamera();
    return;
  }
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyS','KeyA','KeyD','KeyP','KeyR','KeyM','KeyF','KeyG'].includes(code))event.preventDefault();
  if(!event.repeat){if(code==='KeyP'||code==='Space'){pauseFlight();return;}if(code==='KeyF'){enterPhotoMode();return;}if(code==='KeyR'){restart();return;}if(code==='KeyM'){toggleSound();return;}if(code==='KeyG'){geographyGuide?.toggle();return;}}
  if(!paused)keys.add(code);
});
window.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>{stopInspectDrag();keys.clear();touch.clear();if(running&&!paused)pauseFlight(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopInspectDrag();if(running&&!paused)pauseFlight(true);}});
document.querySelectorAll('[data-control]').forEach(button=>{button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);if(!paused)touch.add(button.dataset.control);});for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,()=>touch.delete(button.dataset.control));});
// Modules can run before a deferred vendor script in some hosts; initialize after load.
if(document.readyState==='complete')init();else window.addEventListener('load',init,{once:true});
