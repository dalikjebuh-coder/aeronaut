import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createGeographyGuide} from '../src/geography-guide.js';
import {EARTH,RAD} from '../src/flight.js';
const C=createRequire(import.meta.url)('cesium');
const seeds=JSON.parse(fs.readFileSync(new URL('../src/geography-places.json',import.meta.url),'utf8'));
function fixture({animations=false}={}){
  let time=1000,pauses=0;const previousWindow=globalThis.window;globalThis.window={Cesium:C};
  const element=()=>({animations:[],...(animations?{animate(frames){this.animations.push(frames);return{cancel(){},set onfinish(callback){queueMicrotask(callback);}};}}:{}),hidden:false,value:'',textContent:'',children:[],attributes:{},style:{},setAttribute(key,value){this.attributes[key]=value;},append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},focus(){},showModal(){this.open=true;}});
  const html=fs.readFileSync(new URL('../src/index.html',import.meta.url),'utf8');
  const controls=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,element()]));
  const document={getElementById:id=>controls.get(id),createElement:element};
  const storage={getItem:()=>null,setItem(){}};
  const viewer={dataSources:new C.DataSourceCollection()};
  const guide=createGeographyGuide(viewer,{document,storage,now:()=>time,onPause:()=>pauses++,fetcher:async url=>({ok:true,json:async()=>url.startsWith('/')?seeds:{query:{pages:[]}}})});
  return{guide,$:id=>controls.get(id),get pauses(){return pauses;},advance(milliseconds=1000){time+=milliseconds;},restore(){globalThis.window=previousWindow;}};
}
const state={lat:49.19527778,lon:16.60833333,altitude:700,elapsed:1,onGround:false};
test('mission flyovers save a landmark and update the collection even with the guide disabled',async()=>{
  const run=fixture();
  try{
    await run.guide.ready;run.guide.toggle();
    assert.equal(run.guide.collectPlace('cs:81686').isNew,true);
    assert.equal(run.$('guideJournalButton').textContent,'Sbírka · 1/29');
    assert.equal(run.guide.collectPlace('cs:81686').isNew,false);
    assert.equal(run.$('guideJournalButton').textContent,'Sbírka · 1/29');
    assert.equal(run.guide.collectPlace('missing'),null);
  }finally{run.restore();}
});
test('real Cesium guide markers, cards and atlas use existing DOM ids and correctly respect pause/photo/mission contexts',async()=>{
  const run=fixture();
  try{
    await run.guide.ready;run.guide.update(state,{active:true,ground:230});
    assert.equal(run.guide.source.show,true);assert.ok(run.guide.source.entities.values.length>0&&run.guide.source.entities.values.length<=9);
    assert.equal(run.$('guideCard').hidden,false);assert.equal(run.$('guideName').textContent,'Brno');
    assert.equal(run.$('guideLanguage').textContent,'Nad čím prolétáte');assert.ok(run.$('guideSource').href.startsWith('https://cs.wikipedia.org/wiki/'));
    run.advance();run.guide.update({...state,elapsed:2},{active:true,paused:true,ground:230});assert.equal(run.$('guideCard').hidden,true);
    run.guide.openJournal();assert.equal(run.pauses,1);assert.equal(run.$('geographyDialog').open,true);assert.ok(run.$('guideDiscoveries').children.length>0);
    run.advance();run.guide.update({...state,elapsed:3},{active:true,paused:true,visible:false,ground:230});assert.equal(run.guide.source.show,false);
    run.advance();run.guide.update({...state,elapsed:4},{active:true,auto:false,ground:230});assert.equal(run.$('guideCard').hidden,true);
    run.guide.toggle();assert.equal(run.guide.source.show,false);assert.equal(run.$('guideButton').attributes['aria-pressed'],'false');
  }finally{run.guide.update(state,{active:false});run.restore();}
});
test('dismissing a card and restarting the flight cannot leave stale or permanently hidden geography cards',async()=>{
  const run=fixture();
  try{
    await run.guide.ready;run.guide.update({...state,elapsed:100},{active:true,ground:230});
    run.$('guideClose').onclick();assert.equal(run.$('guideCard').hidden,true);
    run.advance(500);run.guide.update({...state,elapsed:100.5},{active:true,ground:230});assert.equal(run.$('guideCard').hidden,true);
    run.advance();run.guide.update({...state,elapsed:0},{active:true,ground:230});assert.equal(run.$('guideCard').hidden,false);
  }finally{run.guide.update(state,{active:false});run.restore();}
});

test('flying over a place slides in its photo and brief facts without user actions; collection exposes visited and missing cards',async()=>{
  const run=fixture({animations:true});
  try{
    await run.guide.ready;run.guide.openJournal();assert.equal(run.$('guideJournalCount').textContent,'0 z 29 míst posbíráno');
    assert.equal(run.$('guideDiscoveries').children.length,29);run.$('geographyDialog').open=false;
    run.guide.update({...state,speed:100},{active:true,ground:230});
    assert.equal(run.$('guideCard').hidden,false);assert.equal(run.$('guideCard').animations[0][0].transform,'translateX(110%)');
    assert.ok(run.$('guidePhoto').src.startsWith('/images/places/wiki-'));assert.ok(run.$('guideText').textContent.length<=180);
    assert.equal(run.$('guideLanguage').textContent,'Nad čím prolétáte');run.guide.openJournal();
    const collected=run.$('guideCollectedCount').textContent;assert.ok(collected>0);assert.equal(run.$('guideRemainingCount').textContent,29-collected);
    run.$('guideFilterVisited').onclick();assert.equal(run.$('guideDiscoveries').children.length,collected);
    run.$('guideFilterMissing').onclick();assert.equal(run.$('guideDiscoveries').children.length,29-collected);
    run.$('guideRegion').value='Brno a okolí';run.$('guideRegion').onchange();assert.equal(run.$('guideTotalCount').textContent,10);
    run.$('guideSearch').value='Macocha';run.$('guideSearch').oninput();assert.equal(run.$('guideDiscoveries').children.length,1);
    run.$('guidePhoto').onerror();assert.equal(run.$('guidePhoto').hidden,true);assert.equal(run.$('guidePhotoEmpty').hidden,false);
  }finally{run.guide.update(state,{active:false});run.restore();}
});

test('a flyover card hides beyond 500 m before the next polling interval and does not show old Brno cards later',async()=>{
  const run=fixture();
  try{
    await run.guide.ready;run.guide.update(state,{active:true,ground:230});
    assert.equal(run.$('guideName').textContent,'Brno');assert.equal(run.$('guideLanguage').textContent,'Nad čím prolétáte');
    run.advance(16);run.guide.update({...state,lat:state.lat+501/EARTH/RAD,elapsed:1.016},{active:true,ground:230});
    assert.equal(run.$('guideCard').hidden,true);
    for(const elapsed of [5,15,30]){
      run.advance(1000);run.guide.update({...state,lat:state.lat+.1,elapsed},{active:true,ground:230});
      assert.equal(run.$('guideCard').hidden,true);
    }
  }finally{run.guide.update(state,{active:false});run.restore();}
});
