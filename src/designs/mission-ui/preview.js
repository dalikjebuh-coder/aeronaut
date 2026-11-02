import {MISSIONS,getMission,TIME_NAMES,WEATHER_NAMES} from '../../missions.js';
import {OBJECTIVE_NAMES,objectiveType} from '../../task-missions.js';
import {offsetMeters} from '../../flight.js';
import {MISSION_CAPTIONS} from '../../menu-copy.js';

export const DESIGNS={
  horizon:{letter:'A',name:'Horizont',title:'Krajina hraje hlavní roli.',description:'Velký obraz, výrazné písmo a jen to, co potřebuješ před startem.',recommendation:'Doporučený směr'},
  atlas:{letter:'B',name:'Atlas',title:'Čistě. Klidně. Přehledně.',description:'Světlé plochy, velké náhledy a důsledné oddělení výběru od detailu.',recommendation:'Nejvyšší čitelnost'},
  vector:{letter:'C',name:'Vektor',title:'Připraven na další výzvu.',description:'Tmavé rozhraní s jasným cílem: vyber trasu, obtížnost a vzlétni.',recommendation:'Důraz na mise'}
};
export const MISSION_ORDER=['canyon-patrol','brno','everest','prague','giza','brno-landing',...MISSIONS.map(m=>m.id)].filter((id,index,all)=>all.indexOf(id)===index);
export function missionSummary(id,level='easy'){
  const mission=getMission(id,level),gates=mission.route.gates;
  const meters=gates.slice(1).reduce((sum,gate,index)=>{const delta=offsetMeters(gate.lat,gate.lon,gates[index]);return sum+Math.hypot(delta.x,delta.y);},0);
  return{...mission,shortDescription:MISSION_CAPTIONS[mission.id]||mission.description,kind:OBJECTIVE_NAMES[objectiveType(mission.route)],length:new Intl.NumberFormat('cs-CZ',{maximumFractionDigits:1}).format(meters/1000)+' km',conditions:TIME_NAMES[mission.time]+' · '+WEATHER_NAMES[mission.weather]};
}
export function routeSvg(route){
  const anchor=route.gates[0],points=route.gates.map(point=>offsetMeters(point.lat,point.lon,anchor));
  const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
  const scale=Math.min(520/Math.max(1,maxX-minX),240/Math.max(1,maxY-minY));
  const projected=points.map(p=>({x:320+(p.x-(minX+maxX)/2)*scale,y:170-(p.y-(minY+maxY)/2)*scale}));
  return`<svg viewBox="0 0 640 340" role="img" aria-label="Pět bodů trasy mise"><path class="route-glow" d="M${projected.map(p=>`${p.x},${p.y}`).join('L')}"/><path class="route-line" d="M${projected.map(p=>`${p.x},${p.y}`).join('L')}"/>${projected.map((p,index)=>`<g transform="translate(${p.x},${p.y})"><circle class="route-halo" r="23"/><circle class="route-node" r="16"/><text y="6">${index+1}</text>${index===0?'<text class="route-label" y="-34">START</text>':index===points.length-1?'<text class="route-label" y="-34">CÍL</text>':''}</g>`).join('')}</svg>`;
}

