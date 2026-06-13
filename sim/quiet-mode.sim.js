#!/usr/bin/env node
/*
 * Quiet-mode → per-user path sim (pre-lockdown frontend fix).
 * quietUntil moved from shared /settings (sSet/gSet) to the per-user /notificationPrefs cache
 * (window._notif.prefs). Mounts the REAL quietUntilVal / isQuietMode / setQuietMode on a mocked
 * window._notif + a saveNotifPref stub (which, like the real one, writes the cache synchronously).
 *
 *  [1] prefs unloaded            -> quietUntilVal()=null, isQuietMode()=false (no throw)
 *  [2] setQuietMode(4)           -> cache.quietUntil ~4h ahead, isQuietMode()=true
 *  [3] setQuietMode(0)           -> cache.quietUntil=null, isQuietMode()=false
 *  [4] past timestamp in cache   -> isQuietMode()=false
 *  [5] setQuietMode writes via saveNotifPref('quietUntil',…) — NOT sSet/gSet
 *  [6] regression: gSet/sSet byte-identical; setQuietMode no longer references gSet/sSet
 *
 * Run: node sim/quiet-mode.sim.js   (exit 0 = pass)
 */
const fs=require('fs');const vm=require('vm');const cp=require('child_process');const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const WORK=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const HEAD=cp.execSync('git show HEAD:index.html',{cwd:ROOT,maxBuffer:64*1024*1024}).toString();
let fails=0; function ok(c,m){if(c){console.log('  ✓ '+m);}else{console.log('  ✗ '+m);fails++;}}
function extractFn(src,name){const sig='function '+name+'(';const i=src.indexOf(sig);if(i<0)throw new Error('fn '+name);let k=src.indexOf('{',i),d=0,inS=null,esc=false,lc=false,bc=false,prev='';for(;k<src.length;k++){const c=src[k],n=src[k+1];if(lc){if(c==='\n')lc=false;continue;}if(bc){if(c==='*'&&n==='/'){bc=false;k++;}continue;}if(inS){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===inS){inS=null;prev=c;}continue;}if(c==='/'&&n==='/'){lc=true;k++;continue;}if(c==='/'&&n==='*'){bc=true;k++;continue;}if(c==='/'){if(!/[A-Za-z0-9_$)\]}'"`]/.test(prev)){k++;let cl=false;for(;k<src.length;k++){const r=src[k];if(r==='\\'){k++;continue;}if(r==='[')cl=true;else if(r===']')cl=false;else if(r==='/'&&!cl)break;}prev='/';continue;}prev=c;continue;}if(c==='\''||c==='"'||c==='`'){inS=c;prev=c;continue;}if(c==='{')d++;else if(c==='}'){d--;if(d===0)return src.slice(i,k+1);}if(!/\s/.test(c))prev=c;}throw new Error('unbalanced '+name);}

function ctxWith(prefs){
  const writes=[];
  const win={_notif: prefs===undefined ? {} : {prefs:prefs}};
  const sandbox={console,Date,Math,window:win,
    // stub mirrors the REAL saveNotifPref: set the cache synchronously, record the write
    saveNotifPref(key,val){ win._notif.prefs=win._notif.prefs||{}; win._notif.prefs[key]=val; writes.push({key,val}); }
  };
  sandbox.__writes=writes; sandbox.__win=win;
  const ctx=vm.createContext(sandbox);
  ['quietUntilVal','isQuietMode','setQuietMode'].forEach(f=>vm.runInContext(extractFn(WORK,f),ctx));
  return {ctx,win,writes};
}

console.log('\n=== Quiet-mode per-user-path sim ===');

// [1] prefs unloaded
(function(){
  console.log('\n[1] prefs unloaded');
  const {ctx}=ctxWith(undefined); // window._notif = {} (no .prefs)
  ok(vm.runInContext('quietUntilVal()',ctx)===null,'[1] quietUntilVal() = null when prefs absent');
  ok(vm.runInContext('isQuietMode()',ctx)===false,'[1] isQuietMode() = false (no throw)');
})();

