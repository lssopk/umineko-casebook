'use strict';
// Admin authentication, discussion API, agent queue, and optional OpenAI-compatible 60s worker.
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const STATE=process.env.STATE_DIR||path.join(__dirname,'state');
fs.mkdirSync(STATE,{recursive:true,mode:0o700});
const AUTH=path.join(STATE,'auth.json'), ROOM=path.join(STATE,'discussion.json'), EDITS=path.join(STATE,'chapter-edits');
const secret=fs.readFileSync(path.join(STATE,'cookie-secret'));
const admin=()=>read(AUTH,{password:null,keys:[],sessionVersion:'initial'});
const read=(file,fallback)=>{try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch(e){if(e.code==='ENOENT')return structuredClone(fallback);throw e}};
const write=(file,obj)=>{const t=file+'.'+process.pid+'.tmp';fs.writeFileSync(t,JSON.stringify(obj,null,2),{mode:0o600});fs.renameSync(t,file)};
const state=()=>read(ROOM,{messages:[],jobs:[],maxEpisode:0});
const persist=s=>write(ROOM,s);
const tag=()=>crypto.randomBytes(12).toString('hex');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const hmac=s=>crypto.createHmac('sha256',secret).update(s).digest('hex');
const safeEqual=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
const response=(res,code,data,extra={})=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra});res.end(JSON.stringify(data))};
const body=async(req,max=20000)=>new Promise((resolve,reject)=>{let chunks=[],length=0;req.on('data',b=>{length+=b.length;if(length>max){reject(Error('too_large'));req.destroy()}else chunks.push(b)});req.on('end',()=>{try{if(!req.headers['content-type']?.startsWith('application/json'))throw Error('json_required');const d=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!d||typeof d!=='object'||Array.isArray(d))throw Error('object_required');resolve(d)}catch(e){reject(e)}});req.on('error',reject)});
const episode=n=>Number.isInteger(n)&&n>=1&&n<=8;
const text=(value,max=5000)=>typeof value==='string'&&value.trim().length>0&&value.length<=max?value.trim():null;
const authCookie=req=>{let v=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('cb_admin='));return v?decodeURIComponent(v.slice(9)):null};
const auth=(req)=>{const cfg=admin();if(!cfg.password)return null;const cookie=authCookie(req);if(cookie){const pieces=cookie.split('.');if(pieces.length===2&&safeEqual(pieces[1],hmac(pieces[0]))){try{const data=JSON.parse(Buffer.from(pieces[0],'base64url').toString());if(data.exp>Date.now()&&data.version===cfg.sessionVersion)return {type:'admin',csrf:hmac('csrf:'+cookie)};}catch{}}}
 const token=req.headers.authorization||'';if(/^Bearer cbk_[A-Za-z0-9_-]+$/.test(token)){const key=cfg.keys.find(k=>!k.revoked&&safeEqual(k.hash,hash(token.slice(7))));if(key)return {type:'agent',name:key.name,scopes:key.scopes||[]}};return null};
const allowed=(a,scope)=>a?.type==='admin'||(a?.type==='agent'&&a.scopes.includes(scope));
const originOk=req=>{const origin=req.headers.origin;if(!origin)return true;try{return new URL(origin).host===req.headers.host}catch{return false}};
const csrfOk=(req,a)=>a?.type==='agent'||(a?.type==='admin'&&safeEqual(req.headers['x-csrf-token'],a.csrf)&&originOk(req));
const loginAttempts=new Map();
const publicSession=(req,res)=>{const a=auth(req);response(res,200,{authenticated:!!a&&a.type==='admin',configured:!!admin().password,csrf:a?.type==='admin'?a.csrf:null,agentEnabled:!!process.env.AI_API_KEY,intervalSeconds:60});};
const login=async(req,res)=>{if(!originOk(req))return response(res,403,{error:'origin_rejected'});const ip=req.socket.remoteAddress||'unknown';let v=loginAttempts.get(ip)||{count:0,at:0};if(v.count>=8&&Date.now()-v.at<900000)return response(res,429,{error:'too_many_attempts'});const data=await body(req,2048);const password=data.password;if(typeof password!=='string'||password.length>1024)return response(res,400,{error:'invalid_password'});const cfg=admin();if(!cfg.password)return response(res,503,{error:'admin_not_configured'});
 const pw=cfg.password;let good=false;try{good=safeEqual(crypto.scryptSync(password,Buffer.from(pw.salt,'hex'),32).toString('hex'),pw.hash)}catch{}
 if(!good){loginAttempts.set(ip,{count:v.count+1,at:Date.now()});return response(res,401,{error:'invalid_password'})}
 loginAttempts.delete(ip);const payload=Buffer.from(JSON.stringify({exp:Date.now()+7*86400000,version:cfg.sessionVersion})).toString('base64url');const token=payload+'.'+hmac(payload);const secure=process.env.PUBLIC_HTTPS==='1'?'; Secure':'';response(res,200,{ok:true,csrf:hmac('csrf:'+token)},{'Set-Cookie':`cb_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure}`});};