function mount(){
  const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
  let design=Object.hasOwn(DESIGNS,params.get('design'))?params.get('design'):'horizon';
  let selected=MISSIONS.some(m=>m.id===params.get('mission'))?params.get('mission'):'canyon-patrol';
  let difficulty=['easy','normal','hard'].includes(params.get('level'))?params.get('level'):'easy',timer;
  const list=MISSION_ORDER.map(id=>MISSIONS.find(m=>m.id===id));
  function toast(text){clearTimeout(timer);$('previewToast').textContent=text;$('previewToast').hidden=false;timer=setTimeout(()=>$('previewToast').hidden=true,3200);}
  function saveUrl(){const next=new URLSearchParams({design,mission:selected,level:difficulty});history.replaceState(null,'','?'+next);}
  function syncDesign(){
    const info=DESIGNS[design];$('designStage').className='game-stage theme-'+design;
    $('designEyebrow').textContent=`${info.letter} / ${info.name.toUpperCase()}`;$('designTitle').textContent=info.title;$('designDescription').textContent=info.description;$('designRecommendation').textContent=info.recommendation;
    $('chooseDesign').replaceChildren(document.createTextNode(`Vybrat návrh ${info.letter} `),Object.assign(document.createElement('span'),{textContent:'↗'}));
    for(const button of document.querySelectorAll('[data-design]'))button.setAttribute('aria-pressed',String(button.dataset.design===design));
    saveUrl();
  }
  function renderList(){
    const type=$('missionType').value||'all',visible=list.filter(m=>type==='all'||objectiveType(m.route)===type);
    $('missionCount').textContent=String(visible.length);
    $('missionList').replaceChildren(...visible.map(mission=>{
      const button=document.createElement('button'),image=document.createElement('img'),body=document.createElement('span'),name=document.createElement('strong'),place=document.createElement('span'),check=document.createElement('span');
      button.type='button';button.className='mission-option';button.dataset.mission=mission.id;button.setAttribute('aria-pressed',String(selected===mission.id));
      image.src=mission.location.image;image.alt='';image.loading='lazy';image.decoding='async';
      body.className='mission-option-text';name.textContent=mission.title;place.textContent=mission.location.name;body.append(name,place);check.className='mission-check';check.textContent=selected===mission.id?'✓':'↗';check.setAttribute('aria-hidden','true');
      button.append(image,body,check);button.onclick=()=>{selected=mission.id;syncMission();};
      button.onkeydown=event=>{if(!['ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const index=visible.findIndex(m=>m.id===mission.id),next=visible[(index+(event.key==='ArrowDown'?1:visible.length-1))%visible.length];selected=next.id;syncMission();$('missionList').querySelector(`[data-mission="${selected}"]`)?.focus();};
      return button;
    }));
  }
  function syncMission(){
    const mission=missionSummary(selected,difficulty);
    for(const image of document.querySelectorAll('[data-hero-image]'))image.src=mission.location.image;
    $('selectedPlace').textContent=mission.location.name;$('selectedType').textContent=mission.kind;$('selectedCountry').textContent=mission.location.country;
    $('selectedTitle').textContent=mission.title;$('selectedDescription').textContent=mission.shortDescription;$('selectedConditions').textContent=mission.conditions;$('selectedLength').textContent=mission.length;
    $('routeMap').innerHTML=routeSvg(mission.route);
    for(const button of document.querySelectorAll('[data-difficulty]'))button.setAttribute('aria-pressed',String(button.dataset.difficulty===difficulty));
    for(const button of document.querySelectorAll('[data-mission]')){const active=button.dataset.mission===selected;button.setAttribute('aria-pressed',String(active));button.querySelector('.mission-check').textContent=active?'✓':'↗';}
    saveUrl();
  }
  for(const button of document.querySelectorAll('[data-design]'))button.onclick=()=>{design=button.dataset.design;syncDesign();};
  for(const button of document.querySelectorAll('[data-difficulty]'))button.onclick=()=>{difficulty=button.dataset.difficulty;syncMission();};
  $('missionType').onchange=()=>{const visible=list.filter(m=>$('missionType').value==='all'||objectiveType(m.route)===$('missionType').value);if(!visible.some(m=>m.id===selected))selected=visible[0].id;renderList();syncMission();};
  $('startPreview').onclick=()=>toast(`Náhled mise: ${getMission(selected).title}. Spuštění letu zůstává v hlavní hře.`);
  $('chooseDesign').onclick=()=>{const info=DESIGNS[design];toast(`Vybraný vzhled: ${info.letter} · ${info.name}. Napiš mi tuto variantu v chatu.`);};
  document.addEventListener('keydown',event=>{if(event.altKey||event.metaKey||event.ctrlKey||['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName))return;const next={a:'horizon',b:'atlas',c:'vector'}[event.key.toLowerCase()];if(next){event.preventDefault();design=next;syncDesign();}});
  const used=new Set();for(const mission of MISSIONS){const place=mission.location;if(used.has(place.source))continue;used.add(place.source);const paragraph=document.createElement('p'),link=document.createElement('a'),license=document.createElement('a');link.href=place.source;link.textContent=place.name+' — '+place.credit;license.href=place.licenseUrl;license.textContent=place.license;for(const a of [link,license]){a.target='_blank';a.rel='noopener noreferrer';}paragraph.append(link,' · ',license);$('photoCredits').append(paragraph);}
  renderList();syncMission();syncDesign();
}
if(typeof document!=='undefined')mount();
