import {offsetMeters,validCoordinates} from './flight.js';
import {flyoverDistance,FLYOVER_RADIUS_METERS} from './geography-cards.js';

export const WIKI_LICENSE='https://creativecommons.org/licenses/by-sa/4.0/';
export const VISITED_STORAGE='aeronaut.visited.v2';
export const GUIDE_STORAGE='aeronaut.discoveries.v1';
export const pointDistance=(point,state)=>{const xy=offsetMeters(point.lat,point.lon,state);return Math.hypot(xy.x,xy.y);};
const cleanText=value=>String(value||'').replace(/\s+/g,' ').trim();
export function wikiPoints(data,language='cs'){
  if(!['cs','en'].includes(language))return [];
  return(Array.isArray(data?.query?.pages)?data.query.pages:[]).flatMap(page=>{
    if(!page||typeof page.title!=='string'||!Number.isInteger(page.pageid))return [];
    const coordinate=page.coordinates?.find(point=>point.globe==='earth'||!point.globe),text=cleanText(page.extract);
    if(!coordinate||!validCoordinates(coordinate.lat,coordinate.lon)||!text||page.missing||page.pageprops?.disambiguation!==undefined)return [];
    return[{id:`${language}:${page.pageid}`,name:cleanText(page.title).slice(0,100),lat:coordinate.lat,lon:coordinate.lon,text:text.length>420?text.slice(0,417).trimEnd()+'…':text,url:`https://${language}.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(' ','_'))}`,language,source:'Wikipedie',license:WIKI_LICENSE,...(/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(page.thumbnail?.source||'')&&page.pageimage?{photo:{src:page.thumbnail.source,file:page.pageimage,url:'https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(page.pageimage),credit:'Autoři a licence na stránce fotografie',license:'Wikimedia Commons'}}:{})}];
  });
}
export function wikiNearbyUrl(lat,lon,language='cs'){
  if(!validCoordinates(lat,lon)||!['cs','en'].includes(language))throw new Error('Invalid geographic query');
  const params=new URLSearchParams({action:'query',format:'json',formatversion:'2',origin:'*',generator:'geosearch',ggscoord:`${lat.toFixed(4)}|${lon.toFixed(4)}`,ggsradius:'10000',ggslimit:'20',prop:'coordinates|extracts|pageprops|pageimages',piprop:'thumbnail|name',pilicense:'free',pithumbsize:'640',colimit:'max',exintro:'1',explaintext:'1',exchars:'450',exlimit:'20',ppprop:'disambiguation',maxlag:'5'});
  return`https://${language}.wikipedia.org/w/api.php?${params}`;
}
const simpleName=value=>value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function nearbyPlaces(points,state,limit=12){
  const sorted=points.filter(point=>validCoordinates(point.lat,point.lon)).map(point=>({...point,distance:pointDistance(point,state)})).filter(point=>point.distance<=35000).sort((a,b)=>a.distance-b.distance),picked=[];
  for(const point of sorted){
    if(picked.some(other=>other.id===point.id||(pointDistance(point,other)<100&&(simpleName(other.name).includes(simpleName(point.name))||simpleName(point.name).includes(simpleName(other.name))))))continue;
    picked.push(point);if(picked.length===limit)break;
  }
  return picked;
}
function validStoredPoint(point){
  if(!point||typeof point.id!=='string'||typeof point.name!=='string'||typeof point.text!=='string'||!validCoordinates(point.lat,point.lon))return false;
  try{return /^\/(wiki|w)\//.test(new URL(point.url).pathname)&&/^https:\/\/(cs|en)\.wikipedia\.org\//.test(point.url);}catch{return false;}
}
export function createGeographyExplorer({seeds=[],fetcher=globalThis.fetch,now=Date.now,storage,onChange=()=>{}}={}){
  if(storage===undefined){try{storage=globalThis.localStorage;}catch{storage=null;}}
  let enabled=true,nearby=[],lastState=null,lastRequest=null,nextRequest=0,pending=null,generation=0,available='local';
  const catalog=new Map(seeds.map(point=>[point.id,point])),points=new Map(catalog),cache=new Map(),discovered=new Map(),visited=new Set(),zones=new Map();let previousFlight=null;
  try{const stored=JSON.parse(storage?.getItem(GUIDE_STORAGE)||'[]');if(Array.isArray(stored))for(const point of stored.slice(-300))if(validStoredPoint(point))discovered.set(point.id,point);}catch{}
  try{const ids=JSON.parse(storage?.getItem(VISITED_STORAGE)||'[]');if(Array.isArray(ids))for(const id of ids.slice(-50000))if(typeof id==='string'&&/^(cs|en):\d+$/.test(id))visited.add(id);}catch{}
  for(const id of discovered.keys())visited.add(id);
  function persist(){try{if(!storage)return false;storage.setItem(VISITED_STORAGE,JSON.stringify([...visited]));storage.setItem(GUIDE_STORAGE,JSON.stringify([...discovered.values()].slice(-300)));return true;}catch{return false;}}
  function refreshNearby(){if(lastState)nearby=nearbyPlaces([...points.values()],lastState);}
  function merge(items){for(const point of items){if(point.language==='en'&&[...points.values()].some(other=>other.language==='cs'&&pointDistance(point,other)<80))continue;points.set(point.id,{...point,...(catalog.get(point.id)||{})});}for(const id of points.keys()){if(points.size<=600)break;if(!catalog.has(id))points.delete(id);}refreshNearby();}
  async function request(state){
    const started=now(),token=generation,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
    pending=controller;lastRequest={...state};nextRequest=started+30000;available='loading';
    const key=`${Math.round(state.lat*10)},${Math.round(state.lon*Math.cos(state.lat*Math.PI/180)*10)}`;
    try{
      if(cache.has(key)){merge(cache.get(key));available='online';return;}
      let items=[];
      for(const language of ['cs','en']){
        if(token!==generation||!enabled||controller.signal.aborted)return;
        const response=await fetcher(wikiNearbyUrl(state.lat,state.lon,language),{signal:controller.signal,credentials:'omit',headers:{'Api-User-Agent':'AeronautFlightSimulator/0.1 (local personal educational application)'}});
        if(!response.ok){const error=new Error('Nearby data unavailable');error.retry=Number(response.headers?.get('Retry-After'))||0;throw error;}
        const data=await response.json();if(token!==generation||!enabled||controller.signal.aborted)return;if(data.error)throw new Error('Nearby API unavailable');
        items.push(...wikiPoints(data,language));if(items.length>=8)break;
      }
      if(token!==generation||!enabled||controller.signal.aborted)return;
      cache.set(key,items);while(cache.size>24)cache.delete(cache.keys().next().value);
      if(lastState&&pointDistance(lastState,state)<15000)merge(items);
      available='online';
    }catch(error){if(token===generation){available='local';nextRequest=now()+Math.max(90000,Math.min(900000,(error.retry||0)*1000));}}
    finally{clearTimeout(timer);if(pending===controller)pending=null;if(token===generation)onChange();}
  }
  return{
    collectPlace(id){
      const point=catalog.get(id);if(!point||!validStoredPoint(point))return null;
      const isNew=!visited.has(id),entry={...point,foundAt:new Date(now()).toISOString()};
      visited.add(id);discovered.delete(id);discovered.set(id,entry);
      while(discovered.size>300)discovered.delete(discovered.keys().next().value);
      const saved=persist();onChange();return{...entry,isNew,saved};
    },
    addSeeds(items){for(const point of items)catalog.set(point.id,point);merge(items);onChange();},
    setEnabled(value){enabled=value;if(!enabled)this.cancel();onChange();},
    resetFlyovers(){zones.clear();previousFlight=null;},
    cancel(){generation++;pending?.abort();pending=null;lastRequest=null;available='local';},
    update(state,{ground,discover=true,network=true,excludeIds=new Set()}={}){
      if(!enabled||!validCoordinates(state.lat,state.lon))return [];
      lastState={...state};refreshNearby();const found=[];
      if(previousFlight&&state.elapsed<previousFlight.elapsed){zones.clear();previousFlight=null;}
      if(discover&&!state.onGround&&Number.isFinite(ground)&&state.altitude-ground<3000&&state.altitude>=ground){
        for(const point of points.values()){
          if(excludeIds.has(point.id))continue;
          const distance=pointDistance(point,state),zone=zones.get(point.id)||{inside:false,last:-Infinity};
          if(distance>1000)zone.inside=false;
          if(!zone.inside&&state.elapsed-zone.last>90&&flyoverDistance(point,previousFlight,state)<=FLYOVER_RADIUS_METERS){
            const isNew=!visited.has(point.id),entry={...point,foundAt:new Date(now()).toISOString()};delete entry.distance;
            visited.add(point.id);discovered.delete(point.id);discovered.set(point.id,entry);found.push({...entry,isNew});
            zone.inside=distance<1000;zone.last=state.elapsed;
          }
          if(distance<2000||zones.has(point.id))zones.set(point.id,zone);
        }
        if(found.length){while(discovered.size>300)discovered.delete(discovered.keys().next().value);persist();}
        previousFlight={...state};
      }else previousFlight=null;
      if(network&&!pending&&now()>=nextRequest&&(!lastRequest||pointDistance(lastRequest,state)>3500))void request(state);
      return found;
    },
    get catalog(){return [...catalog.values()];},get visitedIds(){return new Set(visited);},get nearby(){return nearby;},get discoveries(){return [...discovered.values()].reverse();},get status(){return available;},get enabled(){return enabled;},get pending(){return Boolean(pending);}
  };
}
