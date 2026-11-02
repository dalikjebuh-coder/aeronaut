import {RAD,offsetMeters,clamp,aircraftProfile} from './flight.js';

export function landingOffset(route,state,target=route.gates.at(-1)){
  const offset=offsetMeters(state.lat,state.lon,target),heading=route.objective.heading*RAD;
  return{along:offset.x*Math.sin(heading)+offset.y*Math.cos(heading),across:offset.x*Math.cos(heading)-offset.y*Math.sin(heading)};
}
export function landingPenalties(route,previous,state,target){
  const {along,across}=landingOffset(route,state,target),objective=route.objective;
  const heading=Math.abs(Math.atan2(Math.sin(state.heading-objective.heading*RAD),Math.cos(state.heading-objective.heading*RAD)))/RAD;
  return {along:.35*Math.abs(along)/objective.halfLength,across:.35*Math.abs(across)/objective.halfWidth,
    sink:.2*Math.max(0,-previous.verticalSpeed)/aircraftProfile(state.model).landingSink,heading:.1*heading/objective.headingTolerance};
}
export function landingResult(route,previous,state,target){
  if(!state.onGround||previous.onGround)return null;
  const objective=route.objective,{along,across}=landingOffset(route,state,target);
  const heading=Math.abs(Math.atan2(Math.sin(state.heading-objective.heading*RAD),Math.cos(state.heading-objective.heading*RAD)))/RAD;
  if(Math.abs(along)>objective.halfLength||Math.abs(across)>objective.halfWidth||heading>objective.headingTolerance)return null;
  const loss=Object.values(landingPenalties(route,previous,state,target)).reduce((sum,value)=>sum+value,0);
  return Math.round(100*clamp(1-loss,0,1));
}
export function discoveryCone(route,gate){
  const clearance=gate.clearance??350,surface=gate.surface??((gate.altitude??route.altitude)-clearance);
  return{surface,height:clearance*2,radius:(gate.radius??route.radius)*2,minHeight:20};
}
export function inDiscoveryArea(route,index,state,previous=null){
  if(state.onGround)return false;
  const gate=route.gates[index],cone=discoveryCone(route,gate),end=offsetMeters(state.lat,state.lon,gate),height=state.altitude-cone.surface,k=cone.radius/cone.height;
  const inside=height>=cone.minHeight&&height<=cone.height&&Math.hypot(end.x,end.y)<=height*k;
  if(inside)return true;
  if(!previous||previous.onGround)return false;
  const dt=state.elapsed-previous.elapsed,start=offsetMeters(previous.lat,previous.lon,gate),dx=end.x-start.x,dy=end.y-start.y,dz=state.altitude-previous.altitude;
  const expected=Math.min(260,Math.max(previous.speed||0,state.speed||0))*dt*1.5+30;
  if(dt<=0||dt>8||Math.hypot(dx,dy,dz)>expected)return false;
  const z=previous.altitude-cone.surface;
  let lo=0,hi=1;
  if(Math.abs(dz)<1e-9){if(z<cone.minHeight||z>cone.height)return false;}
  else{const a=(cone.minHeight-z)/dz,b=(cone.height-z)/dz;lo=Math.max(0,Math.min(a,b));hi=Math.min(1,Math.max(a,b));if(lo>hi)return false;}
  const a=dx*dx+dy*dy-k*k*dz*dz,b=2*(start.x*dx+start.y*dy-k*k*z*dz),c=start.x*start.x+start.y*start.y-k*k*z*z;
  const q=t=>a*t*t+b*t+c;
  return Math.min(q(lo),q(hi),a>1e-9?q(clamp(-b/(2*a),lo,hi)):Infinity)<=1e-6;
}
export function lowFlightValid(route,state,ground){
  if(!Number.isFinite(ground)||state.onGround)return false;
  const objective=route.objective,height=state.altitude-ground;
  if(height<objective.minHeight||height>objective.maxHeight)return false;
  let nearest=Infinity;
  for(let index=1;index<route.gates.length;index++){
    const a=offsetMeters(route.gates[index-1].lat,route.gates[index-1].lon,state),b=offsetMeters(route.gates[index].lat,route.gates[index].lon,state);
    const dx=b.x-a.x,dy=b.y-a.y,t=clamp(-(a.x*dx+a.y*dy)/(dx*dx+dy*dy||1),0,1);
    nearest=Math.min(nearest,Math.hypot(a.x+t*dx,a.y+t*dy));
  }
  return nearest<=objective.corridor;
}
