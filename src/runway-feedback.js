import {clamp} from './flight.js';

export function runwayTransition(wasOnGround,state,contact){
  if(contact==='landed')return 'touchdown';
  if(wasOnGround&&!state.onGround&&contact!=='crash')return 'liftoff';
  return null;
}

// Use simulation time so pausing freezes the pulse and a new attempt can clear it.
export function createRunwayFeedback(){
  let pulse=null;
  return{
    trigger(kind,time,strength=1){pulse={time,strength:clamp(strength,.3,1)*(kind==='liftoff'?.5:1)};},
    reset(){pulse=null;},
    sample(time,{active=true,motion=true}={}){
      const quiet={z:0,pitch:0,roll:0};
      if(!pulse)return quiet;
      const age=time-pulse.time;
      if(age<0||age>=.85){pulse=null;return quiet;}
      if(!active||!motion)return quiet;
      const amount=pulse.strength*Math.pow(1-age/.85,2);
      return{z:amount*.24*Math.sin(age*48),pitch:amount*.004*Math.cos(age*40),roll:amount*.0025*Math.sin(age*35)};
    }
  };
}
