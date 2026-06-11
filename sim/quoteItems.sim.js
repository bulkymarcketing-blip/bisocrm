#!/usr/bin/env node
/*
 * Quote line-items / packages + installment schedule sim — Feature #5.
 *
 * Verifies the ADDITIVE parent/sub-line + schedule layer without a browser/Firebase:
 *   1. Backward compatibility (the strongest proof): runs git-HEAD's docSections /
 *      docSchedule AND the working-tree's on IDENTICAL legacy (flat, package-free) data
 *      and asserts byte-identical HTML — i.e. existing quotes/invoices render unchanged.
 *   2. Packages: a parent pinned to one ceremony with priced sub-lines — ceremony
 *      subtotal = Σ sub-lines, grand-total invariant (qTot === Σ subtotals − discountAmt),
 *      header + indented children render.
 *   3. Custom installment schedule renders (quote + invoice w/ paid badges); absent ⇒ auto.
 *   4. Event↔quote binding still works with packages present (findLinked/syncQuoteItems
 *      never pick up package items), plus a byte-identical regression-diff of every
 *      untouched compute/binding function vs HEAD.
 *
 * Run: node sim/quoteItems.sim.js   (exit 0 = pass)
 */
const fs=require('fs');const vm=require('vm');const cp=require('child_process');const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const WORK=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const HEAD=cp.execSync('git show HEAD:index.html',{cwd:ROOT,maxBuffer:64*1024*1024}).toString();
let fails=0;
function ok(c,m){if(c){console.log('  ✓ '+m);}else{console.log('  ✗ '+m);fails++;}}

// regex/comment-aware brace matcher (same approach as the Phase-4 sim)
function extractFn(src,name){
  const sig='function '+name+'(';const i=src.indexOf(sig);
  if(i<0)throw new Error('fn not found: '+name);
  let k=src.indexOf('{',i),depth=0,inS=null,esc=false,lineC=false,blockC=false,prev='';
  for(;k<src.length;k++){const c=src[k],n=src[k+1];
    if(lineC){if(c==='\n')lineC=false;continue;}
    if(blockC){if(c==='*'&&n==='/'){blockC=false;k++;}continue;}
    if(inS){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===inS){inS=null;prev=c;}continue;}
    if(c==='/'&&n==='/'){lineC=true;k++;continue;}
    if(c==='/'&&n==='*'){blockC=true;k++;continue;}
    if(c==='/'){if(!/[A-Za-z0-9_$)\]}'"`]/.test(prev)){k++;let inCl=false;for(;k<src.length;k++){const rc=src[k];if(rc==='\\'){k++;continue;}if(rc==='[')inCl=true;else if(rc===']')inCl=false;else if(rc==='/'&&!inCl)break;}prev='/';continue;}prev=c;continue;}
    if(c==='\''||c==='"'||c==='`'){inS=c;prev=c;continue;}
    if(c==='{')depth++;else if(c==='}'){depth--;if(depth===0)return src.slice(i,k+1);}
    if(!/\s/.test(c))prev=c;}
  throw new Error('unbalanced: '+name);
}
function extractVar(src,name){const m=src.match(new RegExp('^var '+name+'\\s*=.*;$','m'));if(!m)throw new Error('var not found: '+name);return m[0];}

const MOCKS=`
  var __set={balanceDueDays:14,defaultBespeaking:50000};
  function gSet(){return __set;}
  function escHtml(s){if(s==null)return '';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function escAttr(s){return s==null?'':String(s);}
  function fmt(s){return s?('['+s+']'):'—';}
`;
function mount(src,fns,vars){
  const sandbox={console,Date,Math,Number,String,Object,Array,JSON,isNaN,parseInt,parseFloat};
  const ctx=vm.createContext(sandbox);
  vm.runInContext(MOCKS+'\n'+vars.map(v=>extractVar(src,v)).join('\n')+'\n'+fns.map(f=>extractFn(src,f)).join('\n'),ctx);
  return ctx;
}
const DOC_FNS=['cLine','qTot','dMoney','docSectionFor','docSections','docTotals','docSchedule'];
const DOC_FNS_W=DOC_FNS.concat(['_docResolveDue','_docCustomSchedule']);
const VARS=['_CEREMONY_LABELS','_CEREMONY_ORDER'];

