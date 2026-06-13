#!/usr/bin/env node
/*
 * P2-8 sim — Surface overpayment as a visible CREDIT (Cycle D, item 1/4). DISPLAY-ONLY, ADDITIVE.
 * Mounts the REAL invCredit/brideCredit helpers + the four touched renderers
 * (openIDoc / rInvoices / buildPaymentTab / openAddPay) on a mocked DOM + data and proves:
 *
 *  [A] invCredit/brideCredit math — overpaid>0, partial/exact=0, cancelled=0.
 *  [B] openIDoc — OVERPAID shows "Credit Balance"/green, NOT "Balance Due Rs 0";
 *      PARTIAL/EXACT show "Balance Due" (no Credit); CANCELLED shows CANCELLED + Balance Due 0.
 *  [C] rInvoices — overpaid row sub-line shows "· Rs X credit" (tag stays "Paid"); others don't.
 *  [D] buildPaymentTab — single overpaid bride => "Credit"; mixed (one overpaid + one owing) => "Balance" (owed wins).
 *  [E] openAddPay — overpaid invoice box label "Credit" green; owing => "Balance due" amber.
 *  [F] out-of-scope helpers + buildReceipt/buildPDF/rFinance byte-identical to HEAD (additive proof).
 *
 * Run: node sim/p2-8.sim.js   (exit 0 = pass)
 */
const fs=require('fs');const vm=require('vm');const cp=require('child_process');const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const WORK=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const HEAD=cp.execSync('git show HEAD:index.html',{cwd:ROOT,maxBuffer:64*1024*1024}).toString();
let fails=0; function ok(c,m){if(c){console.log('  ✓ '+m);}else{console.log('  ✗ '+m);fails++;}}
function extractFn(src,name){const sig='function '+name+'(';const i=src.indexOf(sig);if(i<0)throw new Error('fn '+name);let k=src.indexOf('{',i),d=0,inS=null,esc=false,lc=false,bc=false,prev='';for(;k<src.length;k++){const c=src[k],n=src[k+1];if(lc){if(c==='\n')lc=false;continue;}if(bc){if(c==='*'&&n==='/'){bc=false;k++;}continue;}if(inS){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===inS){inS=null;prev=c;}continue;}if(c==='/'&&n==='/'){lc=true;k++;continue;}if(c==='/'&&n==='*'){bc=true;k++;continue;}if(c==='/'){if(!/[A-Za-z0-9_$)\]}'"`]/.test(prev)){k++;let cl=false;for(;k<src.length;k++){const r=src[k];if(r==='\\'){k++;continue;}if(r==='[')cl=true;else if(r===']')cl=false;else if(r==='/'&&!cl)break;}prev='/';continue;}prev=c;continue;}if(c==='\''||c==='"'||c==='`'){inS=c;prev=c;continue;}if(c==='{')d++;else if(c==='}'){d--;if(d===0)return src.slice(i,k+1);}if(!/\s/.test(c))prev=c;}throw new Error('unbalanced '+name);}

// ---- shared sandbox factory -------------------------------------------------
const HELPERS=['fmt','fR','cLine','qTot','invPaid','invInvoiced','invCollected','invOutstanding',
  '_canon','brideTotal','brideCollected','brideOutstanding','invCredit','brideCredit',
  'dU','groupMoney','parseMoney','escHtml','escHtmlMultiline',
  '_briefRow','_briefMain','_briefList','_briefSection','_briefEmpty','_briefDot',
  'openIDoc','rInvoices','openAddPay','buildPaymentTab'];
function mkEl(){return {innerHTML:'',textContent:'',value:'',style:{},classList:{add(){},remove(){}}};}
function newCtx(globals){
  const store={};
  const sandbox=Object.assign({console,Date,Math,Number,String,Object,Array,JSON,RegExp,parseFloat,parseInt,isFinite,isNaN,
    document:{getElementById(id){return store[id]||(store[id]=mkEl());}},
    OM(){},CM(){}
  },globals);
  sandbox.__store=store;
  const ctx=vm.createContext(sandbox);
  HELPERS.forEach(f=>{ try{ vm.runInContext(extractFn(WORK,f),ctx); }catch(e){ /* OM/CM provided as stubs */ } });
  return {ctx,store};
}

// invoice builders ------------------------------------------------------------
function inv(id,unit,paid){return {id:id,date:'2026-05-01',items:{a:{desc:'Bridal',qty:1,unit:unit,disc:0}},advance:0,payments:paid!=null?{p1:{id:'p1',amount:paid,date:'2026-05-02',method:'Cash'}}:{}};}

