import test from 'node:test';
import assert from 'node:assert/strict';
import {getMission} from '../src/missions.js';
import {createMissionRadio,missionRadioLine,radioVoices} from '../src/mission-radio.js';

test('radio line follows the actual starting situation',()=>{
  assert.equal(missionRadioLine(getMission('first-takeoff')).kind,'takeoff');
  assert.equal(missionRadioLine(getMission('airport-circuit')).kind,'takeoff');
  assert.equal(missionRadioLine(getMission('first-landing')).kind,'landing');
  assert.equal(missionRadioLine(getMission('brno-landing')).kind,'landing');
  assert.equal(missionRadioLine(getMission('brno-discovery')).kind,'navigation');
  assert.equal(missionRadioLine(getMission('emergency-landing')).kind,'emergency');
  assert.equal(missionRadioLine(getMission('dusk-landing')).kind,'go-around');
});

test('new attempt replaces the previous transmission; mute and stop cancel it',()=>{
  const caption={hidden:true,textContent:''},spoken=[];
  let cancels=0,enabled=true;const transmissions=[];
  const speech={getVoices:()=>[{lang:'en-US',localService:true}],speak:line=>spoken.push(line),cancel:()=>cancels++,resume:()=>{}};
  class Utterance{constructor(text){this.text=text;}}
  const radio=createMissionRadio({caption,enabled:()=>enabled,transmission:(...event)=>transmissions.push(event),speech,Utterance});
  radio.play(getMission('first-takeoff'));
  assert.equal(spoken.length,1);assert.match(caption.textContent,/cleared for takeoff/);
  spoken[0].onstart();assert.equal(transmissions.filter(([active])=>active).length,1);
  radio.play(getMission('first-landing'));
  assert.equal(cancels,1);assert.equal(spoken.length,2);assert.match(spoken[1].text,/cleared to land/);
  const events=transmissions.length;spoken[0].onend();assert.equal(transmissions.length,events);
  radio.stop();assert.equal(cancels,2);assert.equal(caption.hidden,true);
  assert.deepEqual(transmissions.at(-1),[false,null,true]);
  enabled=false;radio.play(getMission('first-takeoff'));
  assert.equal(spoken.length,2);assert.equal(caption.hidden,false);
  radio.stop();
});

test('radio noise follows both voices and is cancelled on speech errors and timeouts',()=>{
  const spoken=[],transmissions=[],timers=new Map();let timerId=0;
  class Utterance{constructor(text){this.text=text;}}
  const radio=createMissionRadio({Utterance,speech:{speak:line=>spoken.push(line),cancel(){}},transmission:(...event)=>transmissions.push(event),
    schedule:(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay});return id;},cancelTimer:id=>timers.delete(id)});
  radio.flightEvent('touchdown');
  assert.equal(transmissions.some(([active])=>active),false,'no hiss while speech is still loading');
  spoken[0].onstart();assert.deepEqual(transmissions.at(-1),[true,'pilot']);
  spoken[0].onend();assert.deepEqual(transmissions.at(-1),[false,'pilot']);
  const [gapId,gap]=[...timers.entries()][0];timers.delete(gapId);gap.fn();
  spoken[1].onstart();assert.deepEqual(transmissions.at(-1),[true,'tower']);
  spoken[1].onerror();assert.deepEqual(transmissions.at(-1),[false,null,true]);
  radio.flightEvent('liftoff');spoken[2].onstart();
  const timeout=[...timers.values()][0];timeout.fn();
  assert.deepEqual(transmissions.at(-1),[false,null,true]);radio.stop();
});

test('touchdown and liftoff replace the clearance with the matching follow-up transmission',()=>{
  const spoken=[],caption={hidden:true};
  class Utterance{constructor(text){this.text=text;}}
  const radio=createMissionRadio({caption,speech:{speak:line=>spoken.push(line),cancel(){}},Utterance});
  radio.flightEvent('touchdown');assert.match(spoken.at(-1).text,/on the ground/);
  radio.flightEvent('liftoff');assert.match(spoken.at(-1).text,/airborne/);
  assert.equal(spoken.length,2);
  radio.flightEvent('touch-and-go');assert.match(spoken.at(-1).text,/full power/);
  radio.stop();
});

test('normal English voices are preferred over novelty voices and each radio role gets a different voice',()=>{
  const albert={name:'Albert',lang:'en-US',localService:true},daniel={name:'Daniel',lang:'en-GB',localService:true},samantha={name:'Samantha',lang:'en-US',localService:true};
  assert.deepEqual(radioVoices([albert,samantha,daniel]),{tower:daniel,pilot:samantha});
  assert.deepEqual(radioVoices([albert]),{tower:null,pilot:null});
  assert.deepEqual(radioVoices([samantha]),{tower:samantha,pilot:samantha});
});

test('the pilot and tower take turns with a pause, natural pitch and captions that follow the speaker',()=>{
  const spoken=[],timers=new Map(),caption={hidden:true};let timerId=0;
  const daniel={name:'Daniel',lang:'en-GB'},samantha={name:'Samantha',lang:'en-US'};
  class Utterance{constructor(text){this.text=text;}}
  const radio=createMissionRadio({caption,Utterance,speech:{getVoices:()=>[daniel,samantha],speak:line=>spoken.push(line),cancel(){}},
    schedule:(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay});return id;},cancelTimer:id=>timers.delete(id)});
  const line=radio.flightEvent('touchdown');
  assert.equal(line.messages.length,2);assert.ok(line.text.split(/\s+/).length>=25);
  assert.match(caption.textContent,/^PILOT/);assert.equal(spoken[0].voice,samantha);assert.equal(spoken[0].pitch,1);
  spoken[0].onend();
  assert.equal(spoken.length,1);assert.equal(timers.size,1);
  const [id,gap]=[...timers.entries()][0];assert.equal(gap.delay,450);timers.delete(id);gap.fn();
  assert.equal(spoken.length,2);assert.equal(spoken[1].voice,daniel);assert.match(caption.textContent,/^VĚŽ/);
  spoken[1].onend();radio.stop();assert.equal(timers.size,0);assert.equal(caption.hidden,true);
});

test('stopping or replacing a dialogue cancels pending replies, including callbacks from an older session',()=>{
  const spoken=[],timers=new Map();let timerId=0;
  class Utterance{constructor(text){this.text=text;}}
  const radio=createMissionRadio({Utterance,speech:{speak:line=>spoken.push(line),cancel(){}},
    schedule:(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay});return id;},cancelTimer:id=>timers.delete(id)});
  radio.flightEvent('touchdown');spoken[0].onend();const oldReply=[...timers.values()][0].fn;
  radio.flightEvent('liftoff');oldReply();assert.equal(spoken.length,2);
  spoken[1].onend();radio.stop();assert.equal(timers.size,0);
});