// legacy flat quote (object-keyed map, exactly today's shape)
function legacyItems(){return {
  L1:{key:'L1',desc:'Bridal — Classic',qty:1,unit:125000,disc:0,linkedTo:'wedding'},
  L2:{key:'L2',desc:'Bridesmaid',qty:3,unit:38000,disc:0,linkedTo:'bridesmaids'},
  L3:{key:'L3',desc:'Homecoming',qty:1,unit:125000,disc:0,linkedTo:'homecoming'},
  L4:{key:'L4',desc:'Homecoming Package Discount',qty:1,unit:-30000,disc:0,linkedTo:'discount'},
  L5:{key:'L5',desc:'Hair trial',qty:1,unit:15000,disc:10,custom:true}
};}

console.log('\n=== Quote items / packages sim ===');
const head=mount(HEAD,DOC_FNS,VARS);
const work=mount(WORK,DOC_FNS_W,VARS);

// [1] BACKWARD COMPAT — identical HTML on legacy data
(function(){
  console.log('\n[1] backward compatibility (HEAD vs WORK on legacy data)');
  const items=legacyItems();
  const hSec=head.docSections(items), wSec=work.docSections(items);
  ok(hSec.html===wSec.html,'docSections HTML byte-identical on legacy quote');
  ok(hSec.subtotal===wSec.subtotal && hSec.discountAmt===wSec.discountAmt,'docSections subtotal/discount identical ('+wSec.subtotal+'/'+wSec.discountAmt+')');
  // schedule: HEAD(4 args) vs WORK(5 args, schedule undefined) — quote + invoice
  const grand=wSec.subtotal-wSec.discountAmt;
  ok(head.docSchedule(grand,50000,'2026-09-01',null)===work.docSchedule(grand,50000,'2026-09-01',null,undefined),'docSchedule (quote) identical when no custom schedule');
  ok(head.docSchedule(grand,50000,'2026-09-01',60000)===work.docSchedule(grand,50000,'2026-09-01',60000,undefined),'docSchedule (invoice) identical when no custom schedule');
  // grand-total invariant on legacy
  ok(work.qTot(items)===wSec.subtotal-wSec.discountAmt,'qTot === Σ subtotals − discountAmt (legacy)');
})();

// [2] PACKAGES — pinned to one ceremony, priced sub-lines
(function(){
  console.log('\n[2] package (parent + priced sub-lines), pinned to Wedding');
  const items={
    W:{key:'W',desc:'Bridal',qty:1,unit:125000,disc:0,linkedTo:'wedding'},
    P:{key:'P',isPackage:true,desc:'Glam Add-ons',qty:1,unit:0,disc:0,custom:true,pkgCeremony:'wedding'},
    C1:{key:'C1',parentKey:'P',desc:'Hair styling',qty:1,unit:20000,disc:0,custom:true},
    C2:{key:'C2',parentKey:'P',desc:'Makeup',qty:2,unit:15000,disc:0,custom:true},
    H:{key:'H',desc:'Homecoming',qty:1,unit:100000,disc:0,linkedTo:'homecoming'}
  };
  const sec=work.docSections(items);
  ok(sec.html.indexOf('Glam Add-ons')>=0,'package name sub-label renders');
  ok(sec.html.indexOf('pkglabel')>=0,'package label is a muted name-only sub-label (pkglabel)');
  ok(sec.html.indexOf('pkgsub')>=0 && sec.html.indexOf('Hair styling')>=0 && sec.html.indexOf('Makeup')>=0,'sub-lines render indented');
  ok(sec.html.indexOf('pkghead')<0,'NO package header amount row (pkghead removed)');
  ok(sec.html.indexOf('Rs 50,000')<0,'NO per-package subtotal shown in the document');
  // the ONLY subtotal is the per-ceremony one: standalone Bridal + both children (125000 + 20000 + 30000)
  ok(sec.html.indexOf('Rs 175,000')>=0,'only subtotal is the per-ceremony one (Rs 175,000)');
  // grand-total invariant holds with packages (parent priced at 0)
  ok(work.qTot(items)===sec.subtotal-sec.discountAmt,'qTot === Σ subtotals − discountAmt (with package)');
  ok(work.qTot(items)===275000,'qTot counts package children once (Rs 275,000)');
  // package does NOT leak into another ceremony
  const wedBlock=sec.html.split('Homecoming')[0];
  ok(wedBlock.indexOf('Glam Add-ons')>=0,'package sits inside its pinned (Wedding) ceremony, not Homecoming');
})();

