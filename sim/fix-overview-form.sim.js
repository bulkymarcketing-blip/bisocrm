#!/usr/bin/env node
/*
 * Bug-fix sim — "Edit in Overview Form" layering.
 * The detail view (#detail-modal) and the Overview Form (#lead-modal) are both .overlay
 * at z-index 1000; #detail-modal sits LATER in the DOM so it painted over the form.
 * Fix: openOverviewForm() now calls CM('detail-modal') immediately before OM('lead-modal').
 *
 * This mounts the REAL openOverviewForm + real CM/OM on a mocked DOM (classList-backed),
 * opens the detail view, invokes the Edit path, and asserts:
 *   - #lead-modal is the ONLY .open overlay, and #detail-modal is closed;
 *   - CM('detail-modal') is a safe no-op when the detail view wasn't open.
 *
 * Run: node sim/fix-overview-form.sim.js   (exit 0 = pass)
 */
const fs=require('fs');const vm=require('vm');const cp=require('child_process');const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const WORK=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
let fails=0; function ok(c,m){if(c){console.log('  ✓ '+m);}else{console.log('  ✗ '+m);fails++;}}
function extractFn(src,name){const sig='function '+name+'(';const i=src.indexOf(sig);if(i<0)throw new Error('fn '+name);let k=src.indexOf('{',i),d=0,inS=null,esc=false,lc=false,bc=false,prev='';for(;k<src.length;k++){const c=src[k],n=src[k+1];if(lc){if(c==='\n')lc=false;continue;}if(bc){if(c==='*'&&n==='/'){bc=false;k++;}continue;}if(inS){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===inS){inS=null;prev=c;}continue;}if(c==='/'&&n==='/'){lc=true;k++;continue;}if(c==='/'&&n==='*'){bc=true;k++;continue;}if(c==='/'){if(!/[A-Za-z0-9_$)\]}'"`]/.test(prev)){k++;let cl=false;for(;k<src.length;k++){const r=src[k];if(r==='\\'){k++;continue;}if(r==='[')cl=true;else if(r===']')cl=false;else if(r==='/'&&!cl)break;}prev='/';continue;}prev=c;continue;}if(c==='\''||c==='"'||c==='`'){inS=c;prev=c;continue;}if(c==='{')d++;else if(c==='}'){d--;if(d===0)return src.slice(i,k+1);}if(!/\s/.test(c))prev=c;}throw new Error('unbalanced '+name);}

const OVERLAYS=['lead-modal','detail-modal','doc-modal','pdf-modal','adv-modal','einv-modal','pay-modal','resched-modal','disp-modal'];

function makeDom(){
  const els={};
  function el(id){
    if(!els[id]){
      const set=new Set();
      els[id]={ _c:set, textContent:'', innerHTML:'', style:{},
        classList:{ add(c){set.add(c);}, remove(c){set.delete(c);}, contains(c){return set.has(c);} } };
    }
    return els[id];
  }
  return {el,els,open(id){el(id).classList.add('open');},isOpen(id){return el(id).classList.contains('open');}};
}

function mount(dom){
  const sandbox={console,Date,Math,Number,String,Object,Array,JSON,
    OF:{}, brides:{b1:{id:'b1',name:'Bride',phone:'94771234567',quotes:{},events:{}}}, COUNTRIES:[],
    syncQuoteItems(){}, renderOverviewForm(){},
    document:{getElementById:dom.el},
    setTimeout(){}
  };
  const ctx=vm.createContext(sandbox);
  ['CM','OM','openOverviewForm'].forEach(f=>vm.runInContext(extractFn(WORK,f),ctx));
  return ctx;
}

console.log('\n=== Edit-in-Overview-Form layering fix sim ===');

// [1] source has the fix
(function(){
  console.log('\n[1] source');
  const fn=extractFn(WORK,'openOverviewForm');
  ok(fn.indexOf("CM('detail-modal');\n  OM('lead-modal');")>=0,'[1] CM(detail-modal) sits immediately before OM(lead-modal)');
})();

// [2] detail open -> Edit -> lead is the ONLY open overlay, detail closed
(function(){
  console.log('\n[2] detail open, then Edit');
  const dom=makeDom();
  dom.open('detail-modal');                 // detail view is showing
  ok(dom.isOpen('detail-modal'),'[2] precondition: #detail-modal open');
  const ctx=mount(dom);
  vm.runInContext("openOverviewForm('b1')",ctx);
  ok(dom.isOpen('lead-modal'),'[2] #lead-modal is open after Edit');
  ok(!dom.isOpen('detail-modal'),'[2] #detail-modal is closed after Edit');
  const openNow=OVERLAYS.filter(dom.isOpen);
  ok(openNow.length===1 && openNow[0]==='lead-modal','[2] #lead-modal is the ONLY open overlay (got: '+JSON.stringify(openNow)+')');
})();

// [3] safe no-op when detail view was never open (e.g. list-card pencil)
(function(){
  console.log('\n[3] no detail open');
  const dom=makeDom();                       // nothing open
  const ctx=mount(dom);
  vm.runInContext("openOverviewForm('b1')",ctx);
  ok(dom.isOpen('lead-modal'),'[3] #lead-modal opens normally');
  ok(!dom.isOpen('detail-modal'),'[3] #detail-modal stays closed (CM was a safe no-op)');
  const openNow=OVERLAYS.filter(dom.isOpen);
  ok(openNow.length===1 && openNow[0]==='lead-modal','[3] only #lead-modal open');
})();

console.log('\n=== '+(fails===0?'ALL PASS':fails+' FAILURE(S)')+' ===\n');
process.exit(fails===0?0:1);
