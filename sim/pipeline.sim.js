#!/usr/bin/env node
/*
 * Pipeline redesign sim — Phase 5 (lanes → stage pills, lighter cards).
 * Presentation + view-state only; proves the data/compute layer is untouched.
 *
 *  - stage pills render with counts and default to the first stage (New Lead, gold .on);
 *  - tapping (window._pipeStage) shows only that stage's leads;
 *  - the renderTodaysActions widget is gone from the Pipeline;
 *  - STAGES[2]/[3] read "Visit Booked" / "Visited";
 *  - cards: navy full CTA, no lc-overdue red bar, no emoji, amber (not red) idle,
 *    "Rs X quoted" line on quoted cards; Closed-lost is sentence-case + 1px.
 *  - regression (a): computeTodaysActions + _brief* compute helpers byte-identical vs HEAD;
 *  - regression (b): rDailyBrief byte-identical vs HEAD, and renderTodaysActions differs
 *    only by the sanctioned stage relabel (Consultation→Visited / consultation done→visited).
 *
 * Run: node sim/pipeline.sim.js   (exit 0 = pass)
 */
const fs=require('fs');const vm=require('vm');const cp=require('child_process');const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const WORK=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const HEAD=cp.execSync('git show HEAD:index.html',{cwd:ROOT,maxBuffer:64*1024*1024}).toString();
let fails=0; function ok(c,m){if(c){console.log('  ✓ '+m);}else{console.log('  ✗ '+m);fails++;}}
function extractFn(src,name){const sig='function '+name+'(';const i=src.indexOf(sig);if(i<0)throw new Error('fn '+name);let k=src.indexOf('{',i),d=0,inS=null,esc=false,lc=false,bc=false,prev='';for(;k<src.length;k++){const c=src[k],n=src[k+1];if(lc){if(c==='\n')lc=false;continue;}if(bc){if(c==='*'&&n==='/'){bc=false;k++;}continue;}if(inS){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===inS){inS=null;prev=c;}continue;}if(c==='/'&&n==='/'){lc=true;k++;continue;}if(c==='/'&&n==='*'){bc=true;k++;continue;}if(c==='/'){if(!/[A-Za-z0-9_$)\]}'"`]/.test(prev)){k++;let cl=false;for(;k<src.length;k++){const r=src[k];if(r==='\\'){k++;continue;}if(r==='[')cl=true;else if(r===']')cl=false;else if(r==='/'&&!cl)break;}prev='/';continue;}prev=c;continue;}if(c==='\''||c==='"'||c==='`'){inS=c;prev=c;continue;}if(c==='{')d++;else if(c==='}'){d--;if(d===0)return src.slice(i,k+1);}if(!/\s/.test(c))prev=c;}throw new Error('unbalanced '+name);}
function extractDecl(src,name){const m=src.match(new RegExp('^(?:var|const) '+name.replace('$','\\$')+'\\s*=.*;$','m'));if(!m)throw new Error('decl '+name);return m[0].replace(/^const /,'var ');}

const DAY=86400000, NOW=Date.now();
const dago=n=>new Date(NOW-n*DAY).toISOString();
const din=n=>new Date(NOW+n*DAY).toISOString().slice(0,10);

