#!/usr/bin/env node
/*
 * Invoices (rInvoices) restyle sim — Phase 7 screen 3 (presentation + 1 session filter).
 * Mounts rInvoices on a mocked DOM + brides/invoices across statuses; proves the legacy
 * card/.lr/LKR/badge markup is gone, the warm-flat status-dot rows render, and no red is used.
 *
 *  - no .card / .lr / "LKR" / ".00" / inline CANCELLED badge;
 *  - _briefSection('Invoices') + _briefList + _briefRow with a leading status dot; money "Rs " no decimals;
 *  - Paid -> tag ts, Partial -> tag twg, Unpaid/Cancelled -> tag ti; NO var(--danger)/red anywhere;
 *  - pills .fpill/.fpill.on; setInvFilter unpaid/partial/paid show the right set; cancelled only under all;
 *  - regression: qTot, invPaid, inv*, openIDoc, the _brief helpers, and the other r* fns byte-identical.
 *
 * Run: node sim/invoices.sim.js   (exit 0 = pass)
 */
const fs=require('fs');const vm=require('vm');const cp=require('child_process');const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const WORK=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const HEAD=cp.execSync('git show HEAD:index.html',{cwd:ROOT,maxBuffer:64*1024*1024}).toString();
let fails=0; function ok(c,m){if(c){console.log('  ✓ '+m);}else{console.log('  ✗ '+m);fails++;}}
function extractFn(src,name){const sig='function '+name+'(';const i=src.indexOf(sig);if(i<0)throw new Error('fn '+name);let k=src.indexOf('{',i),d=0,inS=null,esc=false,lc=false,bc=false,prev='';for(;k<src.length;k++){const c=src[k],n=src[k+1];if(lc){if(c==='\n')lc=false;continue;}if(bc){if(c==='*'&&n==='/'){bc=false;k++;}continue;}if(inS){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===inS){inS=null;prev=c;}continue;}if(c==='/'&&n==='/'){lc=true;k++;continue;}if(c==='/'&&n==='*'){bc=true;k++;continue;}if(c==='/'){if(!/[A-Za-z0-9_$)\]}'"`]/.test(prev)){k++;let cl=false;for(;k<src.length;k++){const r=src[k];if(r==='\\'){k++;continue;}if(r==='[')cl=true;else if(r===']')cl=false;else if(r==='/'&&!cl)break;}prev='/';continue;}prev=c;continue;}if(c==='\''||c==='"'||c==='`'){inS=c;prev=c;continue;}if(c==='{')d++;else if(c==='}'){d--;if(d===0)return src.slice(i,k+1);}if(!/\s/.test(c))prev=c;}throw new Error('unbalanced '+name);}

function brideData(){return {
  bp:{id:'bp',name:'Paid Bride',invoices:{i:{id:'BI-2026-1001',date:'2026-06-05',items:[{amount:100000}],advance:100000,payments:{}}}},
  bpart:{id:'bpart',name:'Partial Bride',invoices:{i:{id:'BI-2026-1002',date:'2026-06-04',items:[{amount:100000}],advance:40000,payments:{}}}},
  bu:{id:'bu',name:'Unpaid Bride',invoices:{i:{id:'BI-2026-1003',date:'2026-06-03',items:[{amount:100000}],advance:0,payments:{}}}},
  bc:{id:'bc',name:'Cancelled Bride',cancelled:true,invoices:{i:{id:'BI-2026-1004',date:'2026-06-02',items:[{amount:100000}],advance:50000,payments:{}}}}
};}

function render(filter,q,brides){
  const store={};
  const sandbox={console,Date,Math,Number,String,Object,Array,JSON,parseFloat,
    q:q||'', brides:brides||brideData(), window:{_invFilter:filter},
    qTot(items){return (items||[]).reduce(function(s,i){return s+(Number(i.amount)||0);},0);},
    invPaid(inv){return (parseFloat(inv.advance||0)||0)+Object.values(inv.payments||{}).reduce(function(s,p){return s+(Number(p.amount)||0);},0);},
    escHtml(s){return s==null?'':String(s);},
    fmt(s){return s?('['+s+']'):'—';},
    document:{getElementById:function(id){return store[id]||(store[id]={innerHTML:''});}}
  };
  const ctx=vm.createContext(sandbox);
  ['_briefDot','_briefMain','_briefRow','_briefList','_briefEmpty','_briefSection','rInvoices']
    .forEach(f=>vm.runInContext(extractFn(WORK,f),ctx));
  vm.runInContext('rInvoices();',ctx);
  return store['MC'].innerHTML;
}

console.log('\n=== Invoices restyle sim ===');

