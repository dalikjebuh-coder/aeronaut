import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';

const C=createRequire(import.meta.url)('../node_modules/cesium/Build/CesiumUnminified/index.cjs');
const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
function environment(sun){
  const controls={timeOfDay:{value:'day'},weather:{value:'clear'}};
  const scene={sun,globe:{},fog:{},atmosphere:{},skyAtmosphere:{},requestRender(){}};
  const sandbox={C,viewer:{clock:new C.Clock(),scene},daylightTint:{uniforms:{}},$:id=>controls[id],running:false,selection:()=>({lat:49.2,lon:16.6}),Date};
  vm.createContext(sandbox);
  vm.runInContext(source.slice(source.indexOf('const DAYLIGHT_PRESETS='),source.indexOf('function readSavedToken'))+source.slice(source.indexOf('function applyTimeOfDay('),source.indexOf('function selection(')),sandbox);
  return {controls,scene,apply:sandbox.applyTimeOfDay};
}

test('environment initializes without a Sun primitive, as with Viewer skyBox:false',()=>{
  assert.match(source,/skyBox:false/);
  const {controls,scene,apply}=environment(undefined);
  for(const time of ['morning','day','evening','night']){
    controls.timeOfDay.value=time;
    for(const weather of ['clear','haze','overcast']){
      controls.weather.value=weather;
      assert.doesNotThrow(()=>apply(),`${time}/${weather}`);
      assert.ok(scene.light instanceof (time==='night'?C.DirectionalLight:C.SunLight));
    }
  }
  controls.timeOfDay.value='day';controls.weather.value='clear';apply();
  assert.equal(scene.fog.density,.00012);
  assert.equal(scene.skyAtmosphere.saturationShift,0);
});

test('an existing Sun primitive is hidden for overcast and restored for clear skies',()=>{
  const {controls,scene,apply}=environment({show:true});
  controls.weather.value='overcast';apply();assert.equal(scene.sun.show,false);
  controls.weather.value='clear';apply();assert.equal(scene.sun.show,true);
});
