#!/usr/bin/env node
/*
 * Finance (rFinance) restyle sim — Phase 7 (presentation only; dashboard, no top pills).
 * Mounts rFinance on a mocked DOM + brides and proves the warm-flat rebuild:
 *
 *  - no Cinzel / linear-gradient / 10-dot strip / checkmark box / LKR / .00 / red / gold bars;
 *  - Overview stat grid: four .stat tiles with fR() amounts, Outstanding .amber only when owed;
 *  - Monthly revenue: .bars with .bar.cur on the current month (slate otherwise), .fpill 3/6/12
 *    toggle (exactly one .on) wired to setFinMonthWin, trend DOWN renders var(--muted) not red;
 *  - Outstanding: flat _briefRow rows (escaped name, amber balance, openDetail); calm empty state;
 *  - Recent payments: flattened from payments, refunds (negative) excluded, date-desc, capped at 8;
 *  - math parity: rendered totals equal an independent recompute via the real helpers;
 *  - regression: the helpers + every other r* render fn byte-identical vs HEAD; fRshort still exists.
 *
 * Run: node sim/finance.sim.js   (exit 0 = pass)
 */
const fs=require('fs');const vm=require('vm');const cp=require('child_process');const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const WORK=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const HEAD=cp.execSync('git show HEAD:index.html',{cwd:ROOT,maxBuffer:64*1024*1024}).toString();
let fails=0; function ok(c,m){if(c){console.log('  ✓ '+m);}else{console.log('  ✗ '+m);fails++;}}
function extractFn(src,name){const sig='function '+name+'(';const i=src.indexOf(sig);if(i<0)throw new Error('fn '+name);let k=src.indexOf('{',i),d=0,inS=null,esc=false,lc=false,bc=false,prev='';for(;k<src.length;k++){const c=src[k],n=src[k+1];if(lc){if(c==='\n')lc=false;continue;}if(bc){if(c==='*'&&n==='/'){bc=false;k++;}continue;}if(inS){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===inS){inS=null;prev=c;}continue;}if(c==='/'&&n==='/'){lc=true;k++;continue;}if(c==='/'&&n==='*'){bc=true;k++;continue;}if(c==='/'){if(!/[A-Za-z0-9_$)\]}'"`]/.test(prev)){k++;let cl=false;for(;k<src.length;k++){const r=src[k];if(r==='\\'){k++;continue;}if(r==='[')cl=true;else if(r===']')cl=false;else if(r==='/'&&!cl)break;}prev='/';continue;}prev=c;continue;}if(c==='\''||c==='"'||c==='`'){inS=c;prev=c;continue;}if(c==='{')d++;else if(c==='}'){d--;if(d===0)return src.slice(i,k+1);}if(!/\s/.test(c))prev=c;}throw new Error('unbalanced '+name);}

// Month keys built EXACTLY like rFinance does, so parity holds in any timezone.
function monthKey(offset){const n=new Date();return new Date(n.getFullYear(),n.getMonth()-offset,1).toISOString().slice(0,7);}
const THIS=monthKey(0), LAST=monthKey(1);
const fRs=n=>'Rs '+Number(n||0).toLocaleString();

// Rich scenario: live invoice w/ payments + a negative refund; a cancelled booking;
// an all-clear bride; a many-payments bride (feed cap); a big last-month invoice (trend DOWN).
function richBrides(){
  const doraPays={};for(let i=1;i<=8;i++)doraPays['p'+i]={amount:1000+i,date:LAST+'-0'+i,method:'Cash',createdAt:LAST+'-0'+i+'T10:00:00Z'};
  return {
    alice:{id:'alice',name:'Alice <Co>',invoices:{i1:{id:'BI-1001',date:THIS+'-05',items:{a:{qty:1,unit:100000,disc:0}},advance:30000,
      payments:{p1:{amount:20000,date:THIS+'-06',method:'Bank',createdAt:THIS+'-06T10:00:00Z'},
                p2:{amount:-10000,date:THIS+'-07',method:'Refund',createdAt:THIS+'-07T10:00:00Z'}}}}},
    bob:{id:'bob',name:'Bob Cancelled',cancelled:true,invoices:{i1:{id:'BI-1002',date:THIS+'-01',items:{a:{qty:1,unit:50000,disc:0}},advance:20000,payments:{}}}},
    clara:{id:'clara',name:'Clara Clear',invoices:{i1:{id:'BI-1003',date:THIS+'-02',items:{a:{qty:1,unit:80000,disc:0}},advance:0,
      payments:{p1:{amount:40000,date:THIS+'-03',method:'Bank',createdAt:THIS+'-03T10:00:00Z'},
                p2:{amount:40000,date:THIS+'-04',method:'Cash',createdAt:THIS+'-04T10:00:00Z'}}}}},
    dora:{id:'dora',name:'Dora Many',invoices:{i1:{id:'BI-1004',date:THIS+'-02',items:{a:{qty:1,unit:8036,disc:0}},advance:0,payments:doraPays}}},
    eve:{id:'eve',name:'Eve Last',invoices:{i1:{id:'BI-1005',date:LAST+'-15',items:{a:{qty:1,unit:300000,disc:0}},advance:300000,payments:{}}}}
  };
}

