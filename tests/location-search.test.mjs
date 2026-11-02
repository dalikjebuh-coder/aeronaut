import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createLocationSearch,locationSearchResults} from '../src/location-search.js';
import {selectedPlace} from '../src/locations.js';
const C=createRequire(import.meta.url)('../node_modules/cesium/Build/CesiumUnminified/index.cjs');
class Element{
  constructor(){this.value='';this.children=[];this.listeners={};this.hidden=false;this.disabled=false;this.attributes={};}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(type,fn){this.listeners[type]=fn;}
  append(...elements){this.children.push(...elements);}
  replaceChildren(){this.children=[];}
  event(type){return this.listeners[type]({preventDefault(){}});}
}
const answer=name=>({displayName:name,destination:C.Cartesian3.fromDegrees(17.25,49.59)});
function setup(request){
  const ids=Object.fromEntries(['locationSearch','locationQuery','locationSearchButton','locationSearchResults','locationSearchStatus'].map(id=>[id,new Element()]));
  const state={allowed:true,token:'present',picks:[],needsToken:0,preview:[]};
  const controller=createLocationSearch({C,document:{getElementById:id=>ids[id],createElement:()=>new Element()},canSearch:()=>state.allowed,getToken:()=>state.token,request,onPick:place=>state.picks.push(place),onNeedToken:()=>state.needsToken++,onResults:results=>state.preview=results,onClear:()=>state.preview=[]});
  ids.locationQuery.value='Olomouc';
  return{ids,state,controller,submit:()=>ids.locationSearch.event('submit')};
}

test('search normalizes point/rectangle results and filters unsupported or broken coordinates',()=>{
  const results=locationSearchResults(C,[answer('Olomouc'),{displayName:'Oblast',destination:C.Rectangle.fromDegrees(16,48,18,50)},{destination:C.Cartesian3.ZERO},null,{destination:C.Cartesian3.fromDegrees(10,85)}]);
  assert.equal(results.length,2);assert.ok(Math.abs(results[1].lat-49)<1e-10);assert.equal(results[0].name,'Olomouc');
  assert.equal(selectedPlace('custom',results[0]).name,'Olomouc');
});

test('typing sends no request; submit renders safe text and selection preserves the location name',async()=>{
  let calls=0;const ui=setup(async query=>{calls++;assert.equal(query,'Olomouc');return[answer('<Olomouc>')];});
  ui.ids.locationQuery.event('input');assert.equal(calls,0);
  await ui.submit();assert.equal(calls,1);assert.equal(ui.ids.locationSearchResults.hidden,false);
  const item=ui.ids.locationSearchResults.children[0];assert.equal(item.children[0].textContent,'<Olomouc>');assert.equal(ui.state.preview.length,1);
  item.event('click');assert.equal(ui.state.picks[0].name,'<Olomouc>');assert.ok(Math.abs(ui.state.picks[0].lat-49.59)<1e-8);assert.equal(ui.state.preview.length,0);
  assert.equal(ui.ids.locationSearchResults.hidden,true);
});

test('late answers cannot replace newer results or change selection after leaving the menu',async()=>{
  const pending=[];const ui=setup(()=>new Promise(resolve=>pending.push(resolve)));
  const first=ui.submit();ui.ids.locationQuery.value='Praha';ui.ids.locationQuery.event('input');const second=ui.submit();
  pending[1]([answer('Praha')]);await second;pending[0]([answer('Olomouc')]);await first;
  assert.equal(ui.ids.locationSearchResults.children[0].children[0].textContent,'Praha');
  const oldButton=ui.ids.locationSearchResults.children[0];ui.state.allowed=false;ui.controller.refresh();oldButton.event('click');assert.equal(ui.state.picks.length,0);
});

test('empty results, missing token, permission errors and timeout leave search usable',async()=>{
  const ui=setup(async()=>[]);await ui.submit();assert.match(ui.ids.locationSearchStatus.textContent,/nepodařilo najít/);assert.equal(ui.ids.locationSearchButton.disabled,false);
  ui.state.token='';await ui.submit();assert.equal(ui.state.needsToken,1);
  for(const [error,message] of [[{statusCode:403},/geocode/],[{code:'TIMEOUT'},/dlouho/]]){
    const failed=setup(async()=>{throw error;});await failed.submit();assert.match(failed.ids.locationSearchStatus.textContent,message);assert.equal(failed.ids.locationSearchButton.disabled,false);
  }
});
