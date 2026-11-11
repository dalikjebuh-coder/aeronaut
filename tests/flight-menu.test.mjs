import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {installFlightUiLayout} from '../src/flight-ui-layout.js';
import {FLIGHT_CAMERA_MODES} from '../src/flight-camera.js';

const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');

test('C cycles the flight camera once per press and synchronizes saved and menu selection',()=>{
  const handlers=new Map(),saved=new Map(),buttons=FLIGHT_CAMERA_MODES.map(mode=>({dataset:{flightCamera:mode},setAttribute(name,value){this[name]=value;}}));
  let updates=0;
  const context=vm.createContext({FLIGHT_CAMERA_MODES,$:()=>({hidden:true}),
    window:{addEventListener:(name,handler)=>handlers.set(name,handler)},
    document:{activeElement:{tagName:'BODY'},querySelector:()=>null,querySelectorAll:()=>buttons,body:{classList:{contains:()=>true}}},
    localStorage:{setItem:(key,value)=>saved.set(key,value)},stopInspectDrag:()=>{},updateCamera:()=>updates++,notice:()=>{}
  });
  vm.runInContext(`let running=true,paused=false,crashed=false,busy=false,mapDraft=null,menuStep=3,flightCameraMode='chase',flightOrbit={};const photo={active:false},keys=new Set(),FLIGHT_CAMERA_STORAGE_KEY='camera';`+
    app.slice(app.indexOf('function syncFlightCameraButtons(){'),app.indexOf('\nsyncFlightCameraButtons();'))+
    app.slice(app.indexOf("window.addEventListener('keydown'"),app.indexOf("window.addEventListener('keyup'")),context);
  const press=(extra={})=>handlers.get('keydown')({code:'KeyC',preventDefault(){},...extra});
  for(const mode of ['distant','overhead','front','cinematic','roof','chase']){
    press();
    assert.equal(saved.get('camera'),mode);
    assert.deepEqual(buttons.filter(button=>button['aria-pressed']==='true').map(button=>button.dataset.flightCamera),[mode]);
    press({repeat:true});
    assert.equal(saved.get('camera'),mode);
  }
  assert.equal(updates,6);
  assert.equal(vm.runInContext('flightOrbit',context),null);
  for(const flag of ['paused','crashed','busy','photo.active']){
    vm.runInContext(`${flag}=true`,context);press();vm.runInContext(`${flag}=false`,context);
  }
  press({ctrlKey:true});press({metaKey:true});press({altKey:true});
  vm.runInContext("document.activeElement.tagName='INPUT'",context);press();
  assert.equal(updates,6,'typing, repeat, modified shortcuts and inactive flight states do not change the view');
});

test('flight HUD tracks changing map credits without reserving space for a toolbar',()=>{
  const properties=new Map(),credits={height:32},observed=[];
  credits.getBoundingClientRect=()=>({height:credits.height});
  let resized,disconnected=false;
  const layout=installFlightUiLayout({
    document:{querySelector:selector=>selector==='.cesium-viewer-bottom'?credits:null,body:{style:{setProperty:(key,value)=>properties.set(key,value)}}},
    ResizeObserver:class{
      constructor(callback){resized=callback;}
      observe(element){observed.push(element);}
      disconnect(){disconnected=true;}
    }
  });
  assert.deepEqual(observed,[credits]);
  assert.equal(properties.get('--map-credits-height'),'32px');
  assert.equal(properties.has('--flight-actions-height'),false);
  credits.height=57;resized();
  assert.equal(properties.get('--map-credits-height'),'57px');
  credits.height=0;layout.refresh();
  assert.equal(properties.get('--map-credits-height'),'57px','temporarily hidden credits retain their last measurement');
  layout.destroy();assert.ok(disconnected);
});

