import {RAD,clamp,aircraftProfile} from './flight.js';

const smooth=(low,high,value)=>{const t=clamp((value-low)/(high-low),0,1);return t*t*(3-2*t);};

// Positions are metres in the simulator's body axes: right, forward, up.
// Measured from the bundled glTFs after their existing nose corrections.
export const EFFECT_ANCHORS={
  highWing:{radius:7.4,wings:[[-5.45,.15,2.2],[5.45,.15,2.2]],engines:[],tail:[0,-4.3,1.4],beacon:[0,.1,2.4],vaporWidth:.22},
  lowWing:{radius:11.3,wings:[[-7.38,-4.2,.18],[7.38,-4.2,.18]],engines:[[-1.55,-5,.25],[1.55,-5,.25]],tail:[0,-7.8,.1],beacon:[0,-.5,1.3],vaporWidth:.32},
  airliner:{radius:44,wings:[[-29.6,-11.95,-.8],[29.6,-11.95,-.8]],engines:[[-9.7,3.5,-5.8],[9.7,3.5,-5.8]],tail:[0,-30.8,-2.8],beacon:[0,1,-.5],vaporWidth:.65},
  fighter:{radius:12,wings:[[-6.6,-5.1,.3],[6.6,-5.1,.3]],engines:[[-.55,-9.65,.32],[.55,-9.65,.32]],tail:[0,-9.4,1],beacon:[0,-1,1.6],vaporWidth:.38}
};

export function aircraftEffectLevels(state){
  const profile=aircraftProfile(state.model),power=clamp(state.enginePower??state.throttle??0,0,1);
  const turnLoad=1/Math.max(.25,Math.cos(state.roll||0))-1;
  const pullLoad=Math.max(0,state.pitchVelocity||0)*state.speed/9.81;
  const vapor=state.onGround?0:smooth(.08,.95,turnLoad+pullLoad)*smooth(profile.stallSpeed*.8,profile.stallSpeed*1.4,state.speed);
  return{
    vapor,
    exhaust:state.model==='highWing'?0:smooth(.2,.9,power),
    afterburner:state.model==='fighter'?smooth(.88,1,power):0,
    contrail:state.onGround||state.model==='highWing'?0:smooth(6500,9500,state.altitude)*smooth(90,170,state.speed)*power,
    propellerRPM:state.model==='highWing'?650+power*1750:0
  };
}

export function aircraftLightLevels(time,timeOfDay='day',reducedMotion=false){
  const visibility=timeOfDay==='night'?1:timeOfDay==='evening'?0.55:timeOfDay==='morning'?0.2:0.12;
  const phase=time%1.25;
  return{
    visibility,
    strobe:reducedMotion?0.12:Number(phase<0.055||phase>0.14&&phase<0.19),
    beacon:reducedMotion?0.2:Math.pow(Math.max(0,Math.sin(time*Math.PI*2)),14)
  };
}

export class WakeHistory{
  constructor(lifetime=2.2,limit=64,interval=.045){this.lifetime=lifetime;this.limit=limit;this.interval=interval;this.reset();}
  reset(){this.samples=[];this.lastEmission=-Infinity;}
  trim(time){while(this.samples.length&&time-this.samples[0].time>this.lifetime)this.samples.shift();}
  emit(time,sample){
    this.trim(time);
    if(time-this.lastEmission<this.interval)return;
    this.samples.push({...sample,time});this.lastEmission=time;
    if(this.samples.length>this.limit)this.samples.splice(0,this.samples.length-this.limit);
  }
}

function glowTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const context=canvas.getContext('2d'),gradient=context.createRadialGradient(32,32,0,32,32,32);
  for(const [stop,alpha] of [[0,1],[.18,.9],[.45,.4],[.75,.07],[1,0]])gradient.addColorStop(stop,`rgba(255,255,255,${alpha})`);
  context.fillStyle=gradient;context.fillRect(0,0,64,64);return canvas;
}

function propellerTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const context=canvas.getContext('2d'),gradient=context.createRadialGradient(64,64,4,64,64,62);
  for(const [stop,alpha] of [[0,0],[.2,.03],[.4,.2],[.78,.13],[1,0]])gradient.addColorStop(stop,`rgba(205,215,225,${alpha})`);
  context.fillStyle=gradient;context.fillRect(0,0,128,128);return canvas;
}

