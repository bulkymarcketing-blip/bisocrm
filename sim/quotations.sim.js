#!/usr/bin/env node
/*
 * Quotations restyle sim — Phase 7 screen 1 (presentation + one session filter).
 * Mounts rQuotations on a mocked DOM + brides across filters; proves the legacy
 * card/.lr/LKR/badge markup is gone and the Phase-4 vocabulary is reused.
 *
 *  - no .card / class="lr" / "LKR" / ".00" / in-card "+ New";
 *  - uses _briefSection + _briefList + _briefRow; money is "Rs " comma-grouped, no decimals;
 *  - filter pills are .fpill / .fpill.on (default All); Draft -> tag ti, Sent -> tag twg;
 *  - setQuoteFilter('draft'|'sent'|'all') shows the right set; converted quotes never appear;
 *  - regression: qTot, openQDoc, markSent, moreQ, the _brief helpers, and the other r* render fns byte-identical.
 *
 * Run: node sim/quotations.sim.js   (exit 0 = pass)
 */
const fs=require('fs');const vm=require('vm');const cp=require('child_process');const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const WORK=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const HEAD=cp.execSync('git show HEAD:index.html',{cwd:ROOT,maxBuffer:64*1024*1024}).toString();
let fails=0; function ok(c,m){if(c){console.log('  ✓ '+m);}else{console.log('  ✗ '+m);fails++;}}
function extractFn(src,name){const sig='function '+name+'(';const i=src.indexOf(sig);if(i<0)throw new Error('fn '+name);let k=src.indexOf('{',i),d=0,inS=null,esc=false,lc=false,bc=false,prev='';for(;k<src.length;k++){const c=src[k],n=src[k+1];if(lc){if(c==='\n')lc=false;continue;}if(bc){if(c==='*'&&n==='/'){bc=false;k++;}continue;}if(inS){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===inS){inS=null;prev=c;}continue;}if(c==='/'&&n==='/'){lc=true;k++;continue;}if(c==='/'&&n==='*'){bc=true;k++;continue;}if(c==='/'){if(!/[A-Za-z0-9_$)\]}'"`]/.test(prev)){k++;let cl=false;for(;k<src.length;k++){const r=src[k];if(r==='\\'){k++;continue;}if(r==='[')cl=true;else if(r===']')cl=false;else if(r==='/'&&!cl)break;}prev='/';continue;}prev=c;continue;}if(c==='\''||c==='"'||c==='`'){inS=c;prev=c;continue;}if(c==='{')d++;else if(c==='}'){d--;if(d===0)return src.slice(i,k+1);}if(!/\s/.test(c))prev=c;}throw new Error('unbalanced '+name);}

function brideData(){return {
  b1:{id:'b1',name:'Alice Perera',quotes:{q1:{id:'BQ-2026-3062',date:'2026-06-01',items:[{amount:125000}],sent:false}}},
  b2:{id:'b2',name:'Bianca Silva',quotes:{q2:{id:'BQ-2026-3061',date:'2026-06-05',items:[{amount:540000}],sent:true}}},
  b3:{id:'b3',name:'Carol Converted',quotes:{q3:{id:'BQ-2026-3000',date:'2026-05-01',items:[{amount:999999}],sent:true,convertedToInvoice:true}}}
};}

function render(filter,q){
  const store={};
  const sandbox={console,Date,Math,Number,String,Object,Array,JSON,
    q:q||'', brides:brideData(), window:{_quoteFilter:filter},
    qTot(items){return (items||[]).reduce(function(s,i){return s+(Number(i.amount)||0);},0);},
    escHtml(s){return s==null?'':String(s);},
    fmt(s){return s?('['+s+']'):'—';},
    document:{getElementById:function(id){return store[id]||(store[id]={innerHTML:''});}}
  };
  const ctx=vm.createContext(sandbox);
  ['_briefDot','_briefMain','_briefRow','_briefList','_briefEmpty','_briefSection','rQuotations']
    .forEach(f=>vm.runInContext(extractFn(WORK,f),ctx));
  vm.runInContext('rQuotations();',ctx);
  return store['MC'].innerHTML;
}

console.log('\n=== Quotations restyle sim ===');

// [1] structure: legacy markup gone, Phase-4 vocabulary used
(function(){
  console.log('\n[1] structure');
  const h=render('all');
  ok(typeof h==='string'&&h.length>100,'[1] renders non-empty HTML without throwing');
  ['class="card"','class="lr"','class="lrn"','class="lra"','LKR','.00','+ New','class="badge'].forEach(function(bad){
    ok(h.indexOf(bad)<0,'[1] no legacy "'+bad+'"');
  });
  ok(h.indexOf('class="fpills"')>=0 && h.indexOf('class="fpill')>=0,'[1] filter pills use .fpill');
  ok(h.indexOf('<div style="margin-bottom:20px"><div style="display:flex;align-items:baseline')>=0,'[1] section uses _briefSection header');
  ok(h.indexOf('>Quotes<')>=0,'[1] section title "Quotes"');
  ok(h.indexOf('openQDoc(')>=0,'[1] rows wired via _briefRow onclick openQDoc');
  ok(h.indexOf('Rs ')>=0,'[1] money rendered as "Rs "');
})();