test('menu icon and Esc share pause behavior; P and automatic pause leave settings closed',()=>{
  const elements=new Map(),classes=new Set(),events=[],handlers=new Map();
  const $=id=>{
    if(!elements.has(id))elements.set(id,{
      hidden:['pauseOverlay','pauseHint','missionResult'].includes(id),attributes:{},classList:{remove:()=>{}},
      setAttribute(name,value){this.attributes[name]=value;},
      focus(){events.push(`focus:${id}`);},
      hasPointerCapture:()=>false
    });
    return elements.get(id);
  };
  const context=vm.createContext({$,
    document:{body:{classList:{toggle:(name,value)=>value?classes.add(name):classes.delete(name),remove:()=>{},contains:()=>true}},activeElement:{tagName:'BODY'},querySelector:()=>null},
    window:{addEventListener:(name,handler)=>handlers.set(name,handler)},
    engineAudio:{pause:()=>events.push('pause'),play:()=>events.push('play')},
    missionRadio:{stop:()=>events.push('radio stopped')},
    aircraft:{show:true,chaseDistance:48},updatePauseLocation:()=>{},updateCamera:()=>{},
    exitPhotoMode:()=>{vm.runInContext('photo.active=false',context);events.push('exit photo');}
  });
  vm.runInContext(`
    let running=true,paused=false,crashed=false,mapDraft=null,menuStep=3,busy=false;
    const photo={active:false,drag:null},state={heading:40},keys=new Set(),touch=new Set();
    let inspectHeading,inspectElevation,inspectDistance;
  `+app.slice(app.indexOf('function setFlightMenuVisible('),app.indexOf('function syncPhotoControls('))+
    app.slice(app.indexOf("window.addEventListener('keydown'"),app.indexOf("window.addEventListener('keyup'")),context);
  const press=(code,repeat=false)=>{let prevented=false;handlers.get('keydown')({code,repeat,preventDefault:()=>{prevented=true;}});return prevented;};

  $('panelButton').onclick=()=>vm.runInContext('toggleFlightMenu()',context);
  $('panelButton').onclick();
  assert.equal(vm.runInContext('paused',context),true);
  assert.equal($('pauseOverlay').hidden,false);
  assert.equal($('pauseHint').hidden,true);
  assert.equal($('panelButton').attributes['aria-expanded'],'true');
  assert.ok(classes.has('flight-menu-open'));
  assert.ok(events.includes('focus:resumeButton'));
  assert.equal(press('Escape',true),true);
  assert.equal($('pauseOverlay').hidden,false,'key repeat must not close the menu');
  assert.equal(press('Escape'),true);
  assert.equal(vm.runInContext('paused',context),false);
  assert.equal($('pauseOverlay').hidden,true);
  assert.equal($('panelButton').attributes['aria-expanded'],'false');

  vm.runInContext('pauseFlight(true)',context);
  assert.equal($('pauseOverlay').hidden,true);
  assert.equal($('pauseHint').hidden,false);
  press('Escape');
  assert.equal($('pauseOverlay').hidden,false);
  assert.equal($('pauseHint').hidden,true);
  press('Escape');
  assert.equal(vm.runInContext('paused',context),false);
  assert.equal(press('KeyP'),true);
  assert.equal($('pauseOverlay').hidden,true);
  assert.equal($('pauseHint').hidden,false);
  vm.runInContext('photo.active=true',context);
  press('Escape');
  assert.ok(events.includes('exit photo'));
  assert.equal($('pauseOverlay').hidden,true);
  assert.ok(events.includes('focus:panelButton'));

  vm.runInContext('photo.active=false;crashed=true;paused=true;setFlightMenuVisible(true)',context);
  press('Escape');
  assert.equal($('pauseOverlay').hidden,false,'a crash cannot resume by pressing Esc');
});

