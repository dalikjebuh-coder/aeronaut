import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MISSIONS,getMission} from '../src/missions.js';
import {offsetMeters} from '../src/flight.js';
import {missionMapLayout,renderMissionMap} from '../src/mission-map.js';

test('every mission variant fits all geographic points and nonoverlapping labels in the map',()=>{
  for(const base of MISSIONS)for(const level of ['easy','normal','hard']){
    const mission=getMission(base.id,level),{nodes,labels}=missionMapLayout(mission.route),svg=renderMissionMap(mission);
    assert.equal(nodes.length,mission.route.gates.length);
    assert.equal((svg.match(/data-map-point=/g)||[]).length,nodes.length);
    assert.ok(!/NaN|Infinity|https?:|<image/.test(svg));
    for(const point of nodes)assert.ok(point.x>20&&point.x<580&&point.y>40&&point.y<310);
    for(const [index,box] of labels.entries()){
      assert.ok(box.x>=0&&box.x+box.width<=600&&box.y>=0&&box.y+box.height<=310);
      for(const other of labels.slice(index+1))assert.ok(!(box.x<other.x+other.width&&box.x+box.width>other.x&&box.y<other.y+other.height&&box.y+box.height>other.y),`${mission.id}/${level}: overlapping labels`);
    }
  }
});

test('projection keeps north up and uses one metric scale for both axes',()=>{
  const route={gates:[{lat:49,lon:16,name:'Start'},{lat:49.01,lon:16,name:'North'},{lat:49,lon:16.01,name:'East'}]};
  const {nodes,scale}=missionMapLayout(route),north=offsetMeters(49.01,16,route.gates[0]),east=offsetMeters(49,16.01,route.gates[0]);
  assert.ok(nodes[1].y<nodes[0].y&&nodes[2].x>nodes[0].x);
  assert.ok(Math.abs((nodes[0].y-nodes[1].y)/north.y-scale)<1e-9);
  assert.ok(Math.abs((nodes[2].x-nodes[0].x)/east.x-scale)<1e-9);
});

test('map distinguishes discovery, gate crossings, low flight and the landing zone',()=>{
  assert.match(renderMissionMap(getMission('brno-discovery')),/OBJEV PAMÁTKU/);
  assert.match(renderMissionMap(getMission('brno')),/PROLEŤ BRÁNOU/);
  assert.match(renderMissionMap(getMission('brno-landing')),/PŘISTAŇ/);
  assert.match(renderMissionMap(getMission('brno-landing')),/map-runway/);
  assert.match(renderMissionMap(getMission('canyon-patrol')),/90–260 m/);
  assert.notEqual(renderMissionMap(getMission('brno')),renderMissionMap(getMission('brno-discovery')));
});

test('flight plan is open by default and mission labels are escaped in the map',()=>{
  const html=fs.readFileSync(new URL('../src/index.html',import.meta.url),'utf8');
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  assert.match(html,/<details id="missionMore" class="horizon-mission-more" open>/);
  assert.match(app,/function openMissionBriefing\(\)\s*\{[^}]*\$\('missionMore'\)\.open=true;/);
  assert.ok(html.indexOf('id="raceRouteMap"')>html.indexOf('id="missionMore"'));
  assert.ok(html.indexOf('id="missionBronzeTarget"')<html.indexOf('id="missionBronzeXp"'));
  const mission=getMission('brno');
  const svg=renderMissionMap({...mission,title:'<script>"',route:{...mission.route,gates:mission.route.gates.map(g=>({...g,name:'<script>"'}))}});
  assert.ok(!svg.includes('<script>'));
  assert.match(svg,/&lt;script&gt;&quot;/);
});
