import {aircraftProfile,clamp,RAD} from './flight.js';

const ease=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};

// Schedule gusts in simulation time, independent of frame rate and camera updates.
export function createTurbulence({random=Math.random}={}){
  let nextAt=null,burst=null,lastTime=null;
  const quiet=()=>({intensity:0,active:false,started:false});
  const gap=weather=>{
    const [min,max]=({clear:[60,140],partly:[50,125],haze:[45,110],overcast:[25,75]})[weather]||[60,140];
    return min+random()*(max-min);
  };
  function reset(){nextAt=null;burst=null;lastTime=null;}
  function update(state,{active=true,weather='clear',ground}={}){
    if(!active)return quiet();
    const t=state.elapsed;
    if(lastTime!==null&&t<lastTime)reset();
    lastTime=t;
    if(state.onGround||Number.isFinite(ground)&&state.altitude-ground<70){nextAt=null;burst=null;return quiet();}
    if(burst&&t>=burst.start+burst.duration){burst=null;nextAt=t+gap(weather);}
    if(nextAt===null)nextAt=t+gap(weather);
    let started=false;
    if(!burst&&t>=nextAt){
      burst={start:t,duration:4+random()*3,strength:(weather==='overcast'?.4:.25)+random()*.3};
      nextAt=Infinity;started=true;
    }
    if(!burst)return quiet();
    const age=t-burst.start,remaining=burst.duration-age;
    return{intensity:burst.strength*ease(age)*ease(remaining),active:true,started};
  }
  return{update,reset};
}

// Small angular offsets only; never feed visual vibration back into flight physics.
export function flightFeedback(state,{active=true,motion=true,turbulence=0,ground}={}){
  const profile=aircraftProfile(state.model),load=Math.min(1.25,1/Math.sqrt(Math.max(.4,Math.cos(state.roll))));
  const margin=state.speed/(profile.stallSpeed*load);
  const warning=active&&!state.onGround?(margin<1?'stall':margin<1.12?'slow':''):'';
  const airborne=active&&!state.onGround;
  const rolling=clamp((Math.abs(state.rollVelocity||0)/RAD-18)/65,0,1);
  const pitching=clamp((Math.abs(state.pitchVelocity||0)*state.speed/9.81-.45)/1.2,0,1);
  const turning=clamp((1/Math.max(.25,Math.cos(state.roll))-1.6)/1.6,0,1);
  const maneuver=airborne?Math.max(rolling,pitching,turning):0;
  // The banner uses vertical flight and takeoff conditions only. Bank angle and
  // roll rate still drive the small camera offsets, never this notification.
  const power=state.enginePower??state.throttle??0;
  const rolloutTarget=profile.takeoffSpeed*1.3*power*power;
  const accelerating=active&&state.onGround&&power>=.7&&state.speed>=5&&rolloutTarget-state.speed>profile.groundAcceleration*.5;
  const takingOff=airborne&&Number.isFinite(ground)&&state.altitude-ground>=0&&state.altitude-ground<60&&power>=.7&&state.speed>=profile.takeoffSpeed*.85&&state.speed<=profile.takeoffSpeed*1.35&&state.pitch>4*RAD&&state.verticalSpeed>2;
  const climbing=airborne&&state.pitch>Math.max(12,profile.pitchUp*.7)*RAD&&state.verticalSpeed>3;
  const descending=airborne&&state.pitch< -Math.max(12,profile.pitchDown*.7)*RAD&&state.verticalSpeed< -3;
  const maneuverWarning=accelerating?'acceleration':takingOff?'takeoff':climbing?'climb':descending?'descent':'';
  const intensity=airborne&&motion?maneuver:0;
  const gust=airborne&&motion?clamp(turbulence,0,1):0;
  const t=state.elapsed;
  return{warning,maneuver,maneuverWarning,
    heading:intensity*.001*(Math.sin(t*23)+.35*Math.sin(t*41))+gust*.0015*Math.sin(t*8.3),
    pitch:intensity*.0012*(Math.sin(t*29)+.3*Math.sin(t*47))+gust*.002*Math.sin(t*11.7),
    roll:intensity*.0015*Math.sin(t*19)+gust*.003*Math.sin(t*7.1)
  };
}