// [2] setQuietMode(4) -> quiet
(function(){
  console.log('\n[2] setQuietMode(4)');
  const {ctx,win,writes}=ctxWith({});
  vm.runInContext('setQuietMode(4)',ctx);
  const until=new Date(win._notif.prefs.quietUntil);
  const hrs=(until-new Date())/3600000;
  ok(win._notif.prefs.quietUntil!=null,'[2] cache.quietUntil set');
  ok(hrs>3.9 && hrs<4.1,'[2] ~4h ahead (got '+hrs.toFixed(2)+'h)');
  ok(vm.runInContext('isQuietMode()',ctx)===true,'[2] isQuietMode() = true');
  ok(writes.length===1 && writes[0].key==='quietUntil','[2] wrote via saveNotifPref(quietUntil,…)');
})();

// [3] setQuietMode(0) -> off
(function(){
  console.log('\n[3] setQuietMode(0)');
  const {ctx,win}=ctxWith({quietUntil:new Date(Date.now()+4*3600000).toISOString()});
  ok(vm.runInContext('isQuietMode()',ctx)===true,'[3] starts quiet');
  vm.runInContext('setQuietMode(0)',ctx);
  ok(win._notif.prefs.quietUntil===null,'[3] cache.quietUntil cleared to null');
  ok(vm.runInContext('isQuietMode()',ctx)===false,'[3] isQuietMode() = false after resume');
})();

// [4] past timestamp -> not quiet
(function(){
  console.log('\n[4] expired quietUntil');
  const {ctx}=ctxWith({quietUntil:new Date(Date.now()-3600000).toISOString()}); // 1h ago
  ok(vm.runInContext('quietUntilVal()',ctx)!=null,'[4] quietUntilVal present');
  ok(vm.runInContext('isQuietMode()',ctx)===false,'[4] past timestamp => not quiet');
})();

// [5] setQuietMode never touches sSet/gSet (source-level)
(function(){
  console.log('\n[5] no shared-settings coupling');
  const sm=extractFn(WORK,'setQuietMode');
  ok(sm.indexOf('sSet')<0 && sm.indexOf('gSet')<0,'[5] setQuietMode references neither sSet nor gSet');
  const iq=extractFn(WORK,'isQuietMode');
  ok(iq.indexOf('gSet')<0,'[5] isQuietMode no longer reads gSet');
  ok(extractFn(WORK,'quietUntilVal').indexOf('window._notif')>=0,'[5] quietUntilVal reads the per-user cache');
  // renderTodaysActions' quiet banner now reads the per-user value too (this sim co-owns that change)
  const rt=extractFn(WORK,'renderTodaysActions');
  ok(rt.indexOf('new Date(quietUntilVal())')>=0,'[5] renderTodaysActions quiet banner reads quietUntilVal()');
  ok(rt.indexOf('gSet().quietUntil')<0 && rt.indexOf('s.quietUntil')<0,'[5] renderTodaysActions quiet banner no longer reads a gSet quietUntil');
  // loadNotifPrefs carries quietUntil into the cache so it survives a reload
  ok(extractFn(WORK,'loadNotifPrefs').indexOf('quietUntil:(p.quietUntil||null)')>=0,'[5] loadNotifPrefs hydrates quietUntil into the cache');
})();

// [6] regression — shared settings helpers untouched
(function(){
  console.log('\n[6] regression vs HEAD');
  ['gSet','sSet','notifDefaults','notifUid'].forEach(n=>ok(extractFn(HEAD,n)===extractFn(WORK,n),'[6] unchanged: '+n));
})();

console.log('\n=== '+(fails===0?'ALL PASS':fails+' FAILURE(S)')+' ===\n');
process.exit(fails===0?0:1);
