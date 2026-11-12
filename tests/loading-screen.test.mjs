import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoadingScreen} from '../src/loading-screen.js';

function fixture(){
  const classes=new Set();
  const title={textContent:''},detail={textContent:''};
  const progress={hidden:false,max:1,value:0,hasValue:false,
    hasAttribute(name){return name==='value'&&this.hasValue;},
    removeAttribute(name){if(name==='value')this.hasValue=false;}};
  Object.defineProperty(progress,'value',{get(){return this.currentValue;},set(value){this.currentValue=value;this.hasValue=true;}});
  const root={hidden:true,offsetWidth:100,
    classList:{contains:name=>classes.has(name),add:(...names)=>names.forEach(name=>classes.add(name)),remove:(...names)=>names.forEach(name=>classes.delete(name))},
    querySelector(selector){return selector==='strong'?title:selector==='p'?detail:progress;}};
  return {root,title,detail,progress,classes};
}

test('measured steps advance only when reported and completion does not wait',()=>{
  const {root,title,progress,classes}=fixture();
  let finish;
  const loading=createLoadingScreen(root,{setTimer:callback=>{finish=callback;return 1;}});
  loading.show('Start',{completed:0,total:3});
  assert.equal(root.hidden,false);
  assert.equal(progress.value,0);
  loading.show('Svět připraven',{completed:2,total:3});
  assert.equal(title.textContent,'Svět připraven');
  assert.equal(progress.value,2);
  loading.complete();
  assert.equal(progress.value,3);
  assert.equal(classes.has('is-leaving'),true);
  assert.equal(root.hidden,false);
  finish();
  assert.equal(root.hidden,true);
});

test('unknown network progress stays indeterminate; reduced motion closes immediately',()=>{
  const {root,progress}=fixture();
  const loading=createLoadingScreen(root,{reducedMotion:true});
  loading.show('Připojuji mapu');
  assert.equal(progress.hasAttribute('value'),false);
  loading.complete();
  assert.equal(root.hidden,true);
});

test('only the initial load waits five seconds, including a map preparation',()=>{
  const {root}=fixture();
  let time=0,nextId=0;
  const timers=new Map();
  const loading=createLoadingScreen(root,{initialMinimumMs:5000,reducedMotion:true,now:()=>time,
    setTimer:(callback,delay)=>{const id=++nextId;timers.set(id,{callback,delay});return id;},
    clearTimer:id=>timers.delete(id)});
  loading.show('Spouštím hru');loading.complete();
  assert.equal([...timers.values()][0].delay,5000);
  assert.equal(root.hidden,false);
  time=1200;
  loading.show('Připojuji mapu');
  assert.equal(timers.size,0);
  loading.complete();
  assert.equal([...timers.values()][0].delay,3800);
  time=5000;
  [...timers.values()][0].callback();
  assert.equal(root.hidden,true);
  loading.show('Připravuji misi');loading.complete();
  assert.equal(root.hidden,true);
});

test('a new load cancels a pending fade and errors remain visible',()=>{
  const {root,progress,classes}=fixture();
  const callbacks=new Map();let next=0;
  const loading=createLoadingScreen(root,{setTimer:callback=>{callbacks.set(++next,callback);return next;},clearTimer:id=>callbacks.delete(id)});
  loading.show('První');loading.complete();
  loading.complete();
  assert.equal(callbacks.size,1);
  loading.show('Druhé');
  assert.equal(callbacks.size,0);
  assert.equal(root.hidden,false);
  assert.equal(classes.has('is-leaving'),false);
  loading.fail('Chyba','Zkus to znovu');
  assert.equal(root.hidden,false);
  assert.equal(progress.hidden,true);
  assert.equal(classes.has('is-error'),true);
});