function render(brides,winOverride){
  const store={};
  const sandbox={console,Date,Math,Number,String,Object,Array,JSON,parseFloat,parseInt,isNaN,
    brides:brides, window:winOverride?{_finMonthWin:winOverride}:{},
    escHtml(s){if(s==null)return '';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');},
    fmt(s){return s?('['+String(s)+']'):'—';},
    document:{getElementById:function(id){return store[id]||(store[id]={innerHTML:''});}}
  };
  const ctx=vm.createContext(sandbox);
  ['cLine','qTot','invPaid','invInvoiced','invCollected','invOutstanding','fR',
   '_briefDot','_briefMain','_briefRow','_briefList','_briefEmpty','_briefSection','rFinance']
    .forEach(f=>vm.runInContext(extractFn(WORK,f),ctx));
  vm.runInContext('rFinance();',ctx);
  return store['MC'].innerHTML;
}

console.log('\n=== Finance restyle sim ===');
const H=render(richBrides());

// [1] legacy chrome gone
(function(){
  console.log('\n[1] legacy chrome gone');
  ['Cinzel','linear-gradient','width:6px;height:6px;border-radius:50%','✓','LKR','.00','var(--danger)','#DC2626','#E53E3E','var(--gold'].forEach(bad=>
    ok(H.indexOf(bad)<0,'[1] no "'+bad+'"'));
})();

// [2] Overview stat grid + math parity
(function(){
  console.log('\n[2] stat grid + math parity');
  ok((H.split('<div class="stat">').length-1)===4,'[2] four .stat tiles');
  // independent recompute: Alice tot100000 paid40000 bal60000; Bob cancelled retained20000;
  // Clara 80000 paid; Dora 8036 paid; Eve 300000 paid.
  const tInvoiced=100000+20000+80000+8036+300000;
  const tCollected=40000+20000+80000+8036+300000;
  const tBalance=60000;
  const rate=Math.round(tCollected/tInvoiced*100);
  ok(H.indexOf('<div class="val">'+fRs(tCollected)+'</div>')>=0,'[2] Collected = '+fRs(tCollected)+' (parity)');
  ok(H.indexOf('<div class="val amber">'+fRs(tBalance)+'</div>')>=0,'[2] Outstanding amber = '+fRs(tBalance)+' (parity)');
  ok(H.indexOf('<div class="val">'+fRs(tInvoiced)+'</div>')>=0,'[2] Invoiced = '+fRs(tInvoiced)+' (parity)');
  ok(H.indexOf(rate+'% of invoiced')>=0,'[2] collection-rate sub (parity)');
  const thisMonthRev=100000+80000+8036; // this-month invoiced bucket (Alice+Clara+Dora; Bob retained excluded? no — Bob cancelled retains 20000, date THIS)
  // NOTE: Bob's cancelled invoice is dated THIS month and invInvoiced(cancelled)=retained 20000 — include it.
  const thisRev=thisMonthRev+20000;
  ok(H.indexOf(fRs(thisRev))>=0,'[2] This month = '+fRs(thisRev)+' (month-bucket parity)');
})();

// [3] monthly bars + toggle + trend de-red
(function(){
  console.log('\n[3] bars + toggle + trend');
  ok(H.indexOf('class="bars"')>=0,'[3] .bars container renders');
  ok(H.indexOf('class="bar cur"')>=0,'[3] current month uses .bar.cur (navy)');
  ok(H.indexOf('class="bar"')>=0,'[3] other months use slate .bar');
  ok(H.indexOf('class="blab cur"')>=0,'[3] current month label highlighted');
  ok(H.indexOf('class="fpill on" onclick="setFinMonthWin(3)"')>=0,'[3] default 3M toggle active (.fpill.on)');
  ok(H.indexOf('class="fpill" onclick="setFinMonthWin(6)"')>=0 && H.indexOf('class="fpill" onclick="setFinMonthWin(12)"')>=0,'[3] 6M/12M inactive .fpill');
  ok((H.split('fpill on').length-1)===1,'[3] exactly one toggle is .on');
  const H6=render(richBrides(),6);
  ok(H6.indexOf('class="fpill on" onclick="setFinMonthWin(6)"')>=0,'[3] window override -> 6M active');
  // trend DOWN: this month (208,036) < last month (300,000) -> muted, not red
  ok(/color:var\(--muted\)">↘/.test(H),'[3] DOWN trend rendered var(--muted), not red');
})();

// [4] Outstanding rows
(function(){
  console.log('\n[4] outstanding');
  ok(H.indexOf('>Outstanding<')>=0 && H.indexOf(fRs(60000)+' owed')>=0,'[4] section meta "'+fRs(60000)+' owed"');
  ok(H.indexOf('Alice &lt;Co&gt;')>=0 && H.indexOf('<Co>')<0,'[4] name escaped via escHtml');
  ok(H.indexOf('BI-1001 · 40% paid')>=0,'[4] sub "id · pct% paid"');
  ok(H.indexOf('color:var(--warn);font-weight:600;font-variant-numeric:tabular-nums">'+fRs(60000))>=0,'[4] amber balance amount');
  ok(H.indexOf("openDetail('alice')")>=0,'[4] row opens the bride detail');
})();

// [5] Recent payments feed
(function(){
  console.log('\n[5] recent payments');
  const tail=H.slice(H.indexOf('Recent payments'));
  ok((tail.split('padding:12px 2px').length-1)===8,'[5] capped at 8 rows');
  ok(tail.indexOf('Refund')<0 && tail.indexOf('-10,000')<0 && tail.indexOf('10,000')<0,'[5] negative refund excluded');
  ok(tail.indexOf(fRs(1004))>=0 && tail.indexOf(fRs(1003))<0,'[5] oldest overflow rows dropped (1,004 in, 1,003 out)');
  const iAlice=tail.indexOf(fRs(20000)), iClara=tail.indexOf(fRs(40000)), iDora=tail.indexOf(fRs(1008));
  ok(iAlice>=0 && iClara>iAlice && iDora>iClara,'[5] sorted date-desc (Alice newest, then Clara, then Dora)');
  ok(tail.indexOf('Bank · ['+THIS+'-06]')>=0,'[5] sub = "method · date"');
  ok(tail.indexOf("openDetail('dora')")>=0,'[5] payment rows open the bride detail');
  ok(tail.indexOf('color:var(--navy)">'+fRs(20000))>=0,'[5] amounts navy (calm)');
})();

// [6] empty + all-clear states
(function(){
  console.log('\n[6] empty + all-clear');
  const E=render({});
  ok(E.indexOf('No invoices yet')>=0 && E.indexOf('No data yet')>=0 && E.indexOf('No outstanding balances')>=0 && E.indexOf('No payments recorded yet')>=0,'[6] all four empty states');
  ok(E.indexOf('class="stat"')<0,'[6] no stat grid when empty');
  const clear=render({c:{id:'c',name:'Clara Clear',invoices:{i:{id:'X',date:THIS+'-02',items:{a:{qty:1,unit:80000,disc:0}},advance:80000,payments:{}}}}});
  ok(clear.indexOf('val amber')<0,'[6] Outstanding tile NOT amber when nothing owed');
  ok(clear.indexOf('No outstanding balances')>=0 && clear.indexOf('✓')<0,'[6] all-clear is a calm empty line (no checkmark box)');
})();

// [7] regression — helpers + every other r* byte-identical; fRshort still exists
(function(){
  console.log('\n[7] regression vs HEAD');
  ['fR','fRshort','invPaid','invInvoiced','invCollected','invOutstanding','qTot','cLine','fmt','escHtml','openDetail','setFinMonthWin',
   '_briefSection','_briefList','_briefRow','_briefRowLead','_briefMain','_briefDot','_briefEmpty','computeTodaysActions',
   'rDailyBrief','renderTodaysActions','rPipeline','rSchedule','rQuotations','rCustomers','rInvoices',
   'rClients','rMessages','lCard','cardCTA'
  ].forEach(n=>ok(extractFn(HEAD,n)===extractFn(WORK,n),'[7] unchanged: '+n));
})();

console.log('\n=== '+(fails===0?'ALL PASS':fails+' FAILURE(S)')+' ===\n');
process.exit(fails===0?0:1);
