import {EARTH,RAD,clamp,validCoordinates} from './flight.js';

const WORLD_HEIGHT=EARTH*3;
const WORLD_DIAMETER_TO_VIEW_HEIGHT=1.51;
const MIN_HEIGHT=120000;
const MAX_HEIGHT=EARTH*6;
const DEFAULT_CENTER={lat:30,lon:14};
const TILE_ROOT='Assets/Textures/NaturalEarthII';
const wrapLongitude=lon=>((lon+540)%360)-180;

export function createDestinationGlobe({C,root,missions,onMission,onPoint}){
  const $=id=>root.querySelector('#'+id);
  const view=root.querySelector('.globe-view');
  const markerLayer=root.querySelector('.globe-markers');
  const pin=root.querySelector('.globe-pin');
  const group=root.querySelector('.globe-group');
  const groupList=root.querySelector('.globe-group-list');
  const controls=[...root.querySelectorAll('[data-globe-control]')];
  const markers=missions.map(()=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='globe-marker';
    button.hidden=true;
    markerLayer.append(button);
    return button;
  });
  const sites=new Map();
  for(const mission of missions){
    const {name,lat,lon}=mission.location;
    if(!sites.has(name))sites.set(name,{point:C.Cartesian3.fromDegrees(lon,lat),missions:[]});
    sites.get(name).missions.push(mission);
  }
  const ellipsoid=C.Ellipsoid.WGS84;
  const normal=new C.Cartesian3(),position=new C.Cartesian2();
  let widget,scene,host,mission,place,draft,progress,viewKey='',failed=false,busy=false;
  let center={...DEFAULT_CENTER},height=WORLD_HEIGHT,drag,groupButton;
  const hint=message=>{$('globeHint').textContent=message;};
  const defaultHint=()=>mission?'Otoč globus tažením. Klikni na značku a vyber misi.':'Otoč globus tažením a ťukni na místo startu.';

  function closeGroup(restoreFocus=false){
    if(restoreFocus&&groupButton&&!groupButton.hidden)groupButton.focus({preventScroll:true});
    groupButton?.setAttribute('aria-expanded','false');
    group.hidden=true;
    groupButton=null;
  }

  function openGroup(items,button){
    if(busy)return;
    if(items.length===1){
      closeGroup();
      button.focus({preventScroll:true});
      onMission(items[0].id);
      return;
    }
    groupList.replaceChildren(...items.map(item=>{
      const choice=document.createElement('button');
      choice.type='button';
      choice.setAttribute('aria-pressed',String(item.id===mission.id));
      choice.setAttribute('aria-haspopup','dialog');
      choice.textContent=item.title;
      const state=document.createElement('small');
      state.textContent=item.location.name+' · '+missionState(item);
      choice.append(state);
      choice.onclick=()=>{
        closeGroup(true);
        onMission(item.id);
      };
      return choice;
    }));
    closeGroup();
    groupButton=button;
    button.setAttribute('aria-expanded','true');
    group.hidden=false;
    groupList.querySelector('button').focus({preventScroll:true});
  }

  function missionState(item){
    if(progress.completed.has(item.id))return 'Splněno';
    return progress.unlocked.has(item.id)?'Připraveno':'Zamčeno';
  }

  function projected(point){
    // Surface points are visible only when their outward normal faces the camera.
    ellipsoid.geodeticSurfaceNormal(point,normal);
    if(C.Cartesian3.dot(normal,scene.camera.positionWC)<C.Cartesian3.dot(normal,point))return;
    const screen=C.SceneTransforms.worldToWindowCoordinates(scene,point,position);
    if(screen&&screen.x>=0&&screen.x<=view.clientWidth&&screen.y>=0&&screen.y<=view.clientHeight){
      return {x:screen.x,y:screen.y};
    }
  }

  function renderMarkers(){
    if(!host)return;
    const clusters=[];
    if(mission){
      // The first visible site anchors each cluster, regardless of selection.
      for(const site of sites.values()){
        const screen=projected(site.point);
        if(!screen)continue;
        const nearby=clusters.find(cluster=>Math.hypot(screen.x-cluster.x,screen.y-cluster.y)<40);
        if(nearby)nearby.items.push(...site.missions);
        else clusters.push({...screen,items:[...site.missions]});
      }
    }
    markers.forEach((button,index)=>{
      const cluster=clusters[index];
      button.hidden=!cluster;
      if(!cluster)return;
      const {x,y,items}=cluster;
      const selected=items.some(item=>item.id===mission.id);
      const state=items.some(item=>progress.unlocked.has(item.id))?'available':'locked';
      const names=[...new Set(items.map(item=>item.location.name))].join(', ');
      const label=items.length===1?items[0].title+' · '+missionState(items[0]):names+' · počet misí '+items.length;
      button.style.left=x+'px';
      button.style.top=y+'px';
      button.dataset.state=state;
      button.textContent=String(items.length);
      button.setAttribute('aria-pressed',String(selected));
      if(items.length>1)button.setAttribute('aria-expanded',String(groupButton===button));
      else button.removeAttribute('aria-expanded');
      if(items.length===1)button.setAttribute('aria-haspopup','dialog');
      else button.removeAttribute('aria-haspopup');
      button.setAttribute('aria-label',label);
      button.title=label;
      button.disabled=busy;
      button.onclick=()=>openGroup(items,button);
    });
    const point=draft||place;
    const screen=!mission&&point?projected(C.Cartesian3.fromDegrees(point.lon,point.lat)):null;
    pin.hidden=!screen;
    if(screen){
      pin.style.left=screen.x+'px';
      pin.style.top=screen.y+'px';
      pin.dataset.draft=String(Boolean(draft));
    }
  }

  function updateCamera(){
    if(!scene||!view.clientWidth||!view.clientHeight)return;
    widget.resize();
    const aspect=view.clientWidth/view.clientHeight;
    // Fill the width on narrow screens and crop the poles on wider screens.
    const diameterRatio=Math.min(aspect,WORLD_DIAMETER_TO_VIEW_HEIGHT);
    scene.camera.frustum.fov=2*Math.atan(Math.tan(Math.asin(EARTH/(EARTH+WORLD_HEIGHT)))/diameterRatio*Math.max(aspect,1));
    scene.camera.setView({
      destination:C.Cartesian3.fromDegrees(center.lon,center.lat,height),
      orientation:{heading:0,pitch:-Math.PI/2,roll:0}
    });
    const angularRadius=Math.asin(EARTH/(EARTH+height));
    const diameter=view.clientHeight*Math.tan(angularRadius)/Math.tan(scene.camera.frustum.fovy/2);
    root.style.setProperty('--planet-diameter',diameter.toFixed(1)+'px');
    root.dataset.closeup=String(diameter>Math.min(view.clientWidth,view.clientHeight)*1.16);
    scene.requestRender();
    controls[0].disabled=busy||height<=MIN_HEIGHT;
    controls[1].disabled=busy||height>=MAX_HEIGHT;
    controls[2].disabled=busy;
  }

  function zoom(factor){
    closeGroup();
    height=clamp(height*factor,MIN_HEIGHT,MAX_HEIGHT);
    updateCamera();
  }

  function centerOn(point){
    closeGroup();
    center={lat:clamp(point.lat,-88,88),lon:point.lon};
    height=WORLD_HEIGHT;
    updateCamera();
  }

  function rotate(dx,dy){
    closeGroup();
    const scale=2*height*Math.tan(scene.camera.frustum.fovy/2)/(Math.max(1,view.clientHeight)*EARTH*RAD);
    center.lon=wrapLongitude(center.lon-dx*scale/Math.max(.3,Math.cos(center.lat*RAD)));
    center.lat=clamp(center.lat+dy*scale,-88,88);
    updateCamera();
  }

  function pick(x,y){
    if(mission)return;
    const hit=scene.camera.pickEllipsoid(new C.Cartesian2(x,y),ellipsoid);
    if(!hit)return;
    const point=ellipsoid.cartesianToCartographic(hit);
    const lat=point.latitude/RAD,lon=point.longitude/RAD;
    if(!validCoordinates(lat,lon)){
      hint('Místo startu vyber mezi 80° jižní a severní šířky.');
      return;
    }
    onPoint({lat,lon,name:'Vlastní místo'});
  }

  function showFailure(){
    failed=true;
    root.dataset.failed='true';
    if(widget)widget.useDefaultRenderLoop=false;
    $('randomStart').hidden=true;
    hint('Globus se nepodařilo načíst. Místo můžeš vybrat ze seznamu.');
  }

  function init(){
    try{
      widget=new C.CesiumWidget(view,{
        baseLayer:false,skyBox:false,skyAtmosphere:false,scene3DOnly:true,requestRenderMode:true,
        maximumRenderTimeChange:Infinity,showRenderLoopErrors:false,
        contextOptions:{webgl:{alpha:true}},
        useDefaultRenderLoop:false
      });
      scene=widget.scene;
      scene.backgroundColor=C.Color.TRANSPARENT;
      scene.globe.showGroundAtmosphere=false;
      scene.globe.baseColor=C.Color.fromCssColorString('#507b91');
      scene.globe.maximumScreenSpaceError=2;
      scene.fog.enabled=false;
      scene.screenSpaceCameraController.enableInputs=false;
      scene.postRender.addEventListener(renderMarkers);
      scene.renderError.addEventListener(showFailure);
      const url=C.buildModuleUrl(TILE_ROOT);
      const imagery=C.ImageryLayer.fromProviderAsync(C.TileMapServiceImageryProvider.fromUrl(url));
      imagery.errorEvent.addEventListener(showFailure);
      imagery.saturation=.9;
      scene.imageryLayers.add(imagery);
      new ResizeObserver(updateCamera).observe(view);
    }catch(error){
      console.error('Destination globe initialization failed:',error);
      showFailure();
    }
  }

  controls[0].onclick=()=>zoom(.57);
  controls[1].onclick=()=>zoom(1/.57);
  controls[2].onclick=()=>centerOn(mission?.location||draft||place||DEFAULT_CENTER);
  root.querySelector('.globe-group-close').onclick=()=>closeGroup(true);
  group.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    event.preventDefault();
    event.stopPropagation();
    closeGroup(true);
  });
  view.addEventListener('pointerdown',event=>{
    if(busy||failed||drag||event.button!==0)return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
    view.setPointerCapture(event.pointerId);
    view.dataset.dragging='true';
  });
  view.addEventListener('pointermove',event=>{
    if(drag?.id!==event.pointerId)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(!drag.moved&&Math.hypot(dx,dy)<5)return;
    rotate(dx,dy);
    Object.assign(drag,{x:event.clientX,y:event.clientY,moved:true});
  });
  view.addEventListener('pointerup',event=>{
    if(drag?.id!==event.pointerId||drag.moved||busy)return;
    const rect=view.getBoundingClientRect();
    closeGroup();
    pick(event.clientX-rect.left,event.clientY-rect.top);
  });
  view.addEventListener('lostpointercapture',()=>{
    drag=null;
    delete view.dataset.dragging;
  });
  view.addEventListener('wheel',event=>{
    if(busy||failed)return;
    event.preventDefault();
    zoom(Math.exp(clamp(event.deltaY*(event.deltaMode===1?16:1),-200,200)*.003));
  },{passive:false});
  view.addEventListener('keydown',event=>{
    if(busy||failed||event.altKey||event.ctrlKey||event.metaKey)return;
    const movement={ArrowLeft:[36,0],ArrowRight:[-36,0],ArrowUp:[0,-36],ArrowDown:[0,36]}[event.key];
    if(movement)rotate(...movement);
    else if(event.key==='+'||event.key==='=')zoom(.57);
    else if(event.key==='-')zoom(1/.57);
    else if(event.key==='Enter'&&!mission)pick(view.clientWidth/2,view.clientHeight/2);
    else return;
    event.preventDefault();
  });

  return {sync(next){
    if(next.host!==host||next.busy||next.mission?.id!==mission?.id)closeGroup();
    host=next.host;
    root.hidden=!host;
    if(!host){
      if(widget)widget.useDefaultRenderLoop=false;
      viewKey='';
      return;
    }
    if(root.parentElement!==host)host.append(root);
    ({mission,place,draft,progress,busy}=next);
    root.dataset.mode=mission?'missions':'free';
    $('globeEyebrow').textContent=mission?'VÝBĚR MISE':'VOLNÝ LET';
    $('globeHeading').textContent=mission?'Mise po světě':'Globus startu';
    $('randomStart').hidden=Boolean(mission)||failed;
    $('randomStart').disabled=busy;
    $('globeMissionDetails').hidden=!mission;
    $('globeMissionDetails').disabled=busy;
    $('globeMissionList').hidden=!mission;
    const point=draft||place;
    $('globeSelectionState').textContent=mission?missionState(mission):draft?'Čeká na potvrzení':'Vybraný start';
    $('globeSelectionName').textContent=mission?.title||point.name;
    $('globeSelectionDetail').textContent=mission?mission.location.name:
      `${point.lat.toFixed(4)}° / ${point.lon.toFixed(4)}°`;
    if(!widget&&!failed)init();
    if(failed)return;
    hint(defaultHint());
    const key=mission?mission.id:`${place.lat}/${place.lon}`;
    if(key!==viewKey){
      const target=mission?.location||place;
      if(!viewKey||!next.keepView&&!projected(C.Cartesian3.fromDegrees(target.lon,target.lat))){
        centerOn(target);
      }
      viewKey=key;
    }
    widget.useDefaultRenderLoop=true;
    updateCamera();
  },centerOn};
}
