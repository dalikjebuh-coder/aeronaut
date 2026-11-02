import {BRNO_ROUTE,gateFrame} from './brno-race.js';
import {discoveryCone} from './mission-objectives.js';

export function createRaceView(viewer,race){
  const C=window.Cesium,source=new C.CustomDataSource('Mission route');
  viewer.dataSources.add(source);source.show=false;
  source.setRoute=(route)=>{
  source.entities.removeAll();
  const centers=route.gates.map(g=>C.Cartesian3.fromDegrees(g.lon,g.lat,g.altitude??route.altitude));
  source.entities.add({polyline:{positions:centers,width:2,material:new C.PolylineDashMaterialProperty({color:new C.Color(.83,.92,.6,.28),dashLength:20})}});
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
    source.entities.add({polyline:{positions:points,width:6,material:new C.ColorMaterialProperty(color)}});
    const labelPoint=C.Matrix4.multiplyByPoint(enu,new C.Cartesian3(0,0,discovery?35:(gate.radius??route.radius)+35),new C.Cartesian3());
    const text=discovery?new C.CallbackProperty(()=>index<race.next?`✓ ${gate.name}`:`${index+1} · ${gate.name}${index===race.next?'\nProleť žlutým kuželem':''}`,false):`${index+1} · ${gate.name}`;
    source.entities.add({position:labelPoint,label:{text,font:'600 15px sans-serif',fillColor:color,outlineColor:C.Color.BLACK,outlineWidth:3,style:C.LabelStyle.FILL_AND_OUTLINE,scaleByDistance:new C.NearFarScalar(2000,1,18000,.55)}});
  });
  };
  source.setRoute(race.route||BRNO_ROUTE);
  return source;
}
