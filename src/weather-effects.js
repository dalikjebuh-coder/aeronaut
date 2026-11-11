// Native Cesium clouds: one bounded collection, with stable world positions.
const RAD=Math.PI/180;
const COVERAGE={clear:0,partly:.32,haze:.12,overcast:1};
function noise(x,y,seed=0){const n=Math.sin(x*127.1+y*311.7+seed*74.7)*43758.5453;return n-Math.floor(n);}
export function cloudLayout(lat,lon,weather){
  const coverage=COVERAGE[weather]??0;
  if(!coverage||!Number.isFinite(lat)||!Number.isFinite(lon))return [];
  const overcast=weather==='overcast';
  const band=Math.round(Math.max(-85,Math.min(85,lat))/5)*5;
  const dy=overcast?.026:.032,dx=dy/Math.cos(band*RAD);
  const cx=Math.round(lon/dx),cy=Math.round(lat/dy),cellRadius=overcast?13:10;
  const clouds=[];
  for(let y=cy-cellRadius;y<=cy+cellRadius;y++)for(let x=cx-cellRadius;x<=cx+cellRadius;x++){
    if(noise(x,y)>=coverage)continue;
    const latitude=(y+(noise(x,y,1)-.5)*.7)*dy;
    if(Math.abs(latitude)>89)continue;
    const longitude=(x+(noise(x,y,2)-.5)*.7)*dx;
    const distance=Math.hypot((latitude-lat)*111320,(longitude-lon)*111320*Math.cos(lat*RAD));
    // Fade the edge of the local cloud field before recycling its outer cells.
    const alpha=Math.max(0,Math.min(1,(32000-distance)/6500));
    if(alpha===0)continue;
    const size=noise(x,y,3);
    clouds.push({lat:latitude,lon:((longitude+180)%360+360)%360-180,
      altitude:(overcast?1900:2700)+noise(x,y,4)*650,
      width:(overcast?6200:2600)+size*(overcast?2300:2400),
      height:(overcast?1000:850)+size*650,alpha,slice:.36+noise(x,y,5)*.2});
  }
  return clouds;
}

const VOLUME_LIMIT=8;
const VOLUME_DISTANCE=12500;

export function createWeatherEffects(viewer,volumesEnabled=()=>false){
  const C=window.Cesium;
  const collection=viewer.scene.primitives.add(new C.CloudCollection());
  let weather='clear',time='day',lastPosition=null,dirty=true,destroyed=false;
  let layout=[];
  const centers=Array.from({length:VOLUME_LIMIT},()=>new C.Cartesian4());
  const shapes=Array.from({length:VOLUME_LIMIT},()=>new C.Cartesian2());
  const relative=new C.Cartesian3();
  const up=new C.Cartesian3();
  const colorScratch=new C.Color();
  const volume={count:0,centers,shapes,up};
  const visibleVolumes=[];

  function updateVolumes(){
    const camera=viewer.camera.positionWC;
    volume.count=0;
    if(camera&&layout.length&&volumesEnabled()){
      C.Ellipsoid.WGS84.geodeticSurfaceNormal(camera,up);
      visibleVolumes.length=0;
      for(const cloud of layout){
        const distance=C.Cartesian3.distance(camera,cloud.position);
        if(distance<VOLUME_DISTANCE)visibleVolumes.push({cloud,distance});
      }
      visibleVolumes.sort((a,b)=>a.distance-b.distance);
      const limit=weather==='overcast'?VOLUME_LIMIT:5;
      const cutoff=visibleVolumes[limit]?.distance??VOLUME_DISTANCE;
      for(const {cloud,distance} of visibleVolumes.slice(0,limit)){
        const weight=Math.min(1,(VOLUME_DISTANCE-distance)/3500,(cutoff-distance)/900);
        if(weight<=0)continue;
        const i=volume.count++;
        C.Cartesian3.subtract(cloud.position,camera,relative);
        C.Cartesian4.fromElements(relative.x,relative.y,relative.z,cloud.width*.49,centers[i]);
        C.Cartesian2.fromElements(cloud.height*.53,weight*cloud.alpha,shapes[i]);
        cloud.volumeWeight=weight;
      }
    }
    for(const cloud of layout){
      const weight=cloud.volumeWeight??0;
      if(weight!==cloud.lastWeight){
        cloud.primitive.show=weight<1;
        cloud.primitive.color=cloud.color.withAlpha(cloud.alpha*(1-weight),colorScratch);
        cloud.lastWeight=weight;
      }
      cloud.volumeWeight=0;
    }
  }

  function update(){
    const position=viewer.camera.positionCartographic;
    if(!position)return;
    const lat=position.latitude/RAD,lon=position.longitude/RAD;
    if(!dirty&&lastPosition&&Math.hypot(lat-lastPosition.lat,(lon-lastPosition.lon)*Math.cos(lat*RAD))<.006){updateVolumes();return;}
    lastPosition={lat,lon};dirty=false;
    layout=cloudLayout(lat,lon,weather);
    const shade=time==='night'?[.60,.63,.70]:time==='evening'?[1,.79,.63]:time==='morning'?[1,.9,.79]:[1,1,1];
    const gray=weather==='overcast'?.8:1;
    for(let i=0;i<layout.length;i++){
      const p=layout[i],cloud=i<collection.length?collection.get(i):collection.add();
      cloud.show=true;
      p.position=C.Cartesian3.fromDegrees(p.lon,p.lat,p.altitude);
      cloud.position=p.position;
      cloud.scale=new C.Cartesian2(p.width,p.height);
      cloud.maximumSize=new C.Cartesian3(20,12,8);
      cloud.slice=p.slice;
      cloud.brightness=weather==='overcast'?.75:1;
      p.color=new C.Color(shade[0]*gray,shade[1]*gray,shade[2]*gray,p.alpha);
      p.primitive=cloud;
      cloud.color=p.color;
    }
    // Reuse the GPU collection when flying or switching weather.
    for(let i=layout.length;i<collection.length;i++)collection.get(i).show=false;
    collection.show=layout.length>0;
    updateVolumes();
  }
  const removeUpdate=viewer.scene.preUpdate.addEventListener(update);
  return {
    primitives:[collection],
    volume,
    setConditions(nextWeather,nextTime){weather=nextWeather;time=nextTime;dirty=true;},
    destroy(){if(destroyed)return;destroyed=true;removeUpdate();viewer.scene.primitives.remove(collection);}
  };
}

