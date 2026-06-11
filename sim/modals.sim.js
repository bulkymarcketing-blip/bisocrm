#!/usr/bin/env node
/*
 * Action-modal restyle sim — Phase 8 (presentation only) over the five render functions:
 * openAddPay / openEInv / openAdv / openResched / renderDisp (step 1 + each step-2 outcome).
 *
 *  - every info/summary box is var(--surf)+1px (no var(--bg), no 1.5px);
 *  - no UPPERCASE micro-labels (text-transform:uppercase) — sentence case;
 *  - gold totals -> var(--navy) (no var(--gold)); NO emoji (📵 📞 📅 ❌ ⚠ ✎ ✓ ↻);
 *  - legit colours survive: AddPay balance var(--warn); EInv bespeaking var(--success);
 *    disposition "Close as Lost" save is btn-danger; the "Final attempt"/"Closing as Lost" lead-ins are var(--warn);
 *  - regression: every handler (addPay/saveEInv/convInv/prevAdv/saveResched/saveDisp/pick/disp*),
 *    openCancelBooking, every other r* render, and all helpers byte-for-byte unchanged.
 *
 * Run: node sim/modals.sim.js   (exit 0 = pass)
 */
const fs=require('fs');const vm=require('vm');const cp=require('child_process');const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const WORK=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const HEAD=cp.execSync('git show HEAD:index.html',{cwd:ROOT,maxBuffer:64*1024*1024}).toString();
let fails=0; function ok(c,m){if(c){console.log('  ✓ '+m);}else{console.log('  ✗ '+m);fails++;}}
function extractFn(src,name){const sig='function '+name+'(';const i=src.indexOf(sig);if(i<0)throw new Error('fn '+name);let k=src.indexOf('{',i),d=0,inS=null,esc=false,lc=false,bc=false,prev='';for(;k<src.length;k++){const c=src[k],n=src[k+1];if(lc){if(c==='\n')lc=false;continue;}if(bc){if(c==='*'&&n==='/'){bc=false;k++;}continue;}if(inS){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===inS){inS=null;prev=c;}continue;}if(c==='/'&&n==='/'){lc=true;k++;continue;}if(c==='/'&&n==='*'){bc=true;k++;continue;}if(c==='/'){if(!/[A-Za-z0-9_$)\]}'"`]/.test(prev)){k++;let cl=false;for(;k<src.length;k++){const r=src[k];if(r==='\\'){k++;continue;}if(r==='[')cl=true;else if(r===']')cl=false;else if(r==='/'&&!cl)break;}prev='/';continue;}prev=c;continue;}if(c==='\''||c==='"'||c==='`'){inS=c;prev=c;continue;}if(c==='{')d++;else if(c==='}'){d--;if(d===0)return src.slice(i,k+1);}if(!/\s/.test(c))prev=c;}throw new Error('unbalanced '+name);}
const EMOJI=['📵','📞','📅','❌','⚠','✎','✓','↻'];
function clean(label,h){
  ok(h.indexOf('var(--bg)')<0,label+' no var(--bg)');
  ok(h.indexOf('var(--gold)')<0,label+' no var(--gold)');
  ok(h.indexOf('1.5px')<0,label+' no 1.5px borders');
  ok(h.indexOf('text-transform:uppercase')<0,label+' no uppercase micro-labels');
  ok(EMOJI.every(e=>h.indexOf(e)<0),label+' no emoji');
}

function mount(extra){
  const store={};
  function el(id){ if(!store[id]) store[id]={innerHTML:'',textContent:'',style:{},value:'',oninput:null}; return store[id]; }
  const sandbox=Object.assign({
    console,Date,Math,Number,String,Object,Array,JSON,parseFloat,parseInt,isNaN,
    leads:{}, custs:{}, RESCH:{}, DISP:{},
    CM(){},OM(){},notif(){},setTimeout(){},
    groupMoney(n){return String(n==null?'':n);},
    defNotes(){return '';},
    gSet(){return {defaultBespeaking:50000};},
    fmtPhone(p){return String(p||'');},
    document:{getElementById:el,querySelector(){return null;}},
    __store:store
  },extra||{});
  const ctx=vm.createContext(sandbox);
  ['cLine','qTot','invPaid','fR','fmt','escHtml',
   'openAddPay','openEInv','openAdv','openResched','openDisp','renderDisp']
    .forEach(f=>vm.runInContext(extractFn(WORK,f),ctx));
  return {ctx,store};
}

