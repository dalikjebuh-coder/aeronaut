import {offsetMeters} from './flight.js';

// Small, authored geographic sketches. The course uses the actual mission
// coordinates; waterways and terrain are deliberately simplified local vectors.
const MAPS={
  brno:{water:[[49.27,16.45],[49.25,16.48],[49.24,16.51],[49.22,16.53],[49.21,16.57],[49.19,16.59],[49.17,16.61],[49.15,16.65]],land:[[49.22,16.58],[49.225,16.55],[49.245,16.49],[49.26,16.46]],name:'Svratka'},
  prague:{water:[[50.05,14.42],[50.07,14.415],[50.08,14.411],[50.086,14.408],[50.092,14.416],[50.098,14.425],[50.106,14.435],[50.116,14.42],[50.13,14.42]],name:'Vltava'},
  paris:{water:[[48.85,2.28],[48.858,2.295],[48.864,2.307],[48.864,2.321],[48.859,2.333],[48.854,2.348],[48.846,2.366]],name:'Seina'},
  sf:{water:[[37.79,-122.39],[37.81,-122.405],[37.812,-122.44],[37.807,-122.465],[37.816,-122.48],[37.835,-122.48]],coast:true,name:'Sanfranciský záliv'},
  nyc:{water:[[40.87,-73.95],[40.82,-73.973],[40.77,-74.003],[40.72,-74.026],[40.68,-74.04]],name:'Hudson'},
  grandcanyon:{water:[[36.09,-112.05],[36.095,-112.075],[36.102,-112.095],[36.098,-112.113],[36.107,-112.13],[36.12,-112.15]],name:'Colorado',terrain:true},
  rio:{water:[[-22.995,-43.20],[-22.98,-43.185],[-22.965,-43.17],[-22.95,-43.155],[-22.94,-43.17],[-22.95,-43.19]],coast:true,name:'Atlantik',terrain:true},
  iceland:{water:[[63.565,-19.49],[63.548,-19.505],[63.53,-19.512],[63.52,-19.515],[63.50,-19.52]],name:'Skógá',terrain:true},
  'sydney-harbour':{water:[[-33.820,151.290],[-33.840,151.267],[-33.855,151.240],[-33.850,151.217],[-33.858,151.210]],coast:true,name:'Port Jackson'},
  'cape-peninsula':{water:[[-33.900,18.375],[-33.940,18.362],[-33.970,18.370],[-33.995,18.385]],coast:true,terrain:true,name:'Atlantik'},
  'monument-valley':{terrain:true},
  iguazu:{water:[[-25.662,-54.430],[-25.680,-54.434],[-25.695,-54.437],[-25.688,-54.450],[-25.681,-54.465]],terrain:true,name:'Iguaçu'},
  everest:{terrain:true},matterhorn:{terrain:true},fuji:{terrain:true},giza:{terrain:true}
};
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const cleanName=name=>name.replace(/ · (START|CÍL)$/,'');

export function missionMapLayout(route){
  const origin=route.gates[0],offsets=route.gates.map(g=>offsetMeters(g.lat,g.lon,origin));
  const minX=Math.min(...offsets.map(p=>p.x)),maxX=Math.max(...offsets.map(p=>p.x));
  const minY=Math.min(...offsets.map(p=>p.y)),maxY=Math.max(...offsets.map(p=>p.y));
  const scale=Math.min(390/Math.max(600,maxX-minX),180/Math.max(600,maxY-minY));
  const project=point=>{const p=offsetMeters(point.lat,point.lon,origin);return{x:300+(p.x-(minX+maxX)/2)*scale,y:180-(p.y-(minY+maxY)/2)*scale};};
  const nodes=route.gates.map((gate,index)=>({...project(gate),name:cleanName(gate.name),index}));
  // Spread only the numbered badges when close landmarks share the same spot
  // at this scale. Fine leader lines keep their geographic anchors explicit.
  const badges=[];
  for(const node of nodes){
    const candidates=[[0,0],[-22,0],[22,0],[0,-26],[0,26],[-26,-26],[26,26]];
    const [dx,dy]=candidates.find(([dx,dy])=>badges.every(p=>Math.hypot(p.x-node.x-dx,p.y-node.y-dy)>26))||[0,0];
    badges.push({...node,x:node.x+dx,y:node.y+dy});
  }
  const labels=[];
  for(const badge of badges.filter((_,index)=>badges.length<=7||index===0||index===badges.length-1||index%2===0||route.gates[index].kind==='touch-and-go')){
    const width=Math.min(185,Math.max(104,badge.name.length*8+12)),height=40;
    const candidates=[[18,-19],[-width-18,-19],[-width/2,-58],[-width/2,26],[18,-62],[-width-18,26]];
    const boxes=candidates.map(([dx,dy])=>({x:Math.max(12,Math.min(588-width,badge.x+dx)),y:Math.max(38,Math.min(290-height,badge.y+dy)),width,height}));
    const overlaps=(a,b)=>a.x<b.x+b.width+5&&a.x+a.width+5>b.x&&a.y<b.y+b.height+5&&a.y+a.height+5>b.y;
    const score=box=>labels.filter(other=>overlaps(box,other)).length*10000+badges.filter(p=>p.x>box.x-12&&p.x<box.x+box.width+12&&p.y>box.y-12&&p.y<box.y+height+12).length*20;
    if(boxes.every(box=>labels.some(other=>overlaps(box,other)))){
      for(let y=40;y<=250;y+=45)for(let x=12;x<=588-width;x+=24)boxes.push({x,y,width,height});
    }
    const box=boxes.reduce((best,box)=>score(box)<score(best)?box:best,boxes[0]);
    labels.push({...box,index:badge.index});
  }
  return{nodes,badges,labels,project,scale};
}

