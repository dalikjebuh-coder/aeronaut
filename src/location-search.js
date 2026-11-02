// Submit-only search: editing text cancels old results without sending requests.
export function locationSearchResults(C,results){
  return results.flatMap(result=>{
    try{
      const destination=result.destination;
      const point=destination instanceof C.Rectangle?C.Rectangle.center(destination,new C.Cartographic()):C.Cartographic.fromCartesian(destination);
      if(!point)return[];
      const lat=C.Math.toDegrees(point.latitude),lon=C.Math.toDegrees(point.longitude);
      if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>80||Math.abs(lon)>180)return[];
      return[{lat,lon,name:String(result.displayName||'Nalezené místo'),result}];
    }catch{return[];}
  }).slice(0,5);
}

export function createLocationSearch({C,document,canSearch,getToken,request,onPick,onNeedToken,onResults=()=>{},onClear=()=>{}}){
  const form=document.getElementById('locationSearch'),input=document.getElementById('locationQuery'),button=document.getElementById('locationSearchButton'),results=document.getElementById('locationSearchResults'),status=document.getElementById('locationSearchStatus');
  let serial=0,pending=false;
  function refresh(){
    const disabled=!canSearch();
    if(disabled&&pending)cancel();
    input.disabled=disabled;button.disabled=disabled||pending;
    form.setAttribute('aria-busy',String(pending));button.textContent=pending?'Hledám…':'Najít místo';
  }
  function cancel(){serial++;pending=false;onClear();results.replaceChildren();results.hidden=true;status.textContent='';status.hidden=true;}
  function message(text){status.textContent=text;status.hidden=false;}
  input.addEventListener('input',()=>{cancel();refresh();});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!canSearch()||pending)return;
    const query=input.value.trim();cancel();
    if(query.length<2){message('Napiš alespoň dva znaky názvu místa nebo adresy.');return;}
    if(!getToken()){onNeedToken();return;}
    const current=serial;pending=true;refresh();message('Hledám místo…');
    try{
      const found=locationSearchResults(C,await request(query));
      if(current!==serial||!canSearch())return;
      if(!found.length){message('Místo se nepodařilo najít. Zkus přesnější název, město nebo adresu.');return;}
      onResults(found.map(place=>place.result));
      message('Vyber místo startu z výsledků:');
      for(const place of found){
        const item=document.createElement('button');item.type='button';item.className='location-search-result';
        const title=document.createElement('strong');title.textContent=place.name;
        const coordinates=document.createElement('span');coordinates.textContent=`${place.lat.toFixed(5)}° / ${place.lon.toFixed(5)}°`;
        item.append(title,coordinates);
        item.addEventListener('click',()=>{if(current!==serial||!canSearch())return;cancel();onPick(place);refresh();});
        results.append(item);
      }
      results.hidden=false;
    }catch(error){
      if(current!==serial||!canSearch())return;
      const code=Number(error?.statusCode||error?.status);
      message(code===401||code===403?'Vyhledávání nemá přístup. V nastavení tokenu Cesium ion povol oprávnění geocode.':error?.code==='TIMEOUT'?'Hledání trvalo příliš dlouho. Zkus to znovu.':'Vyhledávání se nepodařilo. Zkontroluj připojení a zkus to znovu.');
    }finally{if(current===serial){pending=false;refresh();}}
  });
  refresh();return{refresh,cancel};
}
