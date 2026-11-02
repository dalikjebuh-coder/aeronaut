const ASSET_ROOT='/images/';
export const hangarAircraftImage=(model,view='photo')=>view==='cutout'?`${ASSET_ROOT}hangar-cutout-${model}-v1.png`:`${ASSET_ROOT}hangar-${model}-v1.jpg`;

export function loadHangarImage(src){
  return new Promise((resolve,reject)=>{
    const image=new Image();image.decoding='async';
    image.onload=()=>{const decoded=image.decode?.();Promise.resolve(decoded).catch(()=>{}).then(()=>resolve(src));};
    image.onerror=()=>reject(new Error('Náhled letadla se nepodařilo načíst.'));
    image.src=src;
  });
}
export function createHangarShowcase({stage,image,previous,empty,status,loadImage=loadHangarImage,reducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false}){
  let version=0,requested=null,requestedName='',requestedView=null,visible=null,visibleView=null,view='photo',animations=[];
  stage.dataset.view=view;
  const stop=()=>{for(const animation of animations)animation.cancel();animations=[];};
  async function select(model,name){
    if(requested===model&&requestedView===view)return;
    const token=++version;requested=model;requestedName=name;requestedView=view;stage.dataset.phase='loading';stage.setAttribute('aria-busy','true');status.textContent=`Připravuji ${name}…`;
    try{
      const src=await loadImage(hangarAircraftImage(model,view));
      if(token!==version)return;
      stop();
      if(visible&&visibleView===view){previous.src=visible;previous.hidden=false;}else previous.hidden=true;
      image.src=src;image.alt=`${name} v hangáru — ${view==='photo'?'celá fotografie':'ilustrační náhled'}`;image.hidden=false;empty.hidden=true;
      visible=src;visibleView=view;stage.dataset.model=model;stage.dataset.phase='revealing';stage.setAttribute('aria-busy','false');
      if(!reducedMotion()&&typeof image.animate==='function'){
        const frames=view==='photo'
          ?[{opacity:0,transform:'scale(1.035)',filter:'blur(5px)'},{opacity:1,transform:'scale(1)',filter:'blur(0)'}]
          :[{opacity:0,transform:'translate3d(-46%, 22px, 0) scale(.94)',filter:'blur(7px) brightness(1.7)'},{opacity:1,transform:'translate3d(-50%, 0, 0) scale(1)',filter:'blur(0) brightness(1)'}];
        animations.push(image.animate(frames,{duration:850,easing:'cubic-bezier(.16,1,.3,1)'}));
        if(!previous.hidden&&typeof previous.animate==='function')animations.push(previous.animate([{opacity:.75},{opacity:0}],{duration:240,easing:'ease-out',fill:'forwards'}));
        await Promise.all(animations.map(animation=>animation.finished.catch(()=>{})));
        if(token!==version)return;
      }
      previous.hidden=true;stage.dataset.phase='ready';status.textContent=`${name} připraven k letu.`;
    }catch{
      if(token!==version)return;
      stop();visible=null;visibleView=null;requested=null;requestedView=null;image.hidden=true;previous.hidden=true;empty.hidden=false;
      stage.dataset.phase='error';stage.setAttribute('aria-busy','false');status.textContent='Náhled se nepodařilo načíst. Letadlo je vybrané, můžeš pokračovat nebo ho vybrat znovu.';
    }
  }
  function setView(next){
    if(!['photo','cutout'].includes(next)||next===view)return;
    view=next;stage.dataset.view=view;image.hidden=true;previous.hidden=true;
    if(requested)return select(requested,requestedName);
  }
  return{select,setView,get view(){return view;},get selected(){return requested;},get visible(){return visible;}};
}
