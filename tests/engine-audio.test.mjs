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

test('the recorded explosion plays during a crash pause and stops on mute, restart or exit',async()=>{
  const sources=[],destination={},encoded=new ArrayBuffer(8),decoded={duration:5.976};
  const context={state:'running',destination,
    createGain:()=>({gain:{setTargetAtTime(){}},connect(){}}),
    async decodeAudioData(data){assert.equal(data,encoded);return decoded;},
    createBufferSource:()=>{
      const source={connect(output){this.output=output;},start(){this.started=true;},stop(){this.stopped=true;},disconnect(){this.disconnected=true;}};
      sources.push(source);return source;
    }};
  const previousWindow=globalThis.window,previousFetch=globalThis.fetch;
  globalThis.window={AudioContext:class{constructor(){return context;}}};
  globalThis.fetch=url=>url==='/audio/explosion.mp3'?Promise.resolve({ok:true,arrayBuffer:async()=>encoded}):new Promise(()=>{});
  try{
    const audio=createEngineAudio();audio.explosion();assert.equal(sources.length,0);
    audio.unlock();audio.explosion();assert.equal(sources.length,0);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(sources.length,0);
    audio.play();audio.pause();audio.explosion();audio.explosion();
    assert.equal(sources.length,1);
    const first=sources[0];
    assert.equal(first.output,destination);assert.equal(first.started,true);
    assert.equal(first.buffer,decoded);assert.ok(!first.loop);
    audio.toggle();assert.equal(first.stopped,true);
    audio.explosion();assert.equal(sources.length,1);
    audio.toggle();audio.explosion();
    assert.equal(sources[1].buffer,first.buffer);
    first.onended();assert.equal(first.disconnected,true);
    audio.play();assert.equal(sources[1].stopped,true);
    audio.pause();audio.explosion();audio.stop();assert.equal(sources[2].stopped,true);
    audio.play();audio.pause();audio.explosion();sources[3].onended();
    audio.play();audio.pause();audio.explosion();assert.equal(sources.length,5);
  }finally{globalThis.window=previousWindow;globalThis.fetch=previousFetch;}
});

test('the radio recording waits for decoding, restarts without overlap and survives the landing result pause',async()=>{
  const sources=[],destination={},decoded={duration:33.432};
  let resolveRadio;
  const context={state:'running',destination,
    createGain:()=>({gain:{setTargetAtTime(){}},connect(output){this.output=output;},disconnect(){}}),
    decodeAudioData:()=>new Promise(resolve=>{resolveRadio=resolve;}),
    createBufferSource:()=>{
      const source={connect(output){this.output=output;},start(){this.started=true;},stop(){this.stopped=true;},disconnect(){}};
      sources.push(source);return source;
    }};
  const previousWindow=globalThis.window,previousFetch=globalThis.fetch;
  globalThis.window={AudioContext:class{constructor(){return context;}}};
  globalThis.fetch=url=>url==='/audio/pilot-tower-radio.mp3'?Promise.resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)}):new Promise(()=>{});
  try{
    const audio=createEngineAudio();audio.unlock();audio.radio.play();audio.radio.stop();
    await new Promise(resolve=>setImmediate(resolve));
    resolveRadio(decoded);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(sources.length,0,'ending a flight cancels playback pending decode');
    audio.radio.play();audio.radio.play();
    assert.equal(sources.length,2);
    assert.ok(sources[0].stopped);
    assert.equal(sources[1].buffer,decoded);
    assert.equal(sources[1].output.gain.value,.49);
    assert.equal(sources[1].output.output,destination);
    assert.ok(sources[1].started&&!sources[1].loop);
    audio.pause();assert.ok(!sources[1].stopped);
    audio.toggle();assert.ok(sources[1].stopped);
    audio.radio.play();assert.equal(sources.length,2);
  }finally{globalThis.window=previousWindow;globalThis.fetch=previousFetch;}
});
