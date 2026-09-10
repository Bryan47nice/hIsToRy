#!/usr/bin/env node
/*
 * 同學會 App 版本更新看板 — 產生器  v1.2.0
 * 用法： BOARD_PASSWORD=你的密碼 node build.js
 * 讀 releases/*.json → 產生加密過的 index.html
 * 測試時可用 BOARD_OUT=別的路徑 避免覆蓋正式 index.html
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const JIRA_BASE = 'https://cmoneyteam.atlassian.net/browse/';
const ROOT = __dirname;
const RELEASE_DIR = path.join(ROOT, 'releases');
const OUT = process.env.BOARD_OUT ? path.resolve(process.env.BOARD_OUT) : path.join(ROOT, 'index.html');

const PASSWORD = process.env.BOARD_PASSWORD;
if (!PASSWORD) {
  console.error('✗ 請用環境變數提供密碼，例如：BOARD_PASSWORD=xxxx node build.js');
  process.exit(1);
}

// ---------- 讀取並排序版本（新到舊，semver） ----------
function cmpVer(a, b) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((pb[i]||0) !== (pa[i]||0)) return (pb[i]||0) - (pa[i]||0); }
  return 0;
}
const releases = fs.readdirSync(RELEASE_DIR)
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(fs.readFileSync(path.join(RELEASE_DIR, f), 'utf8')))
  .sort((x, y) => cmpVer(x.version, y.version));

if (!releases.length) { console.error('✗ releases/ 裡沒有任何版本 JSON'); process.exit(1); }

// ---------- HTML 跳脫 ----------
const esc = s => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const aiTag = ai => ai ? '<span class="tag-ai" title="此摘要由 AI 自動產生，可校稿">🤖 AI摘要</span>' : '<span class="tag-human" title="由 PM 手動填寫">✍️ 人工</span>';
const jira = key => `<a class="jira" href="${JIRA_BASE}${esc(key)}" target="_blank" rel="noopener">${esc(key)} ↗</a>`;

function featureCard(it) {
  return `<div class="card feat">
    <div class="card-head"><span class="card-title">${esc(it.title)}</span>${jira(it.key)}</div>
    <div class="meta"><span class="plat">${esc(it.platform||'')}</span>${aiTag(it.ai)}</div>
    <div class="row"><span class="lbl">白話</span><span class="val">${esc(it.plain)}</span></div>
    <div class="row"><span class="lbl">影響</span><span class="val">${esc(it.impact)}</span></div>
  </div>`;
}
function bugCard(it) {
  // tag：這張 Bug 的來源。「開發階段」＝測試期間就修掉、沒進到線上，用戶沒遇過
  const tag = it.tag ? `<span class="tag-stage">${esc(it.tag)}</span>` : '';
  return `<div class="card bug">
    <div class="card-head"><span class="card-title">${esc(it.title)}</span>${jira(it.key)}</div>
    <div class="meta"><span class="plat">${esc(it.platform||'')}</span>${tag}${aiTag(it.ai)}</div>
    <div class="row"><span class="lbl">原本</span><span class="val">${esc(it.before)}</span></div>
    <div class="row"><span class="lbl">修好後</span><span class="val">${esc(it.after)}</span></div>
  </div>`;
}
function backendCard(it) {
  return `<div class="card be">
    <div class="card-head"><span class="card-title">${esc(it.title)}</span>${it.key?jira(it.key):''}</div>
    <div class="meta"><span class="plat">${esc(it.date||'')}</span>${aiTag(it.ai)}</div>
    <div class="row"><span class="lbl">說明</span><span class="val">${esc(it.plain||it.desc||'')}</span></div>
  </div>`;
}

// 一欄：固定高度、內容超出在欄內滾動。empty 是沒資料時顯示的文字；none 是搜尋沒命中時的文字
function column(title, cls, items, render, empty, none) {
  const list = items || [];
  const body = list.length ? list.map(render).join('') : `<div class="col-empty">${empty}</div>`;
  return `<section class="col ${cls}">
    <div class="col-head"><span class="bar"></span>${title}<span class="cnt" data-total="${list.length}">${list.length}</span></div>
    <div class="col-body">${body}<div class="col-none">${none}</div></div>
  </section>`;
}

// 搜尋框：ver 為 true 是版本內搜尋，否則是頁面最上方的全站搜尋
function searchBox(placeholder, label) {
  return `<div class="search">
    <span class="ico">🔍</span>
    <input type="search" placeholder="${placeholder}" aria-label="${label}" autocomplete="off">
    <button class="clr" type="button" aria-label="清除搜尋">✕</button>
  </div>`;
}

// idx===0 → 最新版，預設展開
function versionBlock(r, idx) {
  const open = idx === 0;
  const nf = (r.features||[]).length, nb = (r.bugfixes||[]).length, ne = (r.backend||[]).length;
  const counts = `<i class="c-feat">${nf} 新功能</i><i class="c-bug">${nb} Bug</i>` + (ne ? `<i class="c-be">${ne} 後端</i>` : '');
  return `<article class="ver${open?' open':''}" data-open="${open}">
    <header class="ver-head" role="button" tabindex="0" aria-expanded="${open}">
      <div class="vtop"><span class="chev">▸</span><span class="vnum">v${esc(r.version)}</span>
        <span class="vplat">${esc((r.platforms||[]).join(' / '))}</span>
        <span class="vdate">${esc(r.releaseDate)} 發布</span>
        <span class="vmini">${counts}</span></div>
      <p class="vsum">${esc(r.summary)}</p>
    </header>
    <div class="ver-body">
      <div class="tools">${searchBox('搜尋這版的標題、內文或單號…', `搜尋 v${esc(r.version)} 內容`)}<span class="hint"></span></div>
      <div class="cols">
        ${column('✨ 新功能','feat',r.features,featureCard,'本版沒有新功能','沒有符合的新功能')}
        ${column('🐛 Bug 修復','bug',r.bugfixes,bugCard,'本版沒有 Bug 修復','沒有符合的 Bug')}
      </div>
      ${ne ? column('⚙️ 後端／設定調整（免更新 App）','be be-row',r.backend,backendCard,'','沒有符合的後端調整') : ''}
    </div>
  </article>`;
}

const board = `
<div class="wrap">
  <header class="top"><h1>📱 同學會 App 版本更新看板</h1>
    <p class="sub">每次有新版本發佈會更新此頁。點版本標題可展開／收合。資料來源：Jira（HRTX）。</p>
    <div class="tools gtools">${searchBox('搜尋所有版本：功能名、Bug 描述或單號…', '搜尋所有版本')}<span class="hint"></span></div>
  </header>
  ${releases.map(versionBlock).join('')}
  <footer class="foot">最後更新：${new Date().toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}　·　🤖 AI摘要 表示文字由系統自動產生，可校稿</footer>
</div>`;

const STYLE = `
:root{--bg:#0f1115;--card:#1a1d24;--feat:#3b82f6;--bug:#ef4444;--be:#a855f7;--tx:#e8eaed;--mut:#9aa0a6;--line:#2a2e37;--colbg:#0f1218;--colh:520px}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font-family:-apple-system,"Segoe UI","PingFang TC","Microsoft JhengHei",sans-serif;line-height:1.6}
.wrap{max-width:1180px;margin:0 auto;padding:28px 20px 60px}
.top h1{font-size:26px;margin:0 0 6px}.sub{color:var(--mut);margin:0 0 12px;font-size:14px}
.ver{background:#13161c;border:1px solid var(--line);border-radius:14px;padding:6px 20px 4px;margin:14px 0}
.ver.gone{display:none}
.ver-head{cursor:pointer;padding:14px 0;user-select:none;outline:none}
.ver-head:hover .vnum{color:#9ec0ff}
.vtop{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.chev{display:inline-block;transition:transform .18s;color:#7e879a;font-size:14px}
.ver.open .chev{transform:rotate(90deg)}
.vnum{font-size:21px;font-weight:700}
.vplat{font-size:12px;background:#222732;border:1px solid var(--line);padding:2px 10px;border-radius:99px;color:#cfd3da}
.vdate{font-size:13px;color:var(--mut)}
.vmini{font-size:12px;color:#7e879a;margin-left:auto;display:flex;gap:10px}
.vmini i{font-style:normal;display:inline-flex;align-items:center;gap:4px}
.vmini i::before{content:"";width:8px;height:8px;border-radius:2px;background:var(--c)}
.vmini .c-feat{--c:var(--feat)}.vmini .c-bug{--c:var(--bug)}.vmini .c-be{--c:var(--be)}
.vsum{margin:8px 0 2px 22px;color:#c7ccd4;font-size:14.5px;border-left:3px solid #2f6df6;padding-left:10px}
.ver-body{display:none;padding-bottom:16px}
.ver.open .ver-body{display:block}
.cnt{font-size:12px;background:#222732;color:#cfd3da;border-radius:99px;padding:1px 9px;font-weight:500;font-variant-numeric:tabular-nums}
/* 搜尋 */
.tools{display:flex;align-items:center;gap:10px;margin-top:12px}
.gtools{margin:0 0 6px}
.search{position:relative;flex:1;max-width:420px}
.gtools .search{max-width:520px}
.search input{width:100%;padding:8px 34px 8px 34px;font-size:14px;border-radius:9px;border:1px solid var(--line);background:var(--colbg);color:var(--tx);outline:none;font-family:inherit}
.search input:focus{border-color:#2f6df6;box-shadow:0 0 0 3px rgba(47,109,246,.25)}
.search input::-webkit-search-cancel-button{display:none}
.search .ico{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--mut);font-size:14px;pointer-events:none}
.search .clr{position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:0;color:var(--mut);cursor:pointer;font-size:15px;padding:4px 6px;line-height:1;display:none}
.search.has .clr{display:block}
.search .clr:hover{color:var(--tx)}
.hint{font-size:12.5px;color:var(--mut)}
.hint b{color:#cfd3da;font-weight:600;font-variant-numeric:tabular-nums}
mark{background:#5a4a12;color:#ffe08a;border-radius:3px;padding:0 2px}
.card.hide{display:none}
/* 雙欄：左新功能、右 Bug；固定同高、欄內滾動 */
.cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:12px}
.col{background:var(--colbg);border:1px solid var(--line);border-radius:12px;display:flex;flex-direction:column;overflow:hidden;position:relative;min-width:0}
.col-head{display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid var(--line);font-size:15px;font-weight:600;background:#12151c;flex:none}
.col-head .bar{width:4px;height:16px;border-radius:2px;background:var(--c)}
.col.feat{--c:var(--feat)}.col.bug{--c:var(--bug)}.col.be{--c:var(--be)}
.col-body{max-height:var(--colh);overflow-y:auto;padding:4px 12px 12px;scrollbar-width:thin;scrollbar-color:#3a4050 transparent;overscroll-behavior:contain}
.col-body::-webkit-scrollbar{width:8px}
.col-body::-webkit-scrollbar-thumb{background:#3a4050;border-radius:99px}
.col::after{content:"";position:absolute;left:0;right:8px;bottom:0;height:34px;background:linear-gradient(transparent,var(--colbg));pointer-events:none;transition:opacity .15s}
.col.at-end::after{opacity:0}
.col-empty,.col-none{color:var(--mut);font-size:13.5px;padding:28px 0;text-align:center}
.col-none{display:none}
.col.none .col-none{display:block}
.be-row{margin-top:16px}
.be-row .col-body{max-height:220px}
.card{background:var(--card);border:1px solid var(--line);border-left-width:4px;border-radius:10px;padding:11px 13px;margin:9px 0}
.card.feat{border-left-color:var(--feat)}.card.bug{border-left-color:var(--bug)}.card.be{border-left-color:var(--be)}
.card-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.card-title{font-weight:600;font-size:14.5px}
.jira{font-size:12px;color:#7eb0ff;text-decoration:none;white-space:nowrap;font-variant-numeric:tabular-nums}
.jira:hover{text-decoration:underline}
.meta{margin:4px 0 7px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.plat{font-size:11.5px;color:var(--mut)}
.tag-ai{font-size:11px;background:#2a2440;color:#c4b5fd;border:1px solid #43386b;border-radius:99px;padding:1px 8px}
.tag-human{font-size:11px;background:#23362a;color:#86efac;border:1px solid #2f5640;border-radius:99px;padding:1px 8px}
.tag-stage{font-size:11px;background:#2b2620;color:#fcd34d;border:1px solid #574a2f;border-radius:99px;padding:1px 8px}
.row{display:flex;gap:10px;margin:3px 0;font-size:13.5px}
.lbl{flex:0 0 46px;color:var(--mut);font-size:12.5px;padding-top:1px}
.val{flex:1;color:#dde1e7}
.foot{margin-top:26px;color:var(--mut);font-size:12px;text-align:center}
@media(max-width:760px){.cols{grid-template-columns:1fr}.col-body{max-height:360px}.vmini{display:none}.vsum{margin-left:0}.search{max-width:none}}
@media(max-width:480px){.lbl{flex-basis:40px}.tools{flex-wrap:wrap}}
@media(prefers-reduced-motion:reduce){.chev,.col::after{transition:none}}
`;

// ---------- 加密（AES-256-GCM + PBKDF2-SHA256） ----------
const ITER = 200000;
const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const key = crypto.pbkdf2Sync(PASSWORD, salt, ITER, 32, 'sha256');
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const payload = `<style>${STYLE}</style>${board}`;
const enc = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
const tag = cipher.getAuthTag();
const blob = Buffer.concat([enc, tag]).toString('base64'); // ciphertext||tag
const meta = { salt: salt.toString('base64'), iv: iv.toString('base64'), iter: ITER, data: blob };

const html = `<!DOCTYPE html>
<html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>同學會 App 版本更新看板</title>
<style>*{box-sizing:border-box}body{margin:0;font-family:-apple-system,"PingFang TC","Microsoft JhengHei",sans-serif;background:#0f1115;color:#e8eaed}
#gate{max-width:340px;margin:18vh auto;padding:26px;background:#1a1d24;border:1px solid #2a2e37;border-radius:14px;text-align:center}
#gate h2{font-size:18px;margin:0 0 4px}#gate p{color:#9aa0a6;font-size:13px;margin:0 0 16px}
.pw-wrap{position:relative;margin-bottom:10px}
#pw{width:100%;padding:11px 42px 11px 12px;font-size:15px;border-radius:9px;border:1px solid #2a2e37;background:#0f1115;color:#fff}
#toggle{position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:0;cursor:pointer;font-size:17px;padding:6px;line-height:1;opacity:.75}
#toggle:hover{opacity:1}
#go{width:100%;padding:11px;font-size:15px;border:0;border-radius:9px;background:#2f6df6;color:#fff;cursor:pointer}
#err{color:#f87171;font-size:13px;height:18px;margin-top:8px}</style></head>
<body>
<div id="gate">
  <h2>🔒 版本更新看板</h2>
  <p>請輸入密碼檢視</p>
  <div class="pw-wrap">
    <input id="pw" type="password" placeholder="密碼" autofocus>
    <button id="toggle" type="button" aria-label="顯示／隱藏密碼" title="顯示／隱藏密碼">👁</button>
  </div>
  <button id="go">進入</button>
  <div id="err"></div>
</div>
<div id="app"></div>
<script>
const META=${JSON.stringify(meta)};
const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
function setOpen(v,open){v.classList.toggle('open',open);v.querySelector('.ver-head').setAttribute('aria-expanded',open);}
function initCollapse(){
  document.querySelectorAll('#app .ver-head').forEach(function(h){
    h.addEventListener('click',function(){var v=h.closest('.ver');setOpen(v,!v.classList.contains('open'));});
    h.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();h.click();}});
  });
}
// 欄底漸層：滾到底就淡掉
function initColumns(){
  document.querySelectorAll('#app .col').forEach(function(col){
    var body=col.querySelector('.col-body');
    var chk=function(){col.classList.toggle('at-end',body.scrollHeight-body.scrollTop-body.clientHeight<4);};
    body.addEventListener('scroll',chk);
    if(window.ResizeObserver)new ResizeObserver(chk).observe(body);
    chk();col._chk=chk;
  });
}
// ---- 搜尋：純前端過濾，比對標題／內文／單號，命中反白 ----
var escRe=function(s){return s.replace(/[.*+?^\${}()|[\\]\\\\]/g,'\\\\$&');};
var escHtml=function(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');};
function markHtml(html,q){
  var re=new RegExp(escRe(q),'gi');
  var tpl=document.createElement('template');tpl.innerHTML=html;
  var w=document.createTreeWalker(tpl.content,NodeFilter.SHOW_TEXT),nodes=[];
  while(w.nextNode())nodes.push(w.currentNode);
  nodes.forEach(function(n){
    if(!re.test(n.nodeValue)){re.lastIndex=0;return;}
    re.lastIndex=0;
    var span=document.createElement('span');
    span.innerHTML=escHtml(n.nodeValue).replace(re,function(m){return '<mark>'+m+'</mark>';});
    n.replaceWith.apply(n,span.childNodes);
  });
  return tpl.innerHTML;
}
// 對單一版本套用查詢字串，回傳 {hit,total}
function filterVersion(ver,q){
  q=(q||'').trim().toLowerCase();
  if(!ver._cards){ver._cards=Array.prototype.map.call(ver.querySelectorAll('.card'),function(el){return {el:el,html:el.innerHTML,text:el.textContent.toLowerCase()};});}
  var hit=0,total=0;
  ver.querySelectorAll('.col').forEach(function(col){
    var n=0,list=ver._cards.filter(function(c){return col.contains(c.el);});
    list.forEach(function(c){
      var ok=!q||c.text.indexOf(q)>-1;
      c.el.classList.toggle('hide',!ok);
      c.el.innerHTML=(ok&&q)?markHtml(c.html,q):c.html;
      if(ok)n++;
    });
    col.classList.toggle('none',!!q&&n===0);
    var cnt=col.querySelector('.cnt');
    cnt.textContent=q?n+' / '+list.length:list.length;
    col.querySelector('.col-body').scrollTop=0;
    if(col._chk)col._chk();
    hit+=n;total+=list.length;
  });
  var box=ver.querySelector('.tools .search'),hint=ver.querySelector('.tools .hint');
  if(!q)box.querySelector('input').value='';
  box.classList.toggle('has',!!q);
  hint.innerHTML=q?'命中 <b>'+hit+'</b> / '+total+' 筆':'';
  return {hit:hit,total:total};
}
function wireSearch(box,onChange){
  var input=box.querySelector('input'),clr=box.querySelector('.clr');
  input.addEventListener('input',function(){onChange(input.value);});
  input.addEventListener('keydown',function(e){if(e.key==='Escape'){input.value='';onChange('');}});
  clr.addEventListener('click',function(){input.value='';onChange('');input.focus();});
}
function initSearch(){
  var vers=Array.prototype.slice.call(document.querySelectorAll('#app .ver'));
  // 版本內搜尋：只篩該版
  vers.forEach(function(ver){
    wireSearch(ver.querySelector('.tools .search'),function(q){filterVersion(ver,q);});
  });
  // 全站搜尋：每版都篩，有命中的展開、沒命中的隱藏；清空回到預設（最新展開、其餘收合）
  var g=document.querySelector('#app .gtools');
  var ghint=g.querySelector('.hint');
  wireSearch(g.querySelector('.search'),function(q){
    q=q.trim();
    g.querySelector('.search').classList.toggle('has',!!q);
    var hit=0,nver=0;
    vers.forEach(function(ver){
      ver.querySelector('.tools input').value=q;
      var r=filterVersion(ver,q);
      if(q){ver.classList.toggle('gone',r.hit===0);setOpen(ver,r.hit>0);if(r.hit>0)nver++;hit+=r.hit;}
      else{ver.classList.remove('gone');setOpen(ver,ver.dataset.open==='true');}
    });
    ghint.innerHTML=q?(hit?'命中 <b>'+hit+'</b> 筆，分佈在 <b>'+nver+'</b> 個版本':'沒有符合的項目'):'';
  });
}
async function unlock(pw){
  try{
    const ks=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveKey']);
    const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64(META.salt),iterations:META.iter,hash:'SHA-256'},ks,{name:'AES-GCM',length:256},false,['decrypt']);
    const buf=b64(META.data);
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(META.iv)},key,buf);
    document.getElementById('app').innerHTML=new TextDecoder().decode(plain);
    document.getElementById('gate').style.display='none';
    initCollapse();initColumns();initSearch();
    try{sessionStorage.setItem('rb_pw',pw)}catch(e){}
  }catch(e){document.getElementById('err').textContent='密碼錯誤，請再試一次';}
}
document.getElementById('go').onclick=()=>unlock(document.getElementById('pw').value);
document.getElementById('pw').addEventListener('keydown',e=>{if(e.key==='Enter')unlock(e.target.value)});
document.getElementById('toggle').onclick=function(){
  const i=document.getElementById('pw');
  const show=i.type==='password';i.type=show?'text':'password';
  this.textContent=show?'🙈':'👁';i.focus();
};
try{const s=sessionStorage.getItem('rb_pw');if(s)unlock(s)}catch(e){}
</script>
</body></html>`;

fs.writeFileSync(OUT, html);
const feats = releases.reduce((n,r)=>n+(r.features||[]).length,0);
const bugs = releases.reduce((n,r)=>n+(r.bugfixes||[]).length,0);
console.log(`✓ 已產生 index.html（${releases.length} 個版本、${feats} 新功能、${bugs} Bug 修復）`);
console.log(`  最新版本：v${releases[0].version}`);
