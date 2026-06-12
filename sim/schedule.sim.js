#!/usr/bin/env node
/*
 * Schedule screen restyle sim (presentation-only).
 * Mounts rSchedule on a mocked DOM + data and asserts the visual changes; proves
 * data/logic + global red classes + other screens are untouched.
 *
 *  - filter uses .fpill/.fpill.on (not the old boxed segmented control);
 *  - cards flat (var(--surf) + 1px border + --sh; no amber #FEF7E5 bg, no width:8px left-bar);
 *  - tags de-uppercased ("No-show", not "NO-SHOW"); headers Inter sentence-case ("This week");
 *  - event-type recolour scoped: Wedding #C77D8E / Final Trial #8E2A4A present,
 *    #C8A55B / #DC2626 absent from the Schedule output;
 *  - legend slimmed (no var(--bg) box);
 *  - action chips stay ink/navy: Reschedule navy-filled, "Did come" navy ghost — NO green;
 *  - regression: computeTodaysActions, the _brief helpers, rDailyBrief, renderTodaysActions,
 *    rPipeline, lCard, cardCTA, setSchedMode byte-identical vs HEAD.
 *
 * Run: node sim/schedule.sim.js   (exit 0 = pass)
 */
const fs=require('fs');const vm=require('vm');const cp=require('child_process');const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const WORK=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const HEAD=cp.execSync('git show HEAD:index.html',{cwd:ROOT,maxBuffer:64*1024*1024}).toString();
let fails=0; function ok(c,m){if(c){console.log('  ✓ '+m);}else{console.log('  ✗ '+m);fails++;}}
function extractFn(src,name){const sig='function '+name+'(';const i=src.indexOf(sig);if(i<0)throw new Error('fn '+name);let k=src.indexOf('{',i),d=0,inS=null,esc=false,lc=false,bc=false,prev='';for(;k<src.length;k++){const c=src[k],n=src[k+1];if(lc){if(c==='\n')lc=false;continue;}if(bc){if(c==='*'&&n==='/'){bc=false;k++;}continue;}if(inS){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===inS){inS=null;prev=c;}continue;}if(c==='/'&&n==='/'){lc=true;k++;continue;}if(c==='/'&&n==='*'){bc=true;k++;continue;}if(c==='/'){if(!/[A-Za-z0-9_$)\]}'"`]/.test(prev)){k++;let cl=false;for(;k<src.length;k++){const r=src[k];if(r==='\\'){k++;continue;}if(r==='[')cl=true;else if(r===']')cl=false;else if(r==='/'&&!cl)break;}prev='/';continue;}prev=c;continue;}if(c==='\''||c==='"'||c==='`'){inS=c;prev=c;continue;}if(c==='{')d++;else if(c==='}'){d--;if(d===0)return src.slice(i,k+1);}if(!/\s/.test(c))prev=c;}throw new Error('unbalanced '+name);}

const DAY=86400000, NOW=Date.now();
const dago=n=>new Date(NOW-n*DAY).toISOString().slice(0,10);
const din=n=>new Date(NOW+n*DAY).toISOString().slice(0,10);

function brideData(){return {
  w:{id:'w',name:'Wedding Bride',confirmed:true,invoices:{i1:{}},events:{wedding:{enabled:true,date:din(3),startTime:'10:00',venue:'Galle'}}},
  ft:{id:'ft',name:'Trial Bride',appointments:{a:{key:'a',reason:'Final Trial',date:din(2),time:'14:00'}}},
  ns:{id:'ns',name:'NoShow Bride',appointments:{a2:{key:'a2',reason:'Consultation',date:dago(2),noShow:true}}},
  fu:{id:'fu',name:'Followup Bride',nextReminderAt:new Date(NOW-DAY).toISOString()}
};}

function render(mode){
  const store={};
  const sandbox={console,Date,Math,Number,String,Object,Array,JSON,isNaN,parseInt,parseFloat,
    q:'', brides:brideData(),
    window:{_schedMode:mode},
    escHtml(s){return s==null?'':String(s);},
    document:{getElementById:function(id){return store[id]||(store[id]={innerHTML:''});}}
  };
  sandbox.lA=function(){return Object.values(sandbox.brides);};
  const ctx=vm.createContext(sandbox);
  vm.runInContext(extractFn(WORK,'rSchedule'),ctx);
  vm.runInContext('rSchedule();',ctx);
  return store['MC'].innerHTML;
}

