import test from 'node:test';
import assert from 'node:assert/strict';
import {installMobileControls,joystickVector} from '../src/mobile-controls.js';

function target(control){
  const handlers=new Map(),captures=new Set();
  return {
    dataset:{control},style:{},
    addEventListener(type,handler){handlers.set(type,handler);},
    setPointerCapture(id){captures.add(id);},
    hasPointerCapture(id){return captures.has(id);},
    releasePointerCapture(id){captures.delete(id);this.fire('lostpointercapture',id);},
    getBoundingClientRect(){return {left:0,top:0,width:160,height:160};},
    fire(type,id,x=80,y=80){handlers.get(type)?.({pointerId:id,clientX:x,clientY:y,preventDefault(){}});if((type==='pointerup'||type==='pointercancel')&&captures.delete(id))this.fire('lostpointercapture',id);},
    captures
  };
}

test('joystick is proportional and bounded at the edge',()=>{
  assert.deepEqual(joystickVector(0,0,50),{x:0,y:0});
  assert.deepEqual(joystickVector(25,-25,50),{x:.5,y:-.5});
  const diagonal=joystickVector(100,100,50);
  assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.y)-1)<1e-10);
});

test('joystick and throttle hold independent pointers and release on cancel or pause',()=>{
  const joystick=target(),thumb=target(),up=target('powerUp'),down=target('powerDown');
  let enabled=true;
  const controls=installMobileControls({joystick,thumb,buttons:[up,down],enabled:()=>enabled});
  joystick.fire('pointerdown',1,80,80);
  joystick.fire('pointermove',1,107,53);
  up.fire('pointerdown',2);
  assert.ok(Math.abs(controls.axes.roll-.5)<.01);
  assert.ok(Math.abs(controls.axes.pitch+.5)<.01);
  assert.ok(controls.power.has('powerUp'));
  joystick.fire('pointerdown',3,0,0);
  assert.ok(Math.abs(controls.axes.roll-.5)<.01,'another finger cannot take over the joystick');
  up.fire('pointerup',2);
  assert.equal(controls.power.size,0);
  down.fire('pointerdown',4);
  joystick.fire('pointercancel',1);
  assert.equal(controls.axes.roll,0);
  assert.equal(controls.axes.pitch,0);
  assert.ok(controls.power.has('powerDown'));
  controls.reset();
  assert.equal(controls.power.size,0);
  assert.equal(joystick.captures.size,0);
  assert.equal(down.captures.size,0);
  enabled=false;
  up.fire('pointerdown',5);
  assert.equal(controls.power.size,0);
});
