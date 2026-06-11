#!/usr/bin/env node
/*
 * Retire Confirmed Clients (rClients) sim.
 * Proves the retired screen is unreachable and the post-confirm redirect moved to Schedule,
 * WITHOUT touching the live Profiles (rCustomers) Leads/Clients filter that also uses 'clients'.
 *
 *  - the fn={…} route map has NO 'clients' key; nav items array has NO id:'clients'; TITLES has no 'clients' key;
 *  - the confirm handler calls sv('schedule') (not sv('clients'));
 *  - rCustomers STILL has the ['clients','Clients'] pill + the f==='clients' filter (Profiles untouched);
 *  - rClients body byte-identical (only a RETIRED comment added above it);
 *  - regression: rCustomers, every other r* render, and the helpers byte-for-byte unchanged.
 *
 * Run: node sim/retire-clients.sim.js   (exit 0 = pass)
 */
const fs=require('fs');const cp=require('child_process');const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const WORK=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const HEAD=cp.execSync('git show HEAD:index.html',{cwd:ROOT,maxBuffer:64*1024*1024}).toString();
let fails=0; function ok(c,m){if(c){console.log('  ✓ '+m);}else{console.log('  ✗ '+m);fails++;}}
function extractFn(src,name){const sig='function '+name+'(';const i=src.indexOf(sig);if(i<0)throw new Error('fn '+name);let k=src.indexOf('{',i),d=0,inS=null,esc=false,lc=false,bc=false,prev='';for(;k<src.length;k++){const c=src[k],n=src[k+1];if(lc){if(c==='\n')lc=false;continue;}if(bc){if(c==='*'&&n==='/'){bc=false;k++;}continue;}if(inS){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===inS){inS=null;prev=c;}continue;}if(c==='/'&&n==='/'){lc=true;k++;continue;}if(c==='/'&&n==='*'){bc=true;k++;continue;}if(c==='/'){if(!/[A-Za-z0-9_$)\]}'"`]/.test(prev)){k++;let cl=false;for(;k<src.length;k++){const r=src[k];if(r==='\\'){k++;continue;}if(r==='[')cl=true;else if(r===']')cl=false;else if(r==='/'&&!cl)break;}prev='/';continue;}prev=c;continue;}if(c==='\''||c==='"'||c==='`'){inS=c;prev=c;continue;}if(c==='{')d++;else if(c==='}'){d--;if(d===0)return src.slice(i,k+1);}if(!/\s/.test(c))prev=c;}throw new Error('unbalanced '+name);}
// Slice an object/array literal starting at `marker` up to its first balanced close.
function literal(src,marker,close){const i=src.indexOf(marker);if(i<0)return null;const j=src.indexOf(close,i);return j<0?null:src.slice(i,j+close.length);}

console.log('\n=== Retire Confirmed Clients (rClients) sim ===');

// [1] route map has no 'clients' key
(function(){
  console.log('\n[1] route map');
  const fnMapW=literal(WORK,'var fn={dailyBrief:rDailyBrief','};');
  const fnMapH=literal(HEAD,'var fn={dailyBrief:rDailyBrief','};');
  ok(fnMapW!==null,'[1] located the fn={…} route map');
  ok(fnMapH && fnMapH.indexOf('clients:rClients')>=0,'[1] HEAD route map HAD clients:rClients (sanity)');
  ok(fnMapW.indexOf('clients:rClients')<0,'[1] route map no longer maps clients:rClients');
  ok(fnMapW.indexOf('clients:')<0,'[1] route map has NO clients: key at all');
  ok(fnMapW.indexOf('customers:rCustomers')>=0,'[1] customers:rCustomers still present (Profiles route intact)');
})();

// [2] nav items array has no id:'clients'
(function(){
  console.log('\n[2] nav items');
  ok(HEAD.indexOf("{id:'clients',lbl:'Confirmed'")>=0,'[2] HEAD nav HAD the Confirmed item (sanity)');
  ok(WORK.indexOf("id:'clients'")<0,'[2] no nav item with id:'+"'clients'"+' anywhere');
  ok(WORK.indexOf("{id:'customers',lbl:'Profiles'")>=0,'[2] Profiles nav item still present');
})();

// [3] TITLES has no 'clients' key
(function(){
  console.log('\n[3] TITLES');
  const tW=literal(WORK,'const TITLES={','};');
  ok(tW!==null && tW.indexOf("clients:'Confirmed Clients'")<0 && tW.indexOf('clients:')<0,'[3] TITLES has no clients key');
  ok(tW.indexOf("customers:'Customer Profiles'")>=0,'[3] TITLES still has customers');
})();

// [4] post-confirm redirect moved to Schedule
(function(){
  console.log('\n[4] confirm redirect');
  ok(WORK.indexOf("notif(l.name+' confirmed!');sv('schedule')")>=0,'[4] confirm handler -> sv(schedule), notif kept');
  ok(WORK.indexOf("sv('clients')")<0,'[4] no sv(clients) anywhere');
  ok(WORK.indexOf("CM('detail-modal');notif(l.name+' confirmed!')")>=0,'[4] CM(detail-modal) + notif kept exactly');
})();

// [5] Profiles (rCustomers) intact — the live 'clients' filter is a different meaning
(function(){
  console.log('\n[5] Profiles untouched');
  const rc=extractFn(WORK,'rCustomers');
  ok(rc.indexOf("['clients','Clients']")>=0,'[5] rCustomers still has the [clients,Clients] pill');
  ok(rc.indexOf("f==='clients'")>=0,'[5] rCustomers still has the f===clients filter logic');
  ok(extractFn(HEAD,'rCustomers')===rc,'[5] rCustomers byte-identical to HEAD');
})();

// [6] rClients orphaned: body byte-identical, comment added above
(function(){
  console.log('\n[6] rClients orphaned but intact');
  ok(extractFn(HEAD,'rClients')===extractFn(WORK,'rClients'),'[6] rClients body byte-identical (comment is above the fn)');
  ok(WORK.indexOf('// RETIRED screen (Confirmed Clients) — unreferenced; delete in the Phase-9 dead-code sweep.')>=0,'[6] RETIRED comment present');
})();

// [7] regression — every other r* render + helpers byte-identical
(function(){
  console.log('\n[7] regression vs HEAD');
  ['rDailyBrief','renderTodaysActions','rPipeline','rSchedule','rQuotations','rCustomers','rInvoices','rFinance','rAnalytics',
   'rClients','rSettings','rMessages','lCard','cardCTA','aLeadSourcePerf','aConversionFunnel',
   'buildOverviewTab','buildPaymentTab','buildStageCta','openDetail','computeTodaysActions',
   '_briefSection','_briefList','_briefRow','_briefRowLead','_briefMain','_briefDot','_briefEmpty',
   'qTot','fR','fmt','dU','escHtml','brideTotal','brideCollected','brideOutstanding','setCustFilter'
  ].forEach(n=>ok(extractFn(HEAD,n)===extractFn(WORK,n),'[7] unchanged: '+n));
})();

console.log('\n=== '+(fails===0?'ALL PASS':fails+' FAILURE(S)')+' ===\n');
process.exit(fails===0?0:1);