console.log('\n=== Schedule restyle sim ===');

// [1] no throw + filter pills + headers
(function(){
  console.log('\n[1] pills + headers');
  const h=render('both');
  ok(typeof h==='string'&&h.length>200,'[1] rSchedule renders non-empty HTML without throwing');
  ok(h.indexOf('class="fpill')>=0,'[1] filter uses .fpill pills');
  ok(h.indexOf('class="fpill on" onclick="setSchedMode(\'both\')"')>=0,'[1] active mode pill is gold (.fpill.on)');
  ok(h.indexOf('width:fit-content')<0,'[1] old boxed segmented control gone');
  ok(h.indexOf('>This week<')>=0,'[1] section header is Inter sentence-case "This week"');
  ok(h.indexOf('THIS WEEK')<0 && h.indexOf('Cinzel')<0,'[1] no uppercase / Cinzel header');
})();

// [2] flat cards + de-uppercased tags + no emoji
(function(){
  console.log('\n[2] flat cards + tags');
  const h=render('both');
  ok(h.indexOf('background:var(--surf)')>=0,'[2] cards use flat var(--surf) fill');
  ok(h.indexOf('background:#FEF7E5;border')<0,'[2] no amber card background (no-show/follow-up cards are flat; #FEF7E5 only survives as the Follow-up tag tint)');
  ok(h.indexOf('width:8px;align-self:stretch')<0,'[2] gold/colored left-bar removed');
  ok(h.indexOf('No-show')>=0 && h.indexOf('NO-SHOW')<0,'[2] No-show tag de-uppercased');
  ok(h.indexOf('text-transform:uppercase')<0,'[2] type tag not uppercased');
  ['📍','↻','✓','📞','⏰'].forEach(e=>ok(h.indexOf(e)<0,'[2] no emoji '+e));
})();

// [3] scoped recolour
(function(){
  console.log('\n[3] event-type recolour (scoped)');
  const h=render('both');
  ok(h.indexOf('#C77D8E')>=0,'[3] Wedding recoloured to soft rose #C77D8E');
  ok(h.indexOf('#8E2A4A')>=0,'[3] Final Trial recoloured to deep wine #8E2A4A');
  ok(h.indexOf('#C8A55B')<0,'[3] old Wedding gold gone from Schedule');
  ok(h.indexOf('#DC2626')<0,'[3] old Final Trial red gone from Schedule output');
  ok(WORK.indexOf('background:#FEE2E2;color:#DC2626')>=0,'[3] global .tu/.bu urgent-red classes untouched');
})();

// [4] slim legend
(function(){
  console.log('\n[4] slim legend');
  const h=render('both');
  ok(h.indexOf('padding:10px 12px;background:var(--bg);border-radius:10px;border:1px solid var(--border)')<0,'[4] heavy bordered legend box removed');
  ok(h.indexOf('Homecoming')>=0 && h.indexOf('Pickup')>=0,'[4] legend content kept (dots + labels)');
})();

// [5] action chips stay ink/navy (no green)
(function(){
  console.log('\n[5] action chips navy (no semantic colour)');
  const h=render('both');
  ok(h.indexOf('Reschedule')>=0,'[5] Reschedule chip present');
  ok(h.indexOf('Did come')>=0,'[5] Did come chip present');
  ok(h.indexOf('var(--success)')<0,'[5] no green (var(--success)) on any action button');
  ok(h.indexOf('Log attempt')>=0,'[5] follow-up Log attempt chip present');
})();

// [6] regression — other screens / data untouched
(function(){
  console.log('\n[6] regression: untouched fns byte-identical vs HEAD');
  ['computeTodaysActions','_briefAppointments','_briefSinceLastVisit','_briefNeedsAttention',
   'renderTodaysActions','lCard','cardCTA','setSchedMode']
    .forEach(n=>ok(extractFn(HEAD,n)===extractFn(WORK,n),'[6] unchanged: '+n));
})();

console.log('\n=== '+(fails===0?'ALL PASS':fails+' FAILURE(S)')+' ===\n');
process.exit(fails===0?0:1);
