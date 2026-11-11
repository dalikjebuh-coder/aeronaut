import {CHAPTERS} from './campaign.js';
import {missionProgress} from './mission-progression.js';

const TURBULENCE_KEY='aeronaut.achievement.v1.cloud-turbulence';
const ENGINE_OUT_KEY='aeronaut.achievement.v1.engine-out';
const hasMedal=(progress,id,level='bronze')=>({bronze:1,silver:2,gold:3}[progress.medals.get(id)]||0)>=({bronze:1,silver:2,gold:3}[level]||1);

const FLIGHT_BADGES=Object.freeze([
  {id:'first-flight',title:'První vzlet',hint:'Dokonči úvodní výcvikový let.',image:'/images/badge-first-flight.svg',earned:progress=>progress.completed.has('first-takeoff')},
  {id:'first-gold',title:'Zlatá ruka',hint:'Získej první zlatou medaili.',image:'/images/badge-first-gold.svg',earned:progress=>[...progress.medals.values()].includes('gold')},
  {id:'night-flight',title:'Noční navigátor',hint:'Dokonči noční let nad Paříží.',image:'/images/badge-night-flight.svg',earned:progress=>progress.completed.has('paris')},
  {id:'crosswind',title:'Proti větru',hint:'Bezpečně dokonči přílet na Madeiru v bočním větru.',image:'/images/badge-crosswind.svg',earned:progress=>progress.completed.has('madeira')},
  {id:'hard-landing',title:'Pevná ruka na finále',hint:'Dokonči přistání v Innsbrucku, Gibraltaru nebo na Santos Dumont.',image:'/images/badge-hard-landing.svg',earned:progress=>['innsbruck','gibraltar','santos-dumont'].some(id=>progress.completed.has(id))},
  {id:'low-flight',title:'Strážce koridoru',hint:'Získej alespoň stříbro v hlídce kaňonu nebo v nízkém letu.',image:'/images/badge-low-flight.svg',earned:progress=>['canyon-patrol','monument-valley','iguazu'].some(id=>hasMedal(progress,id,'silver'))},
  {id:'engine-out',title:'Klid v nouzi',hint:'Dokonči let po skutečném výpadku motoru.',image:'/images/badge-engine-out.svg',earned:(_,storage)=>{try{return storage?.getItem(ENGINE_OUT_KEY)==='1';}catch{return false;}}},
  {id:'cloud-turbulence',title:'Skrz turbulenci',hint:'Proleť turbulentním úsekem při zatažené obloze.',image:'/images/badge-cloud-turbulence.svg',earned:(_,storage)=>{try{return storage?.getItem(TURBULENCE_KEY)==='1';}catch{return false;}}}
]);

function storeFor(storage){if(storage!==undefined)return storage;try{return globalThis.localStorage;}catch{return null;}}

export function achievementCollection(storage){
  const store=storeFor(storage),progress=missionProgress(store);
  const chapters=CHAPTERS.map((chapter,index)=>({id:`chapter-${index+1}`,group:'career',title:chapter.award,hint:`Dokonči kapitolu ${index+1}: ${chapter.title}.`,image:`/images/rank-${index+1}.svg`,earned:chapter.ids.every(id=>progress.completed.has(id))}));
  const flights=FLIGHT_BADGES.map(badge=>({id:badge.id,group:'flight',title:badge.title,hint:badge.hint,image:badge.image,earned:badge.earned(progress,store)}));
  const items=[...chapters,...flights],earned=items.filter(item=>item.earned).length;
  return{items,earned,total:items.length,remaining:items.length-earned};
}

function recordEvent(key,storage){
  const store=storeFor(storage);
  try{
    if(store?.getItem(key)==='1')return false;
    store?.setItem(key,'1');
    return store?.getItem(key)==='1';
  }catch{return false;}
}
export const recordCloudTurbulence=storage=>recordEvent(TURBULENCE_KEY,storage);
export const recordEngineOutCompletion=storage=>recordEvent(ENGINE_OUT_KEY,storage);

export function createAchievementGallery(document,{storage,onPause=()=>{}}={}){
  const $=id=>document.getElementById(id);
  let filter='all';
  function render(){
    const collection=achievementCollection(storage);
    $('menuBadgesButton').textContent=`Odznaky · ${collection.earned}/${collection.total}`;
    $('badgeJournalCount').textContent=`${collection.earned} z ${collection.total} odznaků získáno`;
    $('badgeCollectedCount').textContent=collection.earned;
    $('badgeRemainingCount').textContent=collection.remaining;
    $('badgeCollectionProgress').max=collection.total;
    $('badgeCollectionProgress').value=collection.earned;
    $('badgePercent').textContent=`${Math.round(collection.earned/collection.total*100)} %`;
    for(const [id,value,count,label] of [['badgeFilterAll','all',collection.total,'Všechny'],['badgeFilterEarned','earned',collection.earned,'Získané'],['badgeFilterMissing','missing',collection.remaining,'Chybí']]){
      $(id).setAttribute('aria-pressed',String(filter===value));$(id).textContent=`${label} · ${count}`;
    }
    for(const [group,target] of [['career','badgeCareerGrid'],['flight','badgeFlightGrid']]){
      const items=collection.items.filter(item=>item.group===group&&(filter==='all'||(filter==='earned')===item.earned));
      $(target).replaceChildren(...items.map(item=>{
        const card=document.createElement('article'),art=document.createElement('div'),image=document.createElement('img'),copy=document.createElement('div'),title=document.createElement('h3'),hint=document.createElement('p'),status=document.createElement('span');
        card.className='achievement-card';card.dataset.earned=String(item.earned);
        art.className='achievement-art';image.src=item.image;image.alt='';image.loading='lazy';art.append(image);
        copy.className='achievement-copy';title.textContent=item.title;hint.textContent=item.hint;status.className='achievement-status';status.textContent=item.earned?'✓ ZÍSKÁNO':'○ ČEKÁ';
        copy.append(status,title,hint);card.append(art,copy);return card;
      }));
      $(target).parentElement.hidden=!items.length;
    }
    $('badgeJournalEmpty').hidden=collection.items.some(item=>filter==='all'||(filter==='earned')===item.earned);
    $('badgeJournalEmpty').textContent=filter==='earned'?'První odznak získáš dokončením úvodního letu.':'Všechny odznaky už máš.';
    return collection;
  }
  function open(){onPause();render();$('badgeDialog').showModal();}
  $('menuBadgesButton').disabled=false;
  $('menuBadgesButton').onclick=open;
  $('badgeJournalButton').onclick=open;
  $('careerBadgeCollectionButton').onclick=()=>{$('careerJournal').close();open();};
  for(const [id,value] of [['badgeFilterAll','all'],['badgeFilterEarned','earned'],['badgeFilterMissing','missing']])$(id).onclick=()=>{filter=value;render();};
  render();
  return{open,refresh:()=>render()};
}
