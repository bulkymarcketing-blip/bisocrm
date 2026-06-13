#!/usr/bin/env node
/*
 * Profiles (rCustomers) restyle sim — Phase 7 screen 2 (presentation + 1 session filter).
 * Mounts rCustomers on a mocked DOM + custs across filters; proves the legacy
 * table/card markup is gone, the avatar people-directory renders, and _briefRow is intact.
 *
 *  - no <table> / .card / in-card "+ New"; uses _briefSection('Directory') + _briefList;
 *  - each row: .ini avatar + name + phone; Client -> tag ts, Lead -> tag ti;
 *  - pills .fpill/.fpill.on (default All); setCustFilter clients/leads/all show the right set;
 *  - .ini and .ts are the ONLY new CSS classes; _briefRow byte-identical to HEAD;
 *  - regression: cA, openCust, openNC, openDetail, the _brief helpers, and the other r* fns byte-identical vs HEAD.
 *
 * Run: node sim/profiles.sim.js   (exit 0 = pass)
 */
const fs=require('fs');const vm=require('vm');const cp=require('child_process');const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const WORK=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const HEAD=cp.execSync('git show HEAD:index.html',{cwd:ROOT,maxBuffer:64*1024*1024}).toString();
let fails=0; function ok(c,m){if(c){console.log('  ✓ '+m);}else{console.log('  ✗ '+m);fails++;}}
function extractFn(src,name){const sig='function '+name+'(';const i=src.indexOf(sig);if(i<0)throw new Error('fn '+name);let k=src.indexOf('{',i),d=0,inS=null,esc=false,lc=false,bc=false,prev='';for(;k<src.length;k++){const c=src[k],n=src[k+1];if(lc){if(c==='\n')lc=false;continue;}if(bc){if(c==='*'&&n==='/'){bc=false;k++;}continue;}if(inS){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===inS){inS=null;prev=c;}continue;}if(c==='/'&&n==='/'){lc=true;k++;continue;}if(c==='/'&&n==='*'){bc=true;k++;continue;}if(c==='/'){if(!/[A-Za-z0-9_$)\]}'"`]/.test(prev)){k++;let cl=false;for(;k<src.length;k++){const r=src[k];if(r==='\\'){k++;continue;}if(r==='[')cl=true;else if(r===']')cl=false;else if(r==='/'&&!cl)break;}prev='/';continue;}prev=c;continue;}if(c==='\''||c==='"'||c==='`'){inS=c;prev=c;continue;}if(c==='{')d++;else if(c==='}'){d--;if(d===0)return src.slice(i,k+1);}if(!/\s/.test(c))prev=c;}throw new Error('unbalanced '+name);}
function styleClasses(src){
  const a=src.indexOf('<style>'), b=src.indexOf('</style>',a);
  const css=src.slice(a,b);
  const set=new Set(); let m; const re=/\.([A-Za-z][\w-]*)/g;
  while((m=re.exec(css)))set.add(m[1]);
  return set;
}

function custData(){return {
  c1:{id:'c1',name:'Alice Perera',phone:'94771234567',invoices:{i1:{}}},      // client
  c2:{id:'c2',name:'Bianca',phone:'94772223333'},                              // lead (no invoices)
  c3:{id:'c3',name:'Carol Anne Fernando',phone:'',invoices:{}}                 // lead (empty invoices)
};}

function render(filter,q){
  const store={};
  const sandbox={console,Date,Math,Number,String,Object,Array,JSON,RegExp,
    q:q||'', custs:custData(), window:{_custFilter:filter},
    escHtml(s){return s==null?'':String(s);},
    document:{getElementById:function(id){return store[id]||(store[id]={innerHTML:''});}}
  };
  sandbox.cA=function(){return Object.values(sandbox.custs);};
  const ctx=vm.createContext(sandbox);
  ['_briefMain','_briefList','_briefEmpty','_briefSection','_initials','_briefRowLead','fmtPhone','rCustomers']
    .forEach(f=>vm.runInContext(extractFn(WORK,f),ctx));
  vm.runInContext('rCustomers();',ctx);
  return store['MC'].innerHTML;
}

console.log('\n=== Profiles (rCustomers) restyle sim ===');

// [1] structure
(function(){
  console.log('\n[1] structure');
  const h=render('all');
  ok(typeof h==='string'&&h.length>100,'[1] renders non-empty HTML without throwing');
  ['<table','<thead','class="card"','openNC(','+ New'].forEach(bad=>ok(h.indexOf(bad)<0,'[1] no legacy "'+bad+'"'));
  ok(h.indexOf('>Directory<')>=0,'[1] _briefSection title "Directory"');
  ok(h.indexOf('class="ini">')>=0,'[1] rows use the .ini avatar');
  ok(h.indexOf('Alice Perera')>=0,'[1] avatar row shows name');
  ok(h.indexOf('openCust(')>=0,'[1] row onclick openCust');
})();

// [1b] phone formatted via fmtPhone (not raw 94…); blank phone -> em-dash
(function(){
  console.log('\n[1b] phone formatting');
  const h=render('all');
  ok(h.indexOf('+94 77 123 4567')>=0,'[1b] Alice phone shown formatted (+94 77 123 4567)');
  ok(h.indexOf('94771234567')<0,'[1b] raw "94771234567" digits no longer shown');
  ok(h.indexOf('+94 77 222 3333')>=0,'[1b] Bianca phone formatted too');
  // Carol Anne Fernando has a blank phone -> em-dash sub-line
  ok(h.indexOf('>—</div>')>=0,'[1b] blank phone renders the em-dash');
})();

