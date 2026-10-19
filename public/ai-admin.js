'use strict';
const el=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const item=(name,value)=>'<div class="ai-stat"><small>'+esc(name)+'</small><b>'+esc(value)+'</b></div>';
const when=x=>x?new Date(x).toLocaleString('zh-CN'):'—';
let csrf='';let formLoaded=false;
async function request(url,options={}){const r=await fetch(url,{cache:'no-store',credentials:'same-origin',...options});if(r.status===401){location.replace('/');throw Error('请先登录')}const data=await r.json();if(!r.ok)throw Error(data.error||'HTTP '+r.status);return data}
async function refresh(){
 try{
  const data=await request('/api/admin/ai/status'),c=data.config,q=data.queue,w=data.worker;
  el('error').textContent='';if(!formLoaded){el('baseUrl').value=c.baseUrl;el('model').value=c.model;el('dailyLimit').value=c.dailyLimit;el('autoEdit').checked=c.autoEdit;formLoaded=true;}
  el('config').innerHTML=item('密钥',c.keyHint)+item('模型',c.model)+item('API 地址',c.baseUrl)+item('轮询间隔',c.pollSeconds+' 秒')+item('每日调用上限',c.dailyLimit)+item('自动改写章节',c.autoEdit?'开启':'关闭');
  el('queue').innerHTML=item('待处理',q.pending)+item('执行中',q.claimed)+item('已完成',q.done)+item('失败',q.failed)+item('今日调用',w.dailyCount)+item('上次调用',when(w.lastAttempt));
  el('jobs').innerHTML=data.recentJobs.map(j=>'<tr><td>'+esc(when(j.createdAt))+'</td><td>EP'+j.episode+'</td><td>'+esc(j.status)+'</td><td>'+j.attempts+'</td><td>'+esc(j.error||'—')+'</td></tr>').join('')||'<tr><td colspan="5">暂无任务</td></tr>';
  el('logs').innerHTML=data.logs.map(l=>'<tr><td>'+esc(when(l.time))+'</td><td>'+esc(l.event)+'</td><td class="'+(l.success===false||l.event==='job_failed'?'ai-fail':'ai-ok')+'">'+esc(l.success===false?'失败':l.success===true?'成功':l.event==='job_failed'?'失败':'—')+'</td><td>'+esc(l.model||l.jobId||'—')+'</td><td>'+esc(l.durationMs!=null?l.durationMs+' ms':l.usage?.totalTokens!=null?l.usage.totalTokens+' tokens':l.error||l.reason||l.httpStatus||'—')+'</td></tr>').join('')||'<tr><td colspan="5">暂无日志</td></tr>';
 }catch(e){el('error').textContent='无法读取 AI 状态：'+e.message}
}
el('refresh').onclick=()=>{formLoaded=false;refresh()};
el('settings').onsubmit=async e=>{e.preventDefault();const b=e.currentTarget.querySelector('button');b.disabled=true;el('saveResult').textContent='保存中…';try{const payload={baseUrl:el('baseUrl').value.trim(),model:el('model').value.trim(),dailyLimit:Number(el('dailyLimit').value),autoEdit:el('autoEdit').checked,clearKey:el('clearKey').checked};if(el('key').value)payload.key=el('key').value;await request('/api/admin/ai/config',{method:'PUT',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(payload)});el('key').value='';el('clearKey').checked=false;el('saveResult').textContent='✓ 已保存到服务器，立即生效';formLoaded=false;await refresh()}catch(err){el('saveResult').textContent='保存失败：'+err.message}finally{b.disabled=false}};

el('test').onclick=async()=>{const btn=el('test');btn.disabled=true;el('testResult').textContent='正在测试模型连接…';try{const d=await request('/api/admin/ai/test',{method:'POST',headers:{'X-CSRF-Token':csrf,'Content-Type':'application/json'},body:'{}'});el('testResult').textContent=(d.ok?'✓ ':'✗ ')+(d.message||d.error||'未知结果')+(d.durationMs?' · '+d.durationMs+' ms':'')+(d.answer?' · AI 回复：'+d.answer:'');}catch(e){el('testResult').textContent='测试失败：'+e.message}finally{btn.disabled=false;await refresh()}};
(async()=>{try{const auth=await request('/api/auth/status');if(!auth.authenticated){location.replace('/');return}csrf=auth.csrf;await refresh()}catch(e){el('error').textContent=e.message}})();
