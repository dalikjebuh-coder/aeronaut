import {cp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {resolve, extname, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
export function normalizeBase(value='/') {
  const trimmed=value.replace(/^\/+|\/+$/g,'');
  if(trimmed&&!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(trimmed))throw new Error('Invalid Pages base path');
  return trimmed?`/${trimmed}/`:'/';
}
export function validatePublicToken(token) {
  if(!token)return;
  let payload;
  try{payload=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());}catch{throw new Error('Expected a Cesium ion JWT with public scopes');}
  // Some ion JWTs contain only an ID; their permissions must be checked in ion.
  if(payload.scopes!==undefined&&(!Array.isArray(payload.scopes)||!payload.scopes.includes('assets:read')||payload.scopes.some(scope=>!['assets:read','geocode'].includes(scope)))) {
    throw new Error('The published map token must have only assets:read and optionally geocode. Never publish an administrative token.');
  }
}
export async function buildPages({outDir=resolve(root,'dist'),basePath='/',token=''}={}) {
  const base=normalizeBase(basePath);
  validatePublicToken(token);
  outDir=resolve(outDir);
  if(outDir===resolve(root)||['src','public','scripts','tests','node_modules','.github'].some(dir=>outDir===resolve(root,dir)||outDir.startsWith(resolve(root,dir)+'/')))throw new Error('Unsafe output directory');
  await rm(outDir,{recursive:true,force:true});
  await mkdir(outDir,{recursive:true});
  await cp(resolve(root,'src'),outDir,{recursive:true,filter:source=>!source.startsWith(resolve(root,'src/designs'))});
  await cp(resolve(root,'public'),outDir,{recursive:true});
  // Only our own text files are rewritten; Cesium's workers and libraries stay intact.
  async function rewrite(directory){
    for(const entry of await readdir(directory,{withFileTypes:true})){
      const path=join(directory,entry.name);
      if(entry.isDirectory())await rewrite(path);
      else if(['.html','.js','.css','.json'].includes(extname(path))){
        let text=await readFile(path,'utf8');
        text=text.replace(/(["'`])\/(?=(?:images|models|audio|vendor)\/|[a-zA-Z0-9_-]+\.(?:js|css|json)(?:["'`?#])|["'`])/g,(_,quote)=>quote+base)
          .replace(/url\(\/(?!\/)/g,'url('+base);
        await writeFile(path,text);
      }
    }
  }
  await rewrite(outDir);
  await cp(resolve(root,'node_modules/cesium/Build/Cesium'),resolve(outDir,'vendor'),{recursive:true});
  await writeFile(resolve(outDir,'config.js'),`// Public browser configuration; never put administrative credentials here.\nwindow.AERONAUT_CONFIG=${JSON.stringify({basePath:base,cesiumIonToken:token})};\n`);
  await writeFile(resolve(outDir,'.nojekyll'),'');
  return {outDir,basePath:base,hasMapToken:Boolean(token)};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const result=await buildPages({basePath:process.env.PAGES_BASE_PATH||'/',token:(process.env.CESIUM_ION_TOKEN||'').trim()});
  console.log(`Pages build ready: ${result.outDir} (base ${result.basePath}, maps ${result.hasMapToken?'configured':'not configured'})`);
}
