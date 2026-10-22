/* v14 — «Дубай для своих»: быстрые фильтры, выходные, расписание, голосование, жалобы на часы,
   время в пути от дома и работы + мобильная оболочка под iPhone (шторка, нижняя панель). */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const E=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fl=p=>p.f||[];
const hav=(a,b)=>{const R=6371,r=Math.PI/180,dl=(b[0]-a[0])*r,dg=(b[1]-a[1])*r,x=Math.sin(dl/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dg/2)**2;return 2*R*Math.asin(Math.sqrt(x));};
const mins=k=>{const r=k*1.35;return r<1.2?Math.max(2,r*13):r/(r<15?32:r<40?55:85)*60+6;};
const WD=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const nowD=()=>dxbNow();
const month=()=>+new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Dubai',month:'numeric'}).format(new Date());
const SUMMER=()=>[5,6,7,8,9].includes(month());
const MOB=window.matchMedia('(max-width:820px)').matches||(window.matchMedia('(pointer:coarse)').matches&&innerHeight<=500);
const tgo=(k,extra)=>{try{ev(k,extra||{});}catch(e){}};

/* ---------- быстрые фильтры ---------- */
const QF=new Set();window.QF=QF;
const QFL=[['kids','С детьми'],['dog','С собакой'],['duo','Вдвоём'],['in','Под крышей'],['m15','≤ 15 мин'],['m30','≤ 30 мин'],['nw','Новое']];
const origin=()=>(QF.has('work')&&ME.prefs.work)?ME.prefs.work:HOME;
const _vis=visible;
window.visible=function(p){
 if(!_vis(p))return false;
 if(!QF.size||(typeof qTokens==='function'&&qTokens().length))return true;
 for(const k of ['kids','dog','duo','in'])if(QF.has(k)&&!fl(p).includes(k))return false;
 if(QF.has('nw')&&!p.nw)return false;
 if(QF.has('m15')||QF.has('m30')){if(p.co&&p.co!=='AE')return false;const lim=QF.has('m15')?15:30;if(mins(hav(origin(),[p.lat,p.lng]))>lim)return false;}
 return true;};
function qfDraw(){let el=$('qf');if(!el){el=document.createElement('div');el.id='qf';el.className='qf';const s=document.querySelector('#vPlaces .search');s.insertAdjacentElement('afterend',el);}
 const hot=typeof tdW!=='undefined'&&tdW&&+tdW.feels>=35;
 el.innerHTML=QFL.map(([k,l])=>`<button data-qf="${k}" class="${QF.has(k)?'on':''}${k==='in'&&hot&&!QF.has(k)?' hint':''}">${l}</button>`).join('')
  +(ME.prefs.work?`<button data-qf="work" class="${QF.has('work')?'on':''}">от работы</button>`:'')
  +`<button data-qfx="work" class="ghost">${ME.prefs.work?'Работа ✎':'+ Работа'}</button>`;}
document.addEventListener('click',e=>{const b=e.target.closest('[data-qf]');if(b){const k=b.dataset.qf;if(QF.has(k))QF.delete(k);else{QF.add(k);if(k==='m15')QF.delete('m30');if(k==='m30')QF.delete('m15');}qfDraw();render();tgo('qf',{k,on:QF.has(k)});return;}
 const x=e.target.closest('[data-qfx="work"]');if(x)workDlg();});
function workDlg(){const cur=ME.prefs.work;modal('Где ты работаешь?',`<p class="v14p">Нужна только примерная точка, чтобы показать места «≤ 15 минут от работы». Хранится в твоём профиле и никому не передаётся.</p>
 <select id="wkA"><option value="">Не указывать</option>${AREAS.map((a,i)=>`<option value="${i}" ${cur&&Math.abs(cur[0]-a[1][0])<1e-4&&Math.abs(cur[1]-a[1][1])<1e-4?'selected':''}>${E(a[0])}</option>`).join('')}<option value="geo">Я сейчас на работе — по геолокации</option></select>
 <div class="row"><button class="pri" id="wkS">Сохранить</button></div>`);
 $('wkS').onclick=()=>{const v=$('wkA').value;const done=pt=>{if(pt)ME.prefs.work=pt;else delete ME.prefs.work;if(!pt)QF.delete('work');prefsSave();$('gm').style.display='none';qfDraw();render();toast(pt?'Запомнил точку работы':'Убрал точку работы');};
  if(v==='geo'){navigator.geolocation?navigator.geolocation.getCurrentPosition(g=>done([+g.coords.latitude.toFixed(3),+g.coords.longitude.toFixed(3)]),()=>toast('Геолокация недоступна'),{timeout:8000}):toast('Геолокация недоступна');}
  else done(v===''?null:AREAS[+v][1]);};}

