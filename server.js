'use strict';
/** No external npm dependencies. A signed, HttpOnly cookie stores chapter progress.
 * Chapter JSON is outside /public and never accessible as static files. */
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ROOT=__dirname, PUBLIC=path.join(ROOT,'public');
const PORT=Number(process.env.PORT||5699), HOST=process.env.HOST||'0.0.0.0';
const STATE=process.env.STATE_DIR||path.join(ROOT,'state');
fs.mkdirSync(STATE,{recursive:true,mode:0o700});
const secretFile=path.join(STATE,'cookie-secret');
if(!fs.existsSync(secretFile)) fs.writeFileSync(secretFile,crypto.randomBytes(48),{mode:0o600,flag:'wx'});
const secret=fs.readFileSync(secretFile);
const manifest=JSON.parse(fs.readFileSync(path.join(PUBLIC,'manifest.json'),'utf8'));
const room=require('./room');
room.startWorker();
function sign(v){return crypto.createHmac('sha256',secret).update(v).digest('hex')}
function parseProgress(req){
 try{
 const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('casebook_progress='));
 if(!raw)return 0;
 const [payload,mac]=decodeURIComponent(raw.slice('casebook_progress='.length)).split('.');
 if(!payload||!mac||mac.length!==64)return 0;
 if(!crypto.timingSafeEqual(Buffer.from(mac),Buffer.from(sign(payload))))return 0;
 const obj=JSON.parse(Buffer.from(payload,'base64url').toString());
 if(!Number.isSafeInteger(obj.until)||obj.until<Date.now()||!Number.isInteger(obj.level))return 0;
 return Math.max(0,Math.min(8,obj.level));
 }catch{return 0}
}
function makeCookie(req,n){
 const payload=Buffer.from(JSON.stringify({level:n,until:Date.now()+365*86400000})).toString('base64url');
 // Honor HTTPS as perceived by the reverse proxy; no trust in forwarded headers for any authorization.
 const secure=(req.socket.encrypted||req.headers['x-forwarded-proto']==='https')?'; Secure':'';
 return `casebook_progress=${encodeURIComponent(payload+'.'+sign(payload))}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${secure}`;
}
const ct={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon','.png':'image/png'};
function headers(type='application/json; charset=utf-8',cache='no-store'){
 return {'Content-Type':type,'Cache-Control':cache,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; connect-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; form-action 'self'"};
}
function json(res,status,obj,extra={}){res.writeHead(status,{...headers(),...extra});res.end(JSON.stringify(obj))}
function reject(req){const origin=req.headers.origin;if(!origin)return true;try{const url=new URL(origin);const host=req.headers.host;return url.host!==host||!['https:','http:'].includes(url.protocol)}catch{return true}}
function readBody(req){return new Promise((resolve,reject)=>{let s='';req.on('data',b=>{s+=b;if(s.length>2048){reject(new Error('payload too big'));req.destroy()}});req.on('end',()=>{try{resolve(JSON.parse(s||'{}'))}catch{reject(new Error('invalid json'))}});req.on('error',reject)})}
const server=http.createServer(async(req,res)=>{
 let url;try{url=new URL(req.url,'http://local')}catch{return json(res,400,{error:'bad_url'})}
 const p=url.pathname;
 if(p==='/healthz')return json(res,200,{status:'ok'});
 // The login page is public, but archives and all player actions require a session.
 if(p==='/api/auth/status'||p==='/api/auth/login'||p==='/api/auth/logout'||p.startsWith('/api/agent/')||p.startsWith('/api/room/')){
   try{return await room.handle(req,res,p,parseProgress)}catch(e){console.error('[room]',e);return json(res,400,{error:'room_request_failed'})}
 }
 const user=room.auth(req);
 if(user?.type==='admin' && req.method==='GET')room.syncProgress(parseProgress(req));
 const isPublicAsset=req.method==='GET'&&['/login.js','/style.css','/favicon.svg'].includes(p);
 if(!user||user.type!=='admin'){
   if((p==='/'||p==='/index.html'||p==='/login.html')&&req.method==='GET'){
      const html=fs.readFileSync(path.join(PUBLIC,'login.html'));
      res.writeHead(200,headers('text/html; charset=utf-8'));return res.end(html);
   }
   if(!isPublicAsset)return json(res,401,{error:'login_required'});
 }
 if(req.method==='POST'&&!room.auth(req))return json(res,401,{error:'login_required'});
 if(req.method==='POST'&&req.headers['x-csrf-token']!==user.csrf)return json(res,403,{error:'csrf_failed'});
 
 if(p==='/api/progress' && req.method==='GET')return json(res,200,{level:parseProgress(req)});
 if(p==='/api/manifest' && req.method==='GET')return json(res,200,{episodes:manifest});
 if(/^\/api\/chapter\/\d{1,2}$/.test(p)&&req.method==='GET'){
 const id=Number(p.split('/').pop());
 if(id<1||id>8)return json(res,404,{error:'not_found'});
 if(parseProgress(req)<id)return json(res,403,{error:'locked',message:'请先完整通关并主动解锁该章节'});
 const content=JSON.stringify(room.getChapter(id));
 res.writeHead(200,headers());return res.end(content);
 }
 if((p==='/api/unlock'||p==='/api/relock')&&req.method==='POST'){
  if(reject(req))return json(res,403,{error:'origin_rejected'});
  let body;try{body=await readBody(req)}catch{return json(res,400,{error:'invalid_request'})}
  let level=parseProgress(req);
  if(p==='/api/unlock'){
   const n=Number(body.episode);
   if(!Number.isInteger(n)||n<1||n>8||body.confirmed!==true||body.typed!==`EP${n}`)return json(res,400,{error:'confirmation_required'});
   if(n>level+1)return json(res,409,{error:'sequence',message:'请按章节顺序解锁'});
   level=Math.max(level,n);room.syncProgress(level);
  }else{
   const from=Number(body.from);
   if(!Number.isInteger(from)||from<1||from>8||body.confirmed!==true)return json(res,400,{error:'confirmation_required'});
   level=Math.min(level,from-1);room.syncProgress(level,true);
  }
  return json(res,200,{level},{'Set-Cookie':makeCookie(req,level)});
 }
 if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'method_not_allowed'});
 // Static allowlist, preventing retrieval of private chapter files, state, README, and source.
 const allowed=new Set(['/','/index.html','/style.css','/app.js','/login.js','/favicon.svg']);
 if(!allowed.has(p))return json(res,404,{error:'not_found'});
 const file=path.join(PUBLIC,p==='/'?'index.html':p.slice(1));
 try{const body=fs.readFileSync(file);res.writeHead(200,headers(ct[path.extname(file)]||'application/octet-stream',p==='/app.js'||p==='/style.css'?'public, max-age=600':'no-store'));return res.end(req.method==='HEAD'?undefined:body)}catch{return json(res,404,{error:'not_found'})}
});
server.listen(PORT,HOST,()=>process.stdout.write(`Game Casebook listening on ${HOST}:${PORT}\n`));
