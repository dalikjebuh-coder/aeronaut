const aircraftCredits={
  highWing:'Letadlo: High Wing Single Light Aircraft / 3dassets.dev · CC0',
  lowWing:"Letadlo: BlenderCommunityHead / God's Eye View · CC BY 4.0 · Sketchfab",
  airliner:"Letadlo: Nobilis 2 / God's Eye View · CC BY 4.0 · Sketchfab",
  fighter:'Letadlo: andertan / Airframe Archive · CC BY 4.0 · Sketchfab'
};

export function wrapPhotoText(context,text,width){
  const lines=[];
  let line='';
  for(const word of text.split(/\s+/)){
    const candidate=line+word;
    if(line&&context.measureText(candidate).width>width){lines.push(line);line='';}
    // A provider can supply a long unbroken identifier; never clip its attribution.
    for(const character of word){
      if(line&&context.measureText(line+character).width>width){lines.push(line);line='';}
      line+=character;
    }
    line+=' ';
  }
  if(line.trim())lines.push(line.trim());
  return lines.map(value=>value.trim());
}

function loadLogo(element){
  return new Promise(resolve=>{
    const image=new Image();
    const timer=setTimeout(()=>finish(null),2500);
    function finish(result){clearTimeout(timer);image.onload=null;image.onerror=null;resolve(result);}
    image.crossOrigin='anonymous';
    image.onload=()=>finish(image.naturalWidth&&image.naturalHeight?image:null);
    image.onerror=()=>finish(null);
    image.src=element.src;
  });
}

export async function captureScenePhoto(viewer,{google=false,cityLabels=false,model='lowWing',showAircraft=true}={}){
  // Copy synchronously after rendering: WebGL's default drawing buffer is transient.
  // This avoids making every flight frame preserve a costly drawing buffer.
  viewer.scene.requestRender();viewer.render();
  const scene=viewer.scene.canvas;
  if(!scene.width||!scene.height)throw new Error('The scene has no image');
  const snapshot=document.createElement('canvas');
  snapshot.width=scene.width;snapshot.height=scene.height;
  snapshot.getContext('2d').drawImage(scene,0,0);

  // CreditDisplay has just finished the same frame, including tile-specific owners.
  const root=viewer.cesiumWidget.creditDisplay.container;
  const credits=[...root.querySelectorAll('.cesium-credit-wrapper')];
  const texts=credits.map(element=>element.textContent.replace(/\s+/g,' ').trim()).filter(Boolean);
  const logoElements=credits.flatMap(element=>[...element.querySelectorAll('img')]);
  const logos=await Promise.all(logoElements.map(loadLogo));
  logos.forEach((image,index)=>{if(!image)texts.push(logoElements[index].alt||logoElements[index].title||'Mapový zdroj');});
  if(google)texts.unshift('Google Maps');
  else texts.unshift('Tréninková krajina · FlyAtlas');
  if(cityLabels)texts.push('Názvy míst: GeoNames · geonames.org · CC BY 4.0');
  if(showAircraft)texts.push(aircraftCredits[model]||aircraftCredits.lowWing);

  const output=document.createElement('canvas');
  const context=output.getContext('2d');
  const scale=Math.max(1,Math.min(2,scene.width/1600)),padding=14*scale,lineHeight=17*scale;
  context.font=`${12*scale}px sans-serif`;
  const lines=[...new Set(texts)].flatMap(text=>wrapPhotoText(context,text,scene.width-2*padding));
  let logoX=padding,logoY=padding;
  const placements=[];
  for(const image of logos.filter(Boolean)){
    const height=18*scale,width=height*image.naturalWidth/image.naturalHeight;
    if(logoX>padding&&logoX+width>scene.width-padding){logoX=padding;logoY+=32*scale;}
    placements.push({image,x:logoX,y:logoY,width,height});logoX+=width+24*scale;
  }
  const textTop=placements.length?logoY+32*scale:padding;
  const footerHeight=Math.ceil(textTop+lines.length*lineHeight+padding);
  output.width=scene.width;output.height=scene.height+footerHeight;
  context.drawImage(snapshot,0,0);
  context.fillStyle='#14231e';context.fillRect(0,scene.height,output.width,footerHeight);
  for(const item of placements)context.drawImage(item.image,item.x,scene.height+item.y,item.width,item.height);
  context.fillStyle='#eff1e7';context.font=`${12*scale}px sans-serif`;context.textBaseline='top';
  lines.forEach((line,index)=>context.fillText(line,padding,scene.height+textTop+index*lineHeight));
  const blob=await new Promise((resolve,reject)=>{
    output.toBlob(result=>result?resolve(result):reject(new Error('PNG export failed')),'image/png');
  });
  return{blob,width:output.width,height:output.height};
}

export function photoFilename(date=new Date()){
  const pad=value=>String(value).padStart(2,'0');
  return`flyatlas-${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.png`;
}