export function renderMissionMap(mission){
  const route=mission.route,type=route.objective?.type||'time',map=MAPS[mission.place]||MAPS[mission.location?.id]||{};
  const {nodes,badges,labels,project,scale}=missionMapLayout(route);
  const path=points=>points.map(([lat,lon])=>{const p=project({lat,lon});return`${p.x.toFixed(1)},${p.y.toFixed(1)}`;}).join(' ');
  const action=(gate,index)=>gate.kind==='touch-and-go'?'DOSEDNI A VZLÉTNI':gate.kind==='landing'?(route.objective.stop?'PŘISTAŇ A ZASTAV':'PŘISTAŇ'):type==='sightseeing'?'OBJEV PAMÁTKU':type==='lowflight'?`${route.objective.minHeight}–${route.objective.maxHeight} m`:index===0?'START · PROLEŤ':index===nodes.length-1?'CÍL · PROLEŤ':'PROLEŤ BRÁNOU';
  const contours=map.terrain?[70,110,150,190,230].map(r=>`<ellipse cx="330" cy="170" rx="${r}" ry="${r*.55}" transform="rotate(-25 330 170)" class="map-contour"/>`).join(''):'';
  const water=map.water?`<polyline points="${path(map.water)}" class="${map.coast?'map-coast':'map-water'}"/>`:'';
  const land=map.land?`<polyline points="${path(map.land)}" class="map-park"/>`:'';
  const runway=type==='landing'?(()=>{
    const end=nodes.at(-1),heading=route.objective.heading;
    return`<g transform="translate(${end.x} ${end.y}) rotate(${heading-90})"><rect x="-25" y="-6" width="50" height="12" rx="2" class="map-runway"/><path d="M-20 0H20" class="map-runway-axis"/></g>`;
  })():'';
  const scaleMeters=[100,250,500,1000,2000,5000,10000].find(m=>m*scale>=45)||10000;
  return `<svg viewBox="0 0 600 360" role="img" aria-label="${escape('Trasa mise '+mission.title+'. '+nodes.map((p,i)=>`${i+1}: ${p.name}, ${action(route.gates[i],i)}`).join('. '))}">
    <defs><pattern id="mission-map-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" class="map-grid"/></pattern><marker id="mission-map-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0L6 3.5 0 7" class="map-arrow"/></marker></defs>
    <rect width="600" height="360" class="map-land"/><rect width="600" height="360" fill="url(#mission-map-grid)"/>
    ${contours}${land}${water}${runway}
    <text x="18" y="25" class="map-kicker">TRASA · ${nodes.length} BODŮ</text><g class="map-north"><path d="M568 35V14M562 22L568 14 574 22"/><text x="568" y="52" text-anchor="middle">S</text></g>
    ${nodes.slice(1).map((p,i)=>`<path d="M${nodes[i].x} ${nodes[i].y}L${(nodes[i].x+p.x)/2} ${(nodes[i].y+p.y)/2}L${p.x} ${p.y}" class="map-route" marker-mid="url(#mission-map-arrow)"/>`).join('')}
    ${badges.map((p,i)=>`<g class="map-waypoint ${i===0?'map-start':i===nodes.length-1?'map-finish':''}" data-map-point="${i+1}"><title>${escape(`${i+1}. ${p.name} · ${action(route.gates[i],i)}`)}</title><path d="M${nodes[i].x} ${nodes[i].y}L${p.x} ${p.y}" class="map-leader"/><circle cx="${nodes[i].x}" cy="${nodes[i].y}" r="3" class="map-anchor"/><circle cx="${p.x}" cy="${p.y}" r="12"/><text x="${p.x}" y="${p.y+5}" text-anchor="middle">${i+1}</text></g>`).join('')}
    ${labels.map(box=>`<g class="map-point-label"><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="3"/><text x="${box.x+7}" y="${box.y+17}">${escape(nodes[box.index].name.length>22?nodes[box.index].name.slice(0,21)+'…':nodes[box.index].name)}</text><text x="${box.x+7}" y="${box.y+33}" class="map-action">${escape(action(route.gates[box.index],box.index))}</text></g>`).join('')}
    <g class="map-scale"><path d="M18 326V332H${18+scaleMeters*scale}V326"/><text x="18" y="349">${scaleMeters>=1000?scaleMeters/1000+' km':scaleMeters+' m'}</text></g><text x="582" y="349" text-anchor="end" class="map-note">${escape(map.name?map.name+' · ':'')}schematická mapa</text>
  </svg>`;
}
