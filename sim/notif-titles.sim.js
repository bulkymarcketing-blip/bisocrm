#!/usr/bin/env node
/*
 * Cinzel-on-screen cleanup + notification-panel calm sim (presentation only).
 * Verifies:
 *  - notifIcon(type) returns a coloured DOT span (no emoji): new_lead→success, appt_reminder→navy, test/default→muted;
 *  - maSection(title) header is Inter, proper-case (no 'Cinzel', no text-transform:uppercase);
 *  - <style>: .nt-title / .mt / .av-btn / (.av-menu .av-info .rl) are Inter (no 'Cinzel');
 *    .nt-item.unread uses var(--navy) (no var(--gold)); .av-menu .av-info .rl colour is var(--muted) (no var(--gold-lt));
 *  - KEEPERS untouched: .brand-name / .auth-brand / .auth-title / .qgt / .sht / .cpn / .ltl / .card-title still carry Cinzel;
 *  - regression: the notif/avatar/account logic fns byte-identical vs HEAD.
 *
 * Run: node sim/notif-titles.sim.js   (exit 0 = pass)
 */
const fs=require('fs');const vm=require('vm');const cp=require('child_process');const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const WORK=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const HEAD=cp.execSync('git show HEAD:index.html',{cwd:ROOT,maxBuffer:64*1024*1024}).toString();
let fails=0; function ok(c,m){if(c){console.log('  ✓ '+m);}else{console.log('  ✗ '+m);fails++;}}
function extractFn(src,name){const sig='function '+name+'(';const i=src.indexOf(sig);if(i<0)throw new Error('fn '+name);let k=src.indexOf('{',i),d=0,inS=null,esc=false,lc=false,bc=false,prev='';for(;k<src.length;k++){const c=src[k],n=src[k+1];if(lc){if(c==='\n')lc=false;continue;}if(bc){if(c==='*'&&n==='/'){bc=false;k++;}continue;}if(inS){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===inS){inS=null;prev=c;}continue;}if(c==='/'&&n==='/'){lc=true;k++;continue;}if(c==='/'&&n==='*'){bc=true;k++;continue;}if(c==='/'){if(!/[A-Za-z0-9_$)\]}'"`]/.test(prev)){k++;let cl=false;for(;k<src.length;k++){const r=src[k];if(r==='\\'){k++;continue;}if(r==='[')cl=true;else if(r===']')cl=false;else if(r==='/'&&!cl)break;}prev='/';continue;}prev=c;continue;}if(c==='\''||c==='"'||c==='`'){inS=c;prev=c;continue;}if(c==='{')d++;else if(c==='}'){d--;if(d===0)return src.slice(i,k+1);}if(!/\s/.test(c))prev=c;}throw new Error('unbalanced '+name);}
function cssBlock(src){const a=src.indexOf('<style>');const b=src.indexOf('</style>',a);return src.slice(a,b);}
function cssRule(css,sel){const i=css.indexOf(sel);if(i<0)return null;const j=css.indexOf('}',i);return j<0?null:css.slice(i,j+1);}

console.log('\n=== Cinzel cleanup + notif-calm sim ===');

// [1] notifIcon -> coloured dot, no emoji
(function(){
  console.log('\n[1] notifIcon');
  const ctx=vm.createContext({});
  vm.runInContext(extractFn(WORK,'notifIcon'),ctx);
  const cases={new_lead:'var(--success)',appt_reminder:'var(--navy)',test:'var(--muted)',somethingElse:'var(--muted)'};
  Object.keys(cases).forEach(function(t){
    const out=vm.runInContext('notifIcon('+JSON.stringify(t)+')',ctx);
    ok(out.indexOf('border-radius:50%')>=0 && out.indexOf('width:8px')>=0,'[1] '+t+' → dot span');
    ok(out.indexOf('background:'+cases[t])>=0,'[1] '+t+' → '+cases[t]);
  });
  const all=Object.keys(cases).map(t=>vm.runInContext('notifIcon('+JSON.stringify(t)+')',ctx)).join('');
  ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(all),'[1] no emoji in any notifIcon output');
})();

// [2] maSection -> Inter, proper case
(function(){
  console.log('\n[2] maSection');
  const ctx=vm.createContext({});
  vm.runInContext(extractFn(WORK,'maSection'),ctx);
  const h=vm.runInContext('maSection("My profile")',ctx);
  ok(h.indexOf('font-family:Inter,sans-serif')>=0,'[2] header is Inter');
  ok(h.indexOf('Cinzel')<0,'[2] no Cinzel');
  ok(h.indexOf('text-transform:uppercase')<0,'[2] no uppercase');
  ok(h.indexOf('letter-spacing:1px')<0,'[2] letter-spacing dropped');
  ok(h.indexOf('>My profile</div>')>=0,'[2] title rendered as-is (proper case)');
})();

// [3] edited CSS rules
(function(){
  console.log('\n[3] edited CSS rules');
  const css=cssBlock(WORK);
  ['.nt-title{','.mt{','.av-btn{','.av-menu .av-info .rl{'].forEach(function(sel){
    const r=cssRule(css,sel);
    ok(r && r.indexOf("'Inter',sans-serif")>=0 && r.indexOf('Cinzel')<0,'[3] '+sel+' is Inter (no Cinzel)');
  });
  ok(cssRule(css,'.nt-title{').indexOf('letter-spacing')<0,'[3] .nt-title letter-spacing dropped');
  const unread=cssRule(css,'.nt-item.unread{');
  ok(unread.indexOf('var(--navy)')>=0 && unread.indexOf('var(--gold)')<0,'[3] .nt-item.unread navy cue (no gold)');
  ok(unread.indexOf('rgba(27,43,75,0.05)')>=0,'[3] .nt-item.unread bg de-golded to navy tint');
  const rl=cssRule(css,'.av-menu .av-info .rl{');
  ok(rl.indexOf('var(--muted)')>=0 && rl.indexOf('var(--gold-lt)')<0,'[3] .rl colour var(--muted) (no gold-lt)');
  ok(rl.indexOf('text-transform:uppercase')>=0 && rl.indexOf('letter-spacing:1.5px')>=0,'[3] .rl keeps uppercase + letter-spacing');
  const av=cssRule(css,'.av-btn{');
  ok(av.indexOf('border:2px solid var(--gold)')>=0 && av.indexOf('background:var(--navy)')>=0 && av.indexOf('color:#fff')>=0,'[3] .av-btn keeps navy circle + gold ring + white text');
})();

// [4] KEEPERS still Cinzel (untouched)
(function(){
  console.log('\n[4] Cinzel keepers untouched');
  const css=cssBlock(WORK);
  // .auth-brand{} is layout-only — its Cinzel lives on the .nm/.crown/.tg descendants.
  ['.brand-name','.auth-brand .nm','.auth-title','.qgt','.sht','.cpn','.ltl','.card-title'].forEach(function(sel){
    const r=cssRule(css,sel+'{');
    ok(r && r.indexOf('Cinzel')>=0,'[4] '+sel+' still carries Cinzel');
  });
})();

// [5] regression — notif/avatar/account logic byte-identical vs HEAD
(function(){
  console.log('\n[5] regression vs HEAD');
  ['renderNotifList','renderNotifBadge','markAllNotifsRead','toggleNotifPanel','openMyAccount']
    .forEach(n=>ok(extractFn(HEAD,n)===extractFn(WORK,n),'[5] unchanged: '+n));
})();

console.log('\n=== '+(fails===0?'ALL PASS':fails+' FAILURE(S)')+' ===\n');
process.exit(fails===0?0:1);
