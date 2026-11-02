import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {landingApproachMessage} from '../src/task-missions.js';
import {AIRCRAFT_PROFILES} from '../src/flight.js';
import {getMission} from '../src/missions.js';

test('landing instructions use the selected aircraft limits and mission heading tolerance',()=>{
  for(const [model,profile] of Object.entries(AIRCRAFT_PROFILES))for(const level of ['easy','normal','hard']){
    const route=getMission('brno-landing',level).route,message=landingApproachMessage(route,model);
    assert.ok(message.includes(`${Math.round(profile.landingMin*3.6)}–${Math.round(profile.landingMax*3.6)} km/h`));
    assert.ok(message.includes(`${profile.landingSink} m/s`));
    assert.ok(message.includes(`±${route.objective.headingTolerance}°`));
    assert.match(message,/098°/);assert.match(message,/žlutém obdélníku/);
    assert.match(message,/křídla rovně/);assert.match(message,/S uber výkon/);
  }
});

test('final approach guidance stays visible, returns after temporary notices and clears on completion',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8'),element={hidden:true,dataset:{}};
  let timers=0;
  const context=vm.createContext({$:()=>element,landingApproachMessage,isRace:()=>true,
    performance:{now:()=>100},clearTimeout(){},setTimeout:()=>++timers,route:getMission('brno-landing').route});
  vm.runInContext(`let running=true,crashed=false,noticeTimer,noticeLock;const state={model:'highWing',onGround:false},race={route,status:'landing'};`+
    app.slice(app.indexOf('function notice('),app.indexOf('function withTimeout('))+
    app.slice(app.indexOf('function updateLandingNotice(){'),app.indexOf('function updateRace(){')),context);
  vm.runInContext('updateLandingNotice()',context);
  assert.equal(element.hidden,false);assert.equal(element.dataset.landing,'true');assert.equal(timers,0);
  vm.runInContext("notice('Kamera: Shora',1500);updateLandingNotice()",context);
  assert.equal(element.textContent,'Kamera: Shora');assert.equal(timers,1);
  element.hidden=true;vm.runInContext('updateLandingNotice()',context);
  assert.match(element.textContent,/85–140 km\/h/);assert.equal(element.hidden,false);
  vm.runInContext("race.status='finished';updateLandingNotice()",context);
  assert.equal(element.hidden,true);
  vm.runInContext("notice('Mise dokončena!',10000);updateLandingNotice()",context);
  assert.equal(element.hidden,false);assert.equal(element.textContent,'Mise dokončena!');
});
