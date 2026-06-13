#!/usr/bin/env node
/*
 * Analytics (rAnalytics) restyle sim — Phase 7 screen 5 (lean concept; cohort basis).
 * Mounts rAnalytics on a mocked DOM + brides and proves the warm-flat rebuild:
 *
 *  - no Cinzel / var(--danger)/red / LKR / .00 / var(--gold) anywhere (active preset gold is CSS .fpill.on);
 *  - date presets are .fpill with exactly the active one .on (aSetPreset wired) + two date inputs wired to aSetCustomDate;
 *  - Overview: .stats grid of four tiles (Leads/Booked/Conversion/Revenue) = an independent cohort recompute;
 *  - Conversion funnel: all stages + counts, drop deltas var(--muted) not red, bars navy + Confirmed green + no gold,
 *    "Consult Booked"/"Consult Done" labels still present (wording deferred);
 *  - By source: flat _briefRow sorted revenue-desc, escaped names, conv tier tag ts/twg/ti, fR revenue, no onclick;
 *  - aLeadSourcePerf is a DATA fn ({rows,totals}); aRevenueTrends + aTimeInStage still exist but are NOT called;
 *  - regression: range engine + helpers + every other r* byte-identical; fRshort still defined; .stats/.stat CSS unchanged.
 *
 * Run: node sim/analytics.sim.js   (exit 0 = pass)
 */
const fs=require('fs');const vm=require('vm');const cp=require('child_process');const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const WORK=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const HEAD=cp.execSync('git show HEAD:index.html',{cwd:ROOT,maxBuffer:64*1024*1024}).toString();
let fails=0; function ok(c,m){if(c){console.log('  ✓ '+m);}else{console.log('  ✗ '+m);fails++;}}
function extractFn(src,name){const sig='function '+name+'(';const i=src.indexOf(sig);if(i<0)throw new Error('fn '+name);let k=src.indexOf('{',i),d=0,inS=null,esc=false,lc=false,bc=false,prev='';for(;k<src.length;k++){const c=src[k],n=src[k+1];if(lc){if(c==='\n')lc=false;continue;}if(bc){if(c==='*'&&n==='/'){bc=false;k++;}continue;}if(inS){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===inS){inS=null;prev=c;}continue;}if(c==='/'&&n==='/'){lc=true;k++;continue;}if(c==='/'&&n==='*'){bc=true;k++;continue;}if(c==='/'){if(!/[A-Za-z0-9_$)\]}'"`]/.test(prev)){k++;let cl=false;for(;k<src.length;k++){const r=src[k];if(r==='\\'){k++;continue;}if(r==='[')cl=true;else if(r===']')cl=false;else if(r==='/'&&!cl)break;}prev='/';continue;}prev=c;continue;}if(c==='\''||c==='"'||c==='`'){inS=c;prev=c;continue;}if(c==='{')d++;else if(c==='}'){d--;if(d===0)return src.slice(i,k+1);}if(!/\s/.test(c))prev=c;}throw new Error('unbalanced '+name);}
function cssBlock(src){const a=src.indexOf('<style>');const b=src.indexOf('</style>',a);return src.slice(a,b);}

// Cohort fixture. Range below is 2026-01-01..2026-06-30.
//  whatsapp : 4 leads, 2 confirmed -> conv 50% (ts), revenue 300000
//  instagram: 5 leads, 1 confirmed -> conv 20% (twg), revenue 80000
//  referral : 2 leads, 0 confirmed -> conv 0%  (ti), revenue 0
//  old1     : confirmed + revenue but createdAt OUT of range -> excluded entirely
function cohort(){return {
  w1:{id:'w1',name:'W1',source:'whatsapp', createdAt:'2026-02-01',confirmed:true, stage:5,invoices:{a:{items:[{amount:200000}]}}},
  w2:{id:'w2',name:'W2',source:'whatsapp', createdAt:'2026-02-10',confirmed:true, stage:5,invoices:{a:{items:[{amount:100000}]}}},
  w3:{id:'w3',name:'W3',source:'whatsapp', createdAt:'2026-03-01',confirmed:false,stage:3},
  w4:{id:'w4',name:'W4',source:'whatsapp', createdAt:'2026-03-05',confirmed:false,stage:1},
  g1:{id:'g1',name:'G1',source:'instagram',createdAt:'2026-02-02',confirmed:true, stage:5,invoices:{a:{items:[{amount:80000}]}}},
  g2:{id:'g2',name:'G2',source:'instagram',createdAt:'2026-02-12',confirmed:false,stage:4},
  g3:{id:'g3',name:'G3',source:'instagram',createdAt:'2026-02-13',confirmed:false,stage:3},
  g4:{id:'g4',name:'G4',source:'instagram',createdAt:'2026-02-14',confirmed:false,stage:2},
  g5:{id:'g5',name:'G5',source:'instagram',createdAt:'2026-02-15',confirmed:false,stage:0},
  r1:{id:'r1',name:'R1',source:'referral', createdAt:'2026-04-01',confirmed:false,stage:2},
  r2:{id:'r2',name:'R2',source:'referral', createdAt:'2026-04-02',confirmed:false,stage:0},
  old1:{id:'old1',name:'Old',source:'whatsapp',createdAt:'2025-12-01',confirmed:true,stage:5,invoices:{a:{items:[{amount:999999}]}}}
};}

