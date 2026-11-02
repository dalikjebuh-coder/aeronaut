import {clamp,offsetMeters} from './flight.js';

export const FLYOVER_RADIUS_METERS=500;

export function shortPlaceText(point,limit=180){
  if(point.facts?.length){const facts=point.facts.slice(0,2).join(' ');if(facts.length<=limit)return facts;if(point.facts[0].length<=limit)return point.facts[0];}
  const text=String(point.text||'').replace(/\([^()]*\)/g,'').replace(/\s+/g,' ').trim();
  const first=text.match(/^.*?[.!?](?=\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]|$)/)?.[0]||text;
  if(first.length<=limit)return first;
  return first.slice(0,limit-1).replace(/\s+\S*$/,'')+'…';
}
export function flyoverDistance(point,previous,state){
  const end=offsetMeters(state.lat,state.lon,point),distance=Math.hypot(end.x,end.y);
  if(!previous)return distance;
  const dt=state.elapsed-previous.elapsed,start=offsetMeters(previous.lat,previous.lon,point),dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy);
  // Never collect a chain of places after a restart, teleport or paused camera movement.
  const expected=Math.min(260,Math.max(previous.speed||0,state.speed||0))*dt*1.5+30;
  if(dt<=0||dt>8||length>expected)return distance;
  const t=clamp(-(start.x*dx+start.y*dy)/(length*length||1),0,1);
  return Math.hypot(start.x+dx*t,start.y+dy*t);
}
export function collectionProgress(catalog,visited,region='all'){
  const ids=visited instanceof Set?visited:new Set(visited.map(point=>typeof point==='string'?point:point.id));
  const items=catalog.filter(point=>region==='all'||point.collection===region),collected=items.filter(point=>ids.has(point.id)).length;
  return{total:items.length,collected,remaining:items.length-collected,percent:items.length?Math.round(collected/items.length*100):0,items:items.map(point=>({...point,visited:ids.has(point.id)}))};
}
export function createFlyoverCards({duration=12,radius=FLYOVER_RADIUS_METERS}={}){
  let current=null,started=0,cooldown=0;
  const distance=(point,state)=>{const xy=offsetMeters(point.lat,point.lon,state);return Math.hypot(xy.x,xy.y);};
  return{
    update(encounters,time,state){
      if(current&&distance(current,state)>radius)current=null;
      if(current&&time-started>=duration){current=null;cooldown=time+.55;}
      // Offer only this update's encounters. Discard the rest rather than queueing old places.
      if(!current&&time>=cooldown){
        const closest=encounters.map(point=>({point,distance:distance(point,state)})).filter(item=>item.distance<=radius).sort((a,b)=>a.distance-b.distance)[0];
        if(closest){current=closest.point;started=time;}
      }
      return current;
    },
    dismiss(time){current=null;cooldown=time+1;},
    reset(){current=null;started=0;cooldown=0;},
    get current(){return current;},remaining(time){return current?clamp(1-(time-started)/duration,0,1):0;}
  };
}
