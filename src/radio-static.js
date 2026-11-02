// Original radio interference, generated locally and band-limited like a VHF receiver.
// SpeechSynthesis owns the voice output; this channel supplies its synchronized noise bed.
export function createRadioStatic(context){
  let buffer,active=null;
  const channels=new Set();
  function cancel(){
    active=null;
    for(const channel of channels){try{channel.source.stop();}catch{}}
    channels.clear();
  }
  function start(speaker='tower'){
    cancel();
    if(context.state!=='running')return;
    if(!buffer){
      buffer=context.createBuffer(1,Math.ceil(context.sampleRate*2),context.sampleRate);
      const data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++){
        const time=i/context.sampleRate;
        const flutter=.72+.16*Math.sin(time*37)+.08*Math.sin(time*83);
        const crackle=Math.random()<.002?(Math.random()*2-1)*.4:0;
        data[i]=Math.max(-1,Math.min(1,(Math.random()*2-1)*flutter+crackle));
      }
    }
    const source=context.createBufferSource(),high=context.createBiquadFilter(),low=context.createBiquadFilter(),gain=context.createGain();
    const now=context.currentTime,level=speaker==='pilot'?.08:.065;
    source.buffer=buffer;source.loop=true;source.playbackRate.value=speaker==='pilot'?1.03:.97;
    high.type='highpass';high.frequency.value=380;high.Q.value=.7;
    low.type='lowpass';low.frequency.value=3300;low.Q.value=.7;
    source.connect(high);high.connect(low);low.connect(gain);gain.connect(context.destination);
    gain.gain.setValueAtTime(0,now);
    gain.gain.linearRampToValueAtTime(.2,now+.012);
    gain.gain.exponentialRampToValueAtTime(level,now+.1);
    const channel={source,high,low,gain,level};channels.add(channel);active=channel;
    source.onended=()=>{
      channels.delete(channel);if(active===channel)active=null;
      source.disconnect();high.disconnect();low.disconnect();gain.disconnect();
    };
    source.start();
  }
  function stop(){
    if(!active)return;
    const channel=active,now=context.currentTime;active=null;
    channel.gain.gain.cancelScheduledValues(now);
    channel.gain.gain.setValueAtTime(channel.level,now);
    channel.gain.gain.linearRampToValueAtTime(.12,now+.012);
    channel.gain.gain.exponentialRampToValueAtTime(.001,now+.14);
    channel.source.stop(now+.15);
  }
  return{start,stop,cancel};
}