// [3] CUSTOM INSTALLMENT SCHEDULE
(function(){
  console.log('\n[3] custom installment schedule');
  const sch={mode:'custom',installments:[
    {id:'s1',label:'Bespeaking fee',amount:50000,due:{type:'confirmation'}},
    {id:'s2',label:'Second instalment',amount:100000,due:{type:'beforeWedding',days:30}},
    {id:'s3',label:'Final balance',amount:50000,due:{type:'date',date:'2026-08-20'}}
  ]};
  const q=work.docSchedule(200000,50000,'2026-09-01',null,sch);
  ok(q.indexOf('Bespeaking fee')>=0 && q.indexOf('Second instalment')>=0 && q.indexOf('Final balance')>=0,'all 3 custom installments render (quote)');
  ok(q.indexOf('Rs 100,000')>=0,'installment amount rendered');
  const inv=work.docSchedule(200000,50000,'2026-09-01',60000,sch); // paid 60k → 1st Paid, 2nd Partial
  ok(inv.indexOf('Paid')>=0 && inv.indexOf('Partial')>=0,'invoice paid-waterfall marks Paid + Partial');
  // absent schedule → auto (2 rows), present → custom (3 rows)
  ok((work.docSchedule(200000,50000,'2026-09-01',null,null).match(/payrow/g)||[]).length===2,'no schedule ⇒ auto 2-row');
  ok((q.match(/payrow/g)||[]).length===3,'custom schedule ⇒ 3 rows');
})();

// [4] EVENT BINDING still works with a package present
(function(){
  console.log('\n[4] event↔quote binding intact (packages do not interfere)');
  const bindCtx=(function(){
    const sandbox={console,Date,Math,Number,String,Object,Array,JSON,isNaN,parseInt,parseFloat};
    const ctx=vm.createContext(sandbox);
    // OF + the untouched binding fns from WORK
    vm.runInContext('var OF={draft:{quoteItems:{},events:{}},intent:"quote"};function shouldShowQuoteSection(){return true;}function ofMark(){}',ctx);
    ['findLinked','upsertLinked','removeLinked','syncQuoteItems'].forEach(function(f){vm.runInContext(extractFn(WORK,f),ctx);});
    return ctx;
  })();
  // Seed a package that shares NO event linkedTo
  bindCtx.OF.draft.quoteItems={P:{key:'P',isPackage:true,desc:'Pkg',pkgCeremony:'wedding'},C:{key:'C',parentKey:'P',desc:'x',qty:1,unit:1000,disc:0,custom:true}};
  bindCtx.OF.draft.events={wedding:{enabled:true,theme:'Classic',bridesmaids:2}};
  vm.runInContext('syncQuoteItems();',bindCtx);
  const its=bindCtx.OF.draft.quoteItems;
  const vals=Object.values(its);
  ok(vals.some(function(x){return x.linkedTo==='wedding';}),'wedding line auto-created by syncQuoteItems');
  ok(vals.some(function(x){return x.linkedTo==='bridesmaids' && x.qty===2;}),'bridesmaids line synced with count');
  ok(its.P && its.P.isPackage && its.C && its.C.parentKey==='P','package + sub-line survived syncQuoteItems untouched');
  ok(vm.runInContext('findLinked(OF.draft.quoteItems,"wedding")',bindCtx)!=='P','findLinked never returns the package parent for an event key');
})();