/* ---------- попап места: бейджи, расписание, голосование, «часы неверные», учёт кликов ---------- */
const FL={kids:'с детьми',dog:'с собакой',duo:'вдвоём',in:'под крышей'};
const schedFor=pid=>(window.SCHED||[]).filter(s=>s.pid===pid);
const POLL=(()=>{try{return JSON.parse(ME.LS.get('dm_poll')||'[]').filter(x=>typeof x==='string').slice(0,4);}catch(e){return[];}})();
const pollSave=()=>{ME.LS.set('dm_poll',JSON.stringify(POLL));trayDraw();};
const _pop=popup;
window.popup=function(p){let h=_pop(p);
 const tags=fl(p).filter(k=>FL[k]).map(k=>`<span>${FL[k]}</span>`).join('');
 const sea=p.sea==='winter'?`<span class="w">${SUMMER()?'сейчас не сезон':'зимний сезон'}</span>`:'';
 const nw=p.nw?'<span class="n">новое</span>':'';
 const tm=ME.prefs.work&&(p.co==='AE'||!p.co)&&p.c!=='user'?`<div class="v14t">≈ ${Math.round(mins(hav(ME.prefs.work,[p.lat,p.lng])))} мин от работы</div>`:'';
 const sc=schedFor(p.id).map(s=>`<div class="v14s"><b>${s.dow.map(d=>WD[d]).join(', ')} · ${E(s.t)}</b> ${E(s.n)}${s.src?` · <a href="${E(s.src)}" target="_blank" rel="noopener">подробнее</a>`:''}</div>`).join('');
 const inPoll=POLL.includes(p.id);
 const act=p.c==='user'||p.c==='mine'?'':`<div class="v14a"><button data-poll="${p.id}" class="${inPoll?'on':''}">${inPoll?'✓ В голосовании':'+ В голосование'}</button><button data-rep="${p.id}">Часы неверные?</button></div>`;
 const extra=(tags||sea||nw?`<div class="v14b">${nw}${tags}${sea}</div>`:'')+tm+sc+act;
 h=h.replace(/<a href=/g,`<a data-pid="${p.id}" href=`);
 return h.replace(/<\/div>$/,extra+'</div>');};
document.addEventListener('click',e=>{
 const a=e.target.closest('a[target="_blank"]');
 if(a){const t=(a.textContent||'').trim().toLowerCase();const k=/маршрут|route/.test(t)?'route':/сайт|site/.test(t)?'site':/greatlist/.test(t)?'greatlist':/брон|book/.test(t)?'book':/подроб|more/.test(t)?'more':'link';const pid=a.dataset.pid||(a.closest('[data-pid]')||{}).dataset?.pid||'';tgo('go_out',{k,pid});}
 const pb=e.target.closest('[data-poll]');if(pb){const id=pb.dataset.poll;const i=POLL.indexOf(id);if(i>=0)POLL.splice(i,1);else{if(POLL.length>=4){toast('В голосовании максимум 4 места');return;}POLL.push(id);}pollSave();const on=POLL.includes(id);document.querySelectorAll(`[data-poll="${id}"]`).forEach(x=>{x.classList.toggle('on',on);x.textContent=x.closest('.wxa')?(on?'✓ Голос':'+ Голос'):(on?'✓ В голосовании':'+ В голосование');});tgo('poll_add',{n:POLL.length});return;}
 const rb=e.target.closest('[data-rep]');if(rb){repDlg(rb.dataset.rep);return;}});
