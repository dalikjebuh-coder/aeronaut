import {EARTH,RAD,aircraftProfile} from './flight.js';

// Check the wheel corridor rather than the full wingspan; grass beside a runway
// and small photogrammetry errors must not invalidate a smooth touchdown.
export function landingSurfaceFlat(state,ground,sample){
  if(!Number.isFinite(ground))return undefined;
  const length=aircraftProfile(state.model).surfaceRadius,width=Math.min(8,length*.35);
  const forward=[Math.cos(state.heading),Math.sin(state.heading)],right=[-forward[1],forward[0]];
  const offsets=[[forward,length],[forward,-length],[right,width],[right,-width]];
  const heights=offsets.map(([direction,distance])=>sample(
    state.lat+direction[0]*distance/EARTH/RAD,
    state.lon+direction[1]*distance/(EARTH*Math.cos(state.lat*RAD))/RAD
  ));
  if(heights.some(height=>!Number.isFinite(height)))return undefined;
  const [front,back,left,rightHeight]=heights,tolerance=1.5;
  const along=Math.max(0,Math.abs(front-back)-tolerance*2)/(length*2);
  const across=Math.max(0,Math.abs(left-rightHeight)-tolerance*2)/(width*2);
  const smooth=Math.abs((front+back)/2-ground)<=tolerance&&Math.abs((left+rightHeight)/2-ground)<=tolerance;
  return smooth&&Math.hypot(along,across)<=.08;
}
