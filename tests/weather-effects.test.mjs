import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {cloudLayout,createWeatherEffects} from '../src/weather-effects.js';
const C=createRequire(import.meta.url)('../node_modules/cesium/Build/CesiumUnminified/index.cjs');

test('cloud cover increases with weather and stays bounded around worldwide locations',()=>{
  for(const [lat,lon] of [[49,16],[0,179.99],[-40,-179.99],[80,20],[-80,-70]]){
    const partly=cloudLayout(lat,lon,'partly'),overcast=cloudLayout(lat,lon,'overcast');
    assert.equal(cloudLayout(lat,lon,'clear').length,0);
    assert(partly.length>0&&partly.length<overcast.length);
    assert(overcast.length<=729);
    assert.deepEqual(cloudLayout(lat,lon,'partly'),partly);
    for(const p of overcast){
      assert(p.lon>=-180&&p.lon<=180&&Math.abs(p.lat)<=90);
      assert(p.alpha>0&&p.alpha<=1&&p.altitude>=1900);
    }
  }
});

test('cloud field recycles, follows the camera, changes light and cleans up',()=>{
  globalThis.window={Cesium:C};
  let tick,removed=false,unsubscribed=false,volumesEnabled=false;
  const primitives=[];
  const viewer={camera:{positionCartographic:C.Cartographic.fromDegrees(16,49,800)},scene:{
    primitives:{add(c){primitives.push(c);return c;},remove(){removed=true;}},
    preUpdate:{addEventListener(fn){tick=fn;return()=>{unsubscribed=true;};}}
  }};
  const effect=createWeatherEffects(viewer,()=>volumesEnabled),clouds=primitives[0];
  try{
    effect.setConditions('partly','day');tick();
    const count=clouds.length;assert(count>0);assert.equal(clouds.get(0).color.red,1);
    effect.setConditions('overcast','night');tick();assert(clouds.length>count);
    const nightColor=clouds.get(0).color;
    assert(nightColor.red>=.4&&nightColor.blue>nightColor.red&&nightColor.blue<.75);
    const position=C.Cartesian3.clone(clouds.get(0).position);
    viewer.camera.positionWC=C.Cartesian3.fromDegrees(16,49,2800);
    volumesEnabled=true;tick();
    assert.equal(effect.volume.count,8);
    const volumeCloud=clouds.get(Array.from({length:clouds.length},(_,i)=>i).find(i=>!clouds.get(i).show));
    assert(volumeCloud);
    volumesEnabled=false;tick();
    assert.equal(effect.volume.count,0);
    assert.equal(volumeCloud.show,true);
    viewer.camera.positionCartographic=C.Cartographic.fromDegrees(-74,40,900);tick();
    assert(C.Cartesian3.distance(position,clouds.get(0).position)>1000000);
    effect.setConditions('clear','day');tick();assert.equal(clouds.show,false);
    effect.setConditions('partly','evening');tick();assert.equal(clouds.show,true);assert(clouds.get(0).color.red>clouds.get(0).color.blue);
    effect.destroy();effect.destroy();assert(removed&&unsubscribed);
  }finally{delete globalThis.window;clouds.destroy();}
});
