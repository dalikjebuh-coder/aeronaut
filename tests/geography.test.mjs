import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {wikiPoints,wikiNearbyUrl,nearbyPlaces,createGeographyExplorer,GUIDE_STORAGE} from '../src/geography.js';
const seeds=JSON.parse(fs.readFileSync(new URL('../src/geography-places.json',import.meta.url),'utf8'));
const state={lat:49.19527778,lon:16.60833333,altitude:700,elapsed:0,onGround:false};
const memory=()=>{const data=new Map();return{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};};
const page=(id=1)=>({pageid:id,title:'Brno',coordinates:[{lat:state.lat,lon:state.lon,globe:'earth'}],extract:'Město na Moravě.'});
const settle=async()=>{await new Promise(resolve=>setImmediate(resolve));};

test('built-in Czech descriptions cover 29 locations and have valid source and licence links',()=>{
  assert.equal(seeds.length,29);assert.equal(new Set(seeds.map(point=>point.id)).size,29);
  for(const name of ['Brno','Špilberk','Vila Tugendhat','Karlův most','Fudži'])assert.ok(seeds.some(point=>point.name===name),name);
  for(const point of seeds){assert.ok(point.text.length>30&&point.text.length<=420);assert.ok(point.url.startsWith('https://cs.wikipedia.org/wiki/'));assert.ok(point.license.endsWith('/by-sa/4.0/'));}
});
test('reserved mission places wait for the cone event, save once and survive reopening the collection',()=>{
  const storage=memory(),explorer=createGeographyExplorer({seeds,storage});
  const point=seeds.find(point=>point.id==='cs:81686'),excludeIds=new Set([point.id]);
  const found=explorer.update({...state,lat:point.lat,lon:point.lon},{ground:230,network:false,excludeIds});
  assert.ok(!found.some(entry=>entry.id===point.id));assert.equal(explorer.visitedIds.has(point.id),false);
  const first=explorer.collectPlace(point.id);assert.equal(first.isNew,true);assert.equal(first.saved,true);
  const count=explorer.visitedIds.size;
  assert.equal(explorer.collectPlace(point.id).isNew,false);assert.equal(explorer.visitedIds.size,count);
  assert.equal(createGeographyExplorer({seeds,storage}).visitedIds.has(point.id),true);
  const restricted=createGeographyExplorer({seeds,storage:{getItem:()=>null,setItem(){throw Error('Storage denied');}}});
  assert.equal(restricted.collectPlace(point.id).saved,false);
});
test('nearby search is bounded, crosses the date line and ignores invalid coordinates and duplicate articles',()=>{
  const points=[{id:'a',name:'East',lat:0,lon:179.99},{id:'b',name:'East',lat:0,lon:179.99},{id:'c',name:'West',lat:0,lon:-179.98},{id:'d',name:'Far',lat:0,lon:175},{id:'e',lat:90,lon:0}];
  const found=nearbyPlaces(points,{lat:0,lon:179.995});assert.deepEqual(found.map(point=>point.id),['a','c']);assert.ok(found.every(point=>point.distance<3000));
});
test('Wikipedia query batches nearby articles, explicitly permits CORS, and excludes unusable data',()=>{
  const url=new URL(wikiNearbyUrl(state.lat,state.lon));assert.equal(url.hostname,'cs.wikipedia.org');assert.equal(url.searchParams.get('origin'),'*');assert.equal(url.searchParams.get('ggslimit'),'20');
  assert.throws(()=>wikiNearbyUrl(100,0));assert.throws(()=>wikiNearbyUrl(0,0,'javascript'));
  const points=wikiPoints({query:{pages:[page(),{...page(2),pageprops:{disambiguation:''}},{...page(3),coordinates:[]},{...page(4),extract:''}]}});
  assert.equal(points.length,1);assert.equal(points[0].id,'cs:1');assert.equal(wikiPoints({error:{}}).length,0);
});
test('discoveries require actual flight near the place and loaded terrain, persist, and never advance during pause',()=>{
  const storage=memory(),explorer=createGeographyExplorer({seeds,storage});
  assert.equal(explorer.update(state,{network:false,discover:false,ground:230}).length,0);
  assert.equal(explorer.update({...state,onGround:true},{network:false,ground:230}).length,0);
  assert.equal(explorer.update({...state,altitude:8000},{network:false,ground:230}).length,0);
  assert.equal(explorer.update(state,{network:false}).length,0);
  const found=explorer.update(state,{network:false,ground:230});assert.ok(found.some(point=>point.name==='Brno'));
  assert.equal(explorer.update(state,{network:false,ground:230}).length,0);
  const restored=createGeographyExplorer({seeds,storage});assert.equal(restored.discoveries.length,found.length);
  storage.setItem(GUIDE_STORAGE,JSON.stringify([{id:'bad',name:'Injected',text:'x',lat:0,lon:0,url:'javascript:alert(1)'}]));
  assert.equal(createGeographyExplorer({storage}).discoveries.length,0);
});
test('network requests are serial, throttled and cancel-safe; English fallback is explicitly labelled',async()=>{
  const calls=[];let time=1000,resolveRequest;
  const fetcher=(url,{signal})=>{calls.push({url,signal});return new Promise(resolve=>{resolveRequest=resolve;});};
  const explorer=createGeographyExplorer({seeds,storage:memory(),fetcher,now:()=>time});
  explorer.update(state,{discover:false});explorer.update(state,{discover:false});assert.equal(calls.length,1);
  resolveRequest({ok:true,json:async()=>({query:{pages:Array.from({length:8},(_,index)=>page(index+10))}})});await settle();
  assert.equal(explorer.pending,false);explorer.update({...state,lat:49.3},{discover:false});assert.equal(calls.length,1);
  time+=31000;explorer.update({...state,lat:49.3},{discover:false});assert.equal(calls.length,2);
  explorer.setEnabled(false);assert.equal(calls[1].signal.aborted,true);
  resolveRequest({ok:true,json:async()=>({query:{pages:[{...page(300),title:'Should not appear'}]}})});await settle();
  assert.ok(!explorer.nearby.some(point=>point.name==='Should not appear'));
  const languages=[];
  const fallback=createGeographyExplorer({storage:memory(),fetcher:async url=>{languages.push(new URL(url).hostname);return{ok:true,json:async()=>({query:{pages:url.includes('cs.wikipedia')?[]:[page()]}})};}});
  fallback.update(state,{discover:false});await settle();assert.deepEqual(languages,['cs.wikipedia.org','en.wikipedia.org']);assert.equal(fallback.nearby[0].language,'en');
});
test('API failure preserves local guide and backs off; returning to a cached area does not refetch',async()=>{
  let calls=0,time=1000;const storage=memory();
  const failing=createGeographyExplorer({seeds,storage,now:()=>time,fetcher:async()=>{calls++;throw new Error('Offline');}});
  failing.update(state,{discover:false});await settle();assert.ok(failing.nearby.length);assert.equal(failing.status,'local');
  time+=31000;failing.update({...state,lat:49.3},{discover:false});assert.equal(calls,1);
  let goodCalls=0;
  const cached=createGeographyExplorer({seeds,storage,now:()=>time,fetcher:async()=>{goodCalls++;return{ok:true,json:async()=>({query:{pages:Array.from({length:8},(_,index)=>page(index+1))}})};}});
  cached.update(state,{discover:false});await settle();cached.cancel();time+=31000;cached.update(state,{discover:false});await settle();assert.equal(goodCalls,1);
});
