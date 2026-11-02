// Keep the flight HUD clear of map attribution as its height changes.
export function installFlightUiLayout({document,ResizeObserver=globalThis.ResizeObserver}){
  const credits=document.querySelector('.cesium-viewer-bottom');
  const refresh=()=>{
    const height=credits?.getBoundingClientRect().height;
    if(height>0)document.body.style.setProperty('--map-credits-height',`${Math.max(24,Math.ceil(height))}px`);
  };
  const observer=ResizeObserver?new ResizeObserver(refresh):null;
  if(credits)observer?.observe(credits);
  refresh();
  return{refresh,destroy:()=>observer?.disconnect()};
}
