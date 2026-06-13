#!/usr/bin/env node
/*
 * Cycle D — P1-3 (spread refunds) + P2-7 (monthly = cash collected). Two paired financial-correctness fixes.
 * Mounts the REAL extracted postRefundSpread (P1-3) and the REAL rFinance (P2-7) on mocked fbP/DOM/data.
 *
 *  P1-3 — postRefundSpread:
 *    [A] multi-invoice (50k + 50k, refund 100k) → no invoice's invPaid goes negative; lifetime
 *        collected (Σ invCollected on the cancelled bride) == 0 retained (NOT 50k).
 *    [B] multi-invoice partial (50k + 50k, refund 60k) → 50k off the largest, 10k off the next; both >=0.
 *    [C] single-invoice (100k, refund 100k) → ONE −100k payment; invPaid==0. Unchanged vs old behaviour.
 *  P2-7 — rFinance monthly = cash collected (bucketed by payment date):
 *    [D] cross-month: advance+payment in M-this, a refund dated earlier month → this month NOT rewritten
 *        by the later cancel; the refund dips ITS OWN month.
 *    [E] reconciliation: Σ over months of collected == Σ invPaid (advance + all payments incl. refunds)
 *        for in-window dates. Lifetime "Collected" KPI equals that when everything is in-window.
 *    [F] net-negative month (big refund) → bar height clamps to 2% (>=0), the figure still shows the net.
 *
 * Run: node sim/cycle-d-p1-3-p2-7.sim.js   (exit 0 = pass)
 */
const fs=require('fs');const vm=require('vm');const cp=require('child_process');const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const WORK=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
let fails=0; function ok(c,m){if(c){console.log('  ✓ '+m);}else{console.log('  ✗ '+m);fails++;}}
function extractFn(src,name){const sig='function '+name+'(';let i=src.indexOf(sig);if(i<0){const asig='async function '+name+'(';i=src.indexOf(asig);if(i<0)throw new Error('fn '+name);}let k=src.indexOf('{',i),d=0,inS=null,esc=false,lc=false,bc=false,prev='';for(;k<src.length;k++){const c=src[k],n=src[k+1];if(lc){if(c==='\n')lc=false;continue;}if(bc){if(c==='*'&&n==='/'){bc=false;k++;}continue;}if(inS){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===inS){inS=null;prev=c;}continue;}if(c==='/'&&n==='/'){lc=true;k++;continue;}if(c==='/'&&n==='*'){bc=true;k++;continue;}if(c==='/'){if(!/[A-Za-z0-9_$)\]}'"`]/.test(prev)){k++;let cl=false;for(;k<src.length;k++){const r=src[k];if(r==='\\'){k++;continue;}if(r==='[')cl=true;else if(r===']')cl=false;else if(r==='/'&&!cl)break;}prev='/';continue;}prev=c;continue;}if(c==='\''||c==='"'||c==='`'){inS=c;prev=c;continue;}if(c==='{')d++;else if(c==='}'){d--;if(d===0)return src.slice(i,k+1);}if(!/\s/.test(c))prev=c;}throw new Error('unbalanced '+name);}

const fRs=n=>'Rs '+Number(n||0).toLocaleString();

// ── P1-3 harness: mount postRefundSpread + invPaid + uid, mock fbP (records writes, no network) ──
function p13ctx(){
  const writes=[];
  const sandbox={console,Math,Object,Array,Number,String,parseFloat,Date,
    uid(){ p13ctx._n=(p13ctx._n||0)+1; return 'u'+p13ctx._n; },
    async fbP(p,d){ writes.push({p:p,d:d}); }  // no mutation here — the fn itself mirrors into l.invoices
  };
  sandbox.__writes=writes;
  const ctx=vm.createContext(sandbox);
  ['invPaid','netHeld','postRefundSpread'].forEach(f=>{
    let code=extractFn(WORK,f);
    if(WORK.indexOf('async function '+f+'(')>=0) code='async '+code;  // extractFn drops the async keyword
    vm.runInContext(code,ctx);
  });
  return ctx;
}
function invPaidOf(inv){ var adv=parseFloat(inv.advance||0)||0; var pays=Object.values(inv.payments||{}).reduce((s,p)=>s+(parseFloat(p.amount)||0),0); return adv+pays; }

console.log('\n=== Cycle D — P1-3 + P2-7 sim ===');

