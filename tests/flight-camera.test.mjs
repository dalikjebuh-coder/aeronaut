import test from 'node:test';
import assert from 'node:assert/strict';
import {flightCameraPose,crashCameraPose} from '../src/flight-camera.js';

const state={heading:Math.PI/2,pitch:.08,speed:100};
const vibration={heading:.01,pitch:.02,roll:.03};

test('impact camera points at the burst even after a steep dive or bank',()=>{
  const pose=crashCameraPose({...state,pitch:-1,roll:.8},65);
  const distance=Math.hypot(pose.offset.x,pose.offset.y);
  assert.ok(Math.abs(Math.tan(-pose.orientation.pitch)-pose.offset.z/distance)<1e-10);
  assert.equal(pose.orientation.roll,0);
});

test('standard camera keeps the existing chase position and flight motion',()=>{
  const pose=flightCameraPose(state,48,'chase',vibration);
  assert.ok(Math.abs(pose.offset.x+54.4)<1e-10);
  assert.ok(Math.abs(pose.offset.y)<1e-10);
  assert.equal(pose.offset.z,16.9);
  assert.ok(Math.abs(pose.orientation.pitch+.16)<1e-10);
  assert.equal(pose.orientation.roll,.03);
});

test('distant camera follows the heading while showing more of the surroundings',()=>{
  const near=flightCameraPose(state,48,'chase',vibration);
  const far=flightCameraPose(state,48,'distant',vibration);
  assert.ok(Math.hypot(far.offset.x,far.offset.y)>Math.hypot(near.offset.x,near.offset.y)*2);
  assert.ok(far.offset.z>near.offset.z);
  assert.equal(far.orientation.heading,near.orientation.heading);
});

test('overhead camera stays directly above every aircraft and points straight down',()=>{
  for(const chaseDistance of [48,65,105]){
    const pose=flightCameraPose(state,chaseDistance,'overhead',vibration);
    assert.deepEqual(pose.offset,{x:0,y:0,z:Math.max(150,chaseDistance*2.2)});
    assert.deepEqual(pose.orientation,{heading:state.heading,pitch:-Math.PI/2,roll:0});
  }
});

test('front camera stays ahead of every aircraft and looks back at its nose',()=>{
  for(const heading of [0,Math.PI/2,Math.PI,Math.PI*1.75]){
    for(const chaseDistance of [48,65,105]){
      const pose=flightCameraPose({...state,heading},chaseDistance,'front');
      const distance=Math.hypot(pose.offset.x,pose.offset.y);
      assert.ok(pose.offset.x*Math.sin(heading)+pose.offset.y*Math.cos(heading)>0);
      assert.ok(Math.abs(Math.sin(pose.orientation.heading)*distance+pose.offset.x)<1e-10);
      assert.ok(Math.abs(Math.cos(pose.orientation.heading)*distance+pose.offset.y)<1e-10);
      assert.ok(Math.abs(Math.tan(-pose.orientation.pitch)*distance-pose.offset.z)<1e-10);
    }
  }
});

test('cinematic camera orbits smoothly and keeps every aircraft centered',()=>{
  for(const chaseDistance of [48,65,105]){
    for(const heading of [0,Math.PI/2,Math.PI*1.75]){
      let previous;
      for(let elapsed=0;elapsed<=90;elapsed+=.1){
        const pose=flightCameraPose({...state,heading,elapsed,pitch:-1},chaseDistance,'cinematic',vibration);
        const distance=Math.hypot(pose.offset.x,pose.offset.y);
        assert.ok(pose.offset.z>0);
        assert.ok(Math.abs(Math.sin(pose.orientation.heading)*distance+pose.offset.x)<1e-9);
        assert.ok(Math.abs(Math.cos(pose.orientation.heading)*distance+pose.offset.y)<1e-9);
        assert.ok(Math.abs(Math.tan(-pose.orientation.pitch)*distance-pose.offset.z)<1e-9);
        assert.equal(pose.orientation.roll,0);
        if(previous)assert.ok(Math.hypot(pose.offset.x-previous.x,pose.offset.y-previous.y,pose.offset.z-previous.z)<chaseDistance*.025);
        previous=pose.offset;
      }
    }
  }
  const start=flightCameraPose({...state,elapsed:0},48,'cinematic');
  const side=flightCameraPose({...state,elapsed:20},48,'cinematic');
  assert.ok(Math.hypot(start.offset.x-side.offset.x,start.offset.y-side.offset.y)>48);
  assert.notEqual(start.offset.z,side.offset.z);
  assert.deepEqual(flightCameraPose(state,48,'cinematic'),start,'missing flight time starts from a valid pose');
  assert.deepEqual(flightCameraPose({...state,elapsed:20},48,'cinematic'),side,'frozen flight time freezes the orbit');
});