function repDlg(pid){const p=places.find(x=>x.id===pid);if(!p)return;
 modal('Что не так с местом?',`<p class="v14p"><b>${E(p.n)}</b><br>Спасибо, что помогаешь держать карту честной. Три одинаковые отметки от разных людей — и место уходит на проверку.</p>
 <div class="v14rep">${[['hours','Часы работы неверные'],['closed','Закрылось навсегда'],['moved','Переехало'],['other','Другое']].map(([k,l])=>`<button data-rk="${k}">${l}</button>`).join('')}</div>
 <textarea id="repN" maxlength="300" placeholder="Если знаешь, как правильно — напиши (необязательно)"></textarea>`);
 $('gmB').querySelectorAll('[data-rk]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const r=await api('/api/report',{body:{pid,kind:b.dataset.rk,note:$('repN').value.trim()}});$('gm').style.display='none';toast(r.review?'Отправил место на проверку':'Спасибо, учту');tgo('report',{k:b.dataset.rk});}catch(e){b.disabled=false;toast(e.message);}});}

/* ---------- голосование «Куда идём?» ---------- */
function trayDraw(){let t=$('pollTray');if(!POLL.length){if(t)t.remove();return;}
 if(!t){document.body.insertAdjacentHTML('beforeend','<div class="ptray" id="pollTray"></div>');t=$('pollTray');}
 t.innerHTML=`<div><b>Куда идём?</b><small>${POLL.length} ${POLL.length===1?'место — добавь ещё одно':'места в голосовании'}</small></div><button class="pri" id="ptGo" ${POLL.length<2?'disabled':''}>Спросить друзей</button><button class="x" id="ptX" aria-label="Очистить">✕</button>`;
 $('ptX').onclick=()=>{POLL.splice(0);pollSave();render();};$('ptGo').onclick=pollCreate;}
async function pollCreate(){if(POLL.length<2)return;const b=$('ptGo');b.disabled=true;
 try{const r=await api('/api/poll',{body:{pids:POLL,title:''}});const url=location.origin+location.pathname+'?poll='+r.id;const tgu='https://t.me/gotoPlace_bot?startapp=poll_'+r.id;
  const names=POLL.map(id=>(places.find(p=>p.id===id)||{}).n).filter(Boolean);
  const txt='Куда идём? Голосуй: '+names.join(' / ');
  modal('Голосование готово',`<p class="v14p">Отправь ссылку друзьям — проголосовать можно без регистрации. Твоё имя и отметки в голосовании не видны. Ссылка живёт 14 дней.</p>
  <input id="plU" readonly value="${E(url)}"><div class="row"><button class="pri" id="plC">Скопировать</button><a class="btn" target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent(TGA?tgu:url)}&text=${encodeURIComponent(txt)}">В Telegram</a>${navigator.share?'<button id="plS">Ещё…</button>':''}<button id="plO">Открыть</button></div>`);
  $('plC').onclick=()=>{const i=$('plU');i.select();try{navigator.clipboard.writeText(url);}catch(e){document.execCommand('copy');}toast('Скопировал');};
  if($('plS'))$('plS').onclick=()=>navigator.share({title:'Куда идём?',text:txt,url}).catch(()=>{});
  $('plO').onclick=()=>{$('gm').style.display='none';openPoll(r.id);};
  POLL.splice(0);pollSave();render();tgo('poll_create');}catch(e){toast(e.message);b.disabled=false;}}
async function openPoll(id){if(!/^[a-f0-9]{10}$/.test(id))return;let v;
 try{v=await api('/api/poll/'+id);}catch(e){toast(e.message);return;}
 let o=$('pollV');if(!o){document.body.insertAdjacentHTML('beforeend','<div class="pollv" id="pollV" role="dialog" aria-modal="true"><div class="pbox" id="pollB"></div></div>');o=$('pollV');o.addEventListener('click',e=>{if(e.target===o)o.remove();});}
 const draw=v=>{const mx=Math.max(1,...v.options.map(x=>x.v));
  $('pollB').innerHTML=`<div class="ph"><div><small>Голосование</small><h3>${E(v.title)}</h3></div><button class="x" id="pvX" aria-label="Закрыть">✕</button></div>
  <p class="v14p">${v.closed?'Голосование закрыто.':v.mine?'Твой голос учтён — можно передумать.':'Выбери, куда хочешь больше всего.'} Голосов: <b>${v.total}</b></p>
  ${v.options.map(x=>`<button class="popt${v.mine===x.pid?' on':''}" data-vote="${x.pid}" ${v.closed?'disabled':''}><span class="d" style="background:${(CATS[x.c]||{}).hex||'#888'}"></span><span class="pt"><b>${E(x.n)}</b><small>${E(x.a||'')}</small></span><span class="pv">${x.v}</span><i style="width:${Math.round(x.v/mx*100)}%"></i></button>`).join('')}
  <div class="row"><button id="pvMap">Показать на карте</button></div>`;
  $('pvX').onclick=()=>o.remove();
  $('pvMap').onclick=()=>{o.remove();const pts=v.options.map(x=>[x.lat,x.lng]);try{map.fitBounds(L.latLngBounds(pts).pad(.3),{maxZoom:14});}catch(e){}if(window.sheet)sheet('peek');};
  $('pollB').querySelectorAll('[data-vote]').forEach(b=>b.onclick=async()=>{try{const nv=await api('/api/poll/'+id+'/vote',{body:{pid:b.dataset.vote}});draw(nv);if(window.tgHaptic)tgHaptic('success');tgo('poll_vote');}catch(e){toast(e.message);}});};
 draw(v);}
window.openPoll=openPoll;

/* ---------- «Выходные» и «Регулярно» во вкладке «Сегодня» ---------- */
function weekendPicks(){const st=status;const ints=typeof intKeys==='function'?intKeys():[];
 const want=new Set();ints.forEach(k=>(INT2C[k]||[]).forEach(c=>want.add(c)));
 const hot=SUMMER()||(typeof tdW!=='undefined'&&tdW&&+tdW.feels>=35);
 const pool=places.filter(p=>p.co==='AE'&&!p.closed&&p.c!=='mine'&&p.c!=='user'&&!(p.sea==='winter'&&SUMMER())&&hav(HOME,[p.lat,p.lng])<=90);
 const sc=p=>{let s=0,why=[];const m=st[p.id],lk=(LIKES||{})[p.id];
  if(want.has(p.c)||want.has(p.c+':'+p.s)){s+=2;why.push('под твои интересы');}
  if(m==='want'){s+=3;why.unshift('ты хотел сюда');}else if(m==='fav'){s+=1;why.push('любимое');}else if(m==='been'){s-=1.5;}else{s+=.6;why.push('ещё не был');}
  if(lk&&lk.v>0)s+=1;if(lk&&lk.v<0)s-=4;
  if(p.nw){s+=1.4;why.unshift('новое на карте');}
  if(hot){if(fl(p).includes('in')){s+=.8;why.push('под крышей');}else if(['bike','active','nature'].includes(p.c)){s-=.4;why.push('лучше рано утром');}}
  else if(p.sea==='winter'){s+=1.2;why.push('сезон');}
  if(schedFor(p.id).some(x=>x.dow.some(d=>d>=4))){s+=.8;why.push('в выходные заезд');}
  const k=hav(HOME,[p.lat,p.lng]);s-=Math.min(k,90)/35;
  s+=((p.id.charCodeAt(p.id.length-1)+nowD().wd)%7)/20;
  return{p,s,k,why:[...new Set(why)].slice(0,2)};};
 const all=pool.map(sc).sort((a,b)=>b.s-a.s);const per={},out=[];
 for(const x of all){const c=x.p.c;if((per[c]||0)>=1&&out.length<4)continue;if((per[c]||0)>=2)continue;per[c]=(per[c]||0)+1;out.push(x);if(out.length>=5)break;}
 return out;}
function nextDates(){const n=nowD();const res=[];for(let i=0;i<8;i++){const wd=(n.wd+i)%7;res.push({i,wd});}return res;}
function schedNext(){const S=window.SCHED||[];const out=[];const n=nowD();
 nextDates().forEach(({i,wd})=>S.forEach(s=>{if(!s.dow.includes(wd))return;if(s.sea==='winter'&&SUMMER())return;const m=/^(\d\d):(\d\d)$/.exec(s.t);if(i===0&&m&&(+m[1]*60+ +m[2])<n.min)return;out.push({...s,i,wd});}));
 return out.slice(0,6);}
function wkHTML(){const n=nowD();const isWk=n.wd>=4;const picks=weekendPicks();if(!picks.length)return '';
 const card=x=>{const p=x.p;return `<div class="wxc" data-pid="${p.id}"><div class="wxb" style="--c:${CATS[p.c].hex}"><span>${E(subName(p))}</span></div>
  <b>${E(p.n)}</b><small>${Math.round(x.k)} км · ≈ ${Math.round(mins(x.k))} мин</small>
  <div class="wxw">${x.why.map(w=>`<span>${E(w)}</span>`).join('')}</div>
  <div class="wxa"><button data-fly="${p.id}">На карте</button><button data-plan="${p.id}">План</button><button data-poll="${p.id}" class="${POLL.includes(p.id)?'on':''}">${POLL.includes(p.id)?'✓':'+'} Голос</button></div></div>`;};
 const sc=schedNext();
 return `<section class="wx" id="wx"><div class="wxh"><div><small>${isWk?'Эти выходные':'Ближайшие выходные'}</small><h3>Подборка для тебя</h3></div><span class="wxd">${SUMMER()?'летний режим':'сезон на улице'}</span></div>
 <div class="wxs">${picks.map(card).join('')}</div>
 ${sc.length?`<div class="wxr"><small>Регулярно — спорт и заезды</small>${sc.map(s=>`<div class="wxe"><span class="wxt">${s.i===0?'сегодня':s.i===1?'завтра':WD[s.wd]}<b>${E(s.t)}</b></span><span class="wxn"><b>${E(s.n)}</b><small>${E(s.d)}</small></span><a href="${E(s.src)}" target="_blank" rel="noopener" data-pid="${s.pid}">↗</a></div>`).join('')}</div>`:''}
 </section>`;}
if(typeof tdRender==='function'){const _td=tdRender;window.tdRender=function(fit){_td(fit);try{const v=$('vToday');if(!v||$('wx'))return;const anchor=v.querySelector('.tdadv')||v.querySelector('.tdsun');const h=wkHTML();if(!h)return;if(anchor)anchor.insertAdjacentHTML('afterend',h);else v.insertAdjacentHTML('afterbegin',h);}catch(e){console.warn('wk',e);}};}

/* ---------- мобильная оболочка под iPhone ---------- */
const IC={P:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z"/><path d="M9 4v13M15 6.5v13"/></svg>',
 T:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>',
 C:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M19 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z"/></svg>',
 M:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c1.2-3.6 4-5.4 7.5-5.4s6.3 1.8 7.5 5.4"/></svg>'};
let SH='mid';
function hFor(s){const vh=innerHeight;const bar=($('mbar')||{}).offsetHeight||64;return s==='peek'?Math.round(150+bar):s==='mid'?Math.round(vh*.52):Math.round(vh-(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat'))||0)-62);}
function sheet(s,instant){SH=s;const a=document.querySelector('aside');if(!a)return;a.classList.toggle('instant',!!instant);a.style.height=hFor(s)+'px';a.dataset.s=s;document.documentElement.style.setProperty('--sheetH',hFor(s)+'px');
 try{L.Popup.prototype.options.autoPanPaddingBottomRight=[16,hFor(s)+16];}catch(e){}}
window.sheet=sheet;
function shell(){if(!MOB||document.body.classList.contains('mob'))return;document.body.classList.add('mob');
 const aside=document.querySelector('aside'),hdr=aside.querySelector('header'),tabs=aside.querySelector('.tabs');
 const top=document.createElement('div');top.className='mtop';top.appendChild(hdr);document.body.appendChild(top);
 const addFb=()=>{const hb=hdr.querySelector('#hMe');if(!hb){setTimeout(addFb,300);return;}if(!$('hFb')){hb.insertAdjacentHTML('beforebegin','<button class="hb" id="hFb" aria-label="Оставить отзыв" title="Отзыв"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/></svg></button>');$('hFb').onclick=()=>fbDlg();}};addFb();
 const bar=document.createElement('nav');bar.className='mbar';bar.id='mbar';bar.setAttribute('aria-label','Разделы');
 const L1={P:'Карта',T:'Сегодня',C:'Консьерж'};
 ['P','T','C'].forEach(k=>{const b=$('t'+k);b.innerHTML=`${IC[k]}<span>${L1[k]}</span>`;bar.appendChild(b);});
 const me=document.createElement('button');me.id='tM';me.innerHTML=`${IC.M}<span>Профиль</span>`;me.onclick=()=>{cabinet();tgo('tab_m');};bar.appendChild(me);
 tabs.remove();document.body.appendChild(bar);
 aside.insertAdjacentHTML('afterbegin','<div class="grab" id="grab" role="button" aria-label="Развернуть или свернуть панель"><i></i></div>');
 sheet('mid',true);
 setTimeout(()=>{map.invalidateSize();},60);
 // перетаскивание шторки
 let y0=0,h0=0,drag=false,lastY=0,lastT=0,vel=0,scr=null,decided=false;
 const views=()=>[$('vPlaces'),$('vToday'),$('vCon')];
 aside.addEventListener('touchstart',e=>{if(e.touches.length!==1)return;const t=e.target;if(t.closest('input,textarea,select'))return;y0=lastY=e.touches[0].clientY;lastT=Date.now();h0=aside.offsetHeight;drag=false;decided=false;
  scr=views().find(v=>v&&v.style.display!=='none'&&v.contains(t))||null;if(t.closest('#grab'))scr=null;},{passive:true});
 aside.addEventListener('touchmove',e=>{if(e.touches.length!==1)return;const y=e.touches[0].clientY,dy=y-y0;
  if(!decided){if(Math.abs(dy)<6)return;decided=true;
   const inScroll=scr&&getComputedStyle(scr).overflowY!=='visible';const atTop=!scr||scr.scrollTop<=0;
   const horiz=e.target.closest('.qf,.chips,.wxs,.tdhr,.sub,.row2,.tools,.colchips,.moods');
   drag=!scr||(SH!=='full'&&dy<0&&!horiz)||(dy>0&&atTop);if(SH==='full'&&dy<0&&inScroll)drag=false;}
  if(!drag)return;e.preventDefault();const nh=Math.max(hFor('peek')-40,Math.min(hFor('full'),h0-dy));aside.classList.add('instant');aside.style.height=nh+'px';
  const now=Date.now();vel=(y-lastY)/Math.max(1,now-lastT);lastY=y;lastT=now;},{passive:false});
 aside.addEventListener('touchend',()=>{if(!drag)return;drag=false;aside.classList.remove('instant');const h=aside.offsetHeight;const st=['peek','mid','full'];
  let best;if(vel<-.5)best=h<hFor('mid')?'mid':'full';else if(vel>.5)best=h>hFor('mid')?'mid':'peek';else best=st.reduce((a,b)=>Math.abs(hFor(b)-h)<Math.abs(hFor(a)-h)?b:a);sheet(best);tgo('sheet',{s:best});});
 $('grab').addEventListener('click',()=>sheet(SH==='peek'?'mid':SH==='mid'?'full':'peek'));
 $('q').addEventListener('focus',()=>{if(SH!=='full')sheet('full');});
 map.on('popupopen',e=>{if(SH!=='peek')sheet('peek');setTimeout(()=>{try{const px=map.latLngToContainerPoint(e.popup.getLatLng());const want=innerHeight*0.62;if(px.y>want-40)map.panBy([0,px.y-want],{animate:true});}catch(_){}},120);});
 map.on('dragstart',()=>{if(SH==='full')sheet('mid');});
 addEventListener('resize',()=>sheet(SH,true));
 if(window.visualViewport)visualViewport.addEventListener('resize',()=>{document.documentElement.style.setProperty('--vvh',visualViewport.height+'px');});
 try{L.Popup.prototype.options.autoPanPaddingTopLeft=[16,90];L.Popup.prototype.options.maxWidth=300;}catch(e){}}
// вкладки: на мобилке шторка открывается под раздел
const _tab=tab;window.tab=function(v){_tab(v);if(!document.body.classList.contains('mob'))return;const k=v===true?'C':v===false?'P':v;
 if(k==='C')sheet('full');else if(k==='T')sheet(SH==='peek'?'mid':SH);else if(k==='P'&&SH==='full'&&document.activeElement!==$('q'))sheet('mid');};
const _openP=openP;window.openP=function(id){if(document.body.classList.contains('mob'))sheet('peek');_openP(id);};


/* подсказка «листай» в приветствии */
function wHint(){const b=document.querySelector('.wel .wbox');const row=b&&b.querySelector('.wrow');if(!b||!row)return;
 if(!row.querySelector('.wmore')){row.insertAdjacentHTML('afterbegin','<button type="button" class="wmore" aria-label="Пролистать вниз">Ещё ниже ↓</button>');row.querySelector('.wmore').onclick=()=>b.scrollBy({top:b.clientHeight*.7,behavior:'smooth'});}
 const upd=()=>{const m=row.querySelector('.wmore');if(m)m.classList.toggle('off',b.scrollTop+b.clientHeight>=b.scrollHeight-8);};
 if(!b._wh){b._wh=1;b.addEventListener('scroll',upd,{passive:true});}upd();}
new MutationObserver(()=>{const w=document.querySelector('.wel');if(w&&getComputedStyle(w).display!=='none')wHint();}).observe(document.body,{childList:true,subtree:false,attributes:true,attributeFilter:['class']});
setInterval(()=>{const w=document.querySelector('.wel');if(w&&w.classList.contains('show'))wHint();},700);

/* ---------- старт ---------- */
function boot(){try{shell();}catch(e){console.warn('shell',e);}
 qfDraw();trayDraw();
 const sp=new URLSearchParams(location.search).get('poll')||(()=>{try{const s=(TGA&&TGA.initDataUnsafe&&TGA.initDataUnsafe.start_param)||'';return s.startsWith('poll_')?s.slice(5):'';}catch(e){return '';}})();
 if(sp)setTimeout(()=>openPoll(sp.toLowerCase()),700);
 render();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
