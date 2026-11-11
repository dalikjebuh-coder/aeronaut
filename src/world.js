import {RAD,EARTH,offsetMeters,clamp} from './flight.js';
import {createAircraftEffects} from './aircraft-effects.js';
import {createAircraftShadow} from './aircraft-shadow.js';
const C=window.Cesium;
export const DEMO_ORIGIN={lat:50.0755,lon:14.4378};
export function localPosition(x,y,z=0,origin=DEMO_ORIGIN){return C.Cartesian3.fromDegrees(origin.lon+x/EARTH/Math.cos(origin.lat*RAD)/RAD,origin.lat+y/EARTH/RAD,z);}
export function demoHeight(lat,lon){
  const {x,y}=offsetMeters(lat,lon,DEMO_ORIGIN);
  const hill=(hx,hy,w,h)=>h*Math.exp(-((x-hx)**2+(y-hy)**2)/(w*w));
  return hill(-7800,6000,2400,1300)+hill(6000,7600,2200,1750)+hill(9000,-3000,2600,1050)+hill(-7000,-6000,2100,900);
}
export function createDemo(viewer){
  const scheme=new C.GeographicTilingScheme();
  const terrain=new C.CustomHeightmapTerrainProvider({width:32,height:32,tilingScheme:scheme,callback(x,y,level){
    const r=scheme.tileXYToRectangle(x,y,level),values=new Float32Array(1024);
    for(let j=0;j<32;j++)for(let i=0;i<32;i++) values[j*32+i]=demoHeight((r.north+(r.south-r.north)*j/31)/RAD,(r.west+(r.east-r.west)*i/31)/RAD);
    return values;
  }});
  const source=new C.CustomDataSource('Synthetic training landscape');
  viewer.dataSources.add(source);
  const entities=source.entities;
  function polygon(points,color,height=1){return entities.add({polygon:{hierarchy:points.map(p=>localPosition(p[0],p[1],height)),perPositionHeight:true,material:C.Color.fromCssColorString(color)}});}
  function road(points,width,color='#7a8475'){
    entities.add({corridor:{positions:points.map(p=>localPosition(p[0],p[1])),width,height:1.8,material:C.Color.fromCssColorString(color),cornerType:C.CornerType.ROUNDED}});
  }
  // Fields and urban blocks are original procedural geometry, not downloaded map data.
  for(let x=-5;x<6;x++)for(let y=-5;y<6;y++){
    const colors=['#819565','#93a16c','#a2a57a','#748b60','#879b70'];
    const px=x*720,py=y*720;
    polygon([[px+14,py+14],[px+700,py+14],[px+700,py+700],[px+14,py+700]],colors[((x*x+y*y*3)%5)],0.6);
  }
  const river=[];
  for(let y=-6500;y<=6500;y+=180) river.push([-1500+Math.sin(y/1500)*500,y]);
  road(river,220,'#618e94');
  const cityX=600,cityY=1800;
  for(let n=-4;n<=4;n++){
    road([[cityX-1350,cityY+n*290],[cityX+1350,cityY+n*290]],25);
    road([[cityX+n*290,cityY-1350],[cityX+n*290,cityY+1350]],25);
  }
  let seed=37;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  const footprints=[];
  for(let x=-4;x<4;x++)for(let y=-4;y<4;y++){
    if(x===0&&y===0) continue;
    for(let n=0;n<4;n++){
      const px=cityX+x*290+70+(n%2)*130,py=cityY+y*290+70+Math.floor(n/2)*130;
      const height=14+random()*65+(Math.abs(x)+Math.abs(y)<3?random()*90:0),width=45+random()*40,depth=45+random()*45;
      const lat=DEMO_ORIGIN.lat+py/EARTH/RAD,lon=DEMO_ORIGIN.lon+px/EARTH/Math.cos(DEMO_ORIGIN.lat*RAD)/RAD;
      const ground=demoHeight(lat,lon);
      entities.add({position:localPosition(px,py,ground+height/2),box:{dimensions:new C.Cartesian3(width,depth,height),material:C.Color.fromCssColorString(['#d2cfb9','#ddd9c7','#bfc3b1','#bdbaa6'][n]),outline:false}});
      footprints.push({x:px,y:py,width,depth,top:ground+height});
    }
  }
  polygon([[cityX+20,cityY+20],[cityX+270,cityY+20],[cityX+270,cityY+270],[cityX+20,cityY+270]],'#5f855b',2);
  for(let n=0;n<110;n++){
    const x=-1270+Math.sin(n/10)*490+random()*130,y=-4200+n*85;
    entities.add({position:localPosition(x,y,12),ellipsoid:{radii:new C.Cartesian3(14,14,23+random()*8),material:C.Color.fromCssColorString(n%2?'#456d51':'#557c56')}});
  }
  road([[-3600,-1900],[2500,-1900]],22,'#999b88');
  road([[cityX,-2200],[cityX,3400]],32,'#919786');
  polygon([[-700,-2200],[-620,-2200],[-620,-650],[-700,-650]],'#505b54',3);
  for(let y=-2150;y<-700;y+=130) polygon([[-665,y],[-655,y],[-655,y+60],[-665,y+60]],'#e8e8ce',3.2);
  for(let i=0;i<8;i++) polygon([[-694+i*9,-2150],[-690+i*9,-2150],[-690+i*9,-2090],[-694+i*9,-2090]],'#e8e8ce',3.2);
  const boundary=entities.add({position:localPosition(0,0,20),ellipse:{semiMajorAxis:5000,semiMinorAxis:5000,fill:false,outline:true,outlineColor:C.Color.fromCssColorString('#dcf4a3').withAlpha(.45),height:20}});
  return {source,terrain,boundary,surface(lat,lon){const{x,y}=offsetMeters(lat,lon,DEMO_ORIGIN);let h=demoHeight(lat,lon);for(const b of footprints)if(Math.abs(x-b.x)<b.width/2+5&&Math.abs(y-b.y)<b.depth/2+5)h=Math.max(h,b.top);return h;}};
}
export function createAircraft(viewer,getState,getSurfaceHeight=()=>0,sampleSurface){
  const source=new C.CustomDataSource('Aircraft');viewer.dataSources.add(source);
  function basis(){
    const s=getState(),h=s.heading,p=s.pitch,r=s.roll;
    const origin=C.Cartesian3.fromDegrees(s.lon,s.lat,s.altitude),enu=C.Transforms.eastNorthUpToFixedFrame(origin);
    const convert=(x,y,z)=>{
      const xr=x*Math.cos(r)+z*Math.sin(r),zr=-x*Math.sin(r)+z*Math.cos(r);
      const yp=y*Math.cos(p)-zr*Math.sin(p),zp=y*Math.sin(p)+zr*Math.cos(p);
      return new C.Cartesian3(xr*Math.cos(h)+yp*Math.sin(h),-xr*Math.sin(h)+yp*Math.cos(h),zp);
    };
    return {enu,convert};
  }
  function position(offset){return new C.CallbackProperty(()=>{const{enu,convert}=basis();return C.Matrix4.multiplyByPoint(enu,convert(...(typeof offset==='function'?offset():offset)),new C.Cartesian3());},false);}
  const orientation=new C.CallbackProperty(()=>{
    // Cesium normalizes glTF axes to +X forward, +Y right and +Z up.
    // The simulator uses +Y forward, +X right and +Z up.
    const{enu,convert}=basis();const matrix=new C.Matrix3();C.Matrix3.setColumn(matrix,0,convert(0,1,0),matrix);C.Matrix3.setColumn(matrix,1,convert(-1,0,0),matrix);C.Matrix3.setColumn(matrix,2,convert(0,0,1),matrix);
    const global=C.Matrix4.getMatrix3(enu,new C.Matrix3());C.Matrix3.multiply(global,matrix,matrix);return C.Quaternion.fromRotationMatrix(matrix);
  },false);
  let modelOffset=-3;
  const shadow=createAircraftShadow(viewer,source,getState,getSurfaceHeight,sampleSurface);
  const modelEntity=source.entities.add({position:position(()=>[0,0,modelOffset]),orientation,model:{uri:'/models/high-wing-single.glb',scale:1,minimumPixelSize:72,maximumScale:2,runAnimations:false,shadows:C.ShadowMode.ENABLED}});
  const models={
    highWing:{uri:'/models/high-wing-single.glb',offset:-3,chase:48,roof:{forward:.65,height:2.8}},
    lowWing:{uri:'/models/citation2.glb',offset:0,chase:50,roof:{forward:1.2,height:2.3}},
    airliner:{uri:'/models/b789.glb',offset:5,chase:105,roof:{forward:18,height:2.5}},
    fighter:{uri:'/models/fa18e.glb',offset:0,chase:65,roof:{forward:1.3,height:2.4}}
  };
  const effects=createAircraftEffects(viewer,getState,radius=>{
    const{enu,convert}=basis();
    const center=C.Matrix4.getTranslation(enu,new C.Cartesian3());
    const metersPerPixel=viewer.camera.getPixelSize(new C.BoundingSphere(center,radius),Math.max(1,viewer.canvas.width),Math.max(1,viewer.canvas.height));
    const scale=clamp(72*metersPerPixel/(radius*2),1,2);
    return{
      point:([x,y,z])=>C.Matrix4.multiplyByPoint(enu,convert(x*scale,y*scale,z*scale+modelOffset),new C.Cartesian3()),
      right:C.Matrix4.multiplyByPointAsVector(enu,convert(1,0,0),new C.Cartesian3()),
      up:C.Matrix4.multiplyByPointAsVector(enu,convert(0,0,1),new C.Cartesian3()),
      scale,metersPerPixel
    };
  },()=>source.show);
  let selectedModel='highWing';
  source.roofCameraView=()=>{
    const {enu,convert}=basis();
    const {forward,height}=models[selectedModel].roof;
    const downAngle=19*RAD;
    const direction=convert(0,Math.cos(downAngle),-Math.sin(downAngle));
    const up=convert(0,Math.sin(downAngle),Math.cos(downAngle));
    return {
      destination:C.Matrix4.multiplyByPoint(enu,convert(0,forward,modelOffset+height),new C.Cartesian3()),
      orientation:{
        direction:C.Matrix4.multiplyByPointAsVector(enu,direction,new C.Cartesian3()),
        up:C.Matrix4.multiplyByPointAsVector(enu,up,new C.Cartesian3())
      }
    };
  };
  const propellerRotation=new C.CallbackProperty(()=>C.Quaternion.fromAxisAngle(C.Cartesian3.UNIT_Z,effects.propellerAngle),false);
  source.entities.add({
    show:new C.CallbackProperty(()=>selectedModel==='highWing',false),
    position:position(()=>[0,4.4*effects.visualScale,modelOffset+1.2*effects.visualScale]),orientation,
    plane:{plane:new C.Plane(C.Cartesian3.UNIT_X,0),dimensions:new C.CallbackProperty(()=>new C.Cartesian2(1.8*effects.visualScale,1.8*effects.visualScale),false),material:new C.ImageMaterialProperty({image:effects.propellerTexture,transparent:true,color:C.Color.WHITE.withAlpha(.65)})}
  });
  source.selectModel=kind=>{
    selectedModel=Object.hasOwn(models,kind)?kind:'highWing';effects.setModel(selectedModel);
    const selected=models[selectedModel];
    modelEntity.model.uri=selected.uri;
    modelEntity.model.nodeTransformations=selectedModel==='highWing'?{prop:new C.NodeTransformationProperty({rotation:propellerRotation})}:undefined;
    modelOffset=selected.offset;shadow.setModel(selectedModel,modelOffset);source.chaseDistance=selected.chase;
  };
  source.resetEffects=()=>effects.reset();source.destroy=()=>{effects.destroy();shadow.destroy();};
  source.surfacePrimitives=effects.surfacePrimitives;
  source.show=false;return source;
}
