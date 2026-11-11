import {missionFeedback,starsForMedal} from '../src/mission-performance.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const C=createRequire(import.meta.url)('cesium');
import {MISSIONS,getMission,getPlayableMission,missionStart,TIME_NAMES,WEATHER_NAMES} from '../src/missions.js';
import {BrnoRace,gateFrame} from '../src/brno-race.js';
import {createRaceView} from '../src/race-view.js';
import {RAD,EARTH} from '../src/flight.js';
import {DIFFICULTIES,resolveRouteSurface,routeSurfacePoints} from '../src/mission-difficulty.js';
import {discoveryCone} from '../src/mission-objectives.js';
import {objectiveType,usesScore,discoveryMessage} from '../src/task-missions.js';
import {isMissionUnlocked,recordMissionCompletion,BRNO_MISSION_IDS,missionProgress} from '../src/mission-progression.js';

function gatePoint(route,index,along,elapsed){
  const {center,normal}=gateFrame(index,route),anchor=route.gates[0];
  return{lat:anchor.lat+(center.y+normal.y*along)/EARTH/RAD,lon:anchor.lon+(center.x+normal.x*along)/(EARTH*Math.cos(anchor.lat*RAD))/RAD,altitude:route.altitude,elapsed};
}
test('all twelve missions spawn before their own start and finish only after their five gates',()=>{
  assert.deepEqual(MISSIONS.filter(m=>!m.taskVariants&&!m.fixedRoute).map(m=>m.id),['brno','prague','sf','paris','nyc','everest','giza','grandcanyon','matterhorn','fuji','rio','iceland']);assert.equal(new Set(MISSIONS.map(m=>m.route.id)).size,MISSIONS.length);
  for(const mission of MISSIONS.filter(mission=>!mission.taskVariants&&!mission.fixedRoute)){
    assert.ok(TIME_NAMES[mission.time]);assert.ok(WEATHER_NAMES[mission.weather]);assert.ok(mission.location.image);
    const race=new BrnoRace(mission.route),start=missionStart(mission);
    race.update({...start,elapsed:0});assert.equal(race.next,0);
    assert.ok(race.target(start).distance>850&&race.target(start).distance<950);
    for(let index=0;index<5;index++){
      race.update(gatePoint(mission.route,index,-100,index*20+2));
      const events=race.update(gatePoint(mission.route,index,100,index*20+4));
      assert.ok(events.some(event=>event.index===index),mission.id+' gate '+index);
    }
    assert.equal(race.status,'finished');assert.ok(Math.abs(race.elapsed(1000)-80)<1e-5);
    race.setRoute(getMission('prague').route);assert.equal(race.status,'ready');assert.equal(race.next,0);assert.equal(race.previous,null);
  }
});
test('changing mission rebuilds Cesium gate geometry and removes the previous route',()=>{
  globalThis.window={Cesium:C};
  const race=new BrnoRace(),viewer={dataSources:new C.DataSourceCollection()},source=createRaceView(viewer,race);
  for(const mission of MISSIONS){
    const oldIds=source.entities.values.map(entity=>entity.id);
    race.setRoute(mission.route);source.setRoute(mission.route);
    const count=mission.route.gates.length;
    assert.equal(source.entities.values.length,1+count*2+(mission.route.objective?.stop?2:0)+(mission.route.objective?.type==='sightseeing'?count:mission.route.objective?.type==='landing'?mission.route.gates.filter(g=>['landing','touch-and-go'].includes(g.kind)).length:0));
    assert.ok(source.entities.values.every(entity=>!oldIds.includes(entity.id)));
    const path=source.entities.values[0].polyline.positions.getValue(C.JulianDate.now());
    const position=C.Cartographic.fromCartesian(path[0]);
    assert.ok(Math.abs(C.Math.toDegrees(position.latitude)-mission.route.gates[0].lat)<1e-6);
    assert.ok(Math.abs(C.Math.toDegrees(position.longitude)-mission.route.gates[0].lon)<1e-6);
  }
  delete globalThis.window;
});
test('the dashed route material follows the aircraft position in camera coordinates',()=>{
  const previousWindow=globalThis.window;globalThis.window={Cesium:C};
  try{
    const race=new BrnoRace(),time=C.JulianDate.now();
    let aircraft={...race.route.gates[0],altitude:race.route.altitude};
    const origin=C.Cartesian3.fromDegrees(aircraft.lon,aircraft.lat,aircraft.altitude);
    const camera={viewMatrix:C.Matrix4.fromTranslation(C.Cartesian3.negate(origin,new C.Cartesian3()))};
    const view=createRaceView({dataSources:new C.DataSourceCollection(),camera},race,()=>aircraft);
    const property=view.entities.values[0].polyline.material;
    const material=C.Material.fromType(property.getType(time));
    assert.equal(material.materials.dashes.uniforms.dashLength,20);
    assert.ok(material.uniforms.fadeEnd>material.uniforms.fadeStart);
    property.getValue(time,material.uniforms);
    assert.equal(C.Cartesian3.magnitude(material.uniforms.aircraftEye),0);
    aircraft={...aircraft,altitude:aircraft.altitude+1500};
    property.getValue(time,material.uniforms);
    assert.ok(Math.abs(C.Cartesian3.magnitude(material.uniforms.aircraftEye)-1500)<.001);
  }finally{globalThis.window=previousWindow;}
});
test('discovery renders the same cone that is used for collection and advances its active marker',()=>{
  const previousWindow=globalThis.window;globalThis.window={Cesium:C};
  try{
    const mission=getMission('brno-discovery'),route=resolveRouteSurface(mission.route,routeSurfacePoints(mission.route).map(()=>277));
    const race=new BrnoRace(route),source=createRaceView({dataSources:new C.DataSourceCollection()},race),time=C.JulianDate.now();
    const cones=source.entities.values.filter(entity=>entity.cylinder);
    assert.equal(cones.length,5);
    for(const [index,entity] of cones.entries()){
      const expected=discoveryCone(route,route.gates[index]);
      assert.equal(entity.cylinder.length.getValue(time),expected.height);
      assert.equal(entity.cylinder.topRadius.getValue(time),expected.radius);
      assert.equal(entity.cylinder.bottomRadius.getValue(time),0);
      assert.equal(entity.cylinder.show.getValue(time),index===0);
      assert.ok(Math.abs(C.Cartographic.fromCartesian(entity.position.getValue(time)).height-(expected.surface+expected.height/2))<.001);
    }
    race.next=1;assert.equal(cones[0].cylinder.show.getValue(time),false);assert.equal(cones[1].cylinder.show.getValue(time),true);
    race.status='finished';assert.ok(cones.every(entity=>!entity.cylinder.show.getValue(time)));
  }finally{globalThis.window=previousWindow;}
});