console.log('\n=== P2-8 overpayment-as-credit sim ===');

// [A] helper math
(function(){
  console.log('\n[A] invCredit / brideCredit math');
  const over={id:'b1',invoices:{i1:inv('i1',100000,140000)}};                 // paid 140k > tot 100k => credit 40k
  const part={id:'b2',invoices:{i1:inv('i1',100000,60000)}};                  // partial
  const exact={id:'b3',invoices:{i1:inv('i1',100000,100000)}};                // exact
  const canc={id:'b4',cancelled:true,invoices:{i1:inv('i1',100000,140000)}};  // cancelled overpaid => 0
  const {ctx}=newCtx({brides:{b1:over,b2:part,b3:exact,b4:canc}});
  const run=js=>vm.runInContext(js,ctx);
  ok(run('invCredit(brides.b1,brides.b1.invoices.i1)')===40000,'[A] invCredit overpaid = 40000');
  ok(run('invCredit(brides.b2,brides.b2.invoices.i1)')===0,'[A] invCredit partial = 0');
  ok(run('invCredit(brides.b3,brides.b3.invoices.i1)')===0,'[A] invCredit exact = 0');
  ok(run('invCredit(brides.b4,brides.b4.invoices.i1)')===0,'[A] invCredit cancelled = 0');
  ok(run('brideCredit(brides.b1)')===40000,'[A] brideCredit overpaid = 40000');
  ok(run('brideCredit(brides.b3)')===0,'[A] brideCredit exact = 0');
  // out-of-scope helpers unaffected by an overpayment (no negative outstanding)
  ok(run('brideOutstanding(brides.b1)')===0,'[A] brideOutstanding overpaid still 0 (unchanged)');
  ok(run('brideCollected(brides.b1)')===140000,'[A] brideCollected unchanged (=invPaid)');
})();

// [B] openIDoc — the document footer balance row
(function(){
  console.log('\n[B] openIDoc balance/credit row');
  function doc(obj){
    const {ctx,store}=newCtx({leads:{x:obj},custs:{},brides:{},viewPDF(){},openEInv(){},openAddPay(){},viewReceipt(){},delPay(){}});
    vm.runInContext("openIDoc('lead','x','"+Object.keys(obj.invoices)[0]+"')",ctx);
    return store['doc-b'].innerHTML;
  }
  const over=doc({id:'x',name:'Over',invoices:{i1:inv('i1',100000,140000)}});
  ok(over.indexOf('Credit Balance')>=0,'[B] overpaid shows "Credit Balance"');
  ok(over.indexOf('var(--success)')>=0,'[B] overpaid credit row is green');
  ok(over.indexOf('LKR 40,000.00')>=0,'[B] overpaid credit amount = 40,000');
  ok(over.indexOf('Balance Due')<0,'[B] overpaid does NOT show "Balance Due"');

  const part=doc({id:'x',name:'Part',invoices:{i1:inv('i1',100000,60000)}});
  ok(part.indexOf('Balance Due')>=0 && part.indexOf('Credit Balance')<0,'[B] partial shows "Balance Due", no Credit');
  ok(part.indexOf('LKR 40,000.00')>=0,'[B] partial balance = 40,000 (tot-paid)');

  const exact=doc({id:'x',name:'Exact',invoices:{i1:inv('i1',100000,100000)}});
  ok(exact.indexOf('Balance Due')>=0 && exact.indexOf('Credit Balance')<0,'[B] exact shows "Balance Due 0", no Credit');

  const canc=doc({id:'x',name:'Canc',cancelled:true,invoices:{i1:inv('i1',100000,140000)}});
  ok(canc.indexOf('CANCELLED')>=0,'[B] cancelled shows CANCELLED status');
  ok(canc.indexOf('Balance Due')>=0 && canc.indexOf('Credit Balance')<0,'[B] cancelled => Balance Due (no Credit even when overpaid)');
})();