function render(brides,range){
  const store={};
  const sandbox={console,Date,Math,Number,String,Object,Array,JSON,
    brides:brides, window:{_analytics:range},
    escHtml(s){if(s==null)return '';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');},
    qTot(items){return (items?Object.values(items):[]).reduce(function(s,i){return s+(Number(i.amount)||0);},0);},
    document:{getElementById:function(id){return store[id]||(store[id]={innerHTML:''});}}
  };
  const ctx=vm.createContext(sandbox);
  ['aInRange','aGetRange','fR','aLeadSourcePerf','aConversionFunnel',
   '_briefSection','_briefList','_briefEmpty','_briefRow','_briefMain','_briefDot','rAnalytics']
    .forEach(f=>vm.runInContext(extractFn(WORK,f),ctx));
  vm.runInContext('rAnalytics();',ctx);
  return store['MC'].innerHTML;
}

const RANGE={preset:'90d',from:'2026-01-01',to:'2026-06-30'};

console.log('\n=== Analytics (rAnalytics) restyle sim ===');

// [1] no banned styling
(function(){
  console.log('\n[1] no banned styling');
  const h=render(cohort(),RANGE);
  ok(typeof h==='string'&&h.length>100,'[1] renders non-empty HTML without throwing');
  ok(h.indexOf('Cinzel')<0,'[1] no Cinzel');
  ok(h.indexOf('var(--danger)')<0,'[1] no var(--danger)/red');
  ok(h.indexOf('LKR')<0 && h.indexOf('.00')<0,'[1] no LKR / no .00');
  ok(h.indexOf('var(--gold)')<0,'[1] no var(--gold) literal (active preset gold is the CSS .fpill.on class)');
})();

// [2] date range control
(function(){
  console.log('\n[2] date range control');
  const h=render(cohort(),RANGE);
  ['7D','30D','90D','6M','12M','All'].forEach(l=>ok(h.indexOf('>'+l+'</button>')>=0,'[2] preset '+l));
  const onCount=(h.match(/class="fpill on"/g)||[]).length;
  ok(onCount===1,'[2] exactly one active preset (.fpill on), got '+onCount);
  ok(h.indexOf('class="fpill on" onclick="aSetPreset(\'90d\')"')>=0,'[2] active preset wired to aSetPreset(90d)');
  ok((h.match(/<input type="date"/g)||[]).length===2,'[2] two date inputs present');
  ok(h.indexOf('onchange="aSetCustomDate(\'from\',this.value)"')>=0,'[2] from input wired to aSetCustomDate');
  ok(h.indexOf('onchange="aSetCustomDate(\'to\',this.value)"')>=0,'[2] to input wired to aSetCustomDate');
})();

// [3] Overview stat grid == independent cohort recompute
(function(){
  console.log('\n[3] Overview stat grid (cohort recompute)');
  const h=render(cohort(),RANGE);
  // Independent recompute over in-range brides:
  const all=Object.values(cohort()).filter(b=>b.createdAt>=RANGE.from&&b.createdAt<=RANGE.to);
  let leads=0,booked=0,revenue=0;
  all.forEach(b=>{leads+=1;if(b.confirmed){booked+=1;Object.values(b.invoices||{}).forEach(inv=>{(inv.items||[]).forEach(it=>revenue+=(Number(it.amount)||0));});}});
  const conv=leads>0?Math.round(booked/leads*100):0;
  ok(leads===11&&booked===3&&revenue===380000&&conv===27,'[3] recompute: 11 leads / 3 booked / 27% / 380000 (out-of-range excluded)');
  ok(h.indexOf('class="stats"')>=0,'[3] .stats grid present');
  ok((h.match(/class="stat"/g)||[]).length===4,'[3] exactly four .stat tiles');
  ok(h.indexOf('<div class="lab">Leads</div><div class="val">'+leads+'</div>')>=0,'[3] Leads tile = '+leads);
  ok(h.indexOf('<div class="lab">Booked</div><div class="val">'+booked+'</div>')>=0,'[3] Booked tile = '+booked);
  ok(h.indexOf('<div class="lab">Conversion</div><div class="val">'+conv+'%</div>')>=0,'[3] Conversion tile = '+conv+'%');
  ok(h.indexOf('<div class="lab">Revenue</div><div class="val">Rs '+revenue.toLocaleString()+'</div>')>=0,'[3] Revenue tile = fR('+revenue+')');
  ok(h.indexOf('val amber')<0,'[3] no amber tile in Overview');
})();

// [4] Conversion funnel
(function(){
  console.log('\n[4] Conversion funnel');
  const h=render(cohort(),RANGE);
  ['New Lead','Contacted','Consult Booked','Consult Done','Quoted','Confirmed'].forEach(l=>ok(h.indexOf('>'+l+'</span>')>=0,'[4] stage label "'+l+'"'));
  // counts via stage>=i over in-range cohort: [11,9,8,6,4,3]
  [['>11</strong>',11],['>9</strong>',9],['>8</strong>',8],['>6</strong>',6],['>4</strong>',4],['>3</strong>',3]]
    .forEach(p=>ok(h.indexOf(p[0])>=0,'[4] funnel count '+p[1]));
  ok(h.indexOf('font-family:Cinzel')<0,'[4] count is Inter not Cinzel');
  ok(h.indexOf('↓')>=0,'[4] drop-off deltas present');
  ok(h.indexOf('color:var(--muted);font-size:10px;font-weight:600">↓')>=0,'[4] drop deltas var(--muted) (de-redded)');
  // bars: Confirmed (i===5) success, others navy, NO gold
  ok(h.indexOf('background:var(--success);height:100%')>=0,'[4] Confirmed bar var(--success)');
  ok(h.indexOf('background:var(--navy);height:100%')>=0,'[4] non-final bars var(--navy)');
  const funnelStart=h.indexOf('>Conversion funnel<');const funnelEnd=h.indexOf('>By source<');
  const funnel=h.slice(funnelStart,funnelEnd);
  ok(funnel.indexOf('var(--gold)')<0,'[4] no gold in funnel');
})();

// [5] By source rows
(function(){
  console.log('\n[5] By source');
  const h=render(cohort(),RANGE);
  ok(h.indexOf('>By source<')>=0,'[5] section title "By source"');
  ok(h.indexOf('11 leads')>=0,'[5] section meta total leads');
  // revenue-desc order: WhatsApp(300k) > Instagram(80k) > Referral(0)
  const iw=h.indexOf('>WhatsApp</div>'),ig=h.indexOf('>Instagram</div>'),ir=h.indexOf('>Referral</div>');
  ok(iw>=0&&ig>=0&&ir>=0&&iw<ig&&ig<ir,'[5] rows sorted revenue-desc (WhatsApp<Instagram<Referral)');
  ok(h.indexOf('Rs 300,000')>=0&&h.indexOf('Rs 80,000')>=0&&h.indexOf('Rs 0')>=0,'[5] fR revenue per source');
  ok(h.indexOf('4 leads · 2 booked')>=0,'[5] WhatsApp sub "4 leads · 2 booked"');
  // conv tier tags
  ok(h.indexOf('<span class="tag ts">50%</span>')>=0,'[5] high conv -> tag ts 50%');
  ok(h.indexOf('<span class="tag twg">20%</span>')>=0,'[5] mid conv -> tag twg 20%');
  ok(h.indexOf('<span class="tag ti">0%</span>')>=0,'[5] zero conv -> tag ti 0%');
  // rows not clickable
  const bySrc=h.slice(h.indexOf('>By source<'));
  ok(bySrc.indexOf('onclick')<0,'[5] By-source rows have no onclick (a source spans many brides)');
  ok(bySrc.indexOf('cursor:pointer')<0,'[5] By-source rows are not cursor:pointer');
})();

// [6] aLeadSourcePerf is a DATA fn
(function(){
  console.log('\n[6] aLeadSourcePerf returns data');
  const store={};
  const sb={console,Date,Math,Number,String,Object,Array,JSON,brides:cohort(),
    qTot(items){return (items?Object.values(items):[]).reduce((s,i)=>s+(Number(i.amount)||0),0);},
    document:{getElementById:function(id){return store[id]||(store[id]={innerHTML:''});}}};
  const ctx=vm.createContext(sb);
  ['aInRange','aLeadSourcePerf'].forEach(f=>vm.runInContext(extractFn(WORK,f),ctx));
  const out=vm.runInContext('aLeadSourcePerf("2026-01-01","2026-06-30")',ctx);
  ok(out&&typeof out==='object'&&Array.isArray(out.rows)&&out.totals,'[6] returns {rows:[],totals:{}}');
  ok(out.rows.length===3,'[6] 3 source rows');
  ok(out.rows[0].src==='whatsapp'&&out.rows[0].revenue===300000,'[6] rows sorted revenue-desc');
  ok(out.totals.leads===11&&out.totals.booked===3&&out.totals.revenue===380000&&out.totals.conv===27,'[6] totals correct');
  // empty period -> empty rows + zero totals
  const empt=vm.runInContext('aLeadSourcePerf("2099-01-01","2099-12-31")',ctx);
  ok(empt.rows.length===0&&empt.totals.leads===0&&empt.totals.conv===0,'[6] empty period -> [] + zero totals');
})();

// [7] empty range
(function(){
  console.log('\n[7] empty range');
  const h=render(cohort(),{preset:'custom',from:'2099-01-01',to:'2099-12-31'});
  ok(h.indexOf('<div class="lab">Leads</div><div class="val">0</div>')>=0,'[7] Overview grid renders zeros');
  ok(h.indexOf('<div class="lab">Revenue</div><div class="val">Rs 0</div>')>=0,'[7] Revenue Rs 0');
  ok(h.indexOf('No leads in this period')>=0,'[7] funnel + by-source show "No leads in this period"');
})();

// [8] aRevenueTrends + aTimeInStage exist but are NOT called by rAnalytics
(function(){
  console.log('\n[8] dead-but-present modules');
  ok(extractFn(WORK,'aRevenueTrends').length>0,'[8] aRevenueTrends still defined');
  ok(extractFn(WORK,'aTimeInStage').length>0,'[8] aTimeInStage still defined');
  const rA=extractFn(WORK,'rAnalytics');
  ok(rA.indexOf('aRevenueTrends')<0&&rA.indexOf('aTimeInStage')<0,'[8] rAnalytics no longer calls them');
})();

// [9] regression — range engine + helpers + every OTHER r* byte-identical; modules unchanged; fRshort defined; CSS unchanged
(function(){
  console.log('\n[9] regression vs HEAD');
  ['aGetRange','aSetPreset','aSetCustomDate','aInRange','qTot','fR','fRshort','escHtml',
   'aRevenueTrends','aTimeInStage',
   '_briefSection','_briefList','_briefRow','_briefRowLead','_briefMain','_briefDot','_briefEmpty','computeTodaysActions',
   'renderTodaysActions','rSchedule','rQuotations',
   /* rInvoices NOT pinned — P2-8 (overpayment credit) edits it; sim/p2-8.sim.js is the authority.
      rFinance NOT pinned — P2-7 (monthly cash-collected) edits it; sim/finance.sim.js + sim/cycle-d-p1-3-p2-7.sim.js are the authority. */
   'rClients','rMessages','lCard','cardCTA'
  ].forEach(n=>ok(extractFn(HEAD,n)===extractFn(WORK,n),'[9] unchanged: '+n));
  // .stats/.stat CSS unchanged from the Finance build (Analytics added/changed no CSS).
  // NOTE: assert the Finance stat-grid rules are byte-identical rather than the WHOLE <style>
  // block — later screens (e.g. the detail restyle) legitimately edit unrelated rules
  // (.stitle/.pf), and those are owned by their own sims.
  function cssRule(css,sel){var i=css.indexOf(sel);if(i<0)return null;var j=css.indexOf('}',i);return j<0?null:css.slice(i,j+1);}
  ['.stats{','.stat{','.stat .lab{','.stat .val{','.stat .val.amber{'].forEach(sel=>{
    const hr=cssRule(cssBlock(HEAD),sel), wr=cssRule(cssBlock(WORK),sel);
    ok(hr!==null&&hr===wr,'[9] Finance CSS rule byte-identical: '+sel);
  });
})();

console.log('\n=== '+(fails===0?'ALL PASS':fails+' FAILURE(S)')+' ===\n');
process.exit(fails===0?0:1);