test('Do menu ends live, paused, crashed and photo flights and restores the first menu screen',()=>{
  for(const scenario of ['live','paused','crashed','photo']){
    const classes=new Set(['horizon-ui','flying','panel-hidden',...(scenario==='photo'?['photo-mode','photo-clean']:[])]);
    const elements=new Map(),events=[],captures=new Set([7]);
    const $=id=>{
      if(!elements.has(id))elements.set(id,{hidden:false,classList:{remove(){}},hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id)});
      return elements.get(id);
    };
    const context=vm.createContext({$,events,scenario,
      document:{body:{classList:{remove:(...names)=>names.forEach(name=>classes.delete(name))}}},
      engineAudio:{stop:()=>events.push('audio stopped')},
      missionRadio:{stop:()=>events.push('radio stopped')},
      crashEffect:{clear:()=>events.push('crash cleared')},
      cityLabels:{source:{show:true},setDepthTest:()=>{}},geographyGuide:{setDepthTest:()=>{}},
      viewer:{camera:{frustum:{fov:1}},scene:{screenSpaceCameraController:{enableInputs:false}},resize:()=>{}},
      aircraft:{show:true},updateCamera:()=>{},overview:()=>events.push('overview'),
      restart:()=>{},toggleSound:()=>{},setFlightMenuVisible:visible=>{$('pauseOverlay').hidden=!visible;},
      updateLandingNotice:()=>{}
    });
    vm.runInContext(`
      let menuStep=3,running=true,paused=scenario==='paused'||scenario==='photo',crashed=scenario==='crashed',flightOrbit={};
      const state={},keys=new Set(['KeyW']),touch=new Set(['left']);
      const photo={active:scenario==='photo',session:0,savedFov:.8,savedLabels:true,drag:{id:7}};
      function syncControls(){events.push({running,paused,menuStep});}
    `+app.slice(app.indexOf('function stopInspectDrag(){'),app.indexOf('function pauseFlight('))+
      app.slice(app.indexOf('function exitPhotoMode(){'),app.indexOf('function resetPhotoCamera(){'))+
      app.slice(app.indexOf('function endFlight(){'),app.indexOf('function setMode('))+
      app.split('\n').find(line=>line.startsWith("$('startButton').onclick=")),context);
    $('endButton').onclick();
    assert.equal(vm.runInContext('running||paused||crashed',context),false,scenario);
    assert.equal(vm.runInContext('menuStep',context),1,scenario);
    assert.equal(vm.runInContext('keys.size+touch.size',context),0,scenario);
    assert.equal(vm.runInContext('photo.active',context),false,scenario);
    assert.equal(vm.runInContext('flightOrbit',context),null,scenario);
    assert.equal(vm.runInContext('aircraft.show',context),false,scenario);
    assert.equal(vm.runInContext('viewer.scene.screenSpaceCameraController.enableInputs',context),true,scenario);
    assert.ok($('flightUI').hidden&&$('pauseOverlay').hidden,scenario);
    assert.deepEqual([...classes],['horizon-ui'],scenario);
    assert.equal(captures.size,0,scenario);
    assert.ok(events.includes('audio stopped')&&events.includes('overview'),scenario);
    assert.ok(events.includes('radio stopped'),scenario);
    assert.ok(events.includes('crash cleared'),scenario);
    assert.ok(events.some(value=>value.running===false&&value.paused===false&&value.menuStep===1),scenario);
  }
});

test('free flight commits a globe draft before the start button can launch',()=>{
  const elements=new Map(),centers=[],launches=[];
  const $=id=>{
    if(!elements.has(id))elements.set(id,{focus(){}});
    return elements.get(id);
  };
  const context=vm.createContext({
    $,isRace:()=>false,showError(){},syncControls(){},overview(){},
    clearLocationCredits(){},locationSearch:{cancel(){}},
    selectedPlace:(key,custom)=>key==='custom'?custom:{name:'Brno',lat:49.1951,lon:16.6068},
    destinationGlobe:{centerOn:place=>centers.push(place)},
    launches
  });
  vm.runInContext(`
    let mode='google',running=false,busy=false,menuStep=3,locationKey='brno',customLocation=null,mapDraft=null;
    const randomStartPlaces=[{name:'Brno',lat:49.1951,lon:16.6068},{name:'Fudži',lat:35.36,lon:138.73}];
    const startFlight=()=>launches.push(selectedPlace(locationKey,customLocation));
  `+app.slice(app.indexOf('function previewStart('),app.indexOf("$('globeMissionDetails').onclick="))+
    app.split('\n').find(line=>line.startsWith("$('startButton').onclick=")).split(";$('resumeButton')")[0],context);
  $('randomStart').onclick();
  assert.equal(vm.runInContext('mapDraft.name',context),'Fudži');
  assert.equal(vm.runInContext('locationKey',context),'brno');
  assert.equal(centers.at(-1).name,'Fudži');
  $('cancelStartDraft').onclick();
  assert.equal(vm.runInContext('mapDraft',context),null);
  assert.equal(centers.at(-1).name,'Brno');

  vm.runInContext("previewStart({name:'Vlastní místo',lat:-37.12345,lon:179.54321})",context);
  $('startButton').onclick();
  assert.equal(launches.length,0);
  assert.equal(vm.runInContext('mapDraft',context),null);
  $('startButton').onclick();
  assert.deepEqual({...launches[0]},{name:'Vlastní místo',lat:-37.12345,lon:179.54321});
});
