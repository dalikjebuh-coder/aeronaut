import test from 'node:test';
import assert from 'node:assert/strict';
import {projectShadowPoint,shadowAppearance} from '../src/aircraft-shadow.js';
const level={heading:0,pitch:0,roll:0};
const close=(actual,expected)=>actual.forEach((v,i)=>assert(Math.abs(v-expected[i])<1e-9,`${actual} ≠ ${expected}`));

test('the shadow falls away from light and follows aircraft heading',()=>{
  close(projectShadowPoint([3,5],level,{x:0,y:0,z:1},10),[3,5]);
  close(projectShadowPoint([0,0],level,{x:.6,y:0,z:.8},20),[-15,0]);
  close(projectShadowPoint([0,5],{...level,heading:Math.PI/2},{x:0,y:0,z:1},10),[5,0]);
});

test('bank and pitch project different silhouettes, including wing height',()=>{
  close(projectShadowPoint([4,0],{...level,roll:Math.PI/3},{x:0,y:0,z:1},20),[2,0]);
  close(projectShadowPoint([0,4],{...level,pitch:Math.PI/3},{x:0,y:0,z:1},20),[0,2]);
  const sun={x:.6,y:0,z:.8};
  const tip=projectShadowPoint([4,0],{...level,roll:Math.PI/2},sun,20);
  close(tip,[-12,0]);
});

test('contact is distinct, altitude softens and fades, and unlit scenes have no shadow',()=>{
  for(const radius of [7.4,11.3,44,12]){
    const contact=shadowAppearance(0,radius),low=shadowAppearance(50,radius),high=shadowAppearance(500,radius);
    assert(contact.alpha>low.alpha&&low.alpha>high.alpha);
    assert(contact.blur<low.blur&&low.blur<=high.blur);
    assert.equal(shadowAppearance(1000,radius).alpha,0);
    assert.equal(shadowAppearance(0,radius,0).alpha,0);
    assert.deepEqual(shadowAppearance(-5,radius),contact);
  }
});

test('low light and steep banks remain finite',()=>{
  for(const roll of [Math.PI/2,Math.PI,-Math.PI/2]){
    const point=projectShadowPoint([12,8],{heading:2,pitch:.5,roll},{x:1,y:0,z:0},10);
    assert(point.every(Number.isFinite));
  }
});

test('Cesium shadow updates with solar light, tolerates missing surface tiles, and cleans up',async()=>{
  const {createRequire}=await import('node:module');
  const C=createRequire(import.meta.url)('../node_modules/cesium/Build/CesiumUnminified/index.cjs');
  const {createAircraftShadow}=await import('../src/aircraft-shadow.js');
  const previousWindow=globalThis.window,previousDocument=globalThis.document;
  // Keep the real Cesium geometry; the unloaded ICRF table uses the same
  // TEME fallback as a newly opened browser, without fetching astronomy data.
  globalThis.window={Cesium:{...C,Transforms:{...C.Transforms,computeIcrfToFixedMatrix:()=>undefined}}};
  globalThis.document={createElement:()=>({getContext:()=>({translate(){},scale(){},beginPath(){},lineTo(){},moveTo(){},closePath(){},fill(){}})})};
  try{
    const source=new C.CustomDataSource();
    const viewer={clock:{currentTime:C.JulianDate.fromIso8601('2026-09-22T10:00:00Z')},scene:{light:new C.SunLight({intensity:2}),preUpdate:new C.Event()}};
    const state={...level,lon:14.4378,lat:50.0755,altitude:13};
    let samples=0;
    const shadow=createAircraftShadow(viewer,source,()=>state,()=>10,()=>{samples++;return undefined;});
    source.show=true;viewer.scene.preUpdate.raiseEvent();
    const entity=source.entities.values[0],time=viewer.clock.currentTime;
    assert.equal(entity.show.getValue(time),true);
    assert.equal(samples,4);
    const points=entity.polygon.hierarchy.getValue(time).positions;
    assert.equal(points.length,4);
    for(const point of points)assert(Math.abs(C.Cartographic.fromCartesian(point).height-10.18)<.01);
    assert(entity.polygon.material.getValue(time).color.alpha>0);
    shadow.setModel('airliner',5);viewer.scene.preUpdate.raiseEvent();
    const wide=entity.polygon.hierarchy.getValue(time).positions;
    assert(C.Cartesian3.distance(wide[0],wide[1])>100);
    state.altitude=1200;viewer.scene.preUpdate.raiseEvent();
    assert.equal(entity.show.getValue(time),false);
    shadow.destroy();shadow.destroy();
    assert.equal(source.entities.values.length,0);
    assert.equal(viewer.scene.preUpdate.numberOfListeners,0);
  }finally{
    globalThis.window=previousWindow;globalThis.document=previousDocument;
  }
});