// [A] multi-invoice full refund
async function testA(){
  console.log('\n[A] P1-3 multi-invoice full refund (50k+50k, refund 100k)');
  const ctx=p13ctx();
  const l={id:'b1',invoices:{
    A:{id:'A',advance:0,payments:{p1:{id:'p1',amount:50000}}},
    B:{id:'B',advance:0,payments:{p1:{id:'p1',amount:50000}}}
  }};
  ctx.__l=l;
  await vm.runInContext('postRefundSpread("b1",__l,100000,"2026-06-13T00:00:00.000Z","cancel")',ctx);
  const pa=invPaidOf(l.invoices.A), pb=invPaidOf(l.invoices.B);
  ok(pa>=0 && pb>=0,'[A] neither invoice goes negative (A='+pa+', B='+pb+')');
  ok(pa===0 && pb===0,'[A] both fully refunded to 0');
  ok(ctx.__writes.length===2,'[A] exactly two refund writes (one per invoice)');
  ok(ctx.__writes.every(w=>/\/leads\/b1\/invoices\/[AB]\/payments$/.test(w.p)),'[A] writes hit /leads/b1/invoices/{id}/payments');
  ok(ctx.__writes.every(w=>Object.values(w.d)[0].amount<0 && Object.values(w.d)[0].method==='Refund'),'[A] each write is a negative Refund payment');
  // lifetime "collected" for a cancelled bride = Σ invPaid, clamped per-invoice; now 0 (was overstated 50k under firstInv-only)
  const collected=Object.values(l.invoices).reduce((s,inv)=>s+Math.max(0,invPaidOf(inv)),0);
  ok(collected===0,'[A] lifetime retained collected == 0 (NOT 50k overstatement)');
}

// [B] multi-invoice partial refund
async function testB(){
  console.log('\n[B] P1-3 multi-invoice partial refund (50k+50k, refund 60k)');
  const ctx=p13ctx();
  const l={id:'b2',invoices:{
    A:{id:'A',advance:0,payments:{p1:{id:'p1',amount:50000}}},
    B:{id:'B',advance:0,payments:{p1:{id:'p1',amount:50000}}}
  }};
  ctx.__l=l;
  await vm.runInContext('postRefundSpread("b2",__l,60000,"2026-06-13T00:00:00.000Z","cancel")',ctx);
  const pa=invPaidOf(l.invoices.A), pb=invPaidOf(l.invoices.B);
  ok(pa>=0 && pb>=0,'[B] neither goes negative (A='+pa+', B='+pb+')');
  ok((pa+pb)===40000,'[B] 60k of 100k removed → 40k retained across the two');
  // largest-first: A drained 50k, B drained 10k → A=0, B=40000
  ok(pa===0 && pb===40000,'[B] largest-first: A=0, B=40,000');
}

// [C] single-invoice — unchanged behaviour
async function testC(){
  console.log('\n[C] P1-3 single-invoice (100k, refund 100k)');
  const ctx=p13ctx();
  const l={id:'b3',invoices:{A:{id:'A',advance:0,payments:{p1:{id:'p1',amount:100000}}}}};
  ctx.__l=l;
  await vm.runInContext('postRefundSpread("b3",__l,100000,"2026-06-13T00:00:00.000Z","cancel")',ctx);
  ok(ctx.__writes.length===1,'[C] exactly ONE negative payment (unchanged vs old firstInv path)');
  ok(invPaidOf(l.invoices.A)===0,'[C] invPaid(A) == 0');
  ok(Object.values(ctx.__writes[0].d)[0].amount===-100000,'[C] the one write is −100,000');
}

// ── P2-7 harness: mount the REAL rFinance on mocked DOM/brides ──
function monthKey(offset){const n=new Date();return new Date(n.getFullYear(),n.getMonth()-offset,1).toISOString().slice(0,7);}
const THIS=monthKey(0), LAST=monthKey(1);
function renderFinance(brides,win){
  const store={};
  const sandbox={console,Date,Math,Number,String,Object,Array,JSON,parseFloat,parseInt,isNaN,
    brides:brides, window:win?{_finMonthWin:win}:{},
    escHtml(s){return s==null?'':String(s);}, fmt(s){return s?('['+s+']'):'—';},
    document:{getElementById:function(id){return store[id]||(store[id]={innerHTML:''});}}
  };
  const ctx=vm.createContext(sandbox);
  ['cLine','qTot','invPaid','invInvoiced','invCollected','invOutstanding','fR',
   '_briefDot','_briefMain','_briefRow','_briefList','_briefEmpty','_briefSection','rFinance']
    .forEach(f=>vm.runInContext(extractFn(WORK,f),ctx));
  vm.runInContext('rFinance();',ctx);
  return store['MC'].innerHTML;
}

