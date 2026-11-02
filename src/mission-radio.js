import {objectiveType} from './task-missions.js';

// Original, fictional radio exchanges. Keep each turn short enough for browser speech engines.
const exchange=(kind,messages)=>({kind,messages,text:messages.map(message=>message.text).join(' ')});
export function missionRadioLine(mission){
  const route=mission.route;
  const digits=['zero','one','two','three','four','five','six','seven','eight','nine'];
  const runway=route.airport?'runway '+[...route.airport.runway].map(char=>digits[char]||({L:'left',R:'right',C:'center'})[char]||char).join(' '):'runway zero nine';
  if(route.engineLimit===0)return exchange('emergency',[
    {speaker:'pilot',text:`Mayday, November four two seven. Engine failure. Gliding to ${runway}.`},
    {speaker:'tower',text:`November four two seven, ${runway} is clear. Cleared for emergency landing.`}
  ]);
  if(mission.id==='dusk-landing')return exchange('go-around',[
    {speaker:'tower',text:'November four two seven, runway occupied. Go around, climb straight ahead, then rejoin the circuit.'},
    {speaker:'pilot',text:'Going around, climbing straight ahead. November four two seven.'}
  ]);
  if(route.groundStart||objectiveType(route)==='takeoff')return exchange('takeoff',[
    {speaker:'tower',text:`November four two seven, ${runway}, cleared for takeoff. After departure, climb straight ahead.`},
    {speaker:'pilot',text:`Cleared for takeoff, ${runway}. Climbing straight ahead, November four two seven.`}
  ]);
  if(objectiveType(route)==='landing')return exchange('landing',[
    {speaker:'tower',text:`November four two seven, ${runway}, cleared to land. Continue your approach and maintain the runway centerline.`},
    {speaker:'pilot',text:`Cleared to land, ${runway}. Continuing the approach, November four two seven.`}
  ]);
  return exchange('navigation',[
    {speaker:'pilot',text:'Control, November four two seven. Established on course and ready to continue the flight.'},
    {speaker:'tower',text:'November four two seven, radar contact. Continue on course. Have a good flight.'}
  ]);
}

export function runwayRadioLine(kind){
  if(kind==='touch-and-go')return exchange(kind,[
    {speaker:'pilot',text:'Tower, November four two seven, touch and go. Applying full power for departure.'},
    {speaker:'tower',text:'November four two seven, cleared for takeoff. Climb straight ahead, then rejoin the circuit.'}
  ]);
  return kind==='touchdown'
    ?exchange(kind,[
      {speaker:'pilot',text:'Tower, November four two seven, on the ground. Rolling out and slowing down.'},
      {speaker:'tower',text:'November four two seven, roger. Maintain the runway centerline and reduce to taxi speed.'}
    ])
    :exchange(kind,[
      {speaker:'pilot',text:'Tower, November four two seven, airborne. Positive climb, continuing straight ahead.'},
      {speaker:'tower',text:'November four two seven, roger. Continue your climb. Have a good flight.'}
    ]);
}

// Some systems list comic/robotic English voices before their regular voices.
const noveltyVoice=/\b(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Fred|Good News|Hysterical|Junior|Organ|Princess|Ralph|Trinoids|Whisper|Zarvox)\b/i;
export function radioVoices(voices){
  const english=voices.filter(voice=>/^en\b/i.test(voice.lang||'')&&!noveltyVoice.test(voice.name||''));
  const score=(voice,speaker)=>{
    const name=voice.name||'',preferred=speaker==='tower'?/\b(Daniel|Alex|Oliver)\b|Google UK English Male/i:/\b(Samantha|Karen|Moira|Serena|Ava)\b|Google US English/i;
    return(preferred.test(name)?100:0)+(/Natural|Enhanced|Premium|Google|Microsoft/i.test(name)?40:0)+(voice.localService?10:0);
  };
  const tower=[...english].sort((a,b)=>score(b,'tower')-score(a,'tower'))[0]||null;
  const others=english.filter(voice=>voice!==tower);
  const pilot=[...(others.length?others:english)].sort((a,b)=>score(b,'pilot')-score(a,'pilot'))[0]||null;
  return{tower,pilot};
}

export function createMissionRadio({caption,enabled=()=>true,transmission=()=>{},speech=globalThis.speechSynthesis,Utterance=globalThis.SpeechSynthesisUtterance,schedule=setTimeout,cancelTimer=clearTimeout}={}){
  let active=null,nextTimer,hideTimer,session=0,voices=[];
  function refreshVoices(){try{voices=speech?.getVoices?.()||[];}catch{}}
  refreshVoices();speech?.addEventListener?.('voiceschanged',refreshVoices);
  function hide(){if(caption)caption.hidden=true;}
  function stop(){
    session++;cancelTimer(nextTimer);cancelTimer(hideTimer);
    const wasActive=Boolean(active);active=null;
    transmission(false,null,true);
    if(wasActive&&speech?.cancel)speech.cancel();
    hide();
  }
  function speakLine(line){
    stop();
    const currentSession=session,audible=Boolean(enabled()&&speech&&Utterance);
    const finish=()=>{hideTimer=schedule(hide,1200);};
    function playTurn(index){
      if(currentSession!==session)return;
      const message=line.messages[index];
      if(!message){finish();return;}
      if(caption){caption.textContent=`${message.speaker==='tower'?'VĚŽ':'PILOT'} · ${message.text}`;caption.hidden=false;}
      const readingTime=Math.max(4500,message.text.split(/\s+/).length*420);
      if(!audible||!enabled()){nextTimer=schedule(()=>playTurn(index+1),readingTime);return;}
      try{
        refreshVoices();
        const utterance=new Utterance(message.text),voice=radioVoices(voices)[message.speaker];
        utterance.lang=voice?.lang||'en-US';utterance.voice=voice;
        utterance.rate=message.speaker==='tower'?1:1.03;utterance.pitch=1;utterance.volume=.88;
        utterance.onstart=()=>{if(currentSession===session&&active===utterance)transmission(true,message.speaker);};
        utterance.onend=()=>{
          if(currentSession!==session||active!==utterance)return;
          active=null;cancelTimer(nextTimer);
          transmission(false,message.speaker);
          if(index===line.messages.length-1)finish();
          else nextTimer=schedule(()=>playTurn(index+1),450);
        };
        utterance.onerror=()=>{
          if(currentSession!==session||active!==utterance)return;
          active=null;transmission(false,null,true);cancelTimer(nextTimer);nextTimer=schedule(()=>playTurn(index+1),readingTime);
        };
        active=utterance;
        // A stalled speech engine must not leave an old exchange queued indefinitely.
        nextTimer=schedule(()=>{
          if(currentSession!==session||active!==utterance)return;
          active=null;transmission(false,null,true);speech.cancel?.();playTurn(index+1);
        },readingTime+10000);
        speech.speak(utterance);
      }catch{active=null;transmission(false,null,true);cancelTimer(nextTimer);nextTimer=schedule(()=>playTurn(index+1),readingTime);}
    }
    playTurn(0);
    return line;
  }
  return{play:mission=>speakLine(missionRadioLine(mission)),flightEvent:kind=>speakLine(runwayRadioLine(kind)),stop,unlock(){refreshVoices();try{speech?.resume?.();}catch{}}};
}
