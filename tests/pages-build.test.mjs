import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import vm from 'node:vm';
import {buildPages,normalizeBase,validatePublicToken} from '../scripts/build-pages.mjs';

const tokenFor=payload=>'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.test';
test('Pages accepts root and repository URLs and rejects unsafe paths and explicit private token scopes',()=>{
  assert.equal(normalizeBase(''),'/');
  assert.equal(normalizeBase('/aeronaut'),'/aeronaut/');
  assert.throws(()=>normalizeBase('../src'));
  assert.throws(()=>normalizeBase('https://example.com'));
  assert.throws(()=>validatePublicToken('not-a-token'));
  assert.throws(()=>validatePublicToken(tokenFor({scopes:['assets:read','tokens:write']})));
  assert.doesNotThrow(()=>validatePublicToken(tokenFor({id:123,jti:'example',iat:1})));
});
test('published game resolves its scripts, map workers, photos, models and audio beneath the repository URL',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'aeronaut-pages-'));
  try{
    for(const basePath of ['/','/aeronaut/']){
      const outDir=join(temp,basePath==='/'?'root':'project');
      const token=tokenFor({scopes:['assets:read','geocode']});
      await buildPages({outDir,basePath,token});
      const html=await readFile(join(outDir,'index.html'),'utf8');
      assert.ok(html.includes(`window.CESIUM_BASE_URL='${basePath}vendor/'`));
      assert.match(html,/<meta name="referrer" content="no-referrer-when-downgrade">/, 'Cesium path-restricted tokens require the full HTTPS page referrer');
      for(const [,path] of html.matchAll(/(?:src|href)="(\/[^"#]+)"/g)){
        assert.ok(path.startsWith(basePath),path);
        await access(join(outDir,path.slice(basePath.length)));
      }
      const sandbox={window:{}};
      vm.runInNewContext(await readFile(join(outDir,'config.js'),'utf8'),sandbox);
      assert.equal(sandbox.window.FLYATLAS_CONFIG.cesiumIonToken,token);
      assert.equal(sandbox.window.FLYATLAS_CONFIG.basePath,basePath);
      for(const file of ['vendor/Assets/approximateTerrainHeights.json','vendor/Workers/createBoxGeometry.js','models/citation2.glb','audio/propeller.ogg','.nojekyll'])await access(join(outDir,file));
      assert.ok(basePath==='/'||!html.includes('\"'+basePath+'>'), 'SVG closing tags must not be rewritten as asset URLs');
      const labels=await readFile(join(outDir,'city-labels.js'),'utf8');
      assert.ok(basePath==='/'||!labels.includes('\"'+basePath+'>'), 'Data-URI marker SVG must stay intact');
      const locations=await readFile(join(outDir,'locations.js'),'utf8');
      assert.ok(locations.includes(`${basePath}images/location-prague-v1.jpg`));
      const audio=await readFile(join(outDir,'engine-audio.js'),'utf8');
      assert.ok(audio.includes(`${basePath}audio/propeller.ogg`));
      const guide=await readFile(join(outDir,'geography-guide.js'),'utf8');
      // Run the actual photo guard from the published code using its public configuration.
      const guard=guide.slice(guide.indexOf('const localPhotoSource='),guide.indexOf('const photoPage='));
      const seeds=JSON.parse(await readFile(join(outDir,'geography-places.json'),'utf8'));
      for(const place of seeds.filter(place=>place.photo?.src)){
        sandbox.point=place;
        assert.equal(vm.runInNewContext('(()=>{'+guard+'\nreturn photoSource(point);})()',sandbox),place.photo.src);
        await access(join(outDir,place.photo.src.slice(basePath.length)));
      }
      sandbox.point={photo:{src:'https://evil.example/photo.jpg'}};
      assert.equal(vm.runInNewContext('(()=>{'+guard+'\nreturn photoSource(point);})()',{...sandbox}),null);
      assert.ok((await readFile(join(outDir,'app.js'),'utf8')).includes('ionToken=window.FLYATLAS_CONFIG?.cesiumIonToken||readSavedToken()'));
    }
  }finally{await rm(temp,{recursive:true,force:true});}
});
