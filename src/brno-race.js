import {RAD,EARTH,offsetMeters} from './flight.js';
import {landingResult,landingPenalties,landingOffset,inDiscoveryArea,lowFlightValid} from './mission-objectives.js';

// Approximate landmark centres; gate heights are game design values in WGS84 metres.
export const BRNO_ROUTE={id:'brno-landmarks-v1',radius:180,altitude:650,gates:[
  {name:'Petrov · START',lat:49.19083,lon:16.6075},
  {name:'Špilberk',lat:49.1945,lon:16.5994},
  {name:'Hvězdárna · Kraví hora',lat:49.2046,lon:16.5835},
  {name:'Brněnská přehrada',lat:49.2395,lon:16.5125},
  {name:'Hrad Veveří · CÍL',lat:49.2569,lon:16.4626}
]};
export function routeStart(route=BRNO_ROUTE){
  const anchor=route.gates[0],first=offsetMeters(route.gates[1].lat,route.gates[1].lon,anchor),length=Math.hypot(first.x,first.y);
  const approach={x:first.x/length,y:first.y/length};
  return{lat:anchor.lat-approach.y*900/EARTH/RAD,lon:anchor.lon-approach.x*900/(EARTH*Math.cos(anchor.lat*RAD))/RAD,altitude:route.gates[0].altitude??route.altitude,heading:(Math.atan2(approach.x,approach.y)/RAD+360)%360,name:route.name||'Brno · časovka'};
}
export const BRNO_START=routeStart();
export function gateFrame(index,route=BRNO_ROUTE){
  const xy=point=>offsetMeters(point.lat,point.lon,route.gates[0]);
  const first=xy(route.gates[1]),length=Math.hypot(first.x,first.y),approach=route.groundStart?{x:Math.sin(route.groundStart.heading*RAD),y:Math.cos(route.groundStart.heading*RAD)}:{x:first.x/length,y:first.y/length};
  const center=xy(route.gates[index]);
  const previous=index?xy(route.gates[index-1]):{x:center.x-approach.x,y:center.y-approach.y};
  const dx=center.x-previous.x,dy=center.y-previous.y,d=Math.hypot(dx,dy);
  return{center,normal:{x:dx/d,y:dy/d},right:{x:dy/d,y:-dx/d}};
}
export function formatRaceTime(seconds){
  if(!Number.isFinite(seconds))return'—';
  const tenths=Math.floor(Math.max(0,seconds)*10);
  return`${String(Math.floor(tenths/600)).padStart(2,'0')}:${String(Math.floor(tenths/10)%60).padStart(2,'0')}.${tenths%10}`;
}
export class BrnoRace{
  constructor(route=BRNO_ROUTE){this.setRoute(route);}
  setRoute(route){this.route=route;this.reset();}
  reset(){this.next=0;this.status='ready';this.startedAt=null;this.finishedAt=null;this.previous=null;this.hold=0;this.score=0;this.preciseSeconds=0;this.judgedSeconds=0;this.taskHint='';this.landingPenalties=null;this.touchdowns=[];}
  elapsed(time){return this.startedAt===null?0:Math.max(0,(this.finishedAt??time)-this.startedAt);}
  fail(){if(this.status!=='finished')this.status='failed';}
  finishTask(state){
    this.next=this.route.gates.length;this.status='finished';this.finishedAt=state.elapsed;
    return [{index:this.next-1,status:'finished'}];
  }
  update(state,ground){
    const previous=this.previous;this.previous={...state};
    if(!previous||this.status==='finished'||this.status==='failed'||state.elapsed<=previous.elapsed)return[];
    const objective=this.route.objective,type=objective?.type,dt=Math.min(.05,state.elapsed-previous.elapsed);
    if(type==='sightseeing'){
      this.taskHint='Proleť žlutým kuželem nad památkou. Průlet ji přidá do sbírky.';
      if(!inDiscoveryArea(this.route,this.next,state,previous))return [];
      if(this.startedAt===null)this.startedAt=state.elapsed;
      const index=this.next++;this.status='racing';
      if(this.next===this.route.gates.length){this.score=100;return this.finishTask(state);}
      return [{index,status:'discovered',placeId:this.route.gates[index].placeId}];
    }
    if(type==='landing'){
      const target=this.route.gates[this.next];
      const reject=message=>{this.fail();this.taskHint=message+' R · nový pokus.';return [{index:this.next,status:'failed'}];};
      if(this.status==='rollout'){
        const {across}=landingOffset(this.route,state);
        const {along}=landingOffset(this.route,state,objective.stop);
        if(!state.onGround||Math.abs(across)>objective.halfWidth||along>0)return reject('Nezastavil jsi v koridoru před koncem dráhy.');
        this.taskHint='Drž osu a klávesou S stáhni výkon. Zastav před koncem dráhy.';
        if(state.speed<=objective.stop.speed)return this.finishTask(state);
        return [];
      }
      if(this.status==='landing'||target?.kind==='touch-and-go'){
        const result=landingResult(this.route,previous,state,target);
        this.taskHint='Přistaň v obdélníku, drž osu dráhy a pomalu klesej.';
        if(result===null){
          if(state.onGround)return reject('Dosednutí mimo cíl nebo osu dráhy.');
          return [];
        }
        const penalties=landingPenalties(this.route,previous,state,target);
        this.touchdowns.push({score:result,penalties});
        this.score=Math.round(this.touchdowns.reduce((sum,t)=>sum+t.score,0)/this.touchdowns.length);
        this.landingPenalties=Object.fromEntries(Object.keys(penalties).map(key=>[key,this.touchdowns.reduce((sum,t)=>sum+t.penalties[key],0)/this.touchdowns.length]));
        if(target.kind==='touch-and-go'){
          const index=this.next++;this.status='racing';
          this.taskHint='Dosednutí potvrzeno! W · plný výkon, ↓ · znovu vzlétni a sleduj druhý okruh.';
          return [{index,status:'touch-and-go'}];
        }
        if(objective.stop){this.status='rollout';this.taskHint='Dosednutí potvrzeno. S · stáhni výkon a zastav před koncem dráhy.';return [{index:this.next,status:'rollout'}];}
        return this.finishTask(state);
      }
      // A departure may begin on the ground. Landing before the assigned zone is never a shortcut.
      if(!previous.onGround&&state.onGround)return reject('Tady ještě nepřistávej. Sleduj předepsaný průlet.');
    }
    if(type==='lowflight'&&this.status==='racing'){
      this.judgedSeconds+=dt;
      const valid=lowFlightValid(this.route,state,ground);
      if(valid)this.preciseSeconds+=dt;
      this.score=Math.round(100*this.preciseSeconds/this.judgedSeconds);
      this.taskHint=!Number.isFinite(ground)?'Čekám na povrch; tento úsek se nepočítá jako přesný.':`${Math.round(state.altitude-ground)} m nad terénem · ${valid?'správná výška i koridor.':`drž ${objective.minHeight}–${objective.maxHeight} m a sleduj trasu.`}`;
    }
    const xy=point=>offsetMeters(point.lat,point.lon,this.route.gates[0]);
    const from=xy(previous),to=xy(state),events=[];
    let lastFraction=-1;
    while(this.next<this.route.gates.length-(type==='landing'?1:0)){
      const gate=this.route.gates[this.next];
      const {center,normal,right}=gateFrame(this.next,this.route);
      const a=(from.x-center.x)*normal.x+(from.y-center.y)*normal.y;
      const b=(to.x-center.x)*normal.x+(to.y-center.y)*normal.y;
      if(!(a<0&&b>=0))break;
      if((type==='takeoff'||type==='landing'||this.route.groundStart||gate.groundSkim)&&state.onGround)break;
      if(gate.kind==='touch-and-go')break;
      const t=-a/(b-a);
      if(t<lastFraction)break;
      const x=from.x+(to.x-from.x)*t-center.x,y=from.y+(to.y-from.y)*t-center.y;
      const z=previous.altitude+(state.altitude-previous.altitude)*t-(gate.altitude??this.route.altitude);
      if(Math.hypot(x*right.x+y*right.y,z)>(gate.radius??this.route.radius))break;
      const crossedAt=previous.elapsed+(state.elapsed-previous.elapsed)*t,index=this.next++;
      lastFraction=t;
      if(index===0){this.startedAt=crossedAt;this.status='racing';}
      if(this.next===this.route.gates.length){
        this.finishedAt=crossedAt;
        if(type==='lowflight'&&this.score<(objective.minimumScore??0)){
          this.fail();
          this.taskHint=`Přesný let ${this.score} % · potřebuješ alespoň ${objective.minimumScore} %. R · nový pokus.`;
        }else this.status='finished';
      }
      if(type==='landing'&&this.next===this.route.gates.length-1)this.status='landing';
      events.push({index,status:this.status});
    }
    return events;
  }
  target(state){
    if(this.next>=this.route.gates.length)return null;
    const gate=this.route.gates[this.next],point=this.status==='rollout'?{...gate,...this.route.objective.stop,name:'Zastav před čárou'}:gate,offset=offsetMeters(point.lat,point.lon,state);
    return{...point,distance:Math.hypot(offset.x,offset.y),heading:(Math.atan2(offset.x,offset.y)/RAD+360)%360,height:(point.altitude??this.route.altitude)-state.altitude};
  }
}
