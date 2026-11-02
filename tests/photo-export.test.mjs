import test from 'node:test';
import assert from 'node:assert/strict';
import {captureScenePhoto,wrapPhotoText,photoFilename} from '../src/photo-export.js';

function fixture({encodingFails=false}={}){
  const previousDocument=globalThis.document,previousImage=globalThis.Image;
  const scene={width:800,height:600,readable:false};
  const canvases=[];
  const oldCredit={textContent:'Old viewport',querySelectorAll:()=>[]};
  const currentCredit={textContent:'© Google · Current tile provider',querySelectorAll:()=>[{src:'/ion.png',title:'Cesium ion'},{src:'/failed-logo.png',title:'Another provider'}]};
  let current=oldCredit;
  class Canvas{
    width=0;height=0;draws=[];texts=[];
    context={
      measureText:text=>({width:[...text].length*6}),
      drawImage:(source,...dimensions)=>{
        if(source===scene)assert(scene.readable,'WebGL must be copied before the buffer is discarded');
        this.draws.push({source,dimensions});
      },
      fillRect(){},fillText:text=>this.texts.push(text)
    };
    getContext(){return this.context;}
    toBlob(callback,type){queueMicrotask(()=>callback(encodingFails?null:new Blob(['encoded image'],{type})));}
  }
  globalThis.document={createElement(tag){assert.equal(tag,'canvas');const canvas=new Canvas();canvases.push(canvas);return canvas;}};
  globalThis.Image=class{
    naturalWidth=80;naturalHeight=18;
    set src(value){queueMicrotask(()=>{scene.readable=false;if(value.includes('failed'))this.onerror?.();else this.onload?.();});}
  };
  return{
    viewer:{scene:{canvas:scene,requestRender(){}},render(){scene.readable=true;current=currentCredit;},cesiumWidget:{creditDisplay:{container:{querySelectorAll:()=>[current]}}}},
    canvases,scene,
    restore(){globalThis.document=previousDocument;globalThis.Image=previousImage;}
  };
}

test('photo copies the live frame before async work and retains current-view attribution',async()=>{
  const f=fixture();
  try{
    const result=await captureScenePhoto(f.viewer,{google:true,cityLabels:true,model:'fighter'});
    assert.equal(result.blob.type,'image/png');
    assert.equal(result.width,800);assert(result.height>600);
    assert.equal(f.canvases[0].draws[0].source,f.scene);
    assert.equal(f.canvases[1].draws[0].source,f.canvases[0]);
    const text=f.canvases[1].texts.join(' ');
    for(const required of ['Google Maps','Current tile provider','Another provider','GeoNames','andertan','CC BY 4.0'])assert(text.includes(required),required);
    assert(!text.includes('Old viewport'));
  }finally{f.restore();}
});

test('hidden photo overlays do not add aircraft or city credits; encoder failures reject',async()=>{
  const f=fixture();
  try{
    await captureScenePhoto(f.viewer,{showAircraft:false,cityLabels:false});
    const text=f.canvases[1].texts.join(' ');
    assert(text.includes('Tréninková krajina'));
    assert(!text.includes('Letadlo:')&&!text.includes('GeoNames'));
  }finally{f.restore();}
  const failed=fixture({encodingFails:true});
  try{await assert.rejects(captureScenePhoto(failed.viewer),/PNG export failed/);}
  finally{failed.restore();}
});

test('long source strings fit the photo footer without dropping attribution',()=>{
  const context={measureText:text=>({width:[...text].length*6})};
  const text='Google Maps · ProviderWithAnExceptionallyLongUnbrokenName © 2026';
  const lines=wrapPhotoText(context,text,90);
  assert(lines.every(line=>context.measureText(line).width<=90));
  assert.equal(lines.join('').replace(/\s/g,''),text.replace(/\s/g,''));
  assert.equal(photoFilename(new Date(2026,9,15,13,5,9)),'aeronaut-2026-10-15_13-05-09.png');
});
