import {clamp} from './flight.js';

const BURST_DURATION=5;
const GOLDEN_ANGLE=Math.PI*(3-Math.sqrt(5));

function noiseHash(x,y){
  return ((Math.imul(x+17,374761393)^Math.imul(y+31,668265263))>>>0)/4294967295;
}

function noise(x,y){
  const ix=Math.floor(x),iy=Math.floor(y);
  const fx=x-ix,fy=y-iy;
  const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
  const top=noiseHash(ix,iy)*(1-u)+noiseHash(ix+1,iy)*u;
  const bottom=noiseHash(ix,iy+1)*(1-u)+noiseHash(ix+1,iy+1)*u;
  return top*(1-v)+bottom*v;
}

function cloudTexture(ctx,size,fire){
  const image=ctx.createImageData(size,size);
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      const dx=(x+.5)/size*2-1,dy=(y+.5)/size*2-1;
      const lobes=noise(x*.047,y*.047),detail=noise(x*.13,y*.13);
      const radius=Math.hypot(dx,dy);
      const density=1-radius*1.26+(lobes-.5)*.56+(detail-.5)*.21;
      const shading=clamp(.58+lobes*.5+detail*.14-dy*.15,0,1);
      const heat=clamp(density*.9+lobes*.22+detail*.24,0,1);
      const alpha=clamp(density*(fire?2.9:2),0,1);
      const pixel=(y*size+x)*4;
      image.data[pixel]=fire?190+65*heat:255*shading;
      image.data[pixel+1]=fire?28+213*heat:255*shading;
      image.data[pixel+2]=fire?5+219*heat**3:255*shading;
      image.data[pixel+3]=255*alpha*clamp((1-radius)*9,0,1);
    }
  }
  ctx.putImageData(image,0,0);
}

function texture(kind){
  const size=96,center=size/2;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d');
  if(kind==='fire'||kind==='smoke'){
    cloudTexture(ctx,size,kind==='fire');
  }else if(kind==='debris'){
    ctx.fillStyle='#fff';
    ctx.beginPath();ctx.moveTo(8,34);ctx.lineTo(84,20);ctx.lineTo(68,73);ctx.lineTo(23,81);ctx.closePath();ctx.fill();
  }else{
    const gradient=ctx.createRadialGradient(center,center,0,center,center,center);
    for(const [stop,alpha] of [[0,1],[.16,.94],[.42,.52],[.75,.12],[1,0]]){
      gradient.addColorStop(stop,`rgba(255,255,255,${alpha})`);
    }
    ctx.fillStyle=gradient;ctx.fillRect(0,0,size,size);
  }
  return canvas;
}

