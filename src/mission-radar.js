import {RAD,offsetMeters} from './flight.js';
import {discoveryCone} from './mission-objectives.js';

const TAU=Math.PI*2;
const bearingDelta=(bearing,heading)=>((bearing-heading+Math.PI)%TAU+TAU)%TAU-Math.PI;
export function cardinalDirection(heading){
  const points=['SEVER','SEVEROVÝCHOD','VÝCHOD','JIHOVÝCHOD','JIH','JIHOZÁPAD','ZÁPAD','SEVEROZÁPAD'];
  return points[Math.round(((heading%TAU+TAU)%TAU)/RAD/45)%8];
}
export function radarDistance(meters){return meters>=1000?`${(meters/1000).toFixed(1)} km`:`${Math.round(meters)} m`;}
function radarRange(distance){
  const steps=[250,500,1000,2000,5000,10000,20000,50000,100000];
  return steps.find(value=>value>=distance)||Math.ceil(distance/100000)*100000;
}
export function missionRadarState(race,state){
  const complete=race.status==='finished',failed=race.status==='failed';
  const target=complete||failed?null:race.target(state);
  const nextGate=target?race.route.gates[race.next+1]:null;
  const nextOffset=nextGate?offsetMeters(nextGate.lat,nextGate.lon,state):null;
  // Keep the immediate target legible; distant gates remain indicated at the edge.
  const extent=target?Math.max(300,target.distance*1.35,Math.min(nextOffset?Math.hypot(nextOffset.x,nextOffset.y)*1.15:0,target.distance*2+400)):2000;
  const range=radarRange(extent),cx=110,cy=90,radius=72,scale=radius/range;
  const project=point=>{
    const offset=offsetMeters(point.lat,point.lon,state),dx=offset.x*scale,dy=-offset.y*scale,distance=Math.hypot(dx,dy);
    const factor=distance>radius?radius/distance:1;
    return{x:cx+dx*factor,y:cy+dy*factor,rawX:cx+dx,rawY:cy+dy,outside:distance>radius};
  };
  const gates=race.route.gates.map((gate,index)=>({...project(gate),index,passed:index<race.next,active:!!target&&index===race.next}));
  const angle=target?bearingDelta(target.heading*RAD,state.heading):0;
  const degrees=Math.round(Math.abs(angle)/RAD),turn=degrees<=8?'Před tebou':`${angle<0?'Vlevo':'Vpravo'} ${degrees}°`;
  const height=target?.height??0,tolerance=target?Math.min(25,(target.radius??race.route.radius)*.35):25;
  let altitudeCue=Math.abs(height)<=tolerance?'Výška správně':`${height>0?'Stoupej':'Klesej'} ${Math.round(Math.abs(height))} m`;
  if(target&&race.route.objective?.type==='sightseeing'){
    const cone=discoveryCone(race.route,target),above=state.altitude-cone.surface;
    altitudeCue=above>cone.height?'Klesej do žlutého kužele':above<cone.minHeight?'Stoupej nad památku':'Proleť žlutým kuželem';
  }
  if(race.status==='rollout')altitudeCue='S · uber výkon a zastav na dráze';
  return{range,cx,cy,radius,scale,project,gates,target,angle,turn,altitudeCue,complete,failed,next:race.next,total:gates.length,heading:state.heading};
}

export function missionBearingCue(nav){
  if(!nav.target)return null;
  return{
    gate:`BOD ${nav.next+1} / ${nav.total} · ${nav.target.name}`,
    turn:nav.turn,
    detail:`${radarDistance(nav.target.distance)} · ${nav.altitudeCue}`,
    angle:nav.angle
  };
}

export function drawMissionRadar(ctx,nav,trail=[]){
  const {cx,cy,radius,gates}=nav;
  ctx.clearRect(0,0,220,180);ctx.save();
  ctx.lineWidth=1;ctx.strokeStyle='#93b4cb2e';
  for(const r of [radius/3,radius*2/3,radius]){ctx.beginPath();ctx.arc(cx,cy,r,0,TAU);ctx.stroke();}
  ctx.beginPath();ctx.moveTo(cx,cy-radius);ctx.lineTo(cx,cy+radius);ctx.moveTo(cx-radius,cy);ctx.lineTo(cx+radius,cy);ctx.stroke();
  ctx.font='600 9px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#a8bfd0';ctx.fillText('N',cx,7);
  ctx.fillText('E',cx+radius+14,cy);ctx.fillText('W',cx-radius-14,cy);ctx.fillText('S',cx,173);
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,radius+1,0,TAU);ctx.clip();
  ctx.strokeStyle='#9ab4c445';ctx.lineWidth=1;ctx.beginPath();
  trail.forEach((point,index)=>{const q=nav.project(point);index?ctx.lineTo(q.rawX,q.rawY):ctx.moveTo(q.rawX,q.rawY);});ctx.stroke();
  ctx.setLineDash([3,4]);ctx.strokeStyle='#9cb8ce80';ctx.lineWidth=1.3;ctx.beginPath();
  gates.forEach((gate,index)=>{index?ctx.lineTo(gate.rawX,gate.rawY):ctx.moveTo(gate.rawX,gate.rawY);});ctx.stroke();ctx.setLineDash([]);
  const active=gates.find(gate=>gate.active);
  if(active){
    ctx.strokeStyle='#ffdb7a';ctx.lineWidth=2.8;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(active.x,active.y);ctx.stroke();
    // Arrow on the direct leg, in addition to the numbered destination ring.
    const dx=active.x-cx,dy=active.y-cy,d=Math.hypot(dx,dy);
    if(d>30){ctx.save();ctx.translate(cx+dx*.55,cy+dy*.55);ctx.rotate(Math.atan2(dx,-dy));ctx.strokeStyle='#ffe499';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-4,4);ctx.lineTo(0,-3);ctx.lineTo(4,4);ctx.stroke();ctx.restore();}
  }
  ctx.restore();
  // Draw the target last so an overlapping route can never hide it.
  const ordered=[...gates.filter(gate=>!gate.active),...gates.filter(gate=>gate.active)];
  for(const gate of ordered){
    const r=gate.active?13:7,color=gate.active?'#ffdb7a':gate.passed?'#69dca6':'#94b9d9';
    ctx.fillStyle='#0b1827';ctx.strokeStyle=color;ctx.lineWidth=gate.active?2.7:1.5;
    ctx.beginPath();ctx.arc(gate.x,gate.y,r,0,TAU);ctx.fill();ctx.stroke();
    if(gate.active){ctx.strokeStyle='#ffdb7a40';ctx.lineWidth=2;ctx.beginPath();ctx.arc(gate.x,gate.y,r+4,0,TAU);ctx.stroke();}
    ctx.fillStyle=color;ctx.font=`700 ${gate.active?11:9}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(gate.index+1),gate.x,gate.y+.5);
  }
  // Aircraft stays at the centre; north is always up.
  ctx.save();ctx.translate(cx,cy);ctx.rotate(nav.heading);ctx.fillStyle='#f5fafc';ctx.strokeStyle='#0b1827';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(7,8);ctx.lineTo(0,4);ctx.lineTo(-7,8);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  ctx.restore();
}
