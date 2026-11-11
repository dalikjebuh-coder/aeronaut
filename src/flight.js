export const RAD = Math.PI / 180;
export const EARTH = 6378137;
export const MAX_SPEED_KMH = 900;
export const MAX_SPEED = MAX_SPEED_KMH / 3.6;
export const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
const kmh=value=>value/3.6;
// Game-tuned assisted profiles, not performance specifications of the real aircraft.
export const AIRCRAFT_PROFILES=Object.freeze(Object.fromEntries(Object.entries({
  highWing:{
    description:'Klidné řízení, lehké letadlo',maxSpeed:kmh(240),idleSpeed:kmh(75),cruiseSpeed:kmh(165),stallSpeed:kmh(80),minimumSpeed:kmh(40),
    maxBank:42,rollResponse:1.6,pitchRate:13,pitchResponse:2.8,pitchReturn:.35,pitchUp:25,pitchDown:30,
    acceleration:3.2,deceleration:3,speedResponse:.26,engineResponse:2.8,groundAcceleration:2.4,groundBraking:4,steering:.002,
    takeoffSpeed:kmh(100),landingMin:kmh(85),landingMax:kmh(140),landingSink:3,landingBank:12,landingPitch:12,surfaceRadius:12
  },
  lowWing:{
    description:'Svižný a vyvážený proudový letoun',maxSpeed:kmh(760),idleSpeed:kmh(140),cruiseSpeed:kmh(460),stallSpeed:kmh(125),minimumSpeed:kmh(60),
    maxBank:55,rollResponse:2.2,pitchRate:20,pitchResponse:3.5,pitchReturn:.22,pitchUp:35,pitchDown:40,
    acceleration:6,deceleration:4,speedResponse:.18,engineResponse:1,groundAcceleration:4,groundBraking:7,steering:.0016,
    takeoffSpeed:kmh(180),landingMin:kmh(135),landingMax:kmh(230),landingSink:4,landingBank:12,landingPitch:12,surfaceRadius:18
  },
  airliner:{
    description:'Pomalé reakce a velká setrvačnost',maxSpeed:kmh(900),idleSpeed:kmh(200),cruiseSpeed:kmh(600),stallSpeed:kmh(200),minimumSpeed:kmh(90),
    maxBank:32,rollResponse:.65,pitchRate:7,pitchResponse:.75,pitchReturn:.12,pitchUp:18,pitchDown:25,
    acceleration:2.6,deceleration:2.3,speedResponse:.085,engineResponse:.32,groundAcceleration:2.5,groundBraking:4,steering:.0007,
    takeoffSpeed:kmh(260),landingMin:kmh(210),landingMax:kmh(320),landingSink:3,landingBank:8,landingPitch:10,surfaceRadius:45
  },
  fighter:{
    description:'Ostré reakce a rychlé zrychlení',maxSpeed:MAX_SPEED,idleSpeed:kmh(150),cruiseSpeed:kmh(540),stallSpeed:kmh(150),minimumSpeed:kmh(70),
    maxBank:78,rollResponse:4.8,pitchRate:42,pitchResponse:6,pitchReturn:.14,pitchUp:65,pitchDown:65,
    acceleration:14,deceleration:7,speedResponse:.28,engineResponse:1.8,groundAcceleration:8,groundBraking:9,steering:.0018,
    takeoffSpeed:kmh(220),landingMin:kmh(160),landingMax:kmh(300),landingSink:5,landingBank:14,landingPitch:15,surfaceRadius:16
  }
}).map(([key,value])=>[key,Object.freeze(value)])));
export function aircraftProfile(model){return Object.hasOwn(AIRCRAFT_PROFILES,model)?AIRCRAFT_PROFILES[model]:AIRCRAFT_PROFILES.lowWing;}
export function selectFlightAircraft(s,model){
  s.model=Object.hasOwn(AIRCRAFT_PROFILES,model)?model:'lowWing';
  const profile=aircraftProfile(s.model);
  s.speed=clamp(s.speed,s.onGround?0:profile.minimumSpeed,profile.maxSpeed);
  s.roll=clamp(s.roll,-profile.maxBank*RAD,profile.maxBank*RAD);
  s.pitch=clamp(s.pitch,-profile.pitchDown*RAD,profile.pitchUp*RAD);
  s.pitchVelocity=0;s.rollVelocity=0;
  return s;
}
export function initialFlight({lat,lon,altitude=600,heading=0,model='lowWing',onGround=false,wind=null,engineLimit=1,gustStrength=0}) {
  const profile=aircraftProfile(model);
  return selectFlightAircraft({lat,lon,altitude,heading:heading*RAD,pitch:0,pitchVelocity:0,roll:0,speed:onGround?0:profile.cruiseSpeed,throttle:onGround?.85:Math.min(.65,engineLimit),enginePower:onGround?.85:Math.min(.65,engineLimit),elapsed:0,distance:0,verticalSpeed:0,onGround,wind,engineLimit,gustStrength},model);
}
// Deliberately forgiving, assisted flight dynamics; distances are metres and time seconds.
export function stepFlight(s, input, dt) {
  dt = clamp(dt,0,0.05);
  const profile=aircraftProfile(s.model);
  s.throttle=clamp(s.throttle+(input.throttle || 0)*dt*0.28,0,s.engineLimit??1);
  const availablePower=s.engineFailure==='right'?.55:s.engineFailure==='single'?.60:1;
  const power=s.enginePower??s.throttle;
  s.enginePower=power+(s.throttle*availablePower-power)*(1-Math.exp(-dt*profile.engineResponse));
  if(s.onGround){
    s.gustIntensity=0;
    const target=profile.takeoffSpeed*1.3*s.enginePower*s.enginePower;
    s.speed=clamp(s.speed+clamp((target-s.speed)*1.4,-profile.groundBraking,profile.groundAcceleration)*dt,0,profile.maxSpeed);
    s.roll=0;s.rollVelocity=0;s.pitch=0;s.pitchVelocity=0;s.verticalSpeed=0;
    s.heading=(s.heading+(input.roll || 0)*dt*s.speed*profile.steering+Math.PI*2)%(Math.PI*2);
    const distance=s.speed*dt;
    s.lat=clamp(s.lat+Math.cos(s.heading)*distance/EARTH/RAD,-85,85);
    s.lon=((s.lon+Math.sin(s.heading)*distance/(EARTH*Math.cos(s.lat*RAD))/RAD+540)%360)-180;
    if((input.pitch || 0)>0&&s.speed>=profile.takeoffSpeed&&s.enginePower>=.55){s.onGround=false;s.pitch=8*RAD;s.verticalSpeed=s.speed*Math.sin(s.pitch);s.altitude+=Math.max(.2,s.verticalSpeed*dt);}
    s.elapsed+=dt;s.distance+=distance;
    return s;
  }
  const t=s.elapsed;
  const gust=(s.gustStrength||0)*(.5+.5*Math.sin(t*.43))**2;
  const shake=s.engineFailure?1:0;
  const yaw=s.engineFailure==='right'?s.enginePower*2.6*RAD:0;
  s.gustIntensity=gust;
  const targetRoll=clamp((input.roll||0)*profile.maxBank+(gust*16*Math.sin(t*2.9)+shake*5*Math.sin(t*7.1)),-profile.maxBank,profile.maxBank)*RAD;
  const previousRoll=s.roll;
  s.roll+=(targetRoll-s.roll)*(1-Math.exp(-dt*profile.rollResponse));
  s.rollVelocity=dt>0?(s.roll-previousRoll)/dt:0;
  const targetPitchVelocity=((input.pitch||0)*profile.pitchRate+gust*8*Math.sin(t*3.7)+shake*3*Math.sin(t*9.3))*RAD;
  s.pitchVelocity=(s.pitchVelocity||0)+(targetPitchVelocity-(s.pitchVelocity||0))*(1-Math.exp(-dt*profile.pitchResponse));
  s.pitch=clamp(s.pitch+s.pitchVelocity*dt,-profile.pitchDown*RAD,profile.pitchUp*RAD);
  if (!input.pitch) s.pitch*=Math.exp(-dt*profile.pitchReturn);
  const targetSpeed=profile.idleSpeed+Math.pow(s.enginePower,1.5)*(profile.maxSpeed-profile.idleSpeed);
  const acceleration=clamp((targetSpeed-s.speed)*profile.speedResponse,-profile.deceleration,profile.acceleration)-9.81*Math.sin(s.pitch);
  s.speed=clamp(s.speed+acceleration*dt,profile.minimumSpeed,profile.maxSpeed);
  if(s.speed<profile.stallSpeed)s.pitch=clamp(s.pitch-dt*.12,-profile.pitchDown*RAD,profile.pitchUp*RAD);
  s.heading=(s.heading+(9.81*Math.tan(s.roll)/Math.max(s.speed,20)+yaw)*dt+Math.PI*2)%(Math.PI*2);
  const distance=s.speed*Math.cos(s.pitch)*dt;
  s.lat=clamp(s.lat+Math.cos(s.heading)*distance/EARTH/RAD,-85,85);
  s.lon=((s.lon+Math.sin(s.heading)*distance/(EARTH*Math.cos(s.lat*RAD))/RAD+540)%360)-180;
  if(s.wind||gust){
    const north=(s.wind?.north||0)+gust*5*Math.sin(t*1.7);
    const east=(s.wind?.east||0)+gust*6*Math.cos(t*1.3);
    s.lat+=north*dt/EARTH/RAD;s.lon+=east*dt/(EARTH*Math.cos(s.lat*RAD))/RAD;
  }
  s.verticalSpeed=s.speed*Math.sin(s.pitch);
  s.altitude+=s.verticalSpeed*dt;
  s.elapsed+=dt;s.distance+=distance;
  return s;
}
export function landingFailureReason(s,flat){
  const profile=aircraftProfile(s.model);
  if(flat===false)return 'Povrch je příliš nerovný nebo strmý pro přistání.';
  const speed=Math.round(s.speed*3.6),min=Math.round(profile.landingMin*3.6),max=Math.round(profile.landingMax*3.6);
  if(s.speed<profile.landingMin)return `Příliš nízká rychlost při dosednutí: ${speed} km/h. Přistávej při ${min}–${max} km/h.`;
  if(s.speed>profile.landingMax)return `Příliš vysoká rychlost při dosednutí: ${speed} km/h. Přistávej při ${min}–${max} km/h.`;
  if(s.verticalSpeed< -profile.landingSink)return `Příliš prudké klesání: ${(-s.verticalSpeed).toFixed(1)} m/s. Před dosednutím ho zmírni pod ${profile.landingSink} m/s.`;
  if(Math.abs(s.roll)>profile.landingBank*RAD)return 'Příliš velký náklon při dosednutí. Před přistáním srovnej křídla.';
  if(Math.abs(s.pitch)>profile.landingPitch*RAD)return 'Příliš strmý sklon letadla při dosednutí. Před přistáním ho vyrovnej.';
  return null;
}
export function resolveGroundContact(s,ground,flat){
  if(!Number.isFinite(ground))return 'unknown';
  if(s.onGround){s.altitude=ground+3;return 'ground';}
  if(s.altitude>ground+3)return 'air';
  if(flat===undefined||flat===null)return 'unknown';
  if(!landingFailureReason(s,flat)){
    s.onGround=true;s.altitude=ground+3;s.verticalSpeed=0;s.pitch=0;s.pitchVelocity=0;s.roll=0;s.rollVelocity=0;return 'landed';
  }
  return 'crash';
}
export function offsetMeters(lat,lon,origin) {
  let delta=lon-origin.lon; delta=((delta+540)%360)-180;
  return {x:delta*RAD*EARTH*Math.cos(origin.lat*RAD),y:(lat-origin.lat)*RAD*EARTH};
}
export function validCoordinates(lat,lon) {return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-80&&lat<=80&&lon>=-180&&lon<=180;}
