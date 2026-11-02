import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {collectionProgress,createFlyoverCards,flyoverDistance,shortPlaceText} from '../src/geography-cards.js';
import {createGeographyExplorer,GUIDE_STORAGE,VISITED_STORAGE,wikiPoints} from '../src/geography.js';
import {EARTH,RAD} from '../src/flight.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../src/geography-places.json',import.meta.url),'utf8'));
const storage=()=>{const data=new Map();return{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};};
const state={lat:49.19527778,lon:16.60833333,altitude:700,elapsed:1,speed:100,onGround:false};

test('all catalogue entries have brief authored facts, a region, a real local photo and its attribution',()=>{
  for(const point of catalog){
    assert.ok(point.collection);assert.ok(point.facts.length>=1&&point.facts.length<=2);assert.ok(shortPlaceText(point).length<=180);
    const bytes=fs.readFileSync(new URL('../src'+point.photo.src,import.meta.url));
    assert.ok(bytes.length>1000);assert.ok(bytes[0]===0xff||bytes[0]===0x89);
    assert.ok(point.photo.credit);assert.ok(point.photo.license);assert.ok(point.photo.url.startsWith('https://commons.wikimedia.org/wiki/'));
  }
});
test('collection denominator stays fixed and counts missing places per region, excluding bonus discoveries',()=>{
  const ids=new Set([catalog[0].id,'en:999999']);const progress=collectionProgress(catalog,ids);
  assert.equal(progress.total,29);assert.equal(progress.collected,1);assert.equal(progress.remaining,28);
  const brno=collectionProgress(catalog,ids,'Brno a okolí');assert.equal(brno.total,10);assert.equal(brno.collected,1);assert.equal(brno.remaining,9);
  assert.equal(collectionProgress(catalog,new Set(catalog.map(point=>point.id))).percent,100);
});
test('flyover crosses a place between samples, but cannot collect a teleport or paused movement',()=>{
  const point={lat:0,lon:0},a={lat:0,lon:-800/EARTH/RAD,speed:250,elapsed:0},b={lat:0,lon:800/EARTH/RAD,speed:250,elapsed:6.4};
  assert.ok(flyoverDistance(point,a,b)<1e-6);
  assert.ok(flyoverDistance(point,a,{...b,elapsed:0})>650);
  assert.ok(flyoverDistance(point,a,{...b,elapsed:.1})>650);
  assert.ok(flyoverDistance(point,null,b)>650);
});
test('flyover events are automatic, include old discoveries on a later pass, and never duplicate collection counts',()=>{
  const store=storage(),explorer=createGeographyExplorer({seeds:catalog,storage:store});
  const first=explorer.update(state,{network:false,ground:230});assert.ok(first.length);assert.ok(first.every(point=>point.isNew));
  assert.equal(explorer.update({...state,elapsed:2},{network:false,ground:230}).length,0);
  explorer.update({...state,lat:49.25,elapsed:100},{network:false,ground:230});
  const repeat=explorer.update({...state,elapsed:200},{network:false,ground:230});assert.ok(repeat.length);assert.ok(repeat.some(point=>!point.isNew));
  const visited=explorer.visitedIds.size;const restored=createGeographyExplorer({seeds:catalog,storage:store});assert.equal(restored.visitedIds.size,visited);
});
test('catalogue completion survives trimming of the last 300 bonus descriptions and migrates existing progress',()=>{
  const store=storage();store.setItem(GUIDE_STORAGE,JSON.stringify([{...catalog[0],foundAt:'2026-10-24'}]));
  const explorer=createGeographyExplorer({seeds:catalog,storage:store});assert.equal(collectionProgress(catalog,explorer.visitedIds).collected,1);
  explorer.update(state,{network:false,ground:230});assert.ok(JSON.parse(store.getItem(VISITED_STORAGE)).includes(catalog[0].id));
  store.setItem(GUIDE_STORAGE,'[]');const restored=createGeographyExplorer({seeds:catalog,storage:store});assert.ok(restored.visitedIds.has(catalog[0].id));
});
test('cards pick the closest current flyover within 500 m and never replay a backlog',()=>{
  const position={lat:0,lon:0},point=(id,meters)=>({id,lat:meters/EARTH/RAD,lon:0});
  const cards=createFlyoverCards({duration:12}),first=point('closest',100),second=point('other',200),far=point('far',501);
  assert.equal(cards.update([far,second,first],0,position).id,'closest');
  assert.equal(cards.update([],8,position).id,'closest');assert.equal(cards.remaining(8),1-8/12);
  assert.equal(cards.update([],12,position),null);
  assert.equal(cards.update([],13,position),null); // The second encounter was discarded, not queued.
  assert.equal(cards.update([far],14,position),null);
  assert.equal(cards.update([second],15,position).id,'other');
  cards.dismiss(16);assert.equal(cards.update([],18,position),null);
  cards.reset();assert.equal(cards.update([first],0,position).id,'closest');
});
test('an active card is removed immediately on leaving 500 m, even while its timer is still running',()=>{
  const cards=createFlyoverCards(),point={id:'place',lat:0,lon:0};
  assert.equal(cards.update([point],0,{lat:499/EARTH/RAD,lon:0}).id,'place');
  assert.equal(cards.update([],0.02,{lat:501/EARTH/RAD,lon:0}),null);
  assert.equal(cards.update([],1,{lat:100/EARTH/RAD,lon:0}),null); // Returning does not resurrect a stale event.
});
test('online photo data is read only from Wikimedia and long descriptions are shortened',()=>{
  const data={query:{pages:[{pageid:123,title:'A place',extract:'A scenic landscape. '+('Long explanation. '.repeat(50)),coordinates:[{lat:1,lon:1}],pageimage:'Landscape.jpg',thumbnail:{source:'https://upload.wikimedia.org/wikipedia/commons/x.jpg'}}]}};
  const point=wikiPoints(data,'en')[0];assert.ok(point.photo.src.startsWith('https://upload.wikimedia.org/'));assert.equal(shortPlaceText(point),'A scenic landscape.');
  data.query.pages[0].thumbnail.source='https://thumb.wikimedia.org/wikipedia/commons/x.jpg';assert.ok(wikiPoints(data,'en')[0].photo);
  data.query.pages[0].thumbnail.source='https://malicious.example/image.jpg';assert.equal(wikiPoints(data,'en')[0].photo,undefined);
});
