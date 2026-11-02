import {clamp} from './flight.js';
import {createRadioStatic} from './radio-static.js';

const recordings={propeller:'/audio/propeller.ogg',jet:'/audio/jet-cruise.wav'};

export function createEngineAudio(){
  let context,master,radioStatic,enabled=true,flying=false,model='lowWing',throttle=.7,speed=0;
  const tracks=new Map();
  const runwaySounds=new Set();

  function stopRunwaySounds(){for(const source of runwaySounds){try{source.stop();}catch{}}runwaySounds.clear();}

  // Original synthesized rubber chirp: falling harmonics and a little friction noise.
  // Generated only at wheel contact/release; no external recording or network load.
  function tireSqueal(kind,strength=1){
    if(!context||!enabled||!flying||context.state!=='running')return;
    const touchdown=kind==='touchdown',duration=touchdown?.65:.3;
    const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate),data=buffer.getChannelData(0);
    let phase=0;
    for(let i=0;i<data.length;i++){
      const t=i/context.sampleRate,progress=t/duration;
      phase+=2*Math.PI*(touchdown?1700-1050*progress:1000-350*progress)/context.sampleRate;
      data[i]=.5*Math.sin(phase)+.2*Math.sin(phase*2.03)+.1*Math.sin(phase*3.97)+.12*(Math.random()*2-1);
    }
    const source=context.createBufferSource(),gain=context.createGain(),start=context.currentTime;
    source.buffer=buffer;
    gain.gain.setValueAtTime(0,start);
    gain.gain.linearRampToValueAtTime((touchdown?.42:.2)*clamp(strength,.3,1),start+.018);
    gain.gain.exponentialRampToValueAtTime(.001,start+duration);
    source.connect(gain);gain.connect(master);runwaySounds.add(source);
    source.onended=()=>{runwaySounds.delete(source);source.disconnect();gain.disconnect();};
    source.start(start);source.stop(start+duration+.02);
  }

  async function loadTrack(kind,url){
    try{
      const response=await fetch(url);
      if(!response.ok)throw new Error(`Audio ${response.status}`);
      const buffer=await context.decodeAudioData(await response.arrayBuffer());
      if(context.state==='closed')return;
      const source=context.createBufferSource(),gain=context.createGain();
      source.buffer=buffer;source.loop=true;gain.gain.value=0;
      source.connect(gain);gain.connect(master);source.start();
      tracks.set(kind,{source,gain});
      update();
    }catch(error){console.warn(`Zvuk ${kind} se nepodařilo načíst:`,error);}
  }

  function initialize(){
    if(context)return;
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext)return;
    context=new AudioContext();
    master=context.createGain();master.gain.value=0;master.connect(context.destination);
    for(const [kind,url] of Object.entries(recordings))loadTrack(kind,url);
  }

  function update(){
    if(!context)return;
    const now=context.currentTime,power=clamp(throttle,0,1),jet=model!=='highWing';
    master.gain.setTargetAtTime(enabled&&flying ? .42 : 0,now,.15);
    for(const [kind,{source,gain}] of tracks){
      const selected=kind===(jet?'jet':'propeller');
      gain.gain.setTargetAtTime(selected ? (jet ? .45+.25*power : .58+.32*power) : 0,now,.3);
      source.playbackRate.setTargetAtTime(jet ? .94+.16*power : Math.min(1.48,.74+.42*power+speed*.00045),now,jet ? .65 : .2);
    }
  }

  function tone(frequency,delay=0,duration=.13,volume=.16){
    if(!context||!enabled||!flying||context.state!=='running')return;
    const oscillator=context.createOscillator(),gain=context.createGain(),start=context.currentTime+delay;
    oscillator.type='sine';oscillator.frequency.value=frequency;
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+.012);
    gain.gain.exponentialRampToValueAtTime(.001,start+duration);
    oscillator.connect(gain);gain.connect(master);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
    oscillator.start(start);oscillator.stop(start+duration+.02);
  }

  return {
    unlock(){initialize();if(context?.state==='suspended')context.resume().catch(()=>{});},
    play(){flying=true;update();},
    pause(){flying=false;stopRunwaySounds();update();},
    stop(){flying=false;stopRunwaySounds();radioStatic?.cancel();update();},
    setModel(value){model=value;update();},
    setThrottle(value,velocity){throttle=value;speed=velocity;update();},
    gatePassed(finished=false){tone(finished?660:580);tone(finished?990:820,.11,.18);},
    radioTransmission(active,speaker,immediate=false){
      if(!active){if(immediate)radioStatic?.cancel();else radioStatic?.stop();return;}
      if(!context||!enabled||context.state!=='running')return;
      radioStatic??=createRadioStatic(context);radioStatic.start(speaker);
    },
    tireSqueal,
    stallWarning(){tone(330,0,.18,.2);},
    toggle(){enabled=!enabled;if(!enabled){stopRunwaySounds();radioStatic?.cancel();}update();return enabled;},
    get enabled(){return enabled;}
  };
}
