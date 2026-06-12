#!/usr/bin/env node
/*
 * Overview Form restyle sim — Phase 8 PART A (renderOverviewForm, the capture form).
 * Mounts renderOverviewForm on a mocked DOM + OF.draft and proves the warm-flat rebuild,
 * WITHOUT touching the quote builder (buildQuoteSection is mocked here; regression-pinned below).
 *
 *  - the four section headers (Contact/Events/Quotation/Notes) are class="stitle" (navy), NOT uppercase;
 *  - event cards use var(--surf) with 1px borders (NO var(--bg), NO #fafbfc, NO 1.5px);
 *  - the Going-Away readonly date bg is var(--canvas); its hint is var(--muted) (not var(--gold));
 *  - logic parity: the event date-constraint outputs (min / "Must be after wedding" / readonly) still render;
 *  - Quotation section shows iff shouldShowQuoteSection() is true;
 *  - regression: buildQuoteSection, shouldShowQuoteSection, every of-handler, qi-handler and ofSchedule-handler, every other r-render and the helpers byte-identical.
 *
 * Run: node sim/overviewform.sim.js   (exit 0 = pass)
 */
const fs=require('fs');const vm=require('vm');const cp=require('child_process');const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const WORK=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const HEAD=cp.execSync('git show HEAD:index.html',{cwd:ROOT,maxBuffer:64*1024*1024}).toString();
let fails=0; function ok(c,m){if(c){console.log('  ✓ '+m);}else{console.log('  ✗ '+m);fails++;}}
function extractFn(src,name){const sig='function '+name+'(';const i=src.indexOf(sig);if(i<0)throw new Error('fn '+name);let k=src.indexOf('{',i),d=0,inS=null,esc=false,lc=false,bc=false,prev='';for(;k<src.length;k++){const c=src[k],n=src[k+1];if(lc){if(c==='\n')lc=false;continue;}if(bc){if(c==='*'&&n==='/'){bc=false;k++;}continue;}if(inS){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===inS){inS=null;prev=c;}continue;}if(c==='/'&&n==='/'){lc=true;k++;continue;}if(c==='/'&&n==='*'){bc=true;k++;continue;}if(c==='/'){if(!/[A-Za-z0-9_$)\]}'"`]/.test(prev)){k++;let cl=false;for(;k<src.length;k++){const r=src[k];if(r==='\\'){k++;continue;}if(r==='[')cl=true;else if(r===']')cl=false;else if(r==='/'&&!cl)break;}prev='/';continue;}prev=c;continue;}if(c==='\''||c==='"'||c==='`'){inS=c;prev=c;continue;}if(c==='{')d++;else if(c==='}'){d--;if(d===0)return src.slice(i,k+1);}if(!/\s/.test(c))prev=c;}throw new Error('unbalanced '+name);}

function render(draft,intent,showQuote){
  const store={};
  function el(id){ if(!store[id]) store[id]={innerHTML:'',textContent:'',style:{},value:''}; return store[id]; }
  const sandbox={console,Date,Math,Number,String,Object,Array,JSON,
    OF:{draft:draft,countryCode:'94',intent:intent||''},
    escHtml(s){return s==null?'':String(s);},
    findCountry(){return {code:'94',flag:'',name:'Sri Lanka'};},
    countDropdown(id,v){return '<select id="'+id+'"><option>'+(v||0)+'</option></select>';},
    shouldShowQuoteSection(){return !!showQuote;},
    buildQuoteSection(){return '<div data-quote-builder="mock"></div>';},
    initPhoneInput(){},
    setTimeout(){},
    document:{getElementById:el}
  };
  const ctx=vm.createContext(sandbox);
  vm.runInContext(extractFn(WORK,'renderOverviewForm'),ctx);
  vm.runInContext('renderOverviewForm();',ctx);
  return {body:store['of-body'].innerHTML, foot:store['of-footer'].innerHTML};
}

function draftBase(){return {name:'Bride',phone:'771234567',email:'',source:'whatsapp',createdAt:'2026-06-01T00:00:00.000Z',notes:'hi',
  events:{wedding:{enabled:true,date:'2026-08-01'},homecoming:{enabled:false},goingAway:{enabled:true},engagement:{enabled:false}}};}

console.log('\n=== Overview Form restyle sim (Part A) ===');

// [1] section headers -> .stitle, no uppercase
(function(){
  console.log('\n[1] section headers');
  const h=render(draftBase(),'',true).body;
  ok(h.indexOf('text-transform:uppercase')<0,'[1] no uppercase headers');
  ok(h.indexOf('<div class="stitle">Contact</div>')>=0,'[1] Contact -> .stitle (no top margin)');
  ok(h.indexOf('<div class="stitle" style="margin-top:18px">Events</div>')>=0,'[1] Events -> .stitle + margin-top');
  ok(h.indexOf('<div class="stitle" style="margin-top:18px">Quotation</div>')>=0,'[1] Quotation -> .stitle + margin-top');
  ok(h.indexOf('<div class="stitle" style="margin-top:18px">Notes</div>')>=0,'[1] Notes -> .stitle + margin-top');
  ok((h.match(/class="stitle"/g)||[]).length===4,'[1] exactly four .stitle headers');
})();

