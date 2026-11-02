import test from 'node:test';
import assert from 'node:assert/strict';
import {BRNO_ROUTE,BRNO_START,BrnoRace,gateFrame,formatRaceTime} from '../src/brno-race.js';
import {RAD,EARTH} from '../src/flight.js';

function point(index,along,time,lateral=0,vertical=0){
  const {center,normal,right}=gateFrame(index),anchor=BRNO_ROUTE.gates[0];
  const x=center.x+normal.x*along+right.x*lateral,y=center.y+normal.y*along+right.y*lateral;
  return{lat:anchor.lat+y/EARTH/RAD,lon:anchor.lon+x/(EARTH*Math.cos(anchor.lat*RAD))/RAD,altitude:BRNO_ROUTE.altitude+vertical,elapsed:time};
}
function cross(race,index,time){race.update(point(index,-100,time));return race.update(point(index,100,time+2));}

test('start is ahead of the spawn and clock begins at the interpolated gate crossing',()=>{
  const race=new BrnoRace();race.update({...BRNO_START,elapsed:0});
  assert.equal(race.status,'ready');assert.equal(race.elapsed(20),0);
  cross(race,0,10);assert.equal(race.next,1);assert.ok(Math.abs(race.startedAt-11)<1e-6);
});

test('reverse, outside-radius, over-height and out-of-order crossings do not count',()=>{
  for(const [lateral,vertical] of [[181,0],[0,181],[150,150]]){
    const race=new BrnoRace();race.update(point(0,-200,0,lateral,vertical));race.update(point(0,200,2,lateral,vertical));assert.equal(race.next,0);
  }
  const reverse=new BrnoRace();reverse.update(point(0,100,0));reverse.update(point(0,-100,1));assert.equal(reverse.next,0);
  const skipped=new BrnoRace();cross(skipped,2,10);assert.equal(skipped.next,0);
});

test('a fast segment crossing counts even when neither end lies inside the ring',()=>{
  const race=new BrnoRace();race.update(point(0,-300,0));race.update(point(0,300,2));assert.equal(race.next,1);
  // Returning backwards through a completed gate cannot award it twice.
  race.update(point(0,-300,4));assert.equal(race.next,1);
});

test('ordered finish stops the clock permanently; a pause adds no simulation time',()=>{
  const race=new BrnoRace();
  for(let index=0;index<BRNO_ROUTE.gates.length;index++){
    const events=cross(race,index,index*20);
    assert.ok(events.some(event=>event.index===index));
    if(index===0){const frozen=point(0,100,2);race.update(frozen);assert.equal(race.elapsed(frozen.elapsed),1);}
  }
  assert.equal(race.status,'finished');assert.equal(race.next,5);
  assert.ok(Math.abs(race.elapsed(100)-80)<1e-6);
  assert.equal(race.elapsed(100),race.elapsed(10000));assert.equal(race.target(point(4,0,100)),null);
});

test('a crash invalidates the attempt and restart clears timing and progress',()=>{
  const race=new BrnoRace();cross(race,0,0);race.fail();cross(race,1,20);assert.equal(race.next,1);assert.equal(race.status,'failed');
  race.reset();assert.equal(race.next,0);assert.equal(race.status,'ready');assert.equal(race.startedAt,null);assert.equal(race.previous,null);
  assert.equal(formatRaceTime(65.39),'01:05.3');assert.equal(formatRaceTime(null),'—');
});