// [C] rInvoices — list row sub-line
(function(){
  console.log('\n[C] rInvoices list rows');
  const brides={
    bo:{id:'bo',name:'Over',invoices:{i1:inv('i1',100000,140000)}},
    bp:{id:'bp',name:'Part',invoices:{i1:inv('i1',100000,60000)}},
    be:{id:'be',name:'Exact',invoices:{i1:inv('i1',100000,100000)}}
  };
  const {ctx,store}=newCtx({brides,q:'',window:{_invFilter:'all'},setInvFilter(){}});
  vm.runInContext('rInvoices();',ctx);
  const h=store['MC'].innerHTML;
  ok(h.indexOf('· Rs 40,000 credit')>=0,'[C] overpaid row shows "· Rs 40,000 credit"');
  ok(h.indexOf('· Rs 40,000 due')>=0,'[C] partial row still shows "· Rs 40,000 due"');
  ok((h.match(/credit/g)||[]).length===1,'[C] exactly one "credit" sub-line (only the overpaid row)');
  ok(h.indexOf('class="tag ts">Paid')>=0,'[C] overpaid tag stays "Paid" (pill/status unchanged)');
})();

// [D] buildPaymentTab — single overpaid vs mixed multi-invoice
(function(){
  console.log('\n[D] buildPaymentTab summary');
  function tab(bride){
    const {ctx}=newCtx({brides:{},openQDoc(){},openIDoc(){},openAddPay(){}});
    const invs=Object.values(bride.invoices||{});
    return vm.runInContext('buildPaymentTab("'+bride.id+'",__l,false,[],__invs)',Object.assign(ctx,(function(){
      ctx.__l=bride;ctx.__invs=invs;return {};})()));
  }
  // single overpaid bride => Credit
  const single={id:'b1',name:'Over',appointments:{},invoices:{i1:inv('i1',100000,140000)}};
  const hs=tab(single);
  ok(hs.indexOf('>Credit</div>')>=0,'[D] single overpaid bride => summary label "Credit"');
  ok(hs.indexOf('Rs 40,000')>=0,'[D] single overpaid credit value = Rs 40,000');
  // mixed: one overpaid (+40k) + one owing (-60k) => net owed => "Balance"
  const mixed={id:'b2',name:'Mixed',appointments:{},invoices:{i1:inv('i1',100000,140000),i2:inv('i2',100000,40000)}};
  const hm=tab(mixed);
  ok(hm.indexOf('>Balance</div>')>=0,'[D] mixed (owed wins) => summary label "Balance"');
  ok(hm.indexOf('>Credit</div>')<0,'[D] mixed does NOT show "Credit" (a real balance is outstanding)');
})();

// [E] openAddPay — balance box
(function(){
  console.log('\n[E] openAddPay balance box');
  function box(obj,iId){
    const {ctx,store}=newCtx({leads:{x:obj},custs:{},addPay(){},onMoneyBlur(){}});
    vm.runInContext("openAddPay('lead','x','"+iId+"')",ctx);
    return store['pay-b'].innerHTML;
  }
  const over=box({id:'x',name:'Over',invoices:{i1:inv('i1',100000,140000)}},'i1');
  ok(over.indexOf('>Credit</div>')>=0,'[E] overpaid box label "Credit"');
  ok(over.indexOf('var(--success)')>=0,'[E] overpaid box value green');
  ok(over.indexOf('Rs 40,000')>=0,'[E] overpaid box value Rs 40,000');
  const owe=box({id:'x',name:'Owe',invoices:{i1:inv('i1',100000,60000)}},'i1');
  ok(owe.indexOf('>Balance due</div>')>=0,'[E] owing box label "Balance due"');
  ok(owe.indexOf('var(--warn)')>=0,'[E] owing box value amber');
})();

// [F] additive proof — out-of-scope helpers + documents byte-identical to HEAD
(function(){
  console.log('\n[F] out-of-scope byte-identical vs HEAD');
  // invCredit/brideCredit are now ON HEAD (P2-8 shipped) and untouched by later work — pin them byte-identical.
  ['invInvoiced','invCollected','invOutstanding','invPaid','qTot','cLine','netHeld',
   'brideTotal','brideCollected','brideOutstanding','_canon','invCredit','brideCredit',
   /* rFinance NOT pinned — P2-7 (Cycle D, monthly cash-collected) edits it; finance.sim + cycle-d-p1-3-p2-7.sim are the authority. */
   'buildReceipt','buildPDF','rQuotations','rAnalytics'
  ].forEach(n=>ok(extractFn(HEAD,n)===extractFn(WORK,n),'[F] unchanged: '+n));
  ok(WORK.indexOf('function invCredit(')>=0 && WORK.indexOf('function brideCredit(')>=0,'[F] invCredit + brideCredit present');
})();

console.log('\n=== '+(fails===0?'ALL PASS':fails+' FAILURE(S)')+' ===\n');
process.exit(fails===0?0:1);