// Uses wall time so the burst keeps moving after the flight simulation stops.
export function createCrashEffect(viewer,{clock=()=>performance.now(),reducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false}={}){
  const C=window.Cesium,collection=viewer.scene.primitives.add(new C.BillboardCollection({scene:viewer.scene}));
  const offset=new C.Cartesian3();
  let burst=null,textures,destroyed=false;
  collection.show=false;
  function clear(){burst=null;collection.show=false;collection.removeAll();}
  function play({lat,lon,altitude,size=8,wind,onReady}){
    if(destroyed)return;
    clear();
    textures??={flash:texture('flash'),fire:texture('fire'),smoke:texture('smoke'),debris:texture('debris')};
    const calm=reducedMotion(),scale=clamp(size,5,22),particles=[];
    const origin=C.Cartesian3.fromDegrees(lon,lat,altitude);
    function add(kind,count,image=textures[kind]){
      for(let i=0;i<count;i++){
        const angle=i*GOLDEN_ANGLE,seed=((i*37+13)%101)/101;
        particles.push({kind,east:Math.cos(angle),north:Math.sin(angle),angle,seed,
          sprite:collection.add({image,show:false,sizeInMeters:true,position:origin})});
      }
    }
    if(!calm)add('flash',2);
    add('fire',calm?5:12);
    add('smoke',calm?8:16);
    if(!calm){add('dust',6,textures.smoke);add('debris',18);}
    burst={start:clock(),frame:C.Transforms.eastNorthUpToFixedFrame(origin),scale,particles,calm,wind,onReady};
    collection.show=true;update();
  }
  function update(){
    if(!burst||destroyed)return;
    const current=burst,t=Math.max(0,(clock()-current.start)/1000),{scale,frame,calm,wind}=current;
    for(const {kind,east,north,angle,seed,sprite} of current.particles){
      let travel=0,rise,width,height,rotation=angle,drift=0,color;
      sprite.show=false;
      switch(kind){
        case 'flash':{
          const core=seed<.25,life=core?.14:.29;
          if(t>=life)continue;
          const p=t/life;
          rise=scale*(core?.37:.52);
          width=scale*(core?1.7+p:3.2+1.8*p);
          height=width*(core?.85:.6);
          rotation=0;
          color=new C.Color(1,core?.95:.57,core?.8:.21,(1-p)**1.6*(core?1:.76));
          break;
        }
        case 'fire':{
          const age=t-seed*.21,life=(.76+.47*seed)*(calm?.72:1);
          if(age<0||age>=life)continue;
          const p=age/life,expansion=1-(1-p)**3;
          travel=scale*(.2+seed*1.22)*expansion*(calm?.5:1);
          rise=scale*(.12+seed*.34+p*(calm?.48:.75+(1-seed)*.8));
          width=scale*(.5+expansion*(.7+seed*.62));
          height=width*(.83+p*.31);
          rotation+=age*(.5-seed);
          color=new C.Color(1,1-.49*p**2,1-.78*p**2,(1-p**2)*(calm?.6:.98));
          break;
        }
        case 'smoke':{
          const age=t-.24-seed*.77,life=3.55+seed*.42;
          if(age<0||age>=life)continue;
          const p=age/life;
          travel=scale*(.23+seed*.65+p*.55);
          rise=scale*(.35+seed*.42+p*(calm?1.1:1.65+seed*2.45));
          width=scale*(.83+p*(1.6+seed*.65));
          rotation+=age*(seed-.5)*.75;
          drift=age*p*(calm?.35:1);
          const grey=.19+.25*p;
          color=new C.Color(grey,grey*.96,grey*.92,Math.min(1,age*1.7)*(1-p)**1.25*(calm?.45:.79));
          break;
        }
        case 'dust':{
          const life=1.05+seed*.55;
          if(t>=life)continue;
          const p=t/life;
          travel=scale*(.45+(2.1+seed)*(1-(1-p)**2));
          rise=scale*(.02+.12*p);
          width=scale*(.75+p*1.7);
          height=width*.42;
          color=new C.Color(.45,.38,.3,Math.min(1,t*8)*(1-p)**2*.54);
          rotation=0;
          break;
        }
        case 'debris':{
          const lift=3.5+scale*(.24+seed*.63);
          // The burst starts one metre above the impact surface.
          rise=scale*.19+lift*t-4.905*t*t;
          if(rise<-.8||t>=2.5)continue;
          travel=scale*(1.3+seed*2.25)*t/(1+.65*t);
          width=scale*(.03+seed*.061);
          height=width*(.48+seed*.38);
          rotation+=t*(5+seed*8);
          const heat=Math.max(0,1-t/(.35+seed*.55));
          color=new C.Color(.17+.83*heat,.13+.63*heat,.11+.25*heat,Math.min(1,(2.5-t)*5));
          break;
        }
      }
      offset.x=east*travel+(wind?.east??0)*drift;
      offset.y=north*travel+(wind?.north??0)*drift;
      offset.z=rise;
      sprite.position=C.Matrix4.multiplyByPoint(frame,offset,new C.Cartesian3());
      sprite.width=width;
      sprite.height=height??width;
      sprite.rotation=rotation;
      sprite.color=color;
      sprite.show=true;
    }
    if(t>=1.5&&current.onReady){const ready=current.onReady;current.onReady=null;ready();}
    if(burst===current&&t>=BURST_DURATION)clear();
  }
  const removeUpdate=viewer.scene.preUpdate.addEventListener(update);
  return{play,clear,get active(){return Boolean(burst);},destroy(){if(destroyed)return;clear();destroyed=true;removeUpdate();if(!viewer.scene.isDestroyed?.())viewer.scene.primitives.remove(collection);}};
}
