#!/usr/bin/env node
/*
 * 同學會 App 版本更新看板 — 產生器  v1.1.0
 * 用法： BOARD_PASSWORD=你的密碼 node build.js
 * 讀 releases/*.json → 產生加密過的 index.html
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const JIRA_BASE = 'https://cmoneyteam.atlassian.net/browse/';
const ROOT = __dirname;
const RELEASE_DIR = path.join(ROOT, 'releases');
const OUT = path.join(ROOT, 'index.html');

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
  return `<div class="card bug">
    <div class="card-head"><span class="card-title">${esc(it.title)}</span>${jira(it.key)}</div>
    <div class="meta"><span class="plat">${esc(it.platform||'')}</span>${aiTag(it.ai)}</div>
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

function section(title, cls, items, render) {
  if (!items || !items.length) return '';
  return `<section class="sec ${cls}"><h3>${title}<span class="cnt">${items.length}</span></h3>${items.map(render).join('')}</section>`;
}

// idx===0 → 最新版，預設展開
function versionBlock(r, idx) {
  const open = idx === 0;
  const counts = `${(r.features||[]).length} 新功能 · ${(r.bugfixes||[]).length} Bug` +
    ((r.backend||[]).length ? ` · ${(r.backend||[]).length} 後端` : '');
  return `<article class="ver${open?' open':''}">
    <header class="ver-head" role="button" tabindex="0" aria-expanded="${open}">
      <div class="vtop"><span class="chev">▸</span><span class="vnum">v${esc(r.version)}</span>
        <span class="vplat">${esc((r.platforms||[]).join(' / '))}</span>
        <span class="vdate">${esc(r.releaseDate)} 發布</span>
        <span class="vmini">${counts}</span></div>
      <p class="vsum">${esc(r.summary)}</p>
    </header>
    <div class="ver-body">
      ${section('✨ 新功能','s-feat',r.features,featureCard)}
      ${section('🐛 Bug 修復','s-bug',r.bugfixes,bugCard)}
      ${section('⚙️ 後端／設定調整（免更新 App）','s-be',r.backend,backendCard)}
    </div>
  </article>`;
}

const board = `
<div class="wrap">
  <header class="top"><h1>📱 同學會 App 版本更新看板</h1>
    <p class="sub">每次有新版本發佈會更新此頁。點版本標題可展開／收合。資料來源：Jira（HRTX）。</p></header>
  ${releases.map(versionBlock).join('')}
  <footer class="foot">最後更新：${new Date().toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}　·　🤖 AI摘要 表示文字由系統自動產生，可校稿</footer>
</div>`;

const STYLE = `
:root{--bg:#0f1115;--card:#1a1d24;--feat:#3b82f6;--bug:#ef4444;--be:#a855f7;--tx:#e8eaed;--mut:#9aa0a6;--line:#2a2e37}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font-family:-apple-system,"Segoe UI","PingFang TC","Microsoft JhengHei",sans-serif;line-height:1.6}
.wrap{max-width:860px;margin:0 auto;padding:28px 18px 60px}
.top h1{font-size:26px;margin:0 0 6px}.sub{color:var(--mut);margin:0 0 18px;font-size:14px}
.ver{background:#13161c;border:1px solid var(--line);border-radius:14px;padding:6px 20px 4px;margin:14px 0}
.ver-head{cursor:pointer;padding:14px 0;user-select:none;outline:none}
.ver-head:hover .vnum{color:#9ec0ff}
.vtop{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.chev{display:inline-block;transition:transform .18s;color:#7e879a;font-size:14px}
.ver.open .chev{transform:rotate(90deg)}
.vnum{font-size:21px;font-weight:700}
.vplat{font-size:12px;background:#222732;border:1px solid var(--line);padding:2px 10px;border-radius:99px;color:#cfd3da}
.vdate{font-size:13px;color:var(--mut)}
.vmini{font-size:12px;color:#7e879a;margin-left:auto}
.vsum{margin:8px 0 2px 22px;color:#c7ccd4;font-size:14.5px;border-left:3px solid #2f6df6;padding-left:10px}
.ver-body{display:none;padding-bottom:14px}
.ver.open .ver-body{display:block}
.sec{margin-top:16px}.sec h3{font-size:16px;margin:0 0 10px;display:flex;align-items:center;gap:8px}
.cnt{font-size:12px;background:#222732;color:#cfd3da;border-radius:99px;padding:1px 9px}
.card{background:var(--card);border:1px solid var(--line);border-left-width:4px;border-radius:10px;padding:13px 15px;margin:9px 0}
.card.feat{border-left-color:var(--feat)}.card.bug{border-left-color:var(--bug)}.card.be{border-left-color:var(--be)}
.card-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.card-title{font-weight:600;font-size:15.5px}
.jira{font-size:12.5px;color:#7eb0ff;text-decoration:none;white-space:nowrap;font-variant-numeric:tabular-nums}
.jira:hover{text-decoration:underline}
.meta{margin:5px 0 9px;display:flex;gap:8px;align-items:center}
.plat{font-size:11.5px;color:var(--mut)}
.tag-ai{font-size:11px;background:#2a2440;color:#c4b5fd;border:1px solid #43386b;border-radius:99px;padding:1px 8px}
.tag-human{font-size:11px;background:#23362a;color:#86efac;border:1px solid #2f5640;border-radius:99px;padding:1px 8px}
.row{display:flex;gap:10px;margin:4px 0;font-size:14px}
.lbl{flex:0 0 46px;color:var(--mut);font-size:12.5px;padding-top:1px}
.val{flex:1;color:#dde1e7}
.foot{margin-top:26px;color:var(--mut);font-size:12px;text-align:center}
@media(max-width:480px){.lbl{flex-basis:40px}.vmini{display:none}.vsum{margin-left:0}}
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
function initCollapse(){
  document.querySelectorAll('#app .ver-head').forEach(function(h){
    h.addEventListener('click',function(){
      var v=h.closest('.ver');var open=v.classList.toggle('open');
      h.setAttribute('aria-expanded',open);
    });
    h.addEventListener('keydown',function(e){
      if(e.key==='Enter'||e.key===' '){e.preventDefault();h.click();}
    });
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
    initCollapse();
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