function lightAnchors(anchors){
  const tipOffset=Math.max(.25,anchors.radius*.015),upOffset=Math.max(.3,anchors.radius*.01);
  const left=[anchors.wings[0][0]-tipOffset,anchors.wings[0][1],anchors.wings[0][2]+upOffset];
  const right=[anchors.wings[1][0]+tipOffset,anchors.wings[1][1],anchors.wings[1][2]+upOffset];
  return[left,right,[anchors.tail[0],anchors.tail[1],anchors.tail[2]+upOffset],left,right,[anchors.beacon[0],anchors.beacon[1],anchors.beacon[2]+upOffset]];
}

export function createAircraftEffects(viewer,getState,makeFrame,isVisible,getTimeOfDay=()=> 'day'){
  const C=window.Cesium;
  const ribbons=viewer.scene.primitives.add(new C.PolylineCollection());
  const sprites=viewer.scene.primitives.add(new C.BillboardCollection({scene:viewer.scene,blendOption:C.BlendOption.TRANSLUCENT}));
  const lightPointsCollection=viewer.scene.primitives.add(new C.PointPrimitiveCollection());
  const texture=glowTexture();
  let model='highWing',anchors=EFFECT_ANCHORS.highWing,lastTime=NaN,angle=0,visualScale=1,destroyed=false;
  const tracks=[];
  for(let index=0;index<4;index++){
    const long=index>=2;
    const material=C.Material.fromType('PolylineGlow',{color:new C.Color(.96,.98,1,0),glowPower:.18,taperPower:.35});
    tracks.push({long,history:new WakeHistory(long?8:2.2,long?128:64,long ? .065 : .045),line:ribbons.add({show:false,width:2,material,positions:[]}),lastDrawTime:NaN,lastScale:NaN});
  }
  const addSprite=()=>sprites.add({show:false,image:texture,sizeInMeters:true,width:1,height:1,color:C.Color.WHITE});
  const flames=Array.from({length:2},()=>Array.from({length:16},addSprite));
  const lights=Array.from({length:6},(_,index)=>{
    const flash=index===3||index===4;
    return lightPointsCollection.add({show:false,pixelSize:flash||index===5?5:4,color:C.Color.WHITE,outlineColor:C.Color.WHITE,outlineWidth:flash?5:3});
  });
  const lightColors=[new C.Color(1,.08,.04,1),new C.Color(.08,1,.25,1),C.Color.WHITE,C.Color.WHITE,C.Color.WHITE,new C.Color(1,.12,.03,1)];
  let lightPoints=lightAnchors(anchors);
  const reducedMotion=Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  function reset(){
    lastTime=NaN;angle=0;
    for(const track of tracks){track.history.reset();track.line.show=false;track.lastDrawTime=NaN;}
    for(const sprite of flames.flat())sprite.show=false;
    for(const light of lights)light.show=false;
  }
  function drawTrack(track,anchor,side,level,frame,state){
    const time=state.elapsed,history=track.history;
    if(time===track.lastDrawTime&&frame.scale===track.lastScale){
      const width=track.long?anchors.vaporWidth*2.2:anchors.vaporWidth;
      track.line.width=clamp(width*.75*frame.scale/Math.max(.01,frame.metersPerPixel),1,track.long?6:3);return;
    }
    track.lastDrawTime=time;track.lastScale=frame.scale;
    history.trim(time);
    if(anchor&&level>.025)history.emit(time,{point:frame.point(anchor),right:frame.right,up:frame.up,strength:level});
    const points=history.samples.map(sample=>{
      const age=time-sample.time;
      const lateral=side*(track.long ? .12 : .38)*age+Math.sin(age*7+sample.time*2)*age*.07;
      const down=track.long?-.16*age:-.11*age*age;
      const point=C.Cartesian3.clone(sample.point);
      C.Cartesian3.add(point,C.Cartesian3.multiplyByScalar(sample.right,lateral,new C.Cartesian3()),point);
      return C.Cartesian3.add(point,C.Cartesian3.multiplyByScalar(sample.up,down,new C.Cartesian3()),point);
    });
    if(anchor&&level>.025)points.push(frame.point(anchor));
    track.line.show=points.length>=2;
    if(!track.line.show)return;
    track.line.positions=points;
    const newest=history.samples.at(-1),age=time-newest.time;
    const strength=history.samples.reduce((sum,s)=>sum+s.strength,0)/history.samples.length;
    const width=track.long?anchors.vaporWidth*2.2:anchors.vaporWidth;
    track.line.width=clamp(width*.75*frame.scale/Math.max(.01,frame.metersPerPixel),1,track.long?6:3);
    track.line.material.uniforms.color=new C.Color(.96,.98,1,(track.long ? .06 : .08)*strength*Math.max(0,1-age/history.lifetime));
  }
  function place(sprite,point,size,color,frame){
    sprite.show=color.alpha>.002;
    if(!sprite.show)return;
    sprite.position=frame.point(point);sprite.width=size*frame.scale;sprite.height=size*frame.scale;sprite.color=color;
  }
  function update(){
    if(destroyed)return;
    const state=getState(),time=state.elapsed;
    ribbons.show=sprites.show=lightPointsCollection.show=Boolean(isVisible());
    if(!Number.isFinite(time))return;
    if(time<lastTime||Number.isFinite(lastTime)&&time-lastTime>.3)reset();
    const dt=Number.isFinite(lastTime)?clamp(time-lastTime,0,.1):0;
    lastTime=time;
    const levels=aircraftEffectLevels({...state,model});
    angle=(angle+levels.propellerRPM/60*Math.PI*2*dt)%(Math.PI*2);
    if(!ribbons.show)return;
    const frame=makeFrame(anchors.radius);
    visualScale=frame.scale;
    for(let index=0;index<2;index++){
      drawTrack(tracks[index],anchors.wings[index],index?1:-1,levels.vapor,frame,state);
      drawTrack(tracks[index+2],anchors.engines[index],index?1:-1,levels.contrail,frame,state);
      const nozzle=anchors.engines[index];
      for(let i=0;i<16;i++){
        const t=i/15,flutter=reducedMotion?1:.95+.05*Math.sin(time*41+i*1.7);
        const length=1.3+4.5*levels.afterburner;
        const point=nozzle?[nozzle[0],nozzle[1]-.12-t*length,nozzle[2]]:[0,0,0];
        const radius=(1.15-.95*t)*flutter;
        place(flames[index][i],point,radius,new C.Color(1,.3+.35*(1-t),.04+.2*(1-t),nozzle?levels.afterburner*(.95-.5*t)*flutter:0),frame);
      }
    }
    const {visibility,strobe,beacon}=aircraftLightLevels(time,getTimeOfDay(),reducedMotion);
    for(let index=0;index<lights.length;index++){
      const flash=index===3||index===4;
      const strength=(index<2?.92:index===2?.65:flash?strobe*.95:beacon*.85)*visibility;
      const light=lights[index],tint=lightColors[index];
      light.show=strength>.01;
      if(!light.show)continue;
      light.position=frame.point(lightPoints[index]);
      light.color=new C.Color(tint.red*strength,tint.green*strength,tint.blue*strength,1);
      light.outlineColor=new C.Color(tint.red*strength,tint.green*strength,tint.blue*strength,.25);
    }
  }
  const removeUpdate=viewer.scene.preUpdate.addEventListener(update);
  return{
    // Cesium picks individual billboards, polylines and points, not their collections.
    surfacePrimitives:[...tracks.map(track=>track.line),...flames.flat(),...lights],
    propellerTexture:propellerTexture(),
    get propellerAngle(){return angle;},
    get visualScale(){return visualScale;},
    setModel(value){model=Object.hasOwn(EFFECT_ANCHORS,value)?value:'highWing';anchors=EFFECT_ANCHORS[model];lightPoints=lightAnchors(anchors);reset();},
    reset,
    destroy(){
      if(destroyed)return;destroyed=true;removeUpdate();
      if(viewer.scene.isDestroyed?.())return;
      if(!ribbons.isDestroyed())viewer.scene.primitives.remove(ribbons);
      if(!sprites.isDestroyed())viewer.scene.primitives.remove(sprites);
      if(!lightPointsCollection.isDestroyed())viewer.scene.primitives.remove(lightPointsCollection);
    }
  };
}
