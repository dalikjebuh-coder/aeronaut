export const FLIGHT_CAMERA_MODES=['chase','distant','overhead','front','cinematic','roof'];

export function crashCameraPose(state,chaseDistance=48){
  const distance=Math.max(65,Math.min(180,chaseDistance*1.5)),height=distance*.5;
  return{
    offset:{x:-Math.sin(state.heading)*distance,y:-Math.cos(state.heading)*distance,z:height},
    orientation:{heading:state.heading,pitch:-Math.atan2(height,distance),roll:0}
  };
}

export function flightCameraPose(state,chaseDistance=48,mode='chase',vibration={heading:0,pitch:0,roll:0}){
  const baseDistance=chaseDistance+Math.max(0,state.speed-80)*.32;
  if(mode==='cinematic'){
    const time=Number.isFinite(state.elapsed)?state.elapsed:0;
    const angle=state.heading+.55+time*Math.PI/40;
    const distance=baseDistance*(1.55+.2*Math.sin(time*.12));
    const height=distance*(.3+.08*Math.sin(time*.09));
    return {
      offset:{x:-Math.sin(angle)*distance,y:-Math.cos(angle)*distance,z:height},
      orientation:{heading:angle,pitch:-Math.atan2(height,distance),roll:0}
    };
  }
  if(mode==='front'){
    const height=chaseDistance>80?30:16;
    return {
      offset:{x:Math.sin(state.heading)*baseDistance,y:Math.cos(state.heading)*baseDistance,z:height},
      orientation:{heading:state.heading+Math.PI+vibration.heading,pitch:-Math.atan2(height,baseDistance)+vibration.pitch,roll:vibration.roll}
    };
  }
  if(mode==='overhead')return {
    offset:{x:0,y:0,z:Math.max(150,chaseDistance*2.2)},
    orientation:{heading:state.heading,pitch:-Math.PI/2,roll:0}
  };
  const distance=mode==='distant'?baseDistance*2.4:baseDistance;
  const height=mode==='distant'
    ?Math.max(38,chaseDistance*.55)+Math.max(0,state.speed-80)*.065
    :(chaseDistance>80?30:16)+Math.max(0,state.speed-80)*.045;
  return {
    offset:{x:-Math.sin(state.heading)*distance,y:-Math.cos(state.heading)*distance,z:height},
    orientation:{heading:state.heading+vibration.heading,pitch:(mode==='distant'?-.27:-.20)+state.pitch*.25+vibration.pitch,roll:vibration.roll}
  };
}