// [5] EDITOR — buildQuoteSection renders packages + schedule without throwing
(function(){
  console.log('\n[5] Overview Form editor (buildQuoteSection) renders packages + schedule');
  const sandbox={console,Date,Math,Number,String,Object,Array,JSON,isNaN,parseInt,parseFloat};
  const ctx=vm.createContext(sandbox);
  vm.runInContext(
    'var OF={draft:{quoteItems:{},quoteSchedule:null}};'
    +'function ofMark(){}function renderOverviewForm(){}'
    +'function groupMoney(v){return v==null?"":String(v);}function parseMoney(v){return parseFloat(v)||0;}'
    +'var __set={balanceDueDays:14,defaultBespeaking:50000};function gSet(){return __set;}'
    +'function escHtml(s){return s==null?"":String(s);}function escAttr(s){return s==null?"":String(s);}',ctx);
  ['cLine','ofDiscItemKey','ofSubtotalExclDiscount','recomputeOrderDiscount',
   '_ofOrderDiscAmt','ofScheduleGrand','_qiRowHtml','_qiPackageHtml','_qiScheduleHtml','buildQuoteSection'
  ].forEach(function(f){vm.runInContext(extractFn(WORK,f),ctx);});
  ctx.OF.draft.quoteItems={
    W:{key:'W',desc:'Bridal',qty:1,unit:125000,disc:0,linkedTo:'wedding'},
    CUS:{key:'CUS',desc:'Hair trial',qty:1,unit:15000,disc:0,custom:true},
    P:{key:'P',isPackage:true,desc:'Glam Add-ons',qty:1,unit:0,disc:0,custom:true,pkgCeremony:'wedding'},
    C1:{key:'C1',parentKey:'P',desc:'Hair',qty:1,unit:20000,disc:0,custom:true},
    D:{key:'D',orderDiscount:true,discType:'rs',discValue:30000,desc:'Discount',qty:1,unit:0,disc:0}
  };
  ctx.OF.draft.quoteSchedule={mode:'custom',installments:[{id:'s1',label:'Deposit',amount:50000,due:{type:'confirmation'}}]};
  let html='';let threw=false;
  try{html=vm.runInContext('buildQuoteSection()',ctx);}catch(e){threw=true;console.log('    threw: '+e.message);}
  ok(!threw,'buildQuoteSection() does not throw');
  ok(typeof html==='string'&&html.length>200,'returns non-empty HTML');
  ok(html.indexOf('undefined')<0&&html.indexOf('NaN')<0,'no undefined/NaN');
  ok(html.indexOf('Glam Add-ons')>=0&&html.indexOf('+ Add sub-line')>=0,'package card + add-sub-line render');
  ok(html.indexOf('+ Add package')>=0,'add-package control renders');
  ok(html.indexOf('qiSetPkgCeremony')>=0,'package ceremony selector wired');
  ok(html.indexOf('Payment schedule')>=0&&html.indexOf('Reset to automatic')>=0,'custom schedule editor renders');
  ok(html.indexOf('Total')>=0,'totals render');

  // ---- warm-flat look: quoteItems.sim is the authority for the 4 renderers ----
  console.log('\n[5b] quote-builder warm-flat look');
  ['var(--bg)','1.5px','var(--gold)','text-transform:uppercase','⚓','📦','var(--danger)'].forEach(function(bad){
    ok(html.indexOf(bad)<0,'[5b] no "'+bad+'" in buildQuoteSection markup');
  });
  ok(html.indexOf('class="tag ti" style="margin-left:6px">Linked')>=0,'[5b] linked line uses the neutral tag ti "Linked" badge');
  ok(html.indexOf('border:1px solid var(--navy)')>=0,'[5b] package box border is var(--navy) 1px');
  ok(html.indexOf('background:var(--navy)')>=0,'[5b] navy Total box present');
  ok(html.indexOf('>Order discount<')>=0 && html.indexOf('Order Discount')<0,'[5b] "Order discount" sentence-case (no uppercase label)');
  ok(html.indexOf('var(--text2)')>=0,'[5b] discount summary line de-golded to var(--text2)');
  ok(html.indexOf('color:var(--warn)')>=0,'[5b] schedule mismatch emits var(--warn)');
  // matching installments → var(--success); confirm the warn/success validation survives
  var g=vm.runInContext('ofScheduleGrand()',ctx);
  ctx.OF.draft.quoteSchedule={mode:'custom',installments:[{id:'m',label:'Full',amount:g,due:{type:'confirmation'}}]};
  var html2=vm.runInContext('buildQuoteSection()',ctx);
  ok(html2.indexOf('color:var(--success)')>=0,'[5b] schedule match emits var(--success)');
})();

// [6] REGRESSION DIFF — untouched compute/binding fns byte-identical vs HEAD
(function(){
  console.log('\n[6] regression diff vs git HEAD (untouched fns)');
  ['cLine','qTot','invPaid','findLinked','upsertLinked','removeLinked','syncQuoteItems',
   'recomputeOrderDiscount','ofDiscItemKey','ofSubtotalExclDiscount','docTotals','buildReceipt'
  ].forEach(function(name){ ok(extractFn(HEAD,name)===extractFn(WORK,name),'unchanged: '+name); });
})();

console.log('\n=== '+(fails===0?'ALL PASS':fails+' FAILURE(S)')+' ===\n');
process.exit(fails===0?0:1);
