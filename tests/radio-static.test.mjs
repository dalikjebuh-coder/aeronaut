import test from 'node:test';
import assert from 'node:assert/strict';
import {createRadioStatic} from '../src/radio-static.js';
import {createEngineAudio} from '../src/engine-audio.js';

function mockContext(){
  const sources=[],filters=[],gains=[],buffers=[];
  const param=()=>({values:[],setValueAtTime(value,time){this.values.push({value,time});},linearRampToValueAtTime(value,time){this.values.push({value,time});},exponentialRampToValueAtTime(value,time){this.values.push({value,time});},setTargetAtTime(){},cancelScheduledValues(){}});
  const node=()=>({connect(target){this.target=target;},disconnect(){this.disconnected=true;}});
  const context={state:'running',sampleRate:8000,currentTime:2,destination:{},
    createBuffer:(channels,length)=>{const buffer={data:new Float32Array(length),getChannelData(){return this.data;}};buffers.push(buffer);return buffer;},
    createBufferSource:()=>{const source={...node(),playbackRate:{},stops:[],start(){this.started=true;},stop(time){this.stops.push(time);}};sources.push(source);return source;},
    createBiquadFilter:()=>{const filter={...node(),frequency:{},Q:{}};filters.push(filter);return filter;},
    createGain:()=>{const gain={...node(),gain:param()};gains.push(gain);return gain;}};
  return{context,sources,filters,gains,buffers};
}

test('radio interference loops through the speech, has a quieter bed and a finite squelch tail',()=>{
  const {context,sources,filters,gains,buffers}=mockContext(),radio=createRadioStatic(context);
  radio.start('tower');
  assert.ok(sources[0].loop&&sources[0].started);assert.equal(sources[0].stops.length,0);
  assert.equal(filters[0].type,'highpass');assert.equal(filters[1].type,'lowpass');
  assert.ok(filters[0].frequency.value<filters[1].frequency.value);
  assert.ok(buffers[0].data.every(value=>Number.isFinite(value)&&Math.abs(value)<=1));
  assert.ok(buffers[0].data.some(value=>Math.abs(value)>.2));
  assert.ok(gains[0].gain.values[1].value>gains[0].gain.values[2].value);
  radio.stop();assert.ok(sources[0].stops[0]>2&&sources[0].stops[0]<2.2);
  sources[0].onended();assert.ok(sources[0].disconnected&&filters.every(filter=>filter.disconnected)&&gains[0].disconnected);
  radio.start('pilot');assert.equal(buffers.length,1,'reuse the noise buffer between replies');
  radio.cancel();assert.equal(sources[1].stops.at(-1),undefined);
});

test('replacement and cancellation stop old noise sources; a suspended context stays silent',()=>{
  const {context,sources}=mockContext(),radio=createRadioStatic(context);
  radio.start('pilot');radio.start('tower');assert.equal(sources[0].stops.length,1);
  radio.stop();radio.cancel();assert.equal(sources[1].stops.length,2);
  context.state='suspended';radio.start();assert.equal(sources.length,2);
});

test('engine mute and exit cancel the radio, while a result pause lets its final reply finish',()=>{
  const {context,sources}=mockContext(),previousWindow=globalThis.window,previousFetch=globalThis.fetch;
  globalThis.window={AudioContext:class{constructor(){return context;}}};globalThis.fetch=()=>new Promise(()=>{});
  try{
    const audio=createEngineAudio();audio.radioTransmission(true,'pilot');assert.equal(sources.length,0);
    audio.unlock();audio.play();audio.radioTransmission(true,'pilot');audio.pause();
    assert.equal(sources[0].stops.length,0,'radio has its own volume during the result pause');
    audio.radioTransmission(false,null,true);assert.equal(sources[0].stops.length,1);
    audio.radioTransmission(true,'tower');audio.toggle();assert.equal(sources[1].stops.length,1);
    audio.radioTransmission(true,'pilot');assert.equal(sources.length,2);
    audio.toggle();audio.radioTransmission(true,'pilot');audio.stop();assert.equal(sources[2].stops.length,1);
  }finally{globalThis.window=previousWindow;globalThis.fetch=previousFetch;}
});