// [2] pills + tags + default All
(function(){
  console.log('\n[2] pills + tags');
  const h=render('all');
  ['All','Draft','Sent'].forEach(l=>ok(h.indexOf('>'+l+'</button>')>=0,'[2] pill '+l));
  ok(h.indexOf('class="fpill on" onclick="setQuoteFilter(\'all\')"')>=0,'[2] default All pill is active (gold .on)');
  ok(h.indexOf('class="tag twg">Sent')>=0,'[2] Sent -> tag twg (amber)');
  ok(h.indexOf('class="tag ti">Draft')>=0,'[2] Draft -> tag ti (neutral)');
  ok(h.indexOf('Rs 125,000')>=0 && h.indexOf('Rs 540,000')>=0,'[2] amounts comma-grouped, no decimals');
})();

// [3] filtering + converted-excluded
(function(){
  console.log('\n[3] filtering');
  const all=render('all');
  ok(all.indexOf('Alice Perera')>=0 && all.indexOf('Bianca Silva')>=0,'[3] all shows draft + sent');
  ok(all.indexOf('Carol Converted')<0 && all.indexOf('999,999')<0,'[3] convertedToInvoice quote never appears');
  const draft=render('draft');
  ok(draft.indexOf('Alice Perera')>=0 && draft.indexOf('Bianca Silva')<0,'[3] draft shows only !sent');
  ok(draft.indexOf('class="fpill on" onclick="setQuoteFilter(\'draft\')"')>=0,'[3] Draft pill active');
  const sent=render('sent');
  ok(sent.indexOf('Bianca Silva')>=0 && sent.indexOf('Alice Perera')<0,'[3] sent shows only sent');
})();

// [4] empty states
(function(){
  console.log('\n[4] empty states');
  // sent filter but craft data with no sent quotes -> "Nothing under Sent"
  const store={};
  const sandbox={console,Date,Math,Number,String,Object,Array,JSON,q:'',
    brides:{b:{id:'b',name:'OnlyDraft',quotes:{d:{id:'Q1',date:'2026-06-01',items:[{amount:1000}],sent:false}}}},
    window:{_quoteFilter:'sent'},
    qTot(it){return (it||[]).reduce((s,i)=>s+(Number(i.amount)||0),0);},
    escHtml(s){return s==null?'':String(s);},fmt(s){return s||'—';},
    document:{getElementById:function(id){return store[id]||(store[id]={innerHTML:''});}}};
  const ctx=vm.createContext(sandbox);
  ['_briefDot','_briefMain','_briefRow','_briefList','_briefEmpty','_briefSection','rQuotations'].forEach(f=>vm.runInContext(extractFn(WORK,f),ctx));
  vm.runInContext('rQuotations();',ctx);
  ok(store['MC'].innerHTML.indexOf('Nothing under Sent')>=0,'[4] filtered-empty shows "Nothing under Sent"');
  // no quotes at all -> "No open quotations"
  const store2={};
  const sb2=Object.assign({},sandbox,{brides:{},window:{_quoteFilter:'all'},document:{getElementById:function(id){return store2[id]||(store2[id]={innerHTML:''});}}});
  const ctx2=vm.createContext(sb2);
  ['_briefDot','_briefMain','_briefRow','_briefList','_briefEmpty','_briefSection','rQuotations'].forEach(f=>vm.runInContext(extractFn(WORK,f),ctx2));
  vm.runInContext('rQuotations();',ctx2);
  ok(store2['MC'].innerHTML.indexOf('No open quotations')>=0,'[4] no quotes at all -> "No open quotations"');
})();

// [5] regression — everything else byte-identical vs HEAD
(function(){
  console.log('\n[5] regression vs HEAD');
  ['qTot','openQDoc','markSent','moreQ',
   '_briefWeddings','_briefAppointments','_briefSinceLastVisit','_briefNeedsAttention','_briefLastVisit','_humanAgo',
   '_briefSection','_briefList','_briefRow','_briefMain','_briefDot','_briefEmpty',
   'computeTodaysActions','rDailyBrief','renderTodaysActions','rPipeline','rSchedule',
   'rClients','rAnalytics','rSettings','rMessages','lCard','cardCTA'
  ].forEach(n=>ok(extractFn(HEAD,n)===extractFn(WORK,n),'[5] unchanged: '+n));
})();

console.log('\n=== '+(fails===0?'ALL PASS':fails+' FAILURE(S)')+' ===\n');
process.exit(fails===0?0:1);