// Integrate light and extinction through nearby clouds, clipped to the scene depth.
export const cloudVolumeShader=`
  uniform int cloudCount;
  uniform vec4 cloudCenters[${VOLUME_LIMIT}];
  uniform vec2 cloudShapes[${VOLUME_LIMIT}];
  uniform vec3 cloudUp;

  float cloudHash(vec3 p){
    p=fract(p*0.1031);
    p+=dot(p,p.yzx+33.33);
    return fract((p.x+p.y)*p.z);
  }

  float cloudNoise(vec3 p){
    vec3 cell=floor(p);
    vec3 f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(
      mix(mix(cloudHash(cell),cloudHash(cell+vec3(1,0,0)),f.x),
          mix(cloudHash(cell+vec3(0,1,0)),cloudHash(cell+vec3(1,1,0)),f.x),f.y),
      mix(mix(cloudHash(cell+vec3(0,0,1)),cloudHash(cell+vec3(1,0,1)),f.x),
          mix(cloudHash(cell+vec3(0,1,1)),cloudHash(cell+vec3(1,1,1)),f.x),f.y),
      f.z);
  }

  vec3 cloudSpace(vec3 p,float radius,float height){
    vec3 vertical=dot(p,cloudUp)*cloudUp;
    return (p-vertical)/radius+vertical/height;
  }

  vec3 renderCloudVolumes(vec3 background,vec2 uv,float depth,vec3 tint){
    vec4 eye=czm_inverseProjection*vec4(uv*2.0-1.0,1.0,1.0);
    vec3 ray=czm_inverseViewRotation*normalize(eye.xyz);
    vec3 sun=czm_inverseViewRotation*czm_sunDirectionEC;
    float sceneDistance=50000.0;
    if(depth<1.0){
      vec4 surface=czm_windowToEyeCoordinates(gl_FragCoord.xy,depth);
      sceneDistance=length(surface.xyz/surface.w);
    }
    float transmission=1.0;
    vec3 scattered=vec3(0.0);
    for(int i=0;i<${VOLUME_LIMIT};i++){
      if(i>=cloudCount||transmission<0.015)break;
      vec4 cloud=cloudCenters[i];
      vec2 shape=cloudShapes[i];
      vec3 origin=cloudSpace(-cloud.xyz,cloud.w,shape.x);
      vec3 direction=cloudSpace(ray,cloud.w,shape.x);
      float a=dot(direction,direction);
      float b=dot(origin,direction);
      float discriminant=b*b-a*(dot(origin,origin)-1.0);
      if(discriminant<=0.0)continue;
      float root=sqrt(discriminant);
      float start=max(0.0,(-b-root)/a);
      float end=min(sceneDistance,(-b+root)/a);
      if(end<=start)continue;

      float stepSize=(end-start)/12.0;
      for(int j=0;j<12;j++){
        if(transmission<0.015)break;
        float t=start+(float(j)+0.5)*stepSize;
        vec3 local=ray*t-cloud.xyz;
        vec3 p=origin+direction*t;
        vec3 noisePoint=local/470.0;
        float detail=cloudNoise(noisePoint)*0.7+cloudNoise(noisePoint*2.6)*0.3;
        float density=smoothstep(0.0,0.48,1.0-length(p)-(1.0-detail)*0.43);
        float opacity=1.0-exp(-density*stepSize*shape.y*0.0055);
        float diffuse=clamp(dot(p,sun)*0.8+0.50,0.0,1.0);
        vec3 shade=mix(vec3(0.52,0.59,0.67),vec3(1.0,0.99,0.97),diffuse);
        scattered+=transmission*opacity*shade*tint;
        transmission*=1.0-opacity;
      }
    }
    return scattered+background*transmission;
  }
`;
