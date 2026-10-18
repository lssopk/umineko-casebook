'use strict';
const $=id=>document.getElementById(id);
const localFallback=Object.create(null);
const store={getItem:k=>{try{return window.localStorage.getItem(k)}catch{return localFallback[k]??null}},setItem:(k,v)=>{try{window.localStorage.setItem(k,v)}catch{localFallback[k]=v}}};
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const cl=(x,min,max)=>Math.min(max,Math.max(min,x));
const state={csrf:null,level:0,manifest:[],chapter:null,selected:0,page:'dashboard',pending:0,rel:'全部',person:null,zoom:1,time:'全部',evidence:'全部'};
let toastTimer;
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2400)}
async function api(path,options={}){if(options.method&&!['GET','HEAD'].includes(options.method.toUpperCase()))options.headers={...options.headers,'X-CSRF-Token':state.csrf};const res=await fetch(path,{cache:'no-store',credentials:'same-origin',...options});const body=await res.json();if(!res.ok)throw new Error(body.message||body.error||'网络错误');return body}
function episodeManifest(n){return state.manifest.find(e=>e.id===n)}
function setPage(page){
 if(page!=='dashboard'&&!state.chapter){toast('请先解锁并打开一个章节');return}
 state.page=page;
 document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+page));
 document.querySelectorAll('[data-page]').forEach(p=>p.classList.toggle('selected',p.dataset.page===page));
 $('currentCrumb').textContent=({dashboard:'档案总览',chapter:'章节阅读',relations:'人物关系',timeline:'事件时间线',evidence:'线索索引',notes:'个人推理室'})[page];
 if(page==='relations')drawGraph();if(page==='timeline')renderTimeline();if(page==='evidence')renderEvidence();if(page==='notes')renderNotes();
 window.scrollTo({top:0,behavior:'instant'});
}
function renderCabinet(){
 $('progressBadge').textContent=state.level?`已解锁 EP1—EP${state.level}`:'尚未解锁章节';
 $('metricUnlocked').textContent=String(state.level).padStart(2,'0');
 $('episodeGrid').innerHTML=state.manifest.map(e=>{
 const available=e.id<=state.level;const active=state.chapter?.id===e.id;
 return `<button class="episode-card ${available?'':'locked'}" data-episode="${e.id}" aria-label="EP${e.id} ${available?'已解锁':'未解锁'}"><span class="overline">${e.phase} / CASE FILE</span><span class="card-no">${String(e.id).padStart(2,'0')}</span><strong>${available?(active?'正在阅读 · ':'已解锁 · ')+'进入调查档案':'尚未解锁 · 内容已封存'}</strong><small>${available?'↗ 查看档案与推理':'⌁ 查看无剧透注意事项并确认通关'}</small></button>`}).join('');
 $('episodeSide').innerHTML=state.manifest.map(e=>`<button class="chapter-item ${state.selected===e.id?'current':''}" data-episode="${e.id}"><span>EP ${String(e.id).padStart(2,'0')}</span><span>${e.id<=state.level?'◈':'⌑'}</span></button>`).join('');
 renderSafeTips(state.selected||Math.min(state.level+1,8));
}
function renderSafeTips(id){
 const e=episodeManifest(id);if(!e)return;
 $('beforeTips').innerHTML=`<span class="overline">EP${String(id).padStart(2,'0')} / 不剧透</span><ul class="tips-list">${e.before.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`;
}
async function openEpisode(n){
 if(n>state.level){state.selected=n;renderCabinet();requestUnlock(n);return}
 try{
  const data=await api('/api/chapter/'+n);
  state.chapter=data;state.selected=n;state.person=null;state.rel='全部';state.time='全部';state.evidence='全部';state.zoom=1;
  renderCabinet();renderChapter();setPage('chapter');toast(`已进入 EP${n} 档案`);
 }catch(err){toast('无法打开章节：'+err.message)}
}
function requestUnlock(n){
 if(n>state.level+1){toast(`请先完成 EP${state.level+1} 的解锁`);return}
 state.pending=n;const e=episodeManifest(n);
 $('modalTitle').textContent=`EP${String(n).padStart(2,'0')} · 通关确认`;
 $('modalText').textContent=`本次将解锁 EP${n} 的完整剧情、人物、事件、疑点和附录。本站不会自动判断你的实际游戏进度；必须由你主动确认。`;
 $('modalTips').innerHTML=`<strong>进入前的注意事项（无剧透）</strong><ul>${e.before.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
 $('unlockWord').textContent='EP'+n;$('unlockInput').placeholder='EP'+n;
 $('unlockInput').value='';$('unlockCheckbox').checked=false;$('modalConfirm').disabled=true;$('modalShade').hidden=false;
}
function updateConfirm(){const n=state.pending;$('modalConfirm').disabled=!($('unlockCheckbox').checked&&$('unlockInput').value.trim()==='EP'+n)}
async function confirmUnlock(){const n=state.pending;if(!$('unlockCheckbox').checked||$('unlockInput').value.trim()!=='EP'+n)return;
 const btn=$('modalConfirm');btn.disabled=true;
 try{
  const out=await api('/api/unlock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({episode:n,typed:'EP'+n,confirmed:true})});
  state.level=out.level;$('modalShade').hidden=true;await openEpisode(n);
 }catch(err){toast('解锁失败：'+err.message);updateConfirm()}
}
function renderChapter(){const d=state.chapter;if(!d)return;
 $('chapterEyebrow').textContent=`CASE FILE / EPISODE ${String(d.id).padStart(2,'0')}`;
 $('chapterHeading').textContent=d.title;
 $('chapterSubheading').textContent=d.en+' · '+d.lead;
 $('chapterBody').innerHTML=`<div class="chapter-tabs"><button class="chip active" data-tab="story">章节回顾</button><button class="chip" data-tab="tips">复盘注意</button><button class="chip" data-tab="appendix">茶会 / ????</button></div><div id="chapterTabContent"></div><div id="chapterDiscussion"></div>`;
 renderDiscussion('chapterDiscussion');
 renderChapterTab('story');
}
function renderChapterTab(tab){const d=state.chapter;document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));
 const fullLink=d.id===1?`<p><a href="/api/chapter/1" target="_blank" rel="noopener">查看本章结构化资料（JSON） ↗</a></p>`:'';
 let html='';
 if(tab==='story')html=`<div class="reading-columns"><article class="reader"><span class="overline">CHAPTER RETROSPECTIVE</span><h2>本章剧情概览</h2><p>${esc(d.lead)}</p>${d.overview.map((p,i)=>`<h3>${String(i+1).padStart(2,'0')} / 关键叙事</h3><p>${esc(p)}</p>`).join('')}<h2>调查建议</h2><p>上方为本章独立回顾。建议随后打开“事件时间线”和“证据与待解疑点”，逐条验证自己的解释。</p>${fullLink}</article><div class="side-article"><article class="panel"><span class="overline">CASE SUMMARY</span><h3>本章目录</h3><div class="rule"><b>${String(d.events.length).padStart(2,'0')}</b><span>重点事件 / 叙事节点</span></div><div class="rule"><b>${String(d.characters.length).padStart(2,'0')}</b><span>人物关系图节点</span></div><div class="rule"><b>${String(d.mysteries.length).padStart(2,'0')}</b><span>需要独立核查的疑点</span></div></article><article class="panel"><span class="overline">PROVENANCE</span><h3>证据分层</h3><div class="highlight-quote">事实、人物声称和推理判断要分别记录。即使是作品展示的画面，也可能需要首先区分叙事层级。</div></article><article class="panel"><button class="button accent" data-page="timeline">进入案件时间线 →</button></article></div></div>`;
 else if(tab==='tips')html=`<div class="reading-columns"><article class="reader"><span class="overline">POST-CHAPTER CHECKLIST</span><h2>本章复盘注意事项</h2><ul>${d.tips.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><h2>自查清单</h2><ul><li>是否把本章的“现场”与其他章节的对应事件混淆？</li><li>所有重要结论是否都有来源，而非只凭印象？</li><li>能否为关键谜团构建至少两种互相竞争的假说？</li><li>是否清楚标注了自己无法验证的信息？</li></ul></article><div class="side-article"><article class="panel"><span class="overline">PLAY WITHOUT SPOILERS</span><h3>复盘边界</h3><p class="secondary">这里仅讨论到 EP${d.id}。不使用任何来自后续章节的解释来“纠正”本章叙事。</p></article></div></div>`;
 else html=`<div class="reading-columns"><article class="reader"><span class="overline">AFTER STORY / ADDENDUM</span><h2>茶会与「????」</h2><p>本页记录当章结束后的附加叙事提示。它与岛上现场材料保持区分，不将不同叙事层的内容自动合并。</p><ul>${d.tea.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><h3>记录方法</h3><p>建议为附录建立独立编号，标明讲述者、场景位置和是否有其他角色独立佐证。请勿直接把附录中任何角色的主张视为法律意义上的物证。</p></article><div class="side-article"><article class="panel"><span class="overline">CAUTION</span><h3>不跨章解释</h3><p class="secondary">这里不会主动引用 EP${d.id+1<=8?d.id+1:'8'} 或更后的展开作为本章答案。</p></article></div></div>`;
 $('chapterTabContent').innerHTML=html;
}
function chips(container,items,selected,key){$(container).innerHTML=items.map(x=>`<button class="chip ${x===selected?'active':''}" data-filter="${esc(x)}" data-kind="${key}">${esc(x)}</button>`).join('')}
function renderTimeline(){const d=state.chapter;if(!d)return;chips('timeChips',['全部',...new Set(d.events.map(x=>x.kind))],state.time,'time');
 const events=d.events.filter(x=>state.time==='全部'||x.kind===state.time);
 $('timelineBody').innerHTML=events.map((e,i)=>`<article class="time-entry"><header><span class="time-stamp">${esc(e.time)} · ${String(i+1).padStart(2,'0')}</span><span class="tag">${esc(e.kind)}</span></header><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p></article>`).join('')||'<p class="empty">此类事件暂无记录。</p>';
}
function renderEvidence(){const d=state.chapter;if(!d)return;chips('evidenceChips',['全部',...new Set(d.mysteries.map(x=>x.kind))],state.evidence,'evidence');const query=$('evidenceSearch').value.trim().toLowerCase();
 const arr=d.mysteries.filter(x=>(state.evidence==='全部'||state.evidence===x.kind)&&[x.id,x.title,x.question].join(' ').toLowerCase().includes(query));
 $('evidenceBody').innerHTML=arr.map(x=>`<article class="evidence-card"><div class="evidence-meta"><code>${esc(x.id)}</code><span class="tag">${esc(x.kind)}</span></div><h3>${esc(x.title)}</h3><p>${esc(x.question)}</p><button class="button tiny" data-cite="${esc(x.id)}">引用到推理室 →</button></article>`).join('')||'<div class="empty">未找到对应线索。</div>';
}
function personById(id){return state.chapter?.characters.find(p=>p.id===id)}
function relationKind(k){if(k==='婚姻')return 'marriage';if(k==='关联')return 'assoc';if(k==='对立')return 'conflict';return ''}
function layoutGraph(){const d=state.chapter;const count=d.characters.length;const groups={家主:[],家族:[],使用人:[],其他:[],叙事:[]};d.characters.forEach(p=>{(groups[p.group]||(groups[p.group]=[])).push(p)});
 const xPos={家主:510,家族:510,使用人:510,其他:510,叙事:510};const yPos={家主:60,家族:230,使用人:410,其他:550,叙事:680};
 const positions={};for(const [group,members] of Object.entries(groups)){if(!members.length)continue;const cols=group==='家族'?5:group==='使用人'?5:group==='叙事'?5:3;members.forEach((p,i)=>{const row=Math.floor(i/cols);const ncol=Math.min(cols,members.length-row*cols);const col=i%cols;const gap=180;positions[p.id]={x:510+(col-(ncol-1)/2)*gap,y:yPos[group]+row*71}})}
 // Flatten vertically for large groups and ensure nonoverlapping rows.
 return positions;
}
function drawGraph(){const d=state.chapter;if(!d)return;
 chips('relChips',['全部','亲子','婚姻','关联','对立','亲属','家族'],state.rel,'rel');
 const pos=layoutGraph();const selected=state.person;
 const edges=d.links.filter(l=>state.rel==='全部'||l.kind===state.rel);
 const related=new Set();if(selected){related.add(selected);for(const l of edges)if(l.from===selected||l.to===selected){related.add(l.from);related.add(l.to)}}
 let mx=730;for(const v of Object.values(pos))mx=Math.max(mx,v.y+90);
 const edgeSvg=edges.map(e=>{const a=pos[e.from],b=pos[e.to];if(!a||!b)return '';return `<line class="edge ${relationKind(e.kind)} ${selected&&! (e.from===selected||e.to===selected)?'dim':''}" x1="${a.x}" y1="${a.y+19}" x2="${b.x}" y2="${b.y-19}"/>`}).join('');
 const nodes=d.characters.map(p=>{const q=pos[p.id];if(!q)return '';return `<g class="person ${p.id===selected?'active':''} ${selected&&!related.has(p.id)?'dim':''}" data-person="${esc(p.id)}" tabindex="0" role="button" aria-label="查看${esc(p.name)}"><rect x="${q.x-76}" y="${q.y-22}" width="152" height="46" rx="8"/><text x="${q.x}" y="${q.y-2}" text-anchor="middle">${esc(p.name)}</text><text x="${q.x}" y="${q.y+14}" text-anchor="middle" class="role">${esc(p.group)}</text></g>`}).join('');
 $('graphSvg').setAttribute('viewBox',`0 0 1020 ${Math.max(740,mx)}`);$('graphSvg').innerHTML=`<g id="graphScene">${edgeSvg}${nodes}</g>`;setZoom();renderPerson();
}
function setZoom(){const g=$('graphScene');if(g)g.setAttribute('transform',`translate(${510*(1-state.zoom)} ${60*(1-state.zoom)}) scale(${state.zoom})`)}
function renderPerson(){const d=state.chapter;if(!d)return;const p=personById(state.person);
 if(!p){$('personInspector').innerHTML='<span class="overline">PERSONNEL FILE</span><h3>选择一位人物</h3><p class="secondary">点击任意节点阅读简介，浏览亲属、关系与冲突。</p>';return}
 const relatives=d.links.filter(l=>l.from===p.id||l.to===p.id).map(l=>{const target=personById(l.from===p.id?l.to:l.from);return target?`<button class="relation-pill" data-person="${esc(target.id)}">${esc(l.kind)} · ${esc(target.name)}</button>`:''}).join('');
 $('personInspector').innerHTML=`<span class="overline">PERSONNEL FILE</span><h3>${esc(p.name)}</h3><span class="tag">${esc(p.group)}</span><p class="secondary">${esc(p.role)}</p><h4>本章可见的关系</h4><div>${relatives||'<p class="secondary">暂无记录</p>'}</div><p class="secondary" style="font-size:11px">此关系图按已解锁章节记录，并不代表人物的全部真实关系已经得到证实。</p>`;
}
function noteKey(){return 'casebook_user_notes_ep'+state.chapter.id}
function getNotes(){try{const value=JSON.parse(store.getItem(noteKey())||'[]');return Array.isArray(value)?value:[]}catch{return []}}
function putNotes(a){store.setItem(noteKey(),JSON.stringify(a))}
function renderNotes(){const d=state.chapter;if(!d)return;renderDiscussion('notesDiscussion');const notes=getNotes();$('notesList').innerHTML=notes.length?notes.map((n,i)=>`<article class="note-card"><span class="overline">EP${d.id} · HYPOTHESIS ${String(i+1).padStart(2,'0')}</span><h3>${esc(n.title)}</h3><p><b>参考：</b>${esc(n.links||'未指定')}</p><p>${esc(n.reason)}</p><p><b>可能反证：</b>${esc(n.counter||'尚未填写')}</p><footer><span class="overline">${esc(n.at||'')}</span><button class="button tiny muted" data-remove="${i}">删除</button></footer></article>`).join(''):'<div class="empty">本章还没有个人推理。你可以从一条证据开始，提出可能的解释。</div>'}
async function exportNotes(){const all={format:'game-casebook-notes-v1',exportedAt:new Date().toISOString(),notes:{}};for(let i=1;i<=8;i++){try{all.notes['ep'+i]=JSON.parse(store.getItem('casebook_user_notes_ep'+i)||'[]')}catch{all.notes['ep'+i]=[]}}
 const url=URL.createObjectURL(new Blob([JSON.stringify(all,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='游戏调查档案馆_推理备份.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('已导出推理笔记')}
async function importNotes(file){if(!file||file.size>1000000){toast('请选择小于 1MB 的 JSON 文件');return}try{const obj=JSON.parse(await file.text());if(obj.format!=='game-casebook-notes-v1'||typeof obj.notes!=='object')throw Error('备份格式不符合要求');if(!confirm('将以导入的笔记替换本浏览器现有的全部章节笔记。确定继续？'))return;for(let i=1;i<=8;i++){const v=obj.notes['ep'+i]||[];if(!Array.isArray(v)||v.length>1000)throw Error('章节记录过多');store.setItem('casebook_user_notes_ep'+i,JSON.stringify(v.map(o=>({title:String(o.title||'').slice(0,100),links:String(o.links||'').slice(0,200),reason:String(o.reason||'').slice(0,5000),counter:String(o.counter||'').slice(0,3000),at:String(o.at||'')}))))}renderNotes();toast('已导入')}catch(e){toast('导入失败：'+e.message)}}

function discussionMarkup(id){return `<section class="discussion-section"><span class="overline">DEDUCTION FORUM · EP${state.chapter.id}</span><h3>章节讨论与 AI 推理伙伴</h3><p>你可以提出疑问、补充个人推理，或申请扩写档案。AI 会依据本章可见线索完整论证，不替玩家决定最终真相。外部智能体/内置 AI 工作器配置后定期处理消息。</p><div class="discussion-meta" id="${id}Meta">读取讨论中…</div><div class="discussion-list" id="${id}List"></div><form class="discussion-form" data-discussion-form="${id}"><select name="type"><option value="discussion">讨论 / 提问</option><option value="improve">建议扩写章节内容</option><option value="hypothesis">提出我的推理</option></select><textarea name="content" required maxlength="8000" placeholder="例如：仅依据本章，请对这个密室提出两个不同解释，列出支持证据和反证…"></textarea><input type="hidden" name="parentId"><button type="submit" class="button accent">发表到推理室 · 等待 AI 回复 →</button></form></section>`}
async function renderDiscussion(target){const d=state.chapter,container=$(target);if(!d||!container)return;
 if(container.dataset.episode!==String(d.id)){container.innerHTML=discussionMarkup(target);container.dataset.episode=String(d.id)}
 try{const data=await api('/api/room/'+d.id+'/messages');if(!$(target+'List'))return;
  $(target+'Meta').textContent=(data.aiEnabled?'AI 自动轮询已配置':'尚未配置内置 AI；Codex 等外部智能体仍可通过 API 回应')+' · '+data.pendingJobs+' 条待处理';
  $(target+'List').innerHTML=data.messages.length?data.messages.slice(-70).map(m=>`<article class="discussion-card ${m.author==='agent'?'agent':''}"><small>${m.author==='agent'?'✧ AI 推理伙伴':'◈ 玩家'} · ${esc(m.type)} · ${esc(m.createdAt.slice(0,16).replace('T',' '))} ${m.parentId?'· 回复 '+esc(m.parentId.slice(0,9)):''}</small><p>${esc(m.content)}</p><button type="button" class="button tiny muted" data-discussion-reply="${esc(m.id)}" data-discussion-target="${target}">回复此条 ↩</button></article>`).join(''):'<div class="empty">本章暂无讨论。说出你真正怀疑的地方，试试让 AI 提供另一种推理。</div>';
 }catch(err){if($(target+'Meta'))$(target+'Meta').textContent='无法加载讨论：'+err.message}
}
function setupHandlers(){
 document.addEventListener('click',ev=>{
  const reply=ev.target.closest('[data-discussion-reply]');if(reply){const form=document.querySelector('#'+reply.dataset.discussionTarget+' form');if(form){form.elements.parentId.value=reply.dataset.discussionReply;form.elements.content.focus();form.scrollIntoView({behavior:'smooth',block:'center'});toast('正在回复选中的讨论')}return}
  const episode=ev.target.closest('[data-episode]');if(episode){openEpisode(Number(episode.dataset.episode));return}
  const tab=ev.target.closest('[data-tab]');if(tab){renderChapterTab(tab.dataset.tab);return}
  const page=ev.target.closest('[data-page]');if(page){setPage(page.dataset.page);return}
  const filter=ev.target.closest('[data-filter]');if(filter){const val=filter.dataset.filter,kind=filter.dataset.kind;if(kind==='rel'){state.rel=val;state.person=null;drawGraph()}else if(kind==='time'){state.time=val;renderTimeline()}else{state.evidence=val;renderEvidence()}return}
  const person=ev.target.closest('[data-person]');if(person){state.person=person.dataset.person;drawGraph();return}
  const cite=ev.target.closest('[data-cite]');if(cite){setPage('notes');$('notesForm').elements.links.value=[$('notesForm').elements.links.value,cite.dataset.cite].filter(Boolean).join(', ');toast('线索编号已加入表单');return}
  const remove=ev.target.closest('[data-remove]');if(remove){if(!confirm('确定删除这条个人推理？'))return;const notes=getNotes();notes.splice(Number(remove.dataset.remove),1);putNotes(notes);renderNotes();return}
 });
 document.addEventListener('submit',async ev=>{const form=ev.target.closest('[data-discussion-form]');if(!form)return;ev.preventDefault();const episode=state.chapter?.id;if(!episode)return;const btn=form.querySelector('button');btn.disabled=true;try{const data=await api('/api/room/'+episode+'/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:form.elements.type.value,content:form.elements.content.value,parentId:form.elements.parentId.value||null})});if(!data.queued)throw Error('未创建 AI 任务');form.reset();toast('留言已提交，将在 AI 工作器下一次轮询时处理');renderDiscussion(form.dataset.discussionForm)}catch(err){toast('留言失败：'+err.message)}finally{btn.disabled=false}});
 $('logoutButton')?.addEventListener('click',async()=>{try{await api('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})}finally{window.location.href='/'}});
 $('evidenceSearch').addEventListener('input',renderEvidence);
 $('themeSwitch').addEventListener('click',()=>{document.body.classList.toggle('light');store.setItem('casebook_theme',document.body.classList.contains('light')?'light':'dark')});
 if(store.getItem('casebook_theme')==='light')document.body.classList.add('light');
 $('dashboardPrimary').addEventListener('click',()=>{$('episodeGrid').scrollIntoView({behavior:'smooth'})});
 $('howItWorks').addEventListener('click',()=>alert('安全机制：①未解锁章节没有标题、剧情或人物；②本站服务器不会发送锁定章节数据；③顺序解锁；④先勾选通关确认，再手动输入 EP 编号；⑤搜索、关系图和时间线只查询当前已解锁章节；⑥可重新封存进度。')); 
 $('unlockInput').addEventListener('input',updateConfirm);$('unlockCheckbox').addEventListener('change',updateConfirm);
 $('modalCancel').addEventListener('click',()=>{$('modalShade').hidden=true});$('modalConfirm').addEventListener('click',confirmUnlock);
 $('zoomIn').addEventListener('click',()=>{state.zoom=cl(state.zoom+.12,.7,1.8);setZoom()});$('zoomOut').addEventListener('click',()=>{state.zoom=cl(state.zoom-.12,.7,1.8);setZoom()});$('zoomReset').addEventListener('click',()=>{state.zoom=1;setZoom()});
 $('resetProgress').addEventListener('click',async()=>{const from=Number(prompt('要从哪个章节起重新封存？输入 1—8（例如 2 表示保留 EP1、重新封存 EP2—EP8）。'));if(!Number.isInteger(from)||from<1||from>8)return;if(!confirm(`将从 EP${from} 起重新封存后续章节。个人笔记不会删除。是否继续？`))return;try{const result=await api('/api/relock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from,confirmed:true})});state.level=result.level;if(state.chapter?.id>state.level){state.chapter=null;state.selected=0;setPage('dashboard')}renderCabinet();toast('已重新封存')}catch(e){toast(e.message)}});
 $('notesForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget.elements;const record={title:f.title.value.trim(),links:f.links.value.trim(),reason:f.reason.value.trim(),counter:f.counter.value.trim(),at:new Date().toLocaleString('zh-CN')};if(!record.title||!record.reason)return;const notes=getNotes();notes.unshift(record);putNotes(notes);e.currentTarget.reset();renderNotes();try{await api('/api/room/'+state.chapter.id+'/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'hypothesis',content:'推理：'+record.title+'\n依据：'+record.reason+'\n关联：'+record.links+'\n可能反证：'+record.counter})});toast('推理已保存并提交给 AI 推理室');renderDiscussion('notesDiscussion')}catch(error){toast('本地保存成功，但 AI 提交失败：'+error.message)}});
 $('exportNotes').addEventListener('click',exportNotes);$('importNotes').addEventListener('click',()=>$('notesFile').click());$('notesFile').addEventListener('change',e=>importNotes(e.target.files[0]));
}
(async()=>{try{const status=await api('/api/auth/status');if(!status.authenticated){window.location.replace('/');return}state.csrf=status.csrf;const [meta,progress]=await Promise.all([api('/api/manifest'),api('/api/progress')]);state.manifest=meta.episodes;state.level=progress.level;state.selected=Math.max(1,Math.min(8,state.level||1));setupHandlers();renderCabinet();setPage('dashboard');setInterval(()=>{if(state.chapter&&['chapter','notes'].includes(state.page))renderDiscussion(state.page==='notes'?'notesDiscussion':'chapterDiscussion')},30000)}catch(e){document.querySelector('.main-inner').innerHTML=`<div class="empty">站点加载失败：${esc(e.message)}。请检查服务器并刷新页面。</div>`}})();
