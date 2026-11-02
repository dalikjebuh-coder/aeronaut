import {createGeographyExplorer,WIKI_LICENSE,pointDistance} from './geography.js';
import {shortPlaceText,collectionProgress,createFlyoverCards,FLYOVER_RADIUS_METERS} from './geography-cards.js';

const formatDistance=distance=>distance<1000?`${Math.round(distance)} m`:`${(distance/1000).toFixed(1)} km`;
const localPhotoSource=src=>{const base=globalThis.window?.AERONAUT_CONFIG?.basePath||'/';return typeof src==='string'&&src.startsWith(base)&&/^images\/places\/wiki-[a-z0-9-]+\.(jpg|png)$/.test(src.slice(base.length));};
const photoSource=point=>localPhotoSource(point.photo?.src)||/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(point.photo?.src||'')?point.photo.src:null;
const photoPage=point=>point.photo?.url?.startsWith('https://commons.wikimedia.org/wiki/')?point.photo.url:point.url;
export function createGeographyGuide(viewer,{document,storage,fetcher=globalThis.fetch,onPause=()=>{},now=Date.now}={}){
  if(storage===undefined){try{storage=globalThis.localStorage;}catch{storage=null;}}
  const $=id=>document.getElementById(id),C=window.Cesium,source=new C.CustomDataSource('Zeměpisný průvodce');
  viewer.dataSources.add(source);source.show=false;
  const markers=new Map(),cards=createFlyoverCards();
  let missionPlaces=new Set();
  let active=false,paused=false,lastUpdate=-Infinity,lastState=null,lastFlightTime=0,depthTestDistance=Infinity,filter='all',renderedId=null,animation=null,animationId=0,regionKey='';
  const explorer=createGeographyExplorer({storage,fetcher,now,onChange:()=>{syncButtons();if($('geographyDialog').open)renderJournal();}});
  try{explorer.setEnabled(storage?.getItem('aeronaut.geography.enabled')!=='false');}catch{}
  source.credit=new C.Credit('<a href="https://www.wikipedia.org/">Zajímavá místa: Wikipedie</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>');
  const leader='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="40"><path d="M6 0V38M2 34L6 38L10 34" stroke="#132331" stroke-width="4" fill="none"/><path d="M6 0V38M2 34L6 38L10 34" stroke="#ffd37c" stroke-width="1.6" fill="none"/></svg>');
  const progress=(region='all')=>collectionProgress(explorer.catalog,explorer.visitedIds,region);
  function syncButtons(){
    const stats=progress(),count=stats.total?`${stats.collected}/${stats.total}`:'…';
    $('guideButton').setAttribute('aria-pressed',String(explorer.enabled));$('guideButton').setAttribute('aria-label',explorer.enabled?'Vypnout průvodce místy':'Zapnout průvodce místy');
    $('guideJournalButton').textContent=`Sbírka · ${count}`;$('menuAtlasButton').textContent=`Sbírka · ${count}`;
  }
  function renderMarkers(){
    const displayed=[];
    for(const point of explorer.nearby){if(missionPlaces.has(point.id)||point.distance>18000||displayed.some(other=>pointDistance(point,other)<350))continue;displayed.push(point);if(displayed.length===9)break;}
    const ids=new Set(displayed.map(point=>point.id));
    for(const [id,entity] of markers)if(!ids.has(id)){source.entities.remove(entity);markers.delete(id);}
    for(const point of displayed){
      const text=`${point.name}\n${formatDistance(point.distance)}`;
      if(markers.has(point.id)){markers.get(point.id).label.text=text;continue;}
      markers.set(point.id,source.entities.add({position:C.Cartesian3.fromDegrees(point.lon,point.lat,6),billboard:{image:leader,width:12,height:40,verticalOrigin:C.VerticalOrigin.BOTTOM,heightReference:C.HeightReference.RELATIVE_TO_3D_TILE,disableDepthTestDistance:depthTestDistance},label:{text,font:'600 13px sans-serif',fillColor:C.Color.fromCssColorString('#ffdc99'),outlineColor:C.Color.fromCssColorString('#112130'),outlineWidth:3,style:C.LabelStyle.FILL_AND_OUTLINE,showBackground:true,backgroundColor:new C.Color(.04,.09,.14,.85),backgroundPadding:new C.Cartesian2(7,5),verticalOrigin:C.VerticalOrigin.BOTTOM,pixelOffset:new C.Cartesian2(0,-44),heightReference:C.HeightReference.RELATIVE_TO_3D_TILE,disableDepthTestDistance:depthTestDistance,scaleByDistance:new C.NearFarScalar(1000,1,20000,.65),distanceDisplayCondition:new C.DistanceDisplayCondition(0,24000)}}));
    }
  }
  function hideCard(animate=false){
    const card=$('guideCard'),token=++animationId;animation?.cancel();animation=null;
    if(animate&&!card.hidden&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches&&card.animate){
      animation=card.animate([{transform:'translateX(0)',opacity:1},{transform:'translateX(110%)',opacity:0}],{duration:300,easing:'ease-in'});
      animation.onfinish=()=>{if(animationId===token){card.hidden=true;renderedId=null;}};
    }else{card.hidden=true;renderedId=null;}
  }
  function showCard(point){
    const card=$('guideCard');
    if(renderedId===point.id&&!card.hidden)return;
    animationId++;animation?.cancel();renderedId=point.id;
    $('guideName').textContent=point.name;$('guideText').textContent=shortPlaceText(point,130);
    $('guideLanguage').textContent='Nad čím prolétáte';
    $('guideDiscovered').textContent=point.collection||'Zajímavost v okolí';
    $('guideSource').href=point.url;$('guideSource').textContent=point.language==='en'?'Zdroj: Wikipedie (EN) ↗':'Zdroj: Wikipedie ↗';
    const src=photoSource(point),photo=$('guidePhoto');photo.hidden=!src;$('guidePhotoEmpty').hidden=Boolean(src);
    photo.alt=point.name;photo.referrerPolicy='no-referrer';photo.onerror=()=>{photo.hidden=true;$('guidePhotoEmpty').hidden=false;};
    if(src)photo.src=src;
    $('guidePhotoCredit').textContent=point.photo?`Foto: ${point.photo.credit} · ${point.photo.license}`:'Fotografie není k dispozici';$('guidePhotoCredit').href=photoPage(point);
    const stats=progress();$('guideCardCollection').textContent=point.collection?`${stats.collected} / ${stats.total} míst ve sbírce`:'Další objev mimo základní sbírku';
    card.hidden=false;
    if(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)animation=card.animate?.([{transform:'translateX(110%)',opacity:0},{transform:'translateX(0)',opacity:1}],{duration:520,easing:'cubic-bezier(.16,1,.3,1)'});
  }
  function listPoint(point,{collectible=false}={}){
    const item=document.createElement('article'),image=document.createElement('img'),photo=document.createElement('div'),heading=document.createElement('h3'),text=document.createElement('p'),link=document.createElement('a'),note=document.createElement('small'),content=document.createElement('div'),badge=document.createElement('span');
    const visited=collectible?point.visited:true,src=photoSource(point);item.className='place-collectible '+(visited?'is-collected':'is-missing');photo.className='place-collectible-photo';
    image.alt=point.name;image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';
    if(src)image.src=src;else image.hidden=true;image.onerror=()=>{image.hidden=true;};
    photo.append(image);badge.className='place-collectible-badge';badge.textContent=visited?'✓ NAVŠTÍVENO':'○ CHYBÍ';photo.append(badge);
    heading.textContent=point.name;note.textContent=(point.collection||'Další objev')+(lastState?' · '+formatDistance(pointDistance(point,lastState)):'');
    text.textContent=visited?shortPlaceText(point):'Proleť nad tímto místem a odemkni jeho zajímavosti.';
    link.textContent='O místě ↗';link.href=point.url;link.target='_blank';link.rel='noopener noreferrer';
    content.className='place-collectible-info';content.append(heading,note,text,link);
    if(point.photo){const credit=document.createElement('a');credit.className='place-photo-credit';credit.href=photoPage(point);credit.target='_blank';credit.rel='noopener noreferrer';credit.textContent=`Foto: ${point.photo.credit} · ${point.photo.license}`;content.append(credit);}
    item.append(photo,content);return item;
  }
  function renderJournal(){
    const groups=[...new Set(explorer.catalog.map(point=>point.collection))].filter(Boolean).sort((a,b)=>a.localeCompare(b,'cs')),key=groups.join('|');
    if(regionKey!==key){
      const selected=$('guideRegion').value,options=['all',...groups].map(value=>{const option=document.createElement('option');option.value=value;option.textContent=value==='all'?'Celá sbírka':value;return option;});
      $('guideRegion').replaceChildren(...options);$('guideRegion').value=groups.includes(selected)?selected:'all';regionKey=key;
    }
    const stats=progress($('guideRegion').value||'all'),query=$('guideSearch').value.trim().toLocaleLowerCase('cs');
    $('guideJournalCount').textContent=`${stats.collected} z ${stats.total} míst posbíráno`;
    $('guideRemainingCount').textContent=stats.remaining;$('guideCollectedCount').textContent=stats.collected;$('guideTotalCount').textContent=stats.total;
    $('guideCollectionProgress').max=Math.max(1,stats.total);$('guideCollectionProgress').value=stats.collected;$('guidePercent').textContent=`${stats.percent} %`;
    $('guideDataStatus').textContent='Svět pod křídly · základní sbírka. Další místa z Wikipedie se ukládají jako bonusové objevy.';
    for(const [id,value,count] of [['guideFilterAll','all',stats.total],['guideFilterVisited','visited',stats.collected],['guideFilterMissing','missing',stats.remaining]]){
      $(id).setAttribute('aria-pressed',String(filter===value));$(id).textContent=({all:'Všechna',visited:'Navštívená',missing:'Chybí'})[value]+` · ${count}`;
    }
    const match=point=>!query||`${point.name} ${point.text} ${point.collection||''}`.toLocaleLowerCase('cs').includes(query);
    const list=stats.items.filter(point=>match(point)&&(filter==='all'||(filter==='visited')===point.visited)).sort((a,b)=>(a.collection||'').localeCompare(b.collection||'','cs')||a.name.localeCompare(b.name,'cs'));
    $('guideDiscoveries').replaceChildren(...list.map(point=>listPoint(point,{collectible:true})));
    $('guideJournalEmpty').hidden=Boolean(list.length);$('guideJournalEmpty').textContent=filter==='missing'&&!stats.remaining?'Hotovo! Všechna místa této sbírky už máš.':'Žádná místa neodpovídají filtru. Zkus jinou oblast nebo hledání.';
    const catalogIds=new Set(explorer.catalog.map(point=>point.id)),extras=explorer.discoveries.filter(point=>!catalogIds.has(point.id));
    $('guideExtraCount').textContent=extras.length;$('guideNearby').replaceChildren(...extras.filter(match).slice(0,100).map(point=>listPoint(point)));
    $('guideExtrasSection').hidden=!extras.length;$('guideJournalLimit').hidden=extras.filter(match).length<=100;
  }
  function toggle(){
    explorer.setEnabled(!explorer.enabled);source.show=active&&explorer.enabled;cards.reset();hideCard();explorer.resetFlyovers();
    try{storage?.setItem('aeronaut.geography.enabled',String(explorer.enabled));}catch{}
  }
  function openJournal(){onPause();renderJournal();$('geographyDialog').showModal();$('guideSearch').focus();}
  $('menuAtlasButton').disabled=false;$('menuAtlasButton').onclick=openJournal;
  $('guideButton').onclick=toggle;$('guideJournalButton').onclick=openJournal;
  $('guideClose').onclick=()=>{cards.dismiss(lastState?.elapsed||0);hideCard(true);};
  $('guideSource').onclick=onPause;$('guidePhotoCredit').onclick=onPause;$('guideSearch').oninput=renderJournal;$('guideRegion').onchange=renderJournal;
  for(const [id,value] of [['guideFilterAll','all'],['guideFilterVisited','visited'],['guideFilterMissing','missing']])$(id).onclick=()=>{filter=value;renderJournal();};
  $('guideLicense').href=WIKI_LICENSE;syncButtons();
  const ready=fetcher('/geography-places.json').then(response=>{if(!response.ok)throw new Error('Guide unavailable');return response.json();}).then(points=>{explorer.addSeeds(points);return true;}).catch(()=>false);
  return{source,ready,toggle,openJournal,
    collectPlace:id=>explorer.collectPlace(id),
    setMissionPlaces(ids){missionPlaces=new Set(ids);renderMarkers();},
    setDepthTest(enabled){depthTestDistance=enabled?0:Infinity;for(const entity of markers.values()){entity.label.disableDepthTestDistance=depthTestDistance;entity.billboard.disableDepthTestDistance=depthTestDistance;}},
    update(state,{active:nextActive=false,paused:nextPaused=false,ground,auto=true,visible=true}={}){
      if(active&&!nextActive)explorer.cancel();
      if(!active&&nextActive||state.elapsed<lastFlightTime){cards.reset();explorer.resetFlyovers();hideCard();}
      active=nextActive;paused=nextPaused;lastState=state;lastFlightTime=state.elapsed;
      source.show=active&&visible&&explorer.enabled;
      if(!active||paused||!visible||!auto||!explorer.enabled)hideCard();
      if(cards.current&&pointDistance(cards.current,state)>FLYOVER_RADIUS_METERS){cards.update([],state.elapsed,state);hideCard();}
      if(!active||!explorer.enabled||now()-lastUpdate<500)return;lastUpdate=now();
      const found=explorer.update(state,{ground,discover:!paused&&visible,network:!paused&&visible,excludeIds:missionPlaces});renderMarkers();syncButtons();
      if(!paused&&visible&&auto){
        const point=cards.update(found,state.elapsed,state);
        if(point){showCard(point);$('guideDistance').textContent=formatDistance(pointDistance(point,state));$('guideCardTime').style.transform=`scaleX(${cards.remaining(state.elapsed)})`;}
        else if(!$('guideCard').hidden)hideCard(true);
      }
      if(found.length&&$('geographyDialog').open)renderJournal();
    }
  };
}