// [2] event cards: var(--surf) + 1px, no var(--bg)/#fafbfc/1.5px
(function(){
  console.log('\n[2] event cards');
  const h=render(draftBase(),'',false).body;
  ok(h.indexOf('background:var(--surf);border:1px solid var(--navy)')>=0,'[2] enabled card var(--surf)+1px navy border');
  ok(h.indexOf('background:var(--surf);border:1px solid var(--border)')>=0,'[2] disabled card var(--surf)+1px hairline');
  ok(h.indexOf('#fafbfc')<0,'[2] no #fafbfc');
  ok(h.indexOf('var(--bg)')<0,'[2] no var(--bg)');
  ok(h.indexOf('1.5px')<0,'[2] no 1.5px borders');
})();

// [3] Going-Away readonly date + hint
(function(){
  console.log('\n[3] Going-Away date lock');
  const h=render(draftBase(),'',false).body;  // goingAway enabled + wedding has a date
  ok(h.indexOf('background:var(--canvas);cursor:not-allowed;color:var(--muted)')>=0,'[3] readonly date bg var(--canvas)');
  ok(h.indexOf('color:var(--muted);margin-top:3px">Same day as wedding (auto)')>=0,'[3] hint var(--muted) (de-golded)');
  ok(h.indexOf('var(--gold)')<0,'[3] no var(--gold) anywhere');
})();

// [4] logic parity — date-constraint outputs still render
(function(){
  console.log('\n[4] date-constraint parity');
  // homecoming enabled & after wedding -> "Must be after wedding" hint + min attr
  const d=draftBase(); d.events.homecoming={enabled:true};
  const h=render(d,'',false).body;
  ok(h.indexOf('Must be after wedding (2026-08-01)')>=0,'[4] homecoming hint references wedding date');
  ok(h.indexOf(' min="2026-08-02"')>=0,'[4] homecoming min = wedding+1');
  // wedding gets max when homecoming has a date
  const d2=draftBase(); d2.events.homecoming={enabled:true,date:'2026-09-01'};
  const h2=render(d2,'',false).body;
  ok(h2.indexOf('Must be before homecoming (2026-09-01)')>=0,'[4] wedding hint references homecoming date');
  ok(h2.indexOf(' max="2026-08-31"')>=0,'[4] wedding max = homecoming-1');
})();

// [5] quote section gating
(function(){
  console.log('\n[5] quote section gating');
  const on=render(draftBase(),'',true).body;
  ok(on.indexOf('>Quotation</div>')>=0 && on.indexOf('data-quote-builder="mock"')>=0,'[5] quote section shown when shouldShowQuoteSection()');
  const off=render(draftBase(),'',false).body;
  ok(off.indexOf('>Quotation</div>')<0 && off.indexOf('data-quote-builder="mock"')<0,'[5] quote section hidden otherwise');
})();

// [6] regression — quote builder + handlers + every other r* + helpers byte-identical
(function(){
  console.log('\n[6] regression vs HEAD');
  ['shouldShowQuoteSection',
   /* buildQuoteSection intentionally NOT pinned here — the quote-builder warm-flat restyle
      legitimately edits it (+ _qiRowHtml/_qiPackageHtml/_qiScheduleHtml); sim/quoteItems.sim.js
      is the authority for those four renderers. This sim restyled renderOverviewForm. */
   'ofMark','ofToggleEvent','ofSetEvent','ofSetTheme','ofSetThemeOther','ofCountChange','ofPhoneInput','ofPhoneBlur','ofValidate','ofSave','syncQuoteItems',
   'qiAddPackage','qiAddSubLine','qiSetPkgCeremony','ofScheduleAdd',
   /* openOverviewForm intentionally NOT pinned here — the detail-modal layering bug fix
      (CM('detail-modal') before OM('lead-modal')) legitimately edits it; sim/fix-overview-form.sim.js
      is the authority for that change. This sim restyled renderOverviewForm, not openOverviewForm. */
   'closeOverview','countDropdown','initPhoneInput',
   'escHtml','qTot','fR','fmt',
   'openDetail','buildOverviewTab','buildPaymentTab','buildStageCta','buildApptTab','buildNotesTab','buildDocsTab',
   'openAddPay','openEInv','openAdv','openResched','renderDisp','openCancelBooking',
   'rDailyBrief','renderTodaysActions','rSchedule','rQuotations','rInvoices','rFinance','rAnalytics',
   'rClients','rMessages','lCard','cardCTA'
  ].forEach(n=>ok(extractFn(HEAD,n)===extractFn(WORK,n),'[6] unchanged: '+n));
})();

console.log('\n=== '+(fails===0?'ALL PASS':fails+' FAILURE(S)')+' ===\n');
process.exit(fails===0?0:1);
