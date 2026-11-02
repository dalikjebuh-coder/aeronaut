import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MISSIONS,getMission,BRNO_LESSONS} from '../src/missions.js';
import {initGameMenu,syncGameMenu} from '../src/game-menu.js';
import {objectiveType} from '../src/task-missions.js';
import {BRNO_MISSION_IDS,recordMissionCompletion} from '../src/mission-progression.js';

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
      assert.ok(elements.get('missionPhoto').src.startsWith('/images/'));
      assert.ok(fs.existsSync(new URL('../src'+elements.get('missionPhoto').src,import.meta.url)));
      assert.match(elements.get('missionPhoto').alt,new RegExp(mission.title));
      if(!mission.fixedRoute||mission.expedition)assert.ok(elements.get('missionPhotoSource').href.startsWith('https://commons.wikimedia.org/'));
      else assert.match(elements.get('missionPhotoSource').textContent,/AI/);
      assert.equal(elements.get('sidebar').dataset.gameMode,'missions');
      assert.equal(elements.get('horizonMissionPlace').textContent,mission.location.name);
      assert.ok(elements.get('horizonMissionDescription').textContent.length>20);
      assert.ok(elements.get('horizonMissionDescription').textContent.length<140);
      assert.equal(elements.get('horizonMissionLength').textContent,elements.get('raceRouteLength').textContent);
      assert.ok(elements.get('horizonMissionConditions').textContent.includes(' · '));
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

test('Brno unlocks in order while all other missions remain visibly locked',()=>{
  const html=fs.readFileSync(new URL('../src/index.html',import.meta.url),'utf8');
  const element=()=>({value:'',hidden:false,dataset:{},attributes:{},listeners:{},style:{setProperty(){}},status:{textContent:''},
    setAttribute(name,value){this.attributes[name]=value;},append(){},replaceChildren(){},querySelector(){return this.status;},
    addEventListener(name,callback){this.listeners[name]=callback;},focus(){this.focused=true;}});
  const elements=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,element()]));
  const order=[...BRNO_MISSION_IDS,...MISSIONS.map(m=>m.id).filter(id=>!BRNO_MISSION_IDS.includes(id))];
  const rows=order.map(id=>{const button=element(),article={hidden:false,dataset:{}};button.dataset.mission=id;button.closest=()=>article;return button;});
  const medals=['bronze','silver','gold'].map(medal=>({dataset:{medal}}));
  const row=id=>rows.find(button=>button.dataset.mission===id);
  elements.get('aircraftModel').value='highWing';elements.get('gameMode').value='missions';
  elements.get('timeOfDay').value='day';elements.get('weather').value='clear';
  const saved=new Map(),storage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value),key:index=>[...saved.keys()][index]??null,get length(){return saved.size;}};
  const previousDocument=globalThis.document,previousStorage=globalThis.localStorage;
  globalThis.document={getElementById:id=>elements.get(id),createElement:element,createTextNode:text=>({text}),
    querySelectorAll:selector=>selector==='[data-mission]'?rows:selector==='.mission-medal'?medals:[],querySelector:()=>({style:{}})};
  globalThis.localStorage=storage;
  try{
    let selected=getMission('brno-landing');
    const sync=()=>syncGameMenu({mission:selected,step:3,place:selected.location});
    initGameMenu(()=>{},()=>{},id=>{selected=getMission(id);sync();},()=>{});sync();
    const cards=elements.get('missionCards').innerHTML;
    assert.match(cards,/<section class="mission-city-group" aria-label="Brno">/);
    assert.match(cards,/<section class="mission-city-group" aria-label="Praha">/);
    assert.ok(cards.indexOf('data-mission="brno-landing"')<cards.indexOf('data-mission="brno-discovery"'));
    assert.ok(cards.indexOf('data-mission="brno"')<cards.indexOf('data-mission="prague"'));
    const shown=[...cards.matchAll(/data-mission="([^"]+)"/g)].map(match=>match[1]);
    assert.equal(new Set(shown).size,MISSIONS.length,'every mission appears once');
    assert.deepEqual(shown.slice(0,11),BRNO_LESSONS.flatMap(chapter=>chapter.ids));
    assert.equal(shown[0],'first-takeoff','start with learning to take off');
    assert.ok(shown.indexOf('airport-circuit')<shown.indexOf('repeat-circuit'));
    assert.ok(shown.indexOf('crosswind')<shown.indexOf('emergency-landing'));
    assert.equal(rows.length,MISSIONS.length);
    assert.ok(rows.every(button=>!button.closest().hidden));
    assert.ok(rows.every(button=>!button.disabled));
    assert.equal(row('prague').closest().dataset.state,'world-locked');
    assert.match(row('brno-discovery').status.textContent,/Hladké přistání/);
    assert.equal(elements.get('missionCount').textContent,`0 / ${MISSIONS.length} splněno`);
    assert.match(elements.get('missionListGuidance').textContent,/První vzlet/);
    assert.equal(elements.get('startButton').status.textContent,'Spustit misi');
    assert.deepEqual(medals.map(medal=>medal.dataset.earned),['false','false','false']);
    const landingPhoto=elements.get('missionPhoto').src;
    row('prague').listeners.click();assert.equal(selected.id,'prague');
    assert.notEqual(elements.get('missionPhoto').src,landingPhoto);
    assert.equal(elements.get('startButton').status.textContent,'Pokračovat v Brně');
    assert.match(elements.get('missionNextGuidance').textContent,/Svět odemkneš/);
    assert.equal(elements.get('missionDetails').dataset.state,'locked');
    row('brno-landing').listeners.click();

    recordMissionCompletion('brno-landing',storage);sync();
    assert.equal(elements.get('startButton').status.textContent,'Zlepšit medaili');
    assert.equal(elements.get('missionBestMedal').textContent,'Získáno: Bronz');
    assert.equal(elements.get('missionRewardXp').textContent,'Až +50 XP');
    assert.equal(elements.get('missionXpProgress').value,50);
    assert.equal(elements.get('missionXpProgress').max,100);
    assert.deepEqual(medals.map(medal=>medal.dataset.earned),['true','false','false']);
    assert.ok(rows.every(button=>!button.disabled));
    let prevented=false;
    row('brno-landing').listeners.keydown({key:'ArrowDown',preventDefault(){prevented=true;}});
    assert.ok(prevented);assert.equal(selected.id,'brno-discovery');assert.ok(row('brno-discovery').focused);
    recordMissionCompletion('brno-discovery',storage);sync();
    assert.ok(rows.every(button=>!button.disabled));
    assert.equal(elements.get('missionCount').textContent,`2 / ${MISSIONS.length} splněno`);
    elements.get('gameMode').value='free';sync();
    assert.equal(elements.get('sidebar').dataset.gameMode,'free');
    assert.ok(elements.get('missionBrowser').hidden);assert.equal(elements.get('freeAtmosphere').hidden,false);
  }finally{globalThis.document=previousDocument;globalThis.localStorage=previousStorage;}
});
