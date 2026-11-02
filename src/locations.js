export const LOCATIONS=[
  {id:'brno',name:'Brno',country:'ČESKO',lat:49.1951,lon:16.6068,image:'/images/brno-petrov-v1.jpg',description:'Petrov, Špilberk a krajina jižní Moravy',credit:'JiriMatejicek',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',source:'https://commons.wikimedia.org/wiki/File:Brno_Spilberk_vyhled_Petrov.jpg'},
  {id:'prague',name:'Praha',country:'ČESKO',lat:50.0865,lon:14.4114,image:'/images/location-prague-v1.jpg',description:'Vltava, mosty a historické centrum',credit:'DAVID ILIFF',license:'CC BY-SA 3.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/',source:'https://commons.wikimedia.org/wiki/File:Prague_Panorama_-_Oct_2010.jpg'},
  {id:'paris',name:'Paříž',country:'FRANCIE',lat:48.8584,lon:2.2945,image:'/images/location-paris-v1.jpg',description:'Eiffelova věž a oblouky Seiny',credit:'Wladyslaw (Taxiarchos228)',license:'CC BY 3.0',licenseUrl:'https://creativecommons.org/licenses/by/3.0/',source:'https://commons.wikimedia.org/wiki/File:Paris_-_Eiffelturm_und_Marsfeld2.jpg'},
  {id:'nyc',name:'New York',country:'USA',lat:40.758,lon:-73.9855,image:'/images/location-nyc-v1.jpg',description:'Manhattan z výšky mezi mrakodrapy',credit:'Dietmar Rabich',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',source:'https://commons.wikimedia.org/wiki/File:New_York_City_(New_York,_USA),_Manhattan,_Skyline_--_2012_--_6677.jpg'},
  {id:'sf',name:'San Francisco',country:'USA',lat:37.7936,lon:-122.4074,image:'/images/location-sf-v1.jpg',description:'Kopce, pobřeží a rozlehlý záliv',credit:'King of Hearts',license:'CC BY-SA 3.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/',source:'https://commons.wikimedia.org/wiki/File:San_Francisco_from_Twin_Peaks_September_2013_panorama_5_edit.jpg'}
];
export function selectedPlace(key,custom,race=false){
  if(race)return LOCATIONS[0];
  if(key==='custom'&&custom&&Number.isFinite(custom.lat)&&Number.isFinite(custom.lon)&&Math.abs(custom.lat)<=80&&Math.abs(custom.lon)<=180)return {...custom,name:typeof custom.name==='string'&&custom.name.trim()?custom.name.trim():'Vlastní lokalita',id:'custom'};
  return LOCATIONS.find(place=>place.id===key)||LOCATIONS[0];
}