const MOCKS=`
  var q='';
  var _expandedCards={};
  var brides={};
  function lA(){return Object.values(brides);}
  function pipelineMetrics(){return {thisWeek:3,weekDelta:10,convRate:40,bookedCount:2,leadCount:5,avgResp:5,avgValue:300000,pipelineValue:840000,upcoming90:2};}
  function qTot(items){return (items||[]).reduce(function(s,i){return s+(Number(i.amount)||0);},0);}
  function dS(d){if(!d)return 0;return Math.floor((${NOW}-new Date(d).getTime())/${DAY});}
  function dU(d){if(!d)return null;return Math.round((new Date(d).getTime()-${NOW})/${DAY});}
  function fmt(s){return s?('['+String(s).slice(0,10)+']'):'TBD';}
  function fmtPhone(p){return String(p||'');}
  function escHtml(s){return s==null?'':String(s);}
  function escAttr(s){return s==null?'':String(s);}
  function isLeadOverdue(l){return !!l.__overdue;}
  function leadWedTs(l){return l.weddingDate?new Date(l.weddingDate).getTime():Infinity;}
  function overdueReason(l){return 'no follow-up scheduled';}
  var SRC={whatsapp:['tw','WhatsApp'],form:['tf','Form']};
  var window={}, __store={};
  var document={getElementById:function(id){return __store[id]||(__store[id]={innerHTML:''});}};
`;
function pctx(){
  const ctx=vm.createContext({console,Date,Math,Number,String,Object,Array,JSON,isNaN,parseInt,parseFloat,Infinity});
  vm.runInContext(MOCKS,ctx);
  ['_icoWA','_icoCall','_icoClock','_icoArrow','_icoEdit','_icoCheck','_icoMail','_icoAlert','_icoSep','STAGES'].forEach(d=>vm.runInContext(extractDecl(WORK,d),ctx));
  ['fRshort','metricCard','cardIcons','cardCTA','lCard','rPipeline'].forEach(f=>vm.runInContext(extractFn(WORK,f),ctx));
  return ctx;
}
function pdata(){return {
  a:{id:'a',name:'Aaa New',stage:0,createdAt:dago(0),lastActivity:dago(0),source:'whatsapp',phone:'9477'},
  b:{id:'b',name:'Bbb Contacted',stage:1,createdAt:dago(3),lastActivity:dago(1),source:'form',contactAttempts:{x:{at:dago(1),outcome:'no_answer'}}},
  c:{id:'c',name:'Ccc VisitBooked',stage:2,createdAt:dago(5),lastActivity:dago(2),source:'form'},
  d:{id:'d',name:'Ddd Visited',stage:3,createdAt:dago(10),lastActivity:dago(9),source:'form',__overdue:true,phone:'9477',email:'d@x.lk'},
  e:{id:'e',name:'Eee Quoted',stage:4,createdAt:dago(12),lastActivity:dago(1),source:'whatsapp',weddingDate:din(20),quotations:{q1:{id:'q1',items:[{amount:540000}]}},nextReminderAt:din(0)},
  z:{id:'z',name:'Zzz Lost',lost:true,lostReason:'budget',lostAt:dago(4)}
};}
function run(setup){
  const ctx=pctx();
  vm.runInContext('brides='+JSON.stringify(pdata())+';',ctx);
  if(setup) vm.runInContext(setup,ctx);
  vm.runInContext('rPipeline();',ctx);
  return vm.runInContext("document.getElementById('MC').innerHTML",ctx);
}

console.log('\n=== Pipeline redesign sim ===');

// [1] stage pills + default first stage
(function(){
  console.log('\n[1] stage pills (counts, default New Lead, gold active)');
  const h=run(null);
  ['New Lead','Contacted','Visit Booked','Visited','Quoted'].forEach(function(l){ ok(h.indexOf('>'+l+' <')>=0, '[1] pill "'+l+'" renders'); });
  ok(h.indexOf('class="fpill on" id="pipe-pill-on" onclick="setPipeStage(0)"')>=0, '[1] default pill = New Lead (gold .on, scrolled into view via id)');
  ok(h.indexOf('class="fpill" onclick="setPipeStage(1)"')>=0, '[1] other pills inactive');
  ok(h.indexOf('Aaa New')>=0 && h.indexOf('Bbb Contacted')<0 && h.indexOf('Eee Quoted')<0, '[1] only stage-0 leads shown by default');
})();

// [2] tapping a pill shows only that stage
(function(){
  console.log('\n[2] selecting a stage');
  const h=run('window._pipeStage=4;');
  ok(h.indexOf('class="fpill on" id="pipe-pill-on" onclick="setPipeStage(4)"')>=0, '[2] Quoted pill active when selected');
  ok(h.indexOf('Eee Quoted')>=0 && h.indexOf('Aaa New')<0, '[2] shows only stage-4 leads');
  ok(h.indexOf('class="lamt">Rs 540,000 quoted')>=0, '[2] quoted cards show the "Rs X quoted" line');
  ok(h.indexOf('Reminder today')>=0 && h.indexOf('tag tu')>=0, '[2] reminder-today badge is red (act-now)');
})();

// [3] widget gone + STAGES rename
(function(){
  console.log('\n[3] no actions widget; STAGES renamed');
  const h=run(null);
  ok(h.indexOf('Follow-ups')<0 && h.indexOf('Quotes to send')<0 && h.indexOf('Appointments to confirm')<0, '[3] renderTodaysActions widget absent from Pipeline');
  ok(h.indexOf('Visit Booked')>=0 && h.indexOf('Visited')>=0, '[3] STAGES[2]/[3] read Visit Booked / Visited');
  ok(h.indexOf('Consultation Booked')<0 && h.indexOf('Consultation Done')<0, '[3] old stage names gone');
})();