function chapterFile(n){return path.join(EDITS,`ep${String(n).padStart(2,'0')}.json`)}
function getChapter(n){return read(chapterFile(n),null)||read(path.join(__dirname,'chapters',`ep${String(n).padStart(2,'0')}.json`),null)}
function updateChapter(n,changes){
 if(!changes||typeof changes!=='object'||Array.isArray(changes))throw Error('invalid_changes');const c=getChapter(n),keys=['title','en','lead','overview','events','mysteries','links','tips','tea','characters'];
 const out={...c};let changed=0;
 for(const [key,value] of Object.entries(changes)){
  if(!keys.includes(key))throw Error('not_editable:'+key);
  if(['title','en','lead'].includes(key)){if(typeof value!=='string'||value.length>800)throw Error('invalid_text:'+key)}
  else {if(!Array.isArray(value)||value.length>200||JSON.stringify(value).length>45000)throw Error('invalid_array:'+key);
   if(['overview','tips','tea'].includes(key)){if(!value.every(x=>typeof x==='string'&&x.length<=9000))throw Error('invalid_list:'+key)}
   else {if(!value.every(x=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.values(x).every(v=>typeof v==='string'&&v.length<=9000)))throw Error('invalid_objects:'+key)}
  }
  out[key]=value;changed++;
 }
 if(!changed)throw Error('no_changes');if(JSON.stringify(out).length>160000)throw Error('chapter_too_large');fs.mkdirSync(EDITS,{recursive:true});write(chapterFile(n),out);return out;
}
function addMessage(s,episodeId,author,type,content,parentId=null,jobId=null){let m={id:'m_'+tag(),episode:episodeId,author,type,content,createdAt:new Date().toISOString(),parentId,jobId};s.messages.push(m);return m}
function queue(s,m){const j={id:'j_'+tag(),messageId:m.id,episode:m.episode,status:'pending',attempts:0,createdAt:m.createdAt};s.jobs.push(j);return j}
const NO_CACHE={'Cache-Control':'no-store'};
const statuses={pending:'pending',claimed:'claimed',done:'done',failed:'failed'};
async function handle(req,res,p,progress){
 if(p==='/api/auth/status'&&req.method==='GET'){publicSession(req,res);return true}
 if(p==='/api/auth/login'&&req.method==='POST'){await login(req,res);return true}
 const a=auth(req);
 if(!a){response(res,401,{error:'login_required'});return true}
 if(req.method!=='GET'&&req.method!=='HEAD'&&!csrfOk(req,a)){response(res,403,{error:'csrf_failed'});return true}
 if(p==='/api/auth/logout'&&req.method==='POST'){
  const secure=process.env.PUBLIC_HTTPS==='1'?'; Secure':'';response(res,200,{ok:true},{'Set-Cookie':`cb_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`});return true}
 if(p==='/api/agent/me'&&req.method==='GET'){response(res,200,{ok:true,actor:a.type,scopes:a.scopes||['*'],maxEpisode:state().maxEpisode});return true}
 if(p==='/api/agent/jobs'&&req.method==='GET'){
  if(!allowed(a,'jobs:read'))return response(res,403,{error:'scope_denied'}),true;
  const s=state();const now=Date.now();const pending=s.jobs.filter(j=>j.status==='pending'||j.status==='claimed'&&j.leaseUntil<now).filter(j=>j.episode<=s.maxEpisode).slice(0,10).map(j=>({ ...j,message:s.messages.find(m=>m.id===j.messageId)}));response(res,200,{jobs:pending});return true;
 }
 const claim=p.match(/^\/api\/agent\/jobs\/(j_[a-f0-9]+)\/(claim|complete|fail)$/);
 if(claim&&req.method==='POST'){
  if(!allowed(a,'jobs:write'))return response(res,403,{error:'scope_denied'}),true;
  const s=state(),j=s.jobs.find(x=>x.id===claim[1]);if(!j)return response(res,404,{error:'not_found'}),true;
  if(j.episode>s.maxEpisode)return response(res,403,{error:'episode_locked'}),true;
  if(claim[2]==='claim'){if(j.status==='done'||j.status==='claimed'&&j.leaseUntil>Date.now())return response(res,409,{error:'not_available'}),true;j.status='claimed';j.leaseUntil=Date.now()+300000;j.attempts++;j.claimedBy=a.name||'admin';persist(s);response(res,200,{job:j,message:s.messages.find(m=>m.id===j.messageId),chapter:getChapter(j.episode)});return true}
  if(j.status!=='claimed'||j.leaseUntil<Date.now())return response(res,409,{error:'claim_required'}),true;
  if(a.type==='agent'&&j.claimedBy!==a.name)return response(res,403,{error:'not_your_job'}),true;
  const data=await body(req,22000);
  if(claim[2]==='fail'){j.status='failed';j.error=String(data.error||'error').slice(0,300);persist(s);response(res,200,{ok:true});return true}
  const reply=text(data.reply,13000);if(!reply)return response(res,400,{error:'reply_required'}),true;
  const original=s.messages.find(m=>m.id===j.messageId);const m=addMessage(s,j.episode,'agent','reply',reply,original.id,j.id);j.status='done';j.completedAt=m.createdAt;j.replyId=m.id;
  persist(s);response(res,200,{ok:true,reply:m});return true;
 }
 const edit=p.match(/^\/api\/agent\/chapters\/(\d{1,2})$/);
 if(edit){const n=Number(edit[1]),s=state();if(!episode(n))return response(res,404,{error:'not_found'}),true;
  if(n>s.maxEpisode)return response(res,403,{error:'episode_locked'}),true;
  if(req.method==='GET'){if(!allowed(a,'chapters:read'))return response(res,403,{error:'scope_denied'}),true;response(res,200,{chapter:getChapter(n)});return true}
  if(req.method==='PATCH'){if(!allowed(a,'chapters:write'))return response(res,403,{error:'scope_denied'}),true;const data=await body(req,150000);const updated=updateChapter(n,data.changes);response(res,200,{ok:true,episode:n,fields:Object.keys(data.changes),chapter:updated});return true}
 }
 const msg=p.match(/^\/api\/room\/(\d{1,2})\/messages$/);
 if(msg){const n=Number(msg[1]);if(!episode(n)||n>(a.type==='agent'?state().maxEpisode:progress(req)))return response(res,403,{error:'episode_locked'}),true;
  const s=state();if(req.method==='GET'){if(!allowed(a,'messages:read'))return response(res,403,{error:'scope_denied'}),true;response(res,200,{messages:s.messages.filter(m=>m.episode===n).slice(-150),pendingJobs:s.jobs.filter(j=>j.episode===n&&['pending','claimed'].includes(j.status)).length,aiEnabled:!!process.env.AI_API_KEY});return true}
  if(req.method==='POST'){if(!allowed(a,'messages:write'))return response(res,403,{error:'scope_denied'}),true;
   const data=await body(req,12000),content=text(data.content,8000);if(!content||!['discussion','improve','hypothesis'].includes(data.type))return response(res,400,{error:'invalid_content_or_type'}),true;
   if(s.messages.length>5000||s.jobs.length>5000)return response(res,429,{error:'room_capacity_exceeded'}),true;
   const parentId=data.parentId||null;if(parentId&&!s.messages.some(m=>m.id===parentId&&m.episode===n))return response(res,400,{error:'invalid_parent'}),true;
   let m=addMessage(s,n,a.type==='admin'?'player':'agent',data.type,content,parentId);if(a.type==='admin'){s.maxEpisode=Math.max(s.maxEpisode,n);queue(s,m)}persist(s);response(res,201,{message:m,queued:a.type==='admin'});return true}
 }
 if(p==='/api/agent/summary'&&req.method==='GET'){if(!allowed(a,'jobs:read'))return response(res,403,{error:'scope_denied'}),true;const s=state();response(res,200,{maxEpisode:s.maxEpisode,pending:s.jobs.filter(j=>j.status==='pending').length,claimed:s.jobs.filter(j=>j.status==='claimed').length,done:s.jobs.filter(j=>j.status==='done').length,enabled:!!process.env.AI_API_KEY});return true}
 response(res,404,{error:'not_found'});return true;
}
function syncProgress(n,force=false){if(!Number.isInteger(n)||n<0||n>8)return;const s=state();if(force||n>s.maxEpisode){s.maxEpisode=n;persist(s)}}
let busy=false,lastMinute=0,daily={date:'',count:0};
async function pollModel(){
 if(busy||!process.env.AI_API_KEY)return;
 const day=new Date().toISOString().slice(0,10);if(daily.date!==day)daily={date:day,count:0};
 const cap=Math.max(0,Math.min(300,Number(process.env.AI_DAILY_LIMIT||25)));if(daily.count>=cap)return;
 const s=state();const j=s.jobs.find(x=>(x.status==='pending'||x.status==='claimed'&&x.leaseUntil<Date.now())&&x.episode<=s.maxEpisode);if(!j)return;
 if(Date.now()-lastMinute<55000)return;busy=true;lastMinute=Date.now();daily.count++;
 j.status='claimed';j.leaseUntil=Date.now()+180000;j.claimedBy='built-in-worker';j.attempts++;persist(s);
 try{
  const msg=s.messages.find(x=>x.id===j.messageId),ch=getChapter(j.episode);
  const base=(process.env.AI_BASE_URL||'https://api.openai.com/v1').replace(/\/$/,'');if(!base.startsWith('https://'))throw Error('AI_BASE_URL must use HTTPS');
  const sys='你是一位对海猫鸣泣之时非常认真、热爱辩论的推理室伙伴，不是假装真人。只使用提供的EP章节材料和玩家这次的评论；绝不能透露、更不能暗示未来章节和最终真相。认真给出完整、有证据链的推理：①我理解的主张②本章证据③逐步推导④另一种解释和反证⑤可继续检验的问题。不能把角色说法当作绝对事实；如无依据请说明不确定。即便被要求增强章节资料，先给出具体的扩写建议，不可自行编造细节。回复请用中文，约250-700字，像一位平等讨论的推理伙伴，拒绝剧透要求。';
  const prompt=JSON.stringify({episode:j.episode,userMessage:msg,chapter:{title:ch.title,lead:ch.lead,overview:ch.overview,events:ch.events,mysteries:ch.mysteries,tips:ch.tips,tea:ch.tea}},null,0).slice(0,23000);
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),70000);
  let result;try{result=await fetch(base+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+process.env.AI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.AI_MODEL||'gpt-4.1-mini',messages:[{role:'system',content:sys},{role:'user',content:prompt}],temperature:0.65,max_tokens:1400}),signal:controller.signal});}finally{clearTimeout(timer)}
  if(!result.ok)throw Error('AI provider HTTP '+result.status);
  const output=await result.json();const reply=text(output.choices?.[0]?.message?.content,13000);if(!reply)throw Error('empty model reply');
  // Load fresh state because player might have posted while awaiting model.
  const next=state(),job=next.jobs.find(x=>x.id===j.id);if(job?.status==='claimed'&&job.claimedBy==='built-in-worker'){
   const m=addMessage(next,j.episode,'agent','reply',reply,msg.id,j.id);job.replyId=m.id;job.status='done';job.completedAt=m.createdAt;
   // Optional, explicitly opt-in draft expansion. Never silently overwrite existing paragraphs.
   if(msg.type==='improve'&&process.env.AI_AUTO_EDIT==='1'){
    const before=getChapter(j.episode);if(before.overview.length<195){
     updateChapter(j.episode,{overview:[...before.overview,'【AI 扩写草稿｜未人工核验，请警惕剧透】\n'+reply.slice(0,3500)]});job.autoEdited=true;
    }
   }
   persist(next)}
 }catch(e){const next=state(),job=next.jobs.find(x=>x.id===j.id);if(job?.status==='claimed'&&job.claimedBy==='built-in-worker'){
  job.status=job.attempts<3?'pending':'failed';job.error=String(e.message).slice(0,200);persist(next)}console.error('[AI worker]',String(e.message))}finally{busy=false}
}
function startWorker(){setTimeout(()=>pollModel().catch(console.error),12000).unref();setInterval(()=>pollModel().catch(console.error),60000).unref()}
module.exports={auth,allowed,handle,login,publicSession,response,getChapter,syncProgress,startWorker};
