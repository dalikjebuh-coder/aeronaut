import {clamp} from './flight.js';

function texture(kind){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=96;
  const ctx=canvas.getContext('2d');
  if(kind==='debris'){
    ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(22,30);ctx.lineTo(76,22);ctx.lineTo(66,66);ctx.lineTo(30,76);ctx.closePath();ctx.fill();
  }else if(kind==='fire'){
    // Irregular overlapping lobes read as flame rather than a single soft halo.
    for(let i=0;i<9;i++){
      const angle=i*2.39996,radius=i?13+(i%3)*3:0,x=48+Math.cos(angle)*radius,y=48+Math.sin(angle)*radius;
      const gradient=ctx.createRadialGradient(x,y,1,x,y,24);
      for(const [stop,color] of [[0,'#fff9c9'],[.25,'#ffe071'],[.57,'#ff931c'],[.82,'#df4012bb'],[1,'#a4260800']])gradient.addColorStop(stop,color);
      ctx.fillStyle=gradient;ctx.fillRect(x-24,y-24,48,48);
    }
  }else{
    const gradient=ctx.createRadialGradient(48,48,0,48,48,48);
    for(const [stop,alpha] of (kind==='smoke'?[[0,.8],[.45,.65],[.8,.2],[1,0]]:[[0,1],[.18,1],[.45,.7],[1,0]]))gradient.addColorStop(stop,`rgba(255,255,255,${alpha})`);
    ctx.fillStyle=gradient;ctx.fillRect(0,0,96,96);
  }
  return canvas;
}

// Uses wall time so the burst keeps moving after the flight simulation stops.
export function createCrashEffect(viewer,{clock=()=>performance.now(),reducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false}={}){
  const C=window.Cesium,collection=viewer.scene.primitives.add(new C.BillboardCollection({scene:viewer.scene}));
  let burst=null,textures,destroyed=false;
  collection.show=false;
  function clear(){burst=null;collection.show=false;collection.removeAll();}
  function play({lat,lon,altitude,size=8,onReady}){
    clear();
    textures??={fire:texture('fire'),smoke:texture('smoke'),debris:texture('debris')};
    const calm=reducedMotion(),scale=clamp(size,5,22),particles=[];
    const add=(kind,count)=>{
      for(let i=0;i<count;i++){
        const angle=i*2.39996323,seed=((i*37+13)%101)/101;
        particles.push({kind,angle,seed,sprite:collection.add({image:textures[kind],show:false,sizeInMeters:true,position:C.Cartesian3.fromDegrees(lon,lat,altitude)})});
      }
    };
    add('fire',calm?5:16);add('smoke',calm?8:20);if(!calm)add('debris',18);
    burst={start:clock(),frame:C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(lon,lat,altitude)),scale,particles,calm,onReady};
    collection.show=true;update();
  }
  function update(){
    if(!burst||destroyed)return;
    const current=burst,t=Math.max(0,(clock()-current.start)/1000),{scale,frame,calm}=current;
    for(const {kind,angle,seed,sprite} of current.particles){
      let x,y,z,width,color;
      if(kind==='fire'){
        const age=t-seed*.16,life=calm?.65:1.15;
        sprite.show=age>=0&&age<life;if(!sprite.show)continue;
        const p=age/life,spread=scale*p*(calm?.35:1.3)*(.15+seed*.85);
        x=Math.cos(angle)*spread;y=Math.sin(angle)*spread;z=scale*(.2+p*.65+seed*.2);
        width=scale*(.55+Math.sin(p*Math.PI)*.65)*(1-seed*.3);sprite.rotation=angle;
        color=new C.Color(1,.75+seed*.2-p*.25,.7-p*.4,Math.min(1,(1-p)*1.7)*(calm?.55:.95));
      }else if(kind==='smoke'){
        const age=t-.4-seed*.6,life=4;
        sprite.show=age>=0&&age<life;if(!sprite.show)continue;
        const p=age/life,spread=scale*(.2+p*.8);
        x=Math.cos(angle)*spread+p*scale*.5;y=Math.sin(angle)*spread;z=scale*(.3+p*2+seed*.4);
        width=scale*(.65+p*1.5);const grey=.16+p*.19;
        color=new C.Color(grey,grey*.96,grey*.9,Math.min(1,age*1.5)*(1-p)*.35);
      }else{
        sprite.show=t<2.1;if(!sprite.show)continue;
        const velocity=scale*(.5+seed),travel=velocity*t;
        x=Math.cos(angle)*travel;y=Math.sin(angle)*travel;z=Math.max(.15,scale*.2+velocity*t-9*t*t);
        width=scale*(.035+seed*.06);color=new C.Color(.4+Math.max(0,1-t)*.5,.29,.16,Math.min(1,(2.1-t)*2));sprite.rotation=angle+t*(seed+1)*4;
      }
      sprite.position=C.Matrix4.multiplyByPoint(frame,new C.Cartesian3(x,y,z),new C.Cartesian3());
      sprite.width=sprite.height=width;sprite.color=color;
    }
    if(t>=1.5&&current.onReady){const ready=current.onReady;current.onReady=null;ready();}
    if(burst===current&&t>=5)clear();
  }
  const removeUpdate=viewer.scene.preUpdate.addEventListener(update);
  return{play,clear,get active(){return Boolean(burst);},destroy(){if(destroyed)return;clear();destroyed=true;removeUpdate();if(!viewer.scene.isDestroyed?.())viewer.scene.primitives.remove(collection);}};
}