// [4] cards: navy CTA, no red bar, no emoji, amber idle
(function(){
  console.log('\n[4] card styling');
  const h=run('window._pipeStage=3;_expandedCards={d:true};');
  ok(h.indexOf('class="lcard-cta-full"')>=0, '[4] full-width primary CTA present');
  ok(/\.lcard-cta-full\{[^}]*background:var\(--navy\)/.test(WORK), '[4] .lcard-cta-full is NAVY');
  ok(WORK.indexOf('.lcard.lc-overdue')<0, '[4] red overdue left-bar CSS removed');
  ok(h.indexOf('lc-overdue')<0, '[4] no lc-overdue class on cards');
  ok(h.indexOf('lidle warn')>=0, '[4] idle/overdue shown as amber .lidle.warn (not red pill)');
  const EMOJI=['💬','📞','✎','⏰','✓','⚠','✉','📵','→','💌','🤫'];
  ok(EMOJI.every(function(e){return h.indexOf(e)<0;}), '[4] no emoji anywhere in the card output');
})();

// [5] empty stage + closed-lost restyle + metrics
(function(){
  console.log('\n[5] empty state, closed-lost, metrics');
  const empty=run("q='zzzzzz';");
  ok(empty.indexOf('No leads in New Lead')>=0, '[5] empty filtered stage shows quiet "No leads in <Stage>"');
  const lost=run('window._showLost=true;');
  ok(lost.indexOf('Closed–lost')>=0 && lost.indexOf('Closed — Lost')<0, '[5] Closed-lost label is sentence case');
  ok(lost.indexOf('Zzz Lost')>=0 && lost.indexOf('Reopen')>=0, '[5] lost leads + Reopen render');
  const met=run('window._showMetrics=true;');
  ok(met.indexOf('class="mc-grid"')>=0 && met.indexOf('Pipeline metrics')>=0, '[5] metrics grid renders above pills when expanded');
})();

// [6] regression (a) — compute/data untouched
(function(){
  console.log('\n[6] regression (a): compute/data byte-identical vs HEAD');
  ['computeTodaysActions','_briefWeddings','_briefAppointments','_briefSinceLastVisit','_briefNeedsAttention','_briefLastVisit','_humanAgo','pipelineMetrics']
    .forEach(n=>ok(extractFn(HEAD,n)===extractFn(WORK,n),'[6] unchanged: '+n));
})();

// [7] stage path — single-line scroller + chevrons + compact CTA
(function(){
  console.log('\n[7] stage path (single-line scroller, chevrons) + compact CTA');
  const h=run(null);
  ok(h.indexOf('class="spath"')>=0, '[7] stage row uses the pipeline-only .spath container');
  ok(h.indexOf('class="fpills"')<0, '[7] Pipeline does NOT use the Brief .fpills class');
  ok(/\.spath\{[^}]*flex-wrap:nowrap/.test(WORK) && /\.spath\{[^}]*overflow-x:auto/.test(WORK), '[7] .spath is a non-wrapping horizontal scroller');
  const chev=h.split('M9 6l6 6-6 6').length-1;
  ok(chev===4, '[7] a chevron sits between each pair of 5 stages, none after the last (got '+chev+')');
  ok(h.indexOf('id="pipe-pill-on"')>=0, '[7] active pill is tagged for scroll-into-view');
  ok(/\.lcard-cta-full\{[^}]*display:inline-flex/.test(WORK), '[7] .lcard-cta-full is inline-flex (compact)');
  ok(!/\.lcard-cta-full\{[^}]*width:100%/.test(WORK), '[7] .lcard-cta-full no longer full width');
})();

// [8] regression (b) — Daily Brief untouched this branch (shared .fpills unchanged)
(function(){
  console.log('\n[8] regression (b): Daily Brief untouched (shared .fpills)');
  ok(extractFn(HEAD,'rDailyBrief')===extractFn(WORK,'rDailyBrief'), '[8] rDailyBrief byte-identical to HEAD');
  ok(extractFn(HEAD,'renderTodaysActions')===extractFn(WORK,'renderTodaysActions'), '[8] renderTodaysActions byte-identical to HEAD');
  ok(WORK.indexOf('.fpills{display:flex;gap:8px;margin:2px 0 18px;flex-wrap:wrap}')>=0, '[8] Brief .fpills rule unchanged (filter pills still wrap)');
})();

console.log('\n=== '+(fails===0?'ALL PASS':fails+' FAILURE(S)')+' ===\n');
process.exit(fails===0?0:1);
