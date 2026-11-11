import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
const types = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.wasm':'application/wasm','.woff2':'font/woff2','.gif':'image/gif','.glb':'model/gltf-binary','.ogg':'audio/ogg','.wav':'audio/wav','.mp3':'audio/mpeg' };
const server = http.createServer(async (req,res) => {
  try {
    const path = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const asset = path.startsWith('/models/') || path.startsWith('/audio/');
    const base = path.startsWith('/vendor/') ? resolve(root,'node_modules/cesium/Build/Cesium') : asset ? resolve(root,'public') : resolve(root,'src');
    const relative = path.startsWith('/vendor/') ? path.slice(8) : asset ? path.slice(1) : path === '/' ? 'index.html' : path.slice(1);
    const file = resolve(base,relative);
    if (!file.startsWith(base+sep)) {res.writeHead(403).end(); return;}
    const data = await readFile(file);
    res.writeHead(200,{'Content-Type':types[extname(file)] || 'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});
    res.end(data);
  } catch {res.writeHead(404).end('Not found');}
});
server.listen(Number(process.env.PORT || 4387),'127.0.0.1',()=>console.log(`Aeronaut: http://127.0.0.1:${server.address().port}`));