console.log('\n=== Action-modal restyle sim ===');

// [1] openAddPay
(function(){
  console.log('\n[1] openAddPay');
  const m=mount();
  m.ctx.leads={L1:{name:'Bride',invoices:{i1:{items:{a:{qty:1,unit:100000,disc:0}},advance:30000,payments:{p:{amount:20000}}}}}};
  vm.runInContext('openAddPay("lead","L1","i1")',m.ctx);
  const h=m.store['pay-b'].innerHTML;
  clean('[1]',h);
  ok(h.indexOf('background:var(--surf);border:1px solid var(--border)')>=0,'[1] balance box var(--surf)+1px');
  ok(h.indexOf('>Balance due<')>=0,'[1] "Balance due" sentence-case');
  ok(h.indexOf('color:var(--warn)">Rs 50,000')>=0,'[1] balance value keeps var(--warn) (Rs 50,000)');
})();

// [2] openEInv
(function(){
  console.log('\n[2] openEInv');
  const m=mount();
  m.ctx.leads={L1:{name:'Bride',invoices:{i1:{items:{a:{qty:1,unit:100000,disc:0}},advance:30000,date:'2026-06-01'}}}};
  vm.runInContext('openEInv("lead","L1","i1")',m.ctx);
  const h=m.store['einv-b'].innerHTML;
  clean('[2]',h);
  ok(h.indexOf('>Invoice total<')>=0 && h.indexOf('color:var(--navy)">Rs 100,000')>=0,'[2] "Invoice total" navy (de-golded)');
  ok(h.indexOf('>Bespeaking fee<')>=0 && h.indexOf('color:var(--success)">Rs 30,000')>=0,'[2] "Bespeaking fee" keeps var(--success)');
  ok(h.indexOf('>Locked</span>')>=0,'[2] grey "Locked" pill kept');
  ok(h.indexOf('>Balance due<')>=0 && h.indexOf('background:var(--canvas);color:var(--muted)')>=0,'[2] readonly Balance due -> var(--canvas)');
})();

// [3] openAdv
(function(){
  console.log('\n[3] openAdv');
  const m=mount();
  m.ctx.leads={L1:{name:'Bride',quotations:{q1:{id:'BQ-1',items:{a:{qty:1,unit:200000,disc:0}}}}}};
  vm.runInContext('openAdv("lead","L1","q1")',m.ctx);
  const h=m.store['adv-b'].innerHTML;
  clean('[3]',h);
  ok(h.indexOf('>Quote total<')>=0 && h.indexOf('color:var(--navy)">Rs 200,000')>=0,'[3] "Quote total" navy (de-golded)');
  ok(h.indexOf('background:var(--surf);border:1px solid var(--border)')>=0,'[3] boxes var(--surf)+1px');
  ok(h.indexOf('Balance: <strong id="adv-bal" style="color:var(--navy)">')>=0,'[3] balance box keeps navy figure');
})();

// [4] openResched
(function(){
  console.log('\n[4] openResched');
  const m=mount();
  m.ctx.leads={L1:{name:'Bride',appointments:{k1:{reason:'Trial',date:'2026-07-01',time:'10:00'}}}};
  vm.runInContext('openResched("L1","k1")',m.ctx);
  const h=m.store['resched-body'].innerHTML;
  clean('[4]',h);
  ok(h.indexOf('background:var(--surf);border:1px solid var(--border)')>=0,'[4] Original box var(--surf)+1px');
  ok(h.indexOf('>Original</div>')>=0,'[4] "Original" label kept');
})();

// [5] renderDisp — step 1
(function(){
  console.log('\n[5] renderDisp step 1');
  const m=mount();
  m.ctx.leads={L1:{name:'Bride',phone:'94770000000',contactAttempts:{}}};
  m.ctx.DISP={brideId:'L1',outcome:null,draft:{}};
  vm.runInContext('renderDisp()',m.ctx);
  const h=m.store['disp-body'].innerHTML;
  clean('[5]',h);
  ok((h.match(/btn-outline/g)||[]).length===4,'[5] four btn-outline outcome buttons');
  ok(h.indexOf('color:var(--danger)')<0 && h.indexOf('border-color:rgba(229,62,62')<0,'[5] "Not interested" button de-redded to plain btn-outline');
  ok(h.indexOf('>No answer</button>')>=0 && h.indexOf('Reached — not interested</button>')>=0,'[5] outcome labels present, no glyphs');
  ok(m.store['disp-footer'].innerHTML.indexOf('btn-danger')<0,'[5] step-1 footer has no danger button');
})();