// [1] structure
(function(){
  console.log('\n[1] structure');
  const h=render('all');
  ok(typeof h==='string'&&h.length>100,'[1] renders non-empty HTML without throwing');
  ['class="card"','class="lr"','class="lrn"','class="lra"','LKR','.00','>CANCELLED<','class="badge'].forEach(bad=>ok(h.indexOf(bad)<0,'[1] no legacy "'+bad+'"'));
  ok(h.indexOf('>Invoices<')>=0,'[1] _briefSection title "Invoices"');
  ok(h.indexOf('border-radius:50%')>=0,'[1] rows have a leading status dot (_briefDot)');
  ok(h.indexOf('openIDoc(')>=0,'[1] row onclick openIDoc');
  ok(h.indexOf('Rs ')>=0,'[1] money rendered as "Rs "');
})();

// [2] status tags + dots + NO red
(function(){
  console.log('\n[2] tags + dots, no red');
  const h=render('all');
  ok(h.indexOf('class="tag ts">Paid')>=0,'[2] Paid -> tag ts (green)');
  ok(h.indexOf('class="tag twg">Partial')>=0,'[2] Partial -> tag twg (amber)');
  ok(h.indexOf('class="tag ti">Unpaid')>=0,'[2] Unpaid -> tag ti (neutral)');
  ok(h.indexOf('class="tag ti">Cancelled')>=0,'[2] Cancelled -> tag ti (neutral)');
  ok(h.indexOf('var(--danger)')<0 && h.indexOf('#DC2626')<0 && h.indexOf('#E53E3E')<0,'[2] NO red anywhere (act-now red reserved; Overdue deferred)');
  ok(h.indexOf('background:var(--success)')>=0 && h.indexOf('background:var(--warn)')>=0,'[2] status dots use success/warn');
})();

// [3] money
(function(){
  console.log('\n[3] money');
  const h=render('all');
  ok(h.indexOf('Rs 100,000')>=0,'[3] total comma-grouped, no decimals');
  ok(h.indexOf('Rs 60,000 due')>=0,'[3] partial shows "Rs X due" (100k - 40k = 60k)');
  ok(h.indexOf('LKR')<0 && h.indexOf('.00')<0,'[3] no LKR / no decimals');
})();

// [4] pills + filtering + cancelled only under all
(function(){
  console.log('\n[4] pills + filtering');
  const all=render('all');
  ['All','Unpaid','Partial','Paid'].forEach(l=>ok(all.indexOf('>'+l+'</button>')>=0,'[4] pill '+l));
  ok(all.indexOf('class="fpill on" onclick="setInvFilter(\'all\')"')>=0,'[4] default All active');
  ok(all.indexOf('Paid Bride')>=0&&all.indexOf('Partial Bride')>=0&&all.indexOf('Unpaid Bride')>=0&&all.indexOf('Cancelled Bride')>=0,'[4] all shows every invoice incl. cancelled');
  const unpaid=render('unpaid');
  ok(unpaid.indexOf('Unpaid Bride')>=0&&unpaid.indexOf('Paid Bride')<0&&unpaid.indexOf('Partial Bride')<0&&unpaid.indexOf('Cancelled Bride')<0,'[4] unpaid = pct==0 only (no cancelled)');
  const partial=render('partial');
  ok(partial.indexOf('Partial Bride')>=0&&partial.indexOf('Paid Bride')<0&&partial.indexOf('Unpaid Bride')<0&&partial.indexOf('Cancelled Bride')<0,'[4] partial only');
  const paid=render('paid');
  ok(paid.indexOf('Paid Bride')>=0&&paid.indexOf('Cancelled Bride')<0&&paid.indexOf('Unpaid Bride')<0,'[4] paid only (no cancelled)');
})();

// [5] empty states
(function(){
  console.log('\n[5] empty states');
  ok(render('all','',{}).indexOf('No invoices yet')>=0,'[5] none at all -> "No invoices yet"');
  ok(render('paid','',{b:{id:'b',name:'Only Unpaid',invoices:{i:{id:'X',date:'2026-06-01',items:[{amount:1000}],advance:0,payments:{}}}}}).indexOf('Nothing under Paid')>=0,'[5] filtered-empty -> "Nothing under Paid"');
})();

// [6] regression
(function(){
  console.log('\n[6] regression vs HEAD');
  ['qTot','invPaid','invInvoiced','invCollected','invOutstanding',
   /* openIDoc NOT pinned — P2-8 (overpayment credit) edits it; sim/p2-8.sim.js is the authority. */
   '_briefAppointments','_briefSinceLastVisit','_briefNeedsAttention','_briefLastVisit','_humanAgo',
   '_briefSection','_briefList','_briefRow','_briefRowLead','_briefMain','_briefDot','_briefEmpty',
   'computeTodaysActions','renderTodaysActions','rSchedule','rQuotations',
   'rClients','rMessages','lCard','cardCTA'
  ].forEach(n=>ok(extractFn(HEAD,n)===extractFn(WORK,n),'[6] unchanged: '+n));
})();

console.log('\n=== '+(fails===0?'ALL PASS':fails+' FAILURE(S)')+' ===\n');
process.exit(fails===0?0:1);
