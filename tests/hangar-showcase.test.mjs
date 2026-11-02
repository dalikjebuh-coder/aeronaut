import test from 'node:test';
import assert from 'node:assert/strict';
import {createHangarShowcase,hangarAircraftImage} from '../src/hangar-showcase.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
function elements(){
  const stage={dataset:{phase:'empty'},setAttribute(name,value){this[name]=value;}};
  return{stage,image:{hidden:true},previous:{hidden:true},empty:{hidden:false},status:{textContent:'Vyber letadlo'}};
}
const flush=async()=>{await Promise.resolve();await Promise.resolve();};

test('hangar starts empty and does not load or select an aircraft on its own',()=>{
  const nodes=elements();let loads=0;
  const showcase=createHangarShowcase({...nodes,loadImage:async()=>{loads++;},reducedMotion:()=>true});
  assert.equal(showcase.selected,null);assert.equal(showcase.visible,null);assert.equal(nodes.image.hidden,true);assert.equal(nodes.empty.hidden,false);assert.equal(loads,0);
});
test('a selected aircraft is revealed after loading, and repeated menu syncs do not reload it',async()=>{
  const nodes=elements(),loads=[];
  const showcase=createHangarShowcase({...nodes,loadImage:async src=>{loads.push(src);return src;},reducedMotion:()=>true});
  const pending=showcase.select('lowWing','Citation');assert.equal(nodes.stage['aria-busy'],'true');assert.equal(nodes.image.hidden,true);
  await pending;assert.equal(nodes.image.src,hangarAircraftImage('lowWing'));assert.equal(nodes.empty.hidden,true);assert.equal(nodes.stage.dataset.phase,'ready');
  assert.equal(nodes.stage['aria-busy'],'false');assert.match(nodes.status.textContent,/Citation připraven/);
  await showcase.select('lowWing','Citation');assert.equal(loads.length,1);
});
test('full photograph is the default and switching views preserves the selected aircraft',async()=>{
  const nodes=elements(),loads=[];
  const showcase=createHangarShowcase({...nodes,loadImage:async src=>{loads.push(src);return src;},reducedMotion:()=>true});
  assert.equal(showcase.view,'photo');
  await showcase.select('highWing','Hornoplošník');
  assert.equal(nodes.image.src,'/images/hangar-highWing-v1.jpg');
  assert.match(nodes.image.alt,/celá fotografie/);
  await showcase.setView('cutout');
  assert.equal(nodes.stage.dataset.view,'cutout');
  assert.equal(nodes.image.src,'/images/hangar-cutout-highWing-v1.png');
  assert.equal(showcase.selected,'highWing');
  await showcase.setView('photo');
  assert.equal(nodes.image.src,'/images/hangar-highWing-v1.jpg');
  assert.deepEqual(loads,[hangarAircraftImage('highWing'),hangarAircraftImage('highWing','cutout'),hangarAircraftImage('highWing')]);
});
test('late loading of a previously clicked aircraft cannot overwrite the latest choice',async()=>{
  const nodes=elements(),pending=new Map();
  const showcase=createHangarShowcase({...nodes,loadImage:src=>{const d=deferred();pending.set(src,d);return d.promise;},reducedMotion:()=>true});
  const a=showcase.select('highWing','Hornoplošník'),b=showcase.select('fighter','Super Hornet');
  pending.get(hangarAircraftImage('fighter')).resolve(hangarAircraftImage('fighter'));await b;
  pending.get(hangarAircraftImage('highWing')).resolve(hangarAircraftImage('highWing'));await a;
  assert.equal(nodes.stage.dataset.model,'fighter');assert.equal(nodes.image.src,hangarAircraftImage('fighter'));assert.match(nodes.status.textContent,/Super Hornet/);
});
test('a new selection cancels an earlier reveal without leaving a ghost aircraft',async()=>{
  const nodes=elements(),animations=[];
  const animate=()=>{const d=deferred(),animation={finished:d.promise,cancel(){this.cancelled=true;d.resolve();},finish:d.resolve};animations.push(animation);return animation;};
  nodes.image.animate=animate;nodes.previous.animate=animate;
  const showcase=createHangarShowcase({...nodes,loadImage:async src=>src,reducedMotion:()=>false});
  const first=showcase.select('lowWing','Citation');await flush();assert.equal(nodes.stage.dataset.phase,'revealing');
  const second=showcase.select('fighter','Super Hornet');await flush();
  assert.equal(animations[0].cancelled,true);assert.equal(nodes.stage.dataset.model,'fighter');
  for(const animation of animations)animation.finish();await Promise.all([first,second]);
  assert.equal(nodes.stage.dataset.phase,'ready');assert.equal(nodes.previous.hidden,true);assert.equal(nodes.image.hidden,false);assert.match(nodes.status.textContent,/Super Hornet/);
});
test('a failed image clears loading, hides the previous plane and lets the user retry the same selection',async()=>{
  const nodes=elements();let fail=false;
  const showcase=createHangarShowcase({...nodes,loadImage:async src=>{if(fail)throw Error('missing');return src;},reducedMotion:()=>true});
  await showcase.select('lowWing','Citation');fail=true;await showcase.select('airliner','Boeing 787');
  assert.equal(nodes.stage.dataset.phase,'error');assert.equal(nodes.stage['aria-busy'],'false');assert.equal(nodes.image.hidden,true);assert.equal(nodes.previous.hidden,true);assert.equal(nodes.empty.hidden,false);
  fail=false;await showcase.select('airliner','Boeing 787');assert.equal(nodes.stage.dataset.phase,'ready');assert.equal(nodes.image.src,hangarAircraftImage('airliner'));
});
test('reduced motion shows the final plane without running an animation',async()=>{
  const nodes=elements();nodes.image.animate=()=>{throw Error('animation must not run');};
  const showcase=createHangarShowcase({...nodes,loadImage:async src=>src,reducedMotion:()=>true});
  await showcase.select('highWing','Hornoplošník');assert.equal(nodes.stage.dataset.phase,'ready');assert.equal(nodes.empty.hidden,true);
});
