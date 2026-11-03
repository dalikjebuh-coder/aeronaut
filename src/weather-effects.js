// Native Cesium clouds: one bounded collection, with stable world positions.
const RAD=Math.PI/180;
const COVERAGE={clear:0,partly:.32,haze:.12,overcast:1};
function noise(x,y,seed=0){const n=Math.sin(x*127.1+y*311.7+seed*74.7)*43758.5453;return n-Math.floor(n);}
export function cloudLayout(lat,lon,weather){
  const coverage=COVERAGE[weather]??0;
  if(!coverage||!Number.isFinite(lat)||!Number.isFinite(lon))return [];
  const band=Math.round(Math.max(-85,Math.min(85,lat))/5)*5;
  const dy=.032,dx=dy/Math.cos(band*RAD),cx=Math.round(lon/dx),cy=Math.round(lat/dy);
  const clouds=[];
  for(let y=cy-10;y<=cy+10;y++)for(let x=cx-10;x<=cx+10;x++){
    if(noise(x,y)>=coverage)continue;
    const latitude=(y+(noise(x,y,1)-.5)*.7)*dy;
    if(Math.abs(latitude)>89)continue;
    const longitude=(x+(noise(x,y,2)-.5)*.7)*dx;
    const distance=Math.hypot((latitude-lat)*111320,(longitude-lon)*111320*Math.cos(lat*RAD));
    // Fade the edge of the local cloud field before recycling its outer cells.
    const alpha=Math.max(0,Math.min(1,(32000-distance)/6500));
    if(alpha===0)continue;
    const size=noise(x,y,3),overcast=weather==='overcast';
    clouds.push({lat:latitude,lon:((longitude+180)%360+360)%360-180,
      altitude:(overcast?2400:2700)+noise(x,y,4)*650,
      width:(overcast?6200:2600)+size*(overcast?2300:2400),
      height:(overcast?1000:850)+size*650,alpha,slice:.36+noise(x,y,5)*.2});
  }
  return clouds;
}

export function createWeatherEffects(viewer){
  const C=window.Cesium;
  const collection=viewer.scene.primitives.add(new C.CloudCollection());
  let weather='clear',time='day',lastPosition=null,dirty=true,destroyed=false;
  function update(){
    const position=viewer.camera.positionCartographic;
    if(!position)return;
    const lat=position.latitude/RAD,lon=position.longitude/RAD;
    if(!dirty&&lastPosition&&Math.hypot(lat-lastPosition.lat,(lon-lastPosition.lon)*Math.cos(lat*RAD))<.006)return;
    lastPosition={lat,lon};dirty=false;
    const layout=cloudLayout(lat,lon,weather);
    const shade=time==='night'?[.24,.3,.43]:time==='evening'?[1,.79,.63]:time==='morning'?[1,.9,.79]:[1,1,1];
    const gray=weather==='overcast'?.8:1;
    for(let i=0;i<layout.length;i++){
      const p=layout[i],cloud=i<collection.length?collection.get(i):collection.add();
      cloud.show=true;
      cloud.position=C.Cartesian3.fromDegrees(p.lon,p.lat,p.altitude);
      cloud.scale=new C.Cartesian2(p.width,p.height);
      cloud.maximumSize=new C.Cartesian3(20,12,8);
      cloud.slice=p.slice;
      cloud.brightness=weather==='overcast'?.75:1;
      cloud.color=new C.Color(shade[0]*gray,shade[1]*gray,shade[2]*gray,p.alpha);
    }
    // Reuse the GPU collection when flying or switching weather.
    for(let i=layout.length;i<collection.length;i++)collection.get(i).show=false;
    collection.show=layout.length>0;
  }
  const removeUpdate=viewer.scene.preUpdate.addEventListener(update);
  return {
    primitives:[collection],
    setConditions(nextWeather,nextTime){weather=nextWeather;time=nextTime;dirty=true;},
    destroy(){if(destroyed)return;destroyed=true;removeUpdate();viewer.scene.primitives.remove(collection);}
  };
}
