import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createCrashEffect} from '../src/crash-effect.js';

function setup(calm=false){
  let time=0,update,removed=false;
  class Cartesian3{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}static fromDegrees(x,y,z){return new Cartesian3(x,y,z);}}
  class BillboardCollection{items=[];add(value){this.items.push(value);return value;}removeAll(){this.items=[];}}
  class Color{constructor(red,green,blue,alpha){Object.assign(this,{red,green,blue,alpha});}}
  const previousWindow=globalThis.window,previousDocument=globalThis.document;
  globalThis.window={Cesium:{Cartesian3,BillboardCollection,Color,Transforms:{eastNorthUpToFixedFrame:position=>position},Matrix4:{multiplyByPoint:(frame,point)=>new Cartesian3(frame.x+point.x,frame.y+point.y,frame.z+point.z)}}};
  globalThis.document={createElement:()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){}})})};
  let collection;
  const viewer={scene:{primitives:{add:value=>(collection=value),remove:()=>{removed=true;}},preUpdate:{addEventListener:fn=>{update=fn;return()=>{update=null;};}}}};
  const effect=createCrashEffect(viewer,{clock:()=>time,reducedMotion:()=>calm});
  return{effect,get particles(){return collection.items;},get removed(){return removed;},advance(seconds){time=seconds*1000;update?.();},restore(){effect.destroy();globalThis.window=previousWindow;globalThis.document=previousDocument;}};
}

test('impact animates in wall time, reveals the menu once and expires completely',()=>{
  const run=setup();let ready=0;
  try{
    run.effect.play({lat:49,lon:16,altitude:100,onReady:()=>ready++});
    assert.equal(run.effect.active,true);assert.equal(run.particles.length,54);
    run.advance(.5);
    assert.ok(run.particles.filter(p=>p.show).length>30);
    assert.ok(run.particles.some(p=>p.position.z>105));
    assert.equal(ready,0);
    run.advance(1.1);assert.equal(ready,0);
    run.advance(1.51);assert.equal(ready,1);
    run.advance(2);assert.equal(ready,1);
    run.advance(5.1);assert.equal(run.effect.active,false);assert.equal(run.particles.length,0);
  }finally{run.restore();}
});

test('restart or exit cancels smoke and any delayed menu; successive crashes stay bounded',()=>{
  const run=setup();let ready=0;
  try{
    const impact={lat:49,lon:16,altitude:100,onReady:()=>ready++};
    run.effect.play(impact);run.advance(.3);run.effect.clear();run.advance(2);
    assert.equal(ready,0);assert.equal(run.particles.length,0);
    run.effect.play(impact);run.effect.play(impact);assert.equal(run.particles.length,54);
    run.effect.destroy();run.advance(5);assert.equal(ready,0);assert.equal(run.removed,true);
  }finally{run.restore();}
});

test('reduced motion uses a smaller dimmer burst without flying debris',()=>{
  const run=setup(true);
  try{
    run.effect.play({lat:49,lon:16,altitude:100});run.advance(.3);
    assert.equal(run.particles.length,13);
    assert.ok(run.particles.filter(p=>p.show).every(p=>p.color.alpha<=.65));
  }finally{run.restore();}
});

test('a game crash freezes the aircraft once and reveals its reason after the burst',()=>{
  const elements=new Map(),menus=[];let ready,bursts=0,resets=0;
  const $=id=>{if(!elements.has(id))elements.set(id,{hidden:false,classList:{add(){}}});return elements.get(id);};
  const context=vm.createContext({$,isRace:()=>false,updatePauseLocation(){},setFlightMenuVisible:value=>menus.push(value),
    engineAudio:{pause(){}},aircraft:{show:true,chaseDistance:65,resetEffects:()=>resets++},
    missionRadio:{stop(){}},
    crashEffect:{play:options=>{bursts++;ready=options.onReady;}}
  });
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  vm.runInContext(`let running=true,paused=false,crashed=false,surfaceHeight=100;const keys=new Set(),touch=new Set(),state={lat:49,lon:16,altitude:103};`+
    app.slice(app.indexOf('function crash(reason){'),app.indexOf('function surfaceExclusions(){')),context);
  vm.runInContext("crash('Tvrdé dosednutí');crash('Podruhé');",context);
  assert.equal(bursts,1);assert.equal(resets,1);
  assert.equal(context.aircraft.show,false);assert.equal(vm.runInContext('paused&&crashed',context),true);
  assert.equal($('pauseText').textContent,'Tvrdé dosednutí');assert.deepEqual(menus,[false]);
  ready();assert.deepEqual(menus,[false,true]);
  vm.runInContext('crashed=false',context);ready();assert.deepEqual(menus,[false,true]);
});
