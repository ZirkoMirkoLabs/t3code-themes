import http from 'node:http';
import fs from 'node:fs';
import {stat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {loadAllThemes}=createRequire(import.meta.url)('../launcher/theme-library.cjs');
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.mp4':'video/mp4','.webm':'video/webm','.webp':'image/webp','.json':'application/json','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff2':'font/woff2','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    const requested=pathname==='/'?'/preview/index.html':pathname;
    if(requested==='/themes/index.json'||requested==='/preview/../themes/index.json'){const r=loadAllThemes();res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(r));return}
    if(requested==='/prompt.json'){const rd=n=>{try{return fs.readFileSync(path.join(root,'studio',n),'utf8').trim()}catch{return ''}};res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({core:rd('theme-master-prompt.md'),tasteDefault:rd('theme-design-taste.md')}));return}
    if(requested==='/skins/index.json'){const dirs=fs.readdirSync(path.join(root,'skins'),{withFileTypes:true}).filter(d=>d.isDirectory()&&fs.existsSync(path.join(root,'skins',d.name,'skin.json')));const list=dirs.map(d=>{try{return JSON.parse(fs.readFileSync(path.join(root,'skins',d.name,'skin.json'),'utf8'))}catch{return null}}).filter(Boolean);res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(list));return}
    if(!/^\/(preview|runtime|assets|skins|themes)\//.test(requested)||!['GET','HEAD'].includes(req.method)){res.writeHead(404).end();return}
    const file=await realpath(path.join(root,requested));
    const relative=path.relative(root,file);
    if(relative.startsWith('..')||path.isAbsolute(relative)||!types[path.extname(file)]){res.writeHead(404).end();return}
    const info=await stat(file);if(!info.isFile()){res.writeHead(404).end();return}
    const headers={'Content-Type':types[path.extname(file)],'Cache-Control':'no-store','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};
    let start=0,end=info.size-1;
    if(req.headers.range){const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!match){res.writeHead(416).end();return}start=Number(match[1]);if(match[2])end=Math.min(Number(match[2]),end);if(start>end){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return}headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;}
    headers['Content-Length']=end-start+1;res.writeHead(req.headers.range?206:200,headers);
    if(req.method==='HEAD')res.end();else fs.createReadStream(file,{start,end}).pipe(res);
  }catch{res.writeHead(404).end();}
});
server.listen(43872,'127.0.0.1',()=>console.log('T3 Code Themes playground: http://127.0.0.1:43872/'));
