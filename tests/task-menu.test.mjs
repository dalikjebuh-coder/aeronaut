import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MISSIONS,getMission,TIME_NAMES,WEATHER_NAMES} from '../src/missions.js';
import {DISPLAY_MISSIONS,initGameMenu,syncGameMenu} from '../src/game-menu.js';
import {objectiveType} from '../src/task-missions.js';
import {recordMissionCompletion} from '../src/mission-progression.js';

test('all mission variants render their own objective, scoring and instructions with existing UI elements',()=>{
  const html=fs.readFileSync(new URL('../src/index.html',import.meta.url),'utf8');
  const elements=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,{value:'',hidden:false,dataset:{},style:{setProperty(){}},setAttribute(){},replaceChildren(){},querySelector(){return {textContent:''};}}]));
  elements.get('aircraftModel').value='highWing';elements.get('gameMode').value='missions';elements.get('timeOfDay').value='day';elements.get('weather').value='clear';
  const previousDocument=globalThis.document,previousStorage=globalThis.localStorage;
  globalThis.document={getElementById:id=>elements.get(id),querySelectorAll:()=>[],querySelector:()=>({style:{}}),createTextNode:text=>({text}),createElement:()=>({})};
  globalThis.localStorage={getItem:()=>null};
  try{
    for(const base of MISSIONS)for(const level of ['easy','normal','hard']){
      const mission=getMission(base.id,level),type=objectiveType(mission.route);
      syncGameMenu({mission,step:3,place:mission.location});
      assert.equal(elements.get('racePreviewTitle').textContent,mission.title);
      assert.ok(mission.difficultyStars>=1&&mission.difficultyStars<=3);
      assert.equal(elements.get('missionDifficultyStars').textContent,'★'.repeat(mission.difficultyStars)+'☆'.repeat(3-mission.difficultyStars));
      assert.ok(elements.get('missionPhoto').src.startsWith('/images/'));
      assert.ok(fs.existsSync(new URL('../src'+elements.get('missionPhoto').src,import.meta.url)));
      assert.match(elements.get('missionPhoto').alt,new RegExp(mission.title));
      if(!mission.fixedRoute||mission.expedition)assert.ok(elements.get('missionPhotoSource').href.startsWith('https://commons.wikimedia.org/'));
      else assert.match(elements.get('missionPhotoSource').textContent,/AI/);
      assert.equal(elements.get('sidebar').dataset.gameMode,'missions');
      assert.equal(elements.get('briefingAircraft').value,'highWing');
      assert.equal(elements.get('briefingAircraftImage').src,'/images/aircraft-highWing-thumb-v1.jpg');
      assert.ok(elements.get('horizonMissionDescription').textContent.length>20);
      assert.ok(elements.get('horizonMissionDescription').textContent.length<140);
      assert.equal(elements.get('horizonMissionLength').textContent,elements.get('raceRouteLength').textContent);
      assert.ok(TIME_NAMES[mission.time]&&WEATHER_NAMES[mission.weather]);
      assert.ok(elements.get('horizonMissionConditions').textContent.startsWith(`${TIME_NAMES[mission.time]} · ${WEATHER_NAMES[mission.weather]}`));
      assert.ok(elements.get('missionObjectiveBrief').textContent.length>60);
      assert.ok(elements.get('missionTaskSummary').textContent.length>35);
      assert.equal(elements.get('missionBronzeTarget').textContent,'Dokonči misi');
      assert.ok(elements.get('missionGoldTarget').textContent.length>5);
      assert.ok(elements.get('raceRouteMap').innerHTML.includes('<svg'));
      if(type==='sightseeing'){assert.equal(elements.get('racePreviewBest').textContent,'—');assert.match(elements.get('missionMedalHint').textContent,/Bez časového limitu/);assert.match(elements.get('missionDifficultyStats').textContent,/průlet kuželem/);}
      if(type==='landing')assert.match(elements.get('missionDifficultyStats').textContent,/Zóna/);
      if(type==='lowflight')assert.match(elements.get('missionDifficultyStats').textContent,/Výška/);
    }
  }finally{globalThis.document=previousDocument;globalThis.localStorage=previousStorage;}
});

test('career menu presents five chapters and one sequential next flight',()=>{
  const html=fs.readFileSync(new URL('../src/index.html',import.meta.url),'utf8');
  const element=()=>({value:'',hidden:false,dataset:{},attributes:{},listeners:{},style:{setProperty(){}},status:{textContent:''},
    setAttribute(name,value){this.attributes[name]=value;},append(){},replaceChildren(){},querySelector(){return this.status;},
    addEventListener(name,callback){this.listeners[name]=callback;},focus(){this.focused=true;}});
  const elements=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,element()]));
  const rows=DISPLAY_MISSIONS.map(mission=>{const button=element(),article={hidden:false,dataset:{}};button.dataset.mission=mission.id;button.closest=()=>article;return button;});
  const row=id=>rows.find(button=>button.dataset.mission===id);
  const medals=['bronze','silver','gold'].map(medal=>({dataset:{medal}}));
  elements.get('aircraftModel').value='highWing';elements.get('gameMode').value='missions';elements.get('timeOfDay').value='day';elements.get('weather').value='clear';
  const saved=new Map(),storage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value),key:index=>[...saved.keys()][index]??null,get length(){return saved.size;}};
  const previousDocument=globalThis.document,previousStorage=globalThis.localStorage;
  globalThis.document={getElementById:id=>elements.get(id),createElement:element,createTextNode:text=>({text}),
    querySelectorAll:selector=>selector==='[data-mission]'?rows:selector==='.mission-medal'?medals:[],querySelector:()=>({style:{}})};
  globalThis.localStorage=storage;
  try{
    initGameMenu(()=>{},()=>{},()=>{});
    const cards=elements.get('missionCards').innerHTML;
    assert.equal((cards.match(/class="career-chapter-banner"/g)||[]).length,5);
    const shown=[...cards.matchAll(/data-mission="([^"]+)"/g)].map(match=>match[1]);
    assert.deepEqual(shown,DISPLAY_MISSIONS.map(mission=>mission.id));
    syncGameMenu({mission:getMission('first-takeoff'),step:3,place:getMission('first-takeoff').location});
    assert.equal(row('first-takeoff').closest().dataset.state,'unlocked');
    assert.equal(row('brno-landing').closest().dataset.state,'world-locked');
    assert.match(elements.get('missionListGuidance').textContent,/První vzlet/);
    assert.equal(elements.get('careerStageTitle').textContent,'První vzlet');
    assert.equal(elements.get('careerHeroTitle').textContent,'První křídla');
    recordMissionCompletion('first-takeoff',storage);
    syncGameMenu({mission:getMission('brno-landing'),step:3,place:getMission('brno-landing').location});
    assert.equal(row('brno-landing').closest().dataset.state,'unlocked');
    assert.equal(row('first-takeoff').closest().dataset.state,'completed');
    assert.match(elements.get('careerStageText').textContent,/dráhu|dosednutí/i);
    assert.match(elements.get('missionMasteryChallenge').textContent,/mistrovství/);
    assert.equal(elements.get('missionCount').textContent,`1 / ${MISSIONS.length} splněno`);
    elements.get('gameMode').value='free';syncGameMenu({mission:getMission('brno-landing')});
    assert.equal(elements.get('sidebar').dataset.gameMode,'free');
    assert.equal(elements.get('missionBrowser').hidden,true);
  }finally{globalThis.document=previousDocument;globalThis.localStorage=previousStorage;}
});