test('the final discovery is saved before the mission-complete notice is shown',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8'),route=getMission('brno-discovery').route,saved=[],messages=[];
  const context=vm.createContext({objectiveType,usesScore,discoveryMessage,missionFeedback,achievementCollection:()=>({items:[]}),
    geographyGuide:{collectPlace:id=>{saved.push(id);return{isNew:true,saved:true};}},
    engineAudio:{gatePassed(){}},recordMissionResult:()=>({medal:'bronze'}),currentMission:()=>getMission('brno-discovery'),showMissionResult:()=>{},syncControls:()=>{},
    race:{route,next:5,score:100,update:()=>[{index:4,status:'finished'}],elapsed:()=>0},
    notice:text=>{assert.equal(saved.length,1);messages.push(text);}
  });
  vm.runInContext("const state={elapsed:1};let crashed=false,surfaceHeight=277,missionId='brno-discovery',raceBest=null;const isRace=()=>true;"+
    app.slice(app.indexOf('function updateRace(){'),app.indexOf('function showMissionResult(')),context);
  vm.runInContext('updateRace()',context);
  assert.deepEqual(saved,['cs:26471']);assert.match(messages[0],/Uloženo do sbírky: Veveří/);assert.match(messages[0],/Mise splněna/);
});

test('passing the second gate triggers the mission engine failure once per attempt',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  const updateCode=app.slice(app.indexOf('function updateRace(){'),app.indexOf('function showMissionResult('));
  for(const [model,failure] of [['airliner','right'],['highWing','single']]){
    const source=getPlayableMission('sfo-arrival',model).route;
    const route=resolveRouteSurface(source,routeSurfacePoints(source).map(()=>0));
    const race=new BrnoRace(route),messages=[];
    const context=vm.createContext({race,objectiveType,isRace:()=>true,engineAudio:{gatePassed(){}},notice:text=>messages.push(text)});
    vm.runInContext('let state,crashed=false;'+updateCode,context);
    let elapsed=0;
    const pass=index=>{
      for(const distance of [-30,30]){
        context.next={...gatePoint(route,index,distance,elapsed+=1),altitude:route.gates[index].altitude,model,engineFailure:vm.runInContext('state?.engineFailure',context)};
        vm.runInContext('state=next;updateRace()',context);
      }
    };
    vm.runInContext('let surfaceHeight=0;',context);
    pass(0);
    assert.equal(vm.runInContext('state.engineFailure',context),undefined);
    pass(1);
    assert.equal(vm.runInContext('state.engineFailure',context),failure);
    pass(2);
    assert.equal(messages.filter(text=>/motor/i.test(text)).length,1);
    race.reset();
    vm.runInContext('state=undefined;',context);
    pass(0);pass(1);
    assert.equal(vm.runInContext('state.engineFailure',context),failure);
    assert.equal(messages.filter(text=>/motor/i.test(text)).length,2);
  }
});
test('mission result shows the flown stars and next flight while paused',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8'),elements=new Map(),calls=[];
  const stars=Array.from({length:3},()=>({dataset:{}}));
  const $=id=>{if(!elements.has(id))elements.set(id,{hidden:true,dataset:{},classList:{toggle(){},remove(){},add(){}},setAttribute(){},querySelectorAll:()=>stars,focus(){calls.push('focus:'+id);},offsetWidth:520});return elements.get(id);};
  const context=vm.createContext({$,starsForMedal,MEDAL_NAMES:{bronze:'Bronz',silver:'Stříbro',gold:'Zlato'},getMission,pauseFlight:value=>calls.push('pause:'+value),currentMission:()=>getMission('brno-landing')});
  vm.runInContext(app.slice(app.indexOf('function showMissionResult('),app.indexOf('function syncControls(')),context);
  vm.runInContext(`showMissionResult({reward:{medal:'gold',rankUp:false,saved:true,newMissions:['brno-discovery'],nextMissionId:'brno-discovery'}})`,context);
  assert.equal($('missionResult').hidden,false);
  assert.deepEqual(stars.map(star=>star.dataset.earned),['true','true','true']);
  assert.equal($('resultMedalName').textContent,'Zlato');
  assert.equal($('resultPromotion').hidden,true);
  assert.match($('resultUnlocks').textContent,/Pět tváří Brna/);
  assert.match($('resultNext').textContent,/Pět tváří Brna/);
  assert.deepEqual(calls,['pause:true','focus:resultNext']);
});
test('mission selection fixes conditions, restores free-flight choices and preserves the selected free location',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  const elements=new Map(['gameMode','timeOfDay','weather'].map(id=>[id,{value:''}]));
  const $=id=>elements.get(id);$('gameMode').value='free';$('timeOfDay').value='evening';$('weather').value='haze';
  const saved=new Map(),storage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value),key:index=>[...saved.keys()][index]??null,get length(){return saved.size;}};
  const context=vm.createContext({$,getMission,BrnoRace,DIFFICULTIES,isMissionUnlocked:id=>isMissionUnlocked(id,storage),syncControls(){},overview(){},applyTimeOfDay(){},showError(){},setMode(){throw Error('unexpected source change');}});
  vm.runInContext(`let running=false,busy=false,mode='google',locationKey='paris',missionId='brno-landing',missionLevel='easy',freeConditions={};const race=new BrnoRace();let raceView;const locationSearch={cancel(){}};const isRace=()=>$('gameMode').value==='missions';const currentMission=()=>getMission(missionId,missionLevel);`+app.slice(app.indexOf("$('gameMode').onchange="),app.indexOf('function setMenuStep(step)')),context);
  $('gameMode').value='missions';$('gameMode').onchange();
  assert.equal($('timeOfDay').value,'day');assert.equal($('weather').value,'clear');
  vm.runInContext("chooseMission('paris')",context);
  assert.equal(vm.runInContext('missionId',context),'paris','locked missions can be previewed');
  vm.runInContext("chooseMission('brno-discovery')",context);
  assert.equal(vm.runInContext('missionId',context),'brno-discovery');
  recordMissionCompletion('brno-landing',storage);
  vm.runInContext("chooseMission('brno-discovery')",context);assert.equal(vm.runInContext('missionId',context),'brno-discovery');
  assert.equal($('timeOfDay').value,'evening');assert.equal($('weather').value,'partly');
  assert.equal(vm.runInContext('race.route.id',context),getMission('brno-discovery').route.id);
  $('gameMode').value='free';$('gameMode').onchange();
  assert.equal($('timeOfDay').value,'evening');assert.equal($('weather').value,'haze');
  assert.equal(vm.runInContext('locationKey',context),'paris');
});

