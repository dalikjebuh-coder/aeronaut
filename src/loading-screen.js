// The bar reports completed preparation steps. Work with no measurable progress
// stays indeterminate. Only the first launch has a deliberate minimum duration.
export function createLoadingScreen(root,{setTimer=setTimeout,clearTimer=clearTimeout,now=()=>performance.now(),initialMinimumMs=0,reducedMotion=false}={}){
  const title=root.querySelector('strong');
  const detail=root.querySelector('p');
  const progress=root.querySelector('progress');
  let hideTimer;
  let firstLoad=true;
  const firstLoadStarted=now();

  function show(message,{description,completed=0,total}={}){
    if(hideTimer){clearTimer(hideTimer);hideTimer=undefined;}
    const opening=root.hidden||root.classList.contains('is-leaving');
    root.hidden=false;
    root.classList.remove('is-leaving','is-error');
    if(opening){root.classList.remove('is-entering');void root.offsetWidth;root.classList.add('is-entering');}
    title.textContent=message;
    if(description!==undefined)detail.textContent=description;
    progress.hidden=false;
    if(Number.isFinite(total)&&total>0){
      progress.max=total;
      progress.value=Math.max(0,Math.min(total,completed));
    }else progress.removeAttribute('value');
  }

  function finish(){
    firstLoad=false;
    if(progress.hasAttribute('value'))progress.value=progress.max;
    root.classList.remove('is-entering');
    root.classList.add('is-leaving');
    // The overlay stops intercepting input as soon as the minimum has passed.
    if(reducedMotion)root.hidden=true;
    else hideTimer=setTimer(()=>{root.hidden=true;hideTimer=undefined;},180);
  }

  function complete(){
    if(root.hidden||root.classList.contains('is-error')||root.classList.contains('is-leaving'))return;
    if(hideTimer)return;
    const remaining=firstLoad?initialMinimumMs-(now()-firstLoadStarted):0;
    if(remaining>0){
      hideTimer=setTimer(()=>{hideTimer=undefined;finish();},remaining);
      return;
    }
    finish();
  }

  function fail(message,description){
    if(hideTimer){clearTimer(hideTimer);hideTimer=undefined;}
    firstLoad=false;
    root.hidden=false;
    root.classList.remove('is-entering','is-leaving');
    root.classList.add('is-error');
    title.textContent=message;
    detail.textContent=description;
    progress.hidden=true;
  }

  return {show,complete,fail};
}