// [2] pills + tags + initials
(function(){
  console.log('\n[2] pills + tags + initials');
  const h=render('all');
  ['All','Leads','Clients'].forEach(l=>ok(h.indexOf('>'+l+'</button>')>=0,'[2] pill '+l));
  ok(h.indexOf('class="fpill on" onclick="setCustFilter(\'all\')"')>=0,'[2] default All pill active (gold .on)');
  ok(h.indexOf('class="tag ts">Client')>=0,'[2] Client -> tag ts');
  ok(h.indexOf('class="tag ti">Lead')>=0,'[2] Lead -> tag ti');
  ok(h.indexOf('class="ini">AP<')>=0,'[2] two-word initials (Alice Perera -> AP)');
  ok(h.indexOf('class="ini">BI<')>=0,'[2] single-word initials (Bianca -> BI)');
})();

// [3] filtering
(function(){
  console.log('\n[3] filtering');
  const all=render('all');
  ok(all.indexOf('Alice Perera')>=0 && all.indexOf('Bianca')>=0 && all.indexOf('Carol Anne Fernando')>=0,'[3] all shows everyone');
  const clients=render('clients');
  ok(clients.indexOf('Alice Perera')>=0 && clients.indexOf('Bianca')<0 && clients.indexOf('Carol Anne Fernando')<0,'[3] clients = invoice-holders only');
  const leads=render('leads');
  ok(leads.indexOf('Alice Perera')<0 && leads.indexOf('Bianca')>=0 && leads.indexOf('Carol Anne Fernando')>=0,'[3] leads = non-holders only');
  ok(leads.indexOf('class="fpill on" onclick="setCustFilter(\'leads\')"')>=0,'[3] Leads pill active when selected');
})();

// [4] empty states
(function(){
  console.log('\n[4] empty states');
  function emptyRender(custs,filter){
    const store={};
    const sb={console,Date,Math,Number,String,Object,Array,JSON,RegExp,q:'',custs:custs,window:{_custFilter:filter},
      escHtml(s){return s==null?'':String(s);},document:{getElementById:function(id){return store[id]||(store[id]={innerHTML:''});}}};
    sb.cA=function(){return Object.values(sb.custs);};
    const ctx=vm.createContext(sb);
    ['_briefMain','_briefList','_briefEmpty','_briefSection','_initials','_briefRowLead','fmtPhone','rCustomers'].forEach(f=>vm.runInContext(extractFn(WORK,f),ctx));
    vm.runInContext('rCustomers();',ctx);return store['MC'].innerHTML;
  }
  ok(emptyRender({},'all').indexOf('No profiles yet')>=0,'[4] none at all -> "No profiles yet"');
  ok(emptyRender({l:{id:'l',name:'Lead Only',invoices:{}}},'clients').indexOf('No clients')>=0,'[4] clients filter, none -> "No clients"');
  ok(emptyRender({c:{id:'c',name:'Client Only',invoices:{i:{}}}},'leads').indexOf('No leads')>=0,'[4] leads filter, none -> "No leads"');
})();

// [5] _briefRow intact + only 2 new CSS classes
(function(){
  console.log('\n[5] _briefRow intact + CSS class-set');
  ok(extractFn(HEAD,'_briefRow')===extractFn(WORK,'_briefRow'),'[5] _briefRow byte-identical to HEAD');
  const hSet=styleClasses(HEAD), wSet=styleClasses(WORK);
  const added=[...wSet].filter(x=>!hSet.has(x)).sort();
  const removed=[...hSet].filter(x=>!wSet.has(x));
  ok(wSet.has('ini') && wSet.has('ts'),'[5] .ini + .ts classes present');
  // Allow-list of classes added by later redesign screens (extend as screens ship):
  // Profiles added .ini/.ts; Finance added the .stats/.bars blocks.
  var allowed={ini:1,ts:1,stats:1,stat:1,lab:1,val:1,amber:1,sub:1,bars:1,barwrap:1,bartrack:1,bar:1,cur:1,blab:1};
  ok(added.every(function(x){return allowed[x]===1;}),'[5] no unexpected new CSS classes vs HEAD (added: '+JSON.stringify(added)+')');
  ok(removed.length===0,'[5] no CSS classes removed');
})();

// [6] regression
(function(){
  console.log('\n[6] regression vs HEAD');
  ['cA','openCust','openNC','openDetail',
   '_briefAppointments','_briefSinceLastVisit','_briefNeedsAttention','_briefLastVisit','_humanAgo',
   '_briefSection','_briefList','_briefRow','_briefMain','_briefDot','_briefEmpty',
   'computeTodaysActions','renderTodaysActions','rSchedule','rQuotations',
   'rMessages','lCard','cardCTA','qTot'  // rClients removed (Phase 9 dead-code sweep)
  ].forEach(n=>ok(extractFn(HEAD,n)===extractFn(WORK,n),'[6] unchanged: '+n));
})();

console.log('\n=== '+(fails===0?'ALL PASS':fails+' FAILURE(S)')+' ===\n');
process.exit(fails===0?0:1);