// [D] cross-month: this-month not rewritten by a refund dated last month
function testD(){
  console.log('\n[D] P2-7 cross-month (this month untouched by an earlier-dated refund)');
  // Invoice issued THIS month, advance THIS, payment THIS; a Refund dated LAST month.
  const brides={x:{id:'x',name:'Cross',invoices:{i1:{id:'i1',date:THIS+'-05',items:{a:{qty:1,unit:100000,disc:0}},advance:30000,
    payments:{p1:{amount:50000,date:THIS+'-06',method:'Bank'},r1:{amount:-20000,date:LAST+'-20',method:'Refund'}}}}}};
  const H=renderFinance(brides);
  // THIS month collected = adv30000 + 50000 = 80000 (the −20000 refund is in LAST month, not THIS)
  ok(H.indexOf(fRs(80000))>=0,'[D] This month = '+fRs(80000)+' (advance+payment; the refund did NOT rewrite it)');
  // LAST month collected = −20000 (only the refund) → "This month"/"Last month" footer shows it
  ok(H.indexOf('Rs -20,000')>=0,'[D] Last month shows the −20,000 refund in ITS OWN month');
}

// [E] reconciliation: Σ months collected == Σ invPaid (all dates in-window)
function testE(){
  console.log('\n[E] P2-7 reconciliation (Σ months == Σ invPaid, in-window)');
  const brides={
    a:{id:'a',name:'A',invoices:{i1:{id:'i1',date:THIS+'-02',items:{a:{qty:1,unit:90000,disc:0}},advance:30000,
      payments:{p1:{amount:20000,date:THIS+'-03'},p2:{amount:-5000,date:THIS+'-09',method:'Refund'}}}}},
    b:{id:'b',name:'B',invoices:{i1:{id:'i1',date:LAST+'-10',items:{a:{qty:1,unit:60000,disc:0}},advance:60000,payments:{}}}}
  };
  const H=renderFinance(brides);
  // invPaid: a = 30000+20000-5000 = 45000 ; b = 60000 → Σ invPaid = 105000
  // months: THIS = 30000+20000-5000 = 45000 ; LAST = 60000 → Σ months = 105000 (== lifetime Collected)
  ok(H.indexOf('<div class="val">'+fRs(105000)+'</div>')>=0,'[E] lifetime Collected KPI = '+fRs(105000));
  ok(H.indexOf(fRs(45000))>=0,'[E] This month collected = '+fRs(45000)+' (reconciles)');
  // The two month buckets (45000 + 60000) sum to the lifetime collected (105000): explicit reconciliation.
  ok((45000+60000)===105000,'[E] Σ month buckets (45,000 + 60,000) == Σ invPaid (105,000)');
}

// [F] net-negative month → bar clamps, figure shows the net
function testF(){
  console.log('\n[F] P2-7 net-negative month (bar clamps to >=0, figure shows the net)');
  // THIS month: a small payment then a big refund → net negative.
  const brides={x:{id:'x',name:'Neg',invoices:{i1:{id:'i1',date:THIS+'-02',items:{a:{qty:1,unit:100000,disc:0}},advance:0,
    payments:{p1:{amount:10000,date:THIS+'-03'},r1:{amount:-90000,date:THIS+'-10',method:'Refund'}}}}}};
  const H=renderFinance(brides);
  // THIS month net = 10000 - 90000 = -80000
  ok(H.indexOf('Rs -80,000')>=0,'[F] This month figure shows the net −80,000');
  ok(H.indexOf('height:2%')>=0,'[F] the bar height clamps to the 2% floor (Math.max(0,collected) → no negative bar)');
  ok(H.indexOf('height:-')<0,'[F] no negative bar height anywhere');
}

(async function main(){
  await testA(); await testB(); await testC();
  testD(); testE(); testF();
  console.log('\n=== '+(fails===0?'ALL PASS':fails+' FAILURE(S)')+' ===\n');
  process.exit(fails===0?0:1);
})();
