import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngineAudio} from '../src/engine-audio.js';

test('recorded engine follows model, throttle, pause and mute',async()=>{
  class AudioParam{
    targets=[];
    setTargetAtTime(value){this.targets.push(value);}
    get last(){return this.targets.at(-1);}
  }
  class AudioNode{
    gain=new AudioParam();
    playbackRate=new AudioParam();
    connect(){}
    start(){this.started=true;}
  }
  class AudioContext{
    state='running';
    currentTime=0;
    destination=new AudioNode();
    gains=[];
    sources=[];
    createGain(){const node=new AudioNode();this.gains.push(node);return node;}
    createBufferSource(){const node=new AudioNode();this.sources.push(node);return node;}
    async decodeAudioData(){return{duration:2};}
  }
  const previousWindow=globalThis.window,previousFetch=globalThis.fetch;
  const context=new AudioContext();
  globalThis.window={AudioContext:class extends AudioContext{constructor(){super();return context;}}};
  globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});
  try{
    const audio=createEngineAudio();
    audio.unlock();
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(context.sources.length,2);
    assert(context.sources.every(source=>source.started&&source.loop));
    audio.setModel('highWing');audio.setThrottle(.4,70);audio.play();
    assert(context.gains[1].gain.last>0);
    assert.equal(context.gains[2].gain.last,0);
    const low=context.sources[0].playbackRate.last;
    audio.setThrottle(1,170);
    assert(context.sources[0].playbackRate.last>low);
    audio.setModel('fighter');
    assert.equal(context.gains[1].gain.last,0);
    assert(context.gains[2].gain.last>0);
    audio.pause();assert.equal(context.gains[0].gain.last,0);
    audio.play();audio.toggle();assert.equal(context.gains[0].gain.last,0);
  }finally{globalThis.window=previousWindow;globalThis.fetch=previousFetch;}
});

test('gate and warning cues have finite envelopes and respect pause, mute and stopped flight',()=>{
  const oscillators=[];
  const param=()=>({setTargetAtTime(){},setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
  const context={state:'running',currentTime:1,destination:{},createGain:()=>({gain:param(),connect(){},disconnect(){}}),createOscillator:()=>{const node={frequency:{},connect(){},disconnect(){},start(time){this.startTime=time;},stop(time){this.stopTime=time;}};oscillators.push(node);return node;}};
  const previousWindow=globalThis.window,previousFetch=globalThis.fetch;
  globalThis.window={AudioContext:class{constructor(){return context;}}};
  globalThis.fetch=()=>new Promise(()=>{});
  try{
    const audio=createEngineAudio();audio.gatePassed();assert.equal(oscillators.length,0);
    audio.unlock();audio.gatePassed();assert.equal(oscillators.length,0);
    audio.play();audio.gatePassed();assert.equal(oscillators.length,2);
    audio.stallWarning();assert.equal(oscillators.length,3);
    audio.gatePassed(true);assert.equal(oscillators.length,5);
    assert.ok(oscillators.every(node=>node.stopTime>node.startTime&&node.stopTime-node.startTime<.3));
    audio.pause();audio.stallWarning();audio.gatePassed();assert.equal(oscillators.length,5);
    audio.play();audio.toggle();audio.stallWarning();audio.gatePassed();assert.equal(oscillators.length,5);
    audio.toggle();audio.stop();audio.gatePassed();assert.equal(oscillators.length,5);
  }finally{globalThis.window=previousWindow;globalThis.fetch=previousFetch;}
});

test('rubber chirps are finite, softer at liftoff and cancelled by pause, mute or exit',()=>{
  const sources=[],peaks=[];
  const context={state:'running',sampleRate:8000,currentTime:2,destination:{},
    createBuffer:(channels,length)=>({duration:length/8000,data:new Float32Array(length),getChannelData(){return this.data;}}),
    createGain:()=>({gain:{setTargetAtTime(){},setValueAtTime(){},linearRampToValueAtTime:value=>peaks.push(value),exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}),
    createBufferSource:()=>{const source={connect(){},disconnect(){},start(){},stops:[],stop(time){this.stops.push(time);}};sources.push(source);return source;}};
  const previousWindow=globalThis.window,previousFetch=globalThis.fetch;
  globalThis.window={AudioContext:class{constructor(){return context;}}};globalThis.fetch=()=>new Promise(()=>{});
  try{
    const audio=createEngineAudio();audio.tireSqueal('touchdown');assert.equal(sources.length,0);
    audio.unlock();audio.play();audio.tireSqueal('touchdown');audio.tireSqueal('liftoff');
    assert.equal(sources.length,2);assert.ok(sources[0].buffer.duration>sources[1].buffer.duration);
    assert.ok(peaks[0]>peaks[1]);
    assert.ok(sources.every(source=>source.buffer.data.every(Number.isFinite)&&source.stops[0]>2&&source.stops[0]<3));
    audio.pause();assert.ok(sources.every(source=>source.stops.length===2));
    audio.tireSqueal('touchdown');assert.equal(sources.length,2);
    audio.play();audio.tireSqueal('touchdown');audio.toggle();assert.equal(sources[2].stops.length,2);
    audio.tireSqueal('touchdown');assert.equal(sources.length,3);
    audio.toggle();audio.tireSqueal('touchdown');audio.stop();assert.equal(sources[3].stops.length,2);
  }finally{globalThis.window=previousWindow;globalThis.fetch=previousFetch;}
});