test('the primary action on a locked preview selects the next unfinished Brno mission without starting a flight',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  const controls=new Map(),$=id=>{if(!controls.has(id))controls.set(id,{});return controls.get(id);};
  const saved=new Map(),storage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)};
  const selected=[],context=vm.createContext({$,BRNO_MISSION_IDS,missionProgress:()=>missionProgress(storage),
    isMissionUnlocked:id=>isMissionUnlocked(id,storage),isRace:()=>true,chooseMission:id=>selected.push(id),
    startFlight:()=>assert.fail('a locked preview must never start a flight'),restart(){},endFlight(){},toggleSound(){}});
  vm.runInContext(`let running=false,crashed=false,menuStep=3,missionId='prague';`+app.split('\n').find(line=>line.startsWith("$('startButton').onclick=")),context);
  $('startButton').onclick();assert.equal(selected.at(-1),'first-takeoff');
  recordMissionCompletion('first-takeoff',storage);
  $('startButton').onclick();assert.equal(selected.at(-1),'brno-landing');
  recordMissionCompletion('brno-landing',storage);
  $('startButton').onclick();assert.equal(selected.at(-1),'brno-discovery');
  recordMissionCompletion('brno-discovery',storage);
  $('startButton').onclick();assert.equal(selected.at(-1),'brno');
});
