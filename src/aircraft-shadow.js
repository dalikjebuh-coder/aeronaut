import {clamp,EARTH,RAD} from './flight.js';

// Right-hand half of each planform, in metres: right, forward.
const PLANFORMS={
  highWing:{radius:7.4,outline:[[0,4.5],[.45,4],[.65,.7],[5.45,.2],[5.45,-.65],[.6,-.5],[.3,-3],[1.9,-3.5],[1.9,-4],[0,-3.9]]},
  lowWing:{radius:11.3,outline:[[0,7],[.65,5.5],[.8,-1.5],[7.38,-4.2],[7.38,-5.2],[.7,-3.5],[.45,-6.8],[2.8,-7.7],[2.8,-8.5],[0,-8.1]]},
  airliner:{radius:44,outline:[[0,31],[2,28],[2.8,20],[2.8,1],[29.6,-11.95],[29.6,-14.2],[3,-5],[2,-23],[10,-29],[10,-31],[0,-29.8]]},
  fighter:{radius:12,outline:[[0,7.2],[.55,4],[1,0],[2.3,-1],[6.6,-5.1],[6.6,-6.3],[2,-5],[1.5,-7.5],[3.8,-9],[3.8,-10],[0,-9.5]]}
};

export function shadowAppearance(height,radius,light=1){
  const h=Math.max(0,height),fade=1-clamp((h-350)/650,0,1);
  return {alpha:.43*Math.exp(-h/(radius*22+65))*fade*clamp(light,0,1),blur:clamp(.45+h/radius*.32,.45,18)};
}

// Project a body point along incoming light onto the local ground plane.
export function projectShadowPoint(point,state,sun,height){
  const [x,y,z=0]=point,r=state.roll,p=state.pitch,h=state.heading;
  const right=x*Math.cos(r)+z*Math.sin(r),up=-x*Math.sin(r)+z*Math.cos(r);
  const forward=y*Math.cos(p)-up*Math.sin(p),vertical=y*Math.sin(p)+up*Math.cos(p);
  const east=right*Math.cos(h)+forward*Math.sin(h),north=-right*Math.sin(h)+forward*Math.cos(h);
  const distance=Math.max(0,height+vertical)/Math.max(.12,sun.z);
  return [east-sun.x*distance,north-sun.y*distance];
}

function silhouetteTexture(kind,blur){
  const shape=PLANFORMS[kind],canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d'),pixels=256/(shape.radius*3);
  // Padding keeps even the softest penumbra clear of the texture border.
  ctx.translate(128,128);ctx.scale(pixels,-pixels);
  ctx.filter=`blur(${blur}px)`;ctx.fillStyle='#111923';ctx.beginPath();
  const outline=[...shape.outline,...shape.outline.slice(1,-1).reverse().map(([x,y])=>[-x,y])];
  outline.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();
  return canvas;
}

export function createAircraftShadow(viewer,source,getState,getSurfaceHeight,sampleSurface){
  const C=window.Cesium,textures=new Map();
  let kind='highWing',offset=-3,frame=null,lastSurfaceTime=-Infinity,ground=0,cornerHeights=[],destroyed=false;
  const texture=(blur)=>{
    const step=Math.round(blur),key=`${kind}:${step}`;
    if(!textures.has(key))textures.set(key,silhouetteTexture(kind,Math.max(.45,step)));
    return textures.get(key);
  };
  const hierarchy=new C.CallbackProperty(()=>frame?.hierarchy,false);
  const material=new C.ImageMaterialProperty({image:new C.CallbackProperty(()=>frame?.texture,false),transparent:true,color:new C.CallbackProperty(()=>C.Color.WHITE.withAlpha(frame?.alpha||0),false)});
  const entity=source.entities.add({show:new C.CallbackProperty(()=>Boolean(frame&&frame.alpha>.003),false),polygon:{hierarchy,textureCoordinates:new C.PolygonHierarchy([new C.Cartesian2(0,0),new C.Cartesian2(1,0),new C.Cartesian2(1,1),new C.Cartesian2(0,1)]),perPositionHeight:true,material,outline:false,shadows:C.ShadowMode.DISABLED}});
  const removeUpdate=viewer.scene.preUpdate.addEventListener(()=>{
    if(destroyed||!source.show)return;
    const state=getState(),shape=PLANFORMS[kind];
    const sampled=getSurfaceHeight();if(Number.isFinite(sampled))ground=sampled;
    const origin=C.Cartesian3.fromDegrees(state.lon,state.lat),enu=C.Transforms.eastNorthUpToFixedFrame(origin);
    const inverse=C.Matrix4.inverseTransformation(enu,new C.Matrix4());
    let direction=viewer.scene.light?.direction;
    if(direction)direction=C.Cartesian3.negate(direction,new C.Cartesian3());
    else{
      const sun=C.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(viewer.clock.currentTime);
      const rotation=C.Transforms.computeIcrfToFixedMatrix(viewer.clock.currentTime)||C.Transforms.computeTemeToPseudoFixedMatrix(viewer.clock.currentTime);
      direction=C.Matrix3.multiplyByVector(rotation,sun,new C.Cartesian3());
    }
    const localSun=C.Cartesian3.normalize(C.Matrix4.multiplyByPointAsVector(inverse,direction,new C.Cartesian3()),new C.Cartesian3());
    const daylight=clamp((localSun.z-.025)/.18,0,1),intensity=clamp((viewer.scene.light?.intensity??1)/2,0,1);
    const appearance=shadowAppearance(state.altitude-ground,shape.radius,daylight*intensity);
    if(appearance.alpha<.003){frame=null;return;}
    const extent=shape.radius*1.5,height=Math.max(0,state.altitude+offset-ground);
    const corners=[[-extent,-extent],[extent,-extent],[extent,extent],[-extent,extent]].map(point=>projectShadowPoint(point,state,localSun,height));
    const now=performance.now();
    if(now-lastSurfaceTime>120||!frame){
      // Sample at the displaced footprint too, so slopes and roofs do not use
      // the elevation directly beneath the aircraft. Ignore unavailable tiles.
      cornerHeights=corners.map(([east,north])=>{
        const lat=state.lat+north/EARTH/RAD,lon=state.lon+east/EARTH/Math.cos(state.lat*RAD)/RAD;
        const value=sampleSurface?.(lat,lon);return Number.isFinite(value)?value:ground;
      });lastSurfaceTime=now;
    }
    frame={alpha:appearance.alpha,texture:texture(appearance.blur),hierarchy:new C.PolygonHierarchy(corners.map(([east,north],index)=>C.Matrix4.multiplyByPoint(enu,new C.Cartesian3(east,north,cornerHeights[index]+.18),new C.Cartesian3())))};
  });
  return {
    setModel(value,modelOffset){kind=Object.hasOwn(PLANFORMS,value)?value:'highWing';offset=modelOffset;frame=null;lastSurfaceTime=-Infinity;},
    destroy(){if(destroyed)return;destroyed=true;removeUpdate();source.entities.remove(entity);textures.clear();}
  };
}