// [6] renderDisp — step 2 (each outcome + attempt-3 final)
(function(){
  console.log('\n[6] renderDisp step 2');
  function step2(outcome,attempts){
    const m=mount();
    m.ctx.leads={L1:{name:'Bride',phone:'94770000000',contactAttempts:attempts||{}}};
    m.ctx.DISP={brideId:'L1',outcome:outcome,draft:{}};
    vm.runInContext('renderDisp()',m.ctx);
    return {body:m.store['disp-body'].innerHTML,foot:m.store['disp-footer'].innerHTML};
  }
  // no_answer attempt 1
  const na=step2('no_answer',{});
  clean('[6 no_answer]',na.body);
  ok(na.body.indexOf('background:var(--surf);border:1px solid var(--border)')>=0 && na.body.indexOf('<strong>No answer</strong>')>=0,'[6] no_answer banner surf + plain navy lead-in');
  ok(na.foot.indexOf('btn-primary')>=0 && na.foot.indexOf('btn-danger')<0,'[6] no_answer save btn-primary');
  // no_answer attempt 3 -> final-attempt banner (amber lead-in, no red fill)
  const na3=step2('no_answer',{a1:{outcome:'no_answer',at:'2026-06-01'},a2:{outcome:'no_answer',at:'2026-06-03'}});
  clean('[6 final]',na3.body);
  ok(na3.body.indexOf('<strong style="color:var(--warn)">Final attempt</strong>')>=0,'[6] attempt-3 "Final attempt" lead-in var(--warn)');
  ok(na3.body.indexOf('#FEE2E2')<0 && na3.body.indexOf('#FECACA')<0,'[6] final-attempt no red fill');
  // callback_later
  const cb=step2('callback_later',{});
  clean('[6 callback]',cb.body);
  ok(cb.body.indexOf('<strong>Call back later</strong>')>=0 && cb.body.indexOf('#E0EBFE')<0,'[6] callback banner surf navy (no blue fill)');
  // consult_booked
  const co=step2('consult_booked',{});
  clean('[6 consult]',co.body);
  ok(co.body.indexOf('<strong>Booking consultation</strong>')>=0 && co.body.indexOf('#D1FAE5')<0,'[6] consult banner surf navy (no green fill)');
  ok(co.foot.indexOf('btn-primary')>=0 && co.foot.indexOf('Book & Move to Stage 2')>=0,'[6] consult save btn-primary');
  // not_interested
  const ni=step2('not_interested',{});
  clean('[6 not_interested]',ni.body);
  ok(ni.body.indexOf('<strong style="color:var(--warn)">Closing as Lost</strong>')>=0,'[6] "Closing as Lost" lead-in var(--warn)');
  ok(ni.body.indexOf('#FEE2E2')<0,'[6] not_interested no red fill');
  ok(ni.foot.indexOf('btn-danger')>=0 && ni.foot.indexOf('Close as Lost')>=0,'[6] "Close as Lost" save stays btn-danger');
})();

// [7] regression — handlers + openCancelBooking + every other r* + helpers byte-identical
(function(){
  console.log('\n[7] regression vs HEAD');
  ['addPay','delPay','saveEInv','convInv','prevAdv','saveResched','closeResched','openCancelBooking',
   'saveDisp','pickDisp','closeDisp','openDisp','dispRemChange','dispCbChange','dispReasonChange',
   'qTot','cLine','invPaid','fR','fmt','escHtml','brideTotal','brideCollected','brideOutstanding',
   'openDetail','buildOverviewTab','buildPaymentTab','buildStageCta','buildApptTab','buildNotesTab','buildDocsTab',
   'rDailyBrief','renderTodaysActions','rPipeline','rSchedule','rQuotations','rCustomers','rInvoices','rFinance','rAnalytics',
   'rClients','rSettings','rMessages','lCard','cardCTA'
  ].forEach(n=>ok(extractFn(HEAD,n)===extractFn(WORK,n),'[7] unchanged: '+n));
})();

console.log('\n=== '+(fails===0?'ALL PASS':fails+' FAILURE(S)')+' ===\n');
process.exit(fails===0?0:1);
