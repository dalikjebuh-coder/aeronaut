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
  const sandbox={C,viewer:{clock:new C.Clock(),scene},weatherEffects:{setConditions(){}},daylightTint:{uniforms:{}},$:id=>controls[id],running:false,selection:()=>({lat:49.2,lon:16.6}),Date};
  vm.createContext(sandbox);
  vm.runInContext(source.slice(source.indexOf('const DAYLIGHT_PRESETS='),source.indexOf('function readSavedToken'))+source.slice(source.indexOf('function applyTimeOfDay('),source.indexOf('function selection(')),sandbox);
  return {controls,scene,clock:sandbox.viewer.clock,tint:sandbox.daylightTint,apply:sandbox.applyTimeOfDay};
}

test('environment initializes without a Sun primitive, as with Viewer skyBox:false',()=>{
  assert.match(source,/skyBox:false/);
  const {controls,scene,apply}=environment(undefined);
  for(const time of ['morning','day','evening','night']){
    controls.timeOfDay.value=time;
    for(const weather of ['clear','partly','haze','overcast']){
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

test('the Sun is explicitly created and stays hidden at night',()=>{
  assert.match(source,/viewer.scene.sun=new C.Sun\(\)/);
  const {controls,scene,apply}=environment({show:true});
  controls.timeOfDay.value='night';apply();assert.equal(scene.sun.show,false);
  controls.timeOfDay.value='morning';apply();assert.equal(scene.sun.show,true);
});

test('morning and evening keep the Sun low above the horizon',()=>{
  const {controls,clock,tint,apply}=environment({show:true});
  for(const place of [{lat:49.2,lon:16.6},{lat:0,lon:100},{lat:-40,lon:-70}]){
    const up=C.Ellipsoid.WGS84.geodeticSurfaceNormalCartographic(C.Cartographic.fromDegrees(place.lon,place.lat));
    for(const time of ['morning','evening']){
      controls.timeOfDay.value=time;
      apply(place);
      const date=clock.currentTime;
      const sun=C.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(date);
      const fixed=C.Matrix3.multiplyByVector(C.Transforms.computeTemeToPseudoFixedMatrix(date),sun,new C.Cartesian3());
      const elevation=Math.asin(C.Cartesian3.dot(C.Cartesian3.normalize(fixed,fixed),up))*180/Math.PI;
      assert(elevation>0&&elevation<11,`${time} elevation ${elevation}`);
      assert.equal(tint.uniforms.sunset,time==='evening'?1:0);
    }
  }
});
