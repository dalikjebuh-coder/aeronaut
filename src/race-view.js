import {BRNO_ROUTE,gateFrame} from './brno-race.js';
import {discoveryCone} from './mission-objectives.js';

function routeDashMaterial(C,viewer,getAircraft){
  const type='FlyAtlasRouteDash',aircraftWorld=new C.Cartesian3();
  // Entity polylines resolve their material type through Cesium's Fabric cache.
  C.Material._materialCache.addMaterial(type,{translucent:true,fabric:{
    type,
    materials:{dashes:{type:C.Material.PolylineDashType,uniforms:{
      color:{type:'vec4',red:.83,green:.92,blue:.6,alpha:.5},
      gapColor:{type:'vec4',red:0,green:0,blue:0,alpha:0},
      dashLength:20
    }}},
    uniforms:{aircraftEye:{type:'vec3',x:0,y:0,z:0},fadeStart:1000,fadeEnd:6000},
    source:`czm_material czm_getMaterial(czm_materialInput materialInput){
      czm_material material = dashes;
      // Recover the position along the perspective ray using the fragment's clip W.
      vec4 ray = czm_windowToEyeCoordinates(vec4(gl_FragCoord.xy, 0.0, 1.0));
      vec3 positionEye = ray.xyz / (-ray.z * gl_FragCoord.w);
      float meters = distance(positionEye, aircraftEye);
      material.alpha *= 1.0 - smoothstep(fadeStart, fadeEnd, meters);
      if (material.alpha <= 0.0) discard;
      return material;
    }`
  }});
  return{
    isConstant:false,
    definitionChanged:new C.Event(),
    getType:()=>type,
    getValue(_time,result={}){
      const aircraft=getAircraft?.();
      result.aircraftEye??=new C.Cartesian3();
      if(aircraft){
        C.Cartesian3.fromDegrees(aircraft.lon,aircraft.lat,aircraft.altitude,C.Ellipsoid.WGS84,aircraftWorld);
        C.Matrix4.multiplyByPoint(viewer.camera.viewMatrix,aircraftWorld,result.aircraftEye);
      }else C.Cartesian3.clone(C.Cartesian3.ZERO,result.aircraftEye);
      return result;
    },
    equals(other){return this===other;}
  };
}

export function createRaceView(viewer,race,getAircraft){
  const C=window.Cesium,source=new C.CustomDataSource('Mission route');
  const dashMaterial=routeDashMaterial(C,viewer,getAircraft);
  viewer.dataSources.add(source);source.show=false;
  source.setRoute=(route)=>{
  source.entities.removeAll();
  const centers=route.gates.map(g=>C.Cartesian3.fromDegrees(g.lon,g.lat,g.altitude??route.altitude));
  source.entities.add({polyline:{positions:centers,width:4,material:dashMaterial}});
  if(route.objective?.stop){
    const stop=route.objective.stop,angle=route.objective.heading*Math.PI/180;
    const center=C.Cartesian3.fromDegrees(stop.lon,stop.lat,route.gates.at(-1).altitude??route.altitude),enu=C.Transforms.eastNorthUpToFixedFrame(center);
    const points=[-1,1].map(side=>C.Matrix4.multiplyByPoint(enu,new C.Cartesian3(side*route.objective.halfWidth*Math.cos(angle),-side*route.objective.halfWidth*Math.sin(angle),1),new C.Cartesian3()));
    source.entities.add({polyline:{positions:points,width:7,material:C.Color.ORANGE}});
    source.entities.add({position:center,label:{text:'ZASTAV PŘED ČÁROU · S uber výkon',font:'600 15px sans-serif',fillColor:C.Color.ORANGE,outlineColor:C.Color.BLACK,outlineWidth:3,style:C.LabelStyle.FILL_AND_OUTLINE}});
  }
  route.gates.forEach((gate,index)=>{
    const center=centers[index],enu=C.Transforms.eastNorthUpToFixedFrame(center),{right}=gateFrame(index,route),points=[];
    const project=(east,north,up=0)=>C.Matrix4.multiplyByPoint(enu,new C.Cartesian3(east,north,up),new C.Cartesian3());
    const discovery=route.objective?.type==='sightseeing',landing=['landing','touch-and-go'].includes(gate.kind);
    if(landing){
      const angle=route.objective.heading*Math.PI/180;
      for(const [along,across] of [[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]]){
        const a=along*route.objective.halfLength,b=across*route.objective.halfWidth;
        points.push(project(a*Math.sin(angle)+b*Math.cos(angle),a*Math.cos(angle)-b*Math.sin(angle),1));
      }
      source.entities.add({polygon:{hierarchy:points.slice(0,4),perPositionHeight:true,material:new C.Color(1,.85,.25,.18)}});
    }else if(discovery){
      const cone=discoveryCone(route,gate),active=new C.CallbackProperty(()=>index===race.next&&race.status!=='finished'&&race.status!=='failed',false);
      source.entities.add({position:C.Cartesian3.fromDegrees(gate.lon,gate.lat,cone.surface+cone.height/2),cylinder:{show:active,length:cone.height,topRadius:cone.radius,bottomRadius:0,slices:64,material:new C.Color(1,.8,.2,.13),outline:true,outlineColor:new C.Color(1,.86,.35,.45),numberOfVerticalLines:8}});
      const radius=gate.radius??route.radius;
      for(let i=0;i<=80;i++){const angle=i/80*Math.PI*2;points.push(project(Math.cos(angle)*radius,Math.sin(angle)*radius));}
    }else for(let i=0;i<=80;i++){
      const angle=i/80*Math.PI*2,r=gate.radius??route.radius;
      points.push(project(right.x*Math.cos(angle)*r,right.y*Math.cos(angle)*r,Math.sin(angle)*r));
    }
    const color=new C.CallbackProperty(()=>index<race.next?new C.Color(.3,1,.6,.35):index===race.next?new C.Color(1,.86,.25,1):new C.Color(.7,.82,1,.3),false);
    source.entities.add({polyline:{positions:points,width:landing?6:9,material:new C.ColorMaterialProperty(color)}});
    const labelPoint=C.Matrix4.multiplyByPoint(enu,new C.Cartesian3(0,0,discovery?35:(gate.radius??route.radius)+35),new C.Cartesian3());
    const text=discovery?new C.CallbackProperty(()=>index<race.next?`✓ ${gate.name}`:`${index+1} · ${gate.name}${index===race.next?'\nProleť žlutým kuželem':''}`,false):`${index+1} · ${gate.name}`;
    source.entities.add({position:labelPoint,label:{text,font:'600 15px sans-serif',fillColor:color,outlineColor:C.Color.BLACK,outlineWidth:3,style:C.LabelStyle.FILL_AND_OUTLINE,scaleByDistance:new C.NearFarScalar(2000,1,18000,.55)}});
  });
  };
  source.setRoute(race.route||BRNO_ROUTE);
  return source;
}
