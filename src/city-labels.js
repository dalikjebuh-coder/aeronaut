import {RAD,EARTH} from './flight.js';

export function nearbyCities(cities,lat,lon,limit=36){
  const nearby=[];
  for(const city of cities){
    const [name,cityLat,cityLon,population]=city;
    const north=(cityLat-lat)*RAD*EARTH;
    const wrappedLon=((cityLon-lon+540)%360)-180;
    const east=wrappedLon*RAD*EARTH*Math.cos(lat*RAD);
    const distance=Math.hypot(north,east);
    if(distance<=80000)nearby.push({name,lat:cityLat,lon:cityLon,population,distance});
  }
  nearby.sort((a,b)=>b.population-a.population||a.distance-b.distance);
  const picked=[];
  for(const city of nearby){
    if(picked.every(other=>{
      const north=(city.lat-other.lat)*RAD*EARTH;
      const east=(((city.lon-other.lon+540)%360)-180)*RAD*EARTH*Math.cos(lat*RAD);
      return Math.hypot(north,east)>2500;
    }))picked.push(city);
    if(picked.length>=limit)break;
  }
  return picked;
}

export function createCityLabels(viewer){
  const C=window.Cesium;
  const source=new C.CustomDataSource('Názvy měst');
  viewer.dataSources.add(source);
  source.show=false;
  const leaderImage='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="38" viewBox="0 0 12 38"><path d="M6 1V36M2 32L6 36L10 32" fill="none" stroke="#17211e" stroke-opacity=".85" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 1V36M2 32L6 36L10 32" fill="none" stroke="#d8ef8d" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>');
  viewer.scene.frameState.creditDisplay.addStaticCredit(new C.Credit('<a href="https://www.geonames.org/">GeoNames</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>'));
  let cities=[],lastLat=NaN,lastLon=NaN,depthTestDistance=Infinity;
  const layer={source,ready:null,setDepthTest(enabled){depthTestDistance=enabled?0:Infinity;for(const entity of source.entities.values){if(entity.label)entity.label.disableDepthTestDistance=depthTestDistance;if(entity.billboard)entity.billboard.disableDepthTestDistance=depthTestDistance;}},update(lat,lon){
    if(!source.show||!cities.length||!Number.isFinite(lat)||!Number.isFinite(lon))return;
    const moveNorth=(lat-lastLat)*RAD*EARTH;
    const moveEast=((((lon-lastLon+540)%360)-180)*RAD*EARTH*Math.cos(lat*RAD));
    if(Math.hypot(moveNorth,moveEast)<5000)return;
    lastLat=lat;lastLon=lon;source.entities.removeAll();
    for(const city of nearbyCities(cities,lat,lon)){
      source.entities.add({
        position:C.Cartesian3.fromDegrees(city.lon,city.lat,2),
        billboard:{image:leaderImage,width:12,height:38,verticalOrigin:C.VerticalOrigin.BOTTOM,heightReference:C.HeightReference.RELATIVE_TO_3D_TILE,disableDepthTestDistance:depthTestDistance},
        label:{text:city.name,font:'600 14px sans-serif',fillColor:C.Color.WHITE,outlineColor:C.Color.fromCssColorString('#17211e'),outlineWidth:3,style:C.LabelStyle.FILL_AND_OUTLINE,showBackground:true,backgroundColor:C.Color.fromCssColorString('#17211e').withAlpha(.78),backgroundPadding:new C.Cartesian2(8,5),verticalOrigin:C.VerticalOrigin.BOTTOM,pixelOffset:new C.Cartesian2(0,-42),heightReference:C.HeightReference.RELATIVE_TO_3D_TILE,disableDepthTestDistance:depthTestDistance,scaleByDistance:new C.NearFarScalar(1000,1,150000,.65)}
      });
    }
  }};
  layer.ready=fetch('/cities.json').then(response=>{if(!response.ok)throw new Error('City data unavailable');return response.json();}).then(data=>{cities=data;return true;}).catch(()=>false);
  return layer;
}
