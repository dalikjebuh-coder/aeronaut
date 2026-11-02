import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
function setup(){
  const listeners=new Map(),captures=new Set(),canvas={},classes=new Set();let updates=0;
  const container={addEventListener:(name,callback)=>listeners.set(name,callback),setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id),getBoundingClientRect:()=>({width:1000,height:500})};
  const context=vm.createContext({$:()=>container,viewer:{canvas},document:{body:{classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)}}},updateCamera:()=>updates++,syncPhotoControls:()=>{},aircraft:{chaseDistance:48}});
  vm.runInContext('let running=true,paused=true,crashed=false,busy=false,inspectHeading=0,inspectElevation=.3,inspectDistance=110;const photo={active:false,drag:null};'+source.slice(source.indexOf('function stopInspectDrag(){'),source.indexOf('function pauseFlight('))+source.slice(source.indexOf("    $('cesiumContainer').addEventListener('pointerdown'"),source.indexOf('    locationSearch=createLocationSearch')),context);
  return {context,captures,classes,get updates(){return updates;},read:expression=>vm.runInContext(expression,context),send:(name,extra={})=>listeners.get(name)({pointerId:1,button:0,target:canvas,clientX:100,clientY:100,preventDefault(){},...extra})};
}
test('paused camera ignores hovering and orbits only while dragging the canvas',()=>{
  const run=setup();run.send('pointermove');assert.equal(run.updates,0);
  run.send('pointerdown');assert.equal(run.captures.has(1),true);assert.equal(run.updates,0);
  run.send('pointermove',{clientX:200,clientY:120});assert.equal(run.updates,1);assert.ok(run.read('inspectHeading')<0);
  run.send('pointerup');assert.equal(run.captures.size,0);assert.equal(run.classes.size,0);
  run.send('pointermove',{clientX:400});assert.equal(run.updates,1);
});
test('right mouse button, UI clicks and another pointer cannot orbit',()=>{
  const run=setup();run.send('pointerdown',{button:2});run.send('pointermove');assert.equal(run.updates,0);
  run.send('pointerdown',{target:{}});run.send('pointermove');assert.equal(run.updates,0);
  run.send('pointerdown');run.send('pointermove',{pointerId:2});assert.equal(run.updates,0);
});
test('cancel, lost capture and focus cleanup terminate dragging; photo mode keeps dragging and wheel zoom',()=>{
  const run=setup();
  for(const name of ['pointercancel','lostpointercapture']){
    run.send('pointerdown');run.send(name);assert.equal(run.read('photo.drag'),null);assert.equal(run.captures.size,0);
  }
  run.send('pointerdown');run.read('stopInspectDrag()');assert.equal(run.read('photo.drag'),null);
  run.read('photo.active=true');run.send('pointerdown');run.send('pointermove',{clientX:150});assert.equal(run.updates,1);
  run.send('pointerup');run.send('wheel',{deltaY:-100,deltaMode:0});assert.ok(run.read('inspectDistance')<110);
  run.read('paused=false');run.send('pointerdown');assert.equal(run.read('photo.drag'),null);
});
