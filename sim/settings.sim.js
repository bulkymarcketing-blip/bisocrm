#!/usr/bin/env node
/*
 * Settings (rSettings) restyle sim — presentation only.
 * Renders each tab (invoice/prices/sources/data) on a mocked DOM and asserts the warm-flat look:
 *  - NO var(--bg) BOX backgrounds (the price input keeps a grey var(--bg) field — radius 6px — by design);
 *  - NO "1.5px"; NO "#EFF6FF"/"#BFDBFE" (de-blued Backfill card); row boxes use var(--surf)+1px;
 *  - the two "Remove" buttons use color:var(--muted), not var(--danger);
 *  - TITLES.customers === 'Profiles' and the rest of TITLES byte-identical;
 *  - regression: every Settings handler byte-identical vs HEAD.
 *
 * Run: node sim/settings.sim.js   (exit 0 = pass)
 */
const fs=require('fs');const vm=require('vm');const cp=require('child_process');const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const WORK=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const HEAD=cp.execSync('git show HEAD:index.html',{cwd:ROOT,maxBuffer:64*1024*1024}).toString();
let fails=0; function ok(c,m){if(c){console.log('  ✓ '+m);}else{console.log('  ✗ '+m);fails++;}}
function extractFn(src,name){const sig='function '+name+'(';const i=src.indexOf(sig);if(i<0)throw new Error('fn '+name);let k=src.indexOf('{',i),d=0,inS=null,esc=false,lc=false,bc=false,prev='';for(;k<src.length;k++){const c=src[k],n=src[k+1];if(lc){if(c==='\n')lc=false;continue;}if(bc){if(c==='*'&&n==='/'){bc=false;k++;}continue;}if(inS){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===inS){inS=null;prev=c;}continue;}if(c==='/'&&n==='/'){lc=true;k++;continue;}if(c==='/'&&n==='*'){bc=true;k++;continue;}if(c==='/'){if(!/[A-Za-z0-9_$)\]}'"`]/.test(prev)){k++;let cl=false;for(;k<src.length;k++){const r=src[k];if(r==='\\'){k++;continue;}if(r==='[')cl=true;else if(r===']')cl=false;else if(r==='/'&&!cl)break;}prev='/';continue;}prev=c;continue;}if(c==='\''||c==='"'||c==='`'){inS=c;prev=c;continue;}if(c==='{')d++;else if(c==='}'){d--;if(d===0)return src.slice(i,k+1);}if(!/\s/.test(c))prev=c;}throw new Error('unbalanced '+name);}
function titlesLine(src){return src.match(/^const TITLES=\{.*\};$/m)[0];}

function render(tab){
  const store={};
  const sandbox={console,Date,Math,Number,String,Object,Array,JSON,parseInt,parseFloat,isNaN,
    window:{_settingsTab:null},
    SVCS:[{d:'Bridal',c:'Wedding',b:125000,aA:true},{d:'Homecoming',c:'Homecoming',b:100000,aA:true}],
    gSet(){return {linePrices:{Bridal:130000},defaultNotes:'notes',defaultBespeaking:50000,logoUrl:'',balanceDueDays:14,bankDetails:''};},
    getCustomSvcs(){return [{d:'Saree draping',b:8000}];},
    getSources(){return [{label:'WhatsApp'},{label:'Referral'}];},
    groupMoney(v){return v==null||v===''?'':String(v);},
    defNotes(){return 'default notes';},
    escHtml(s){return s==null?'':String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');},
    document:{getElementById:function(id){return store[id]||(store[id]={innerHTML:''});}}
  };
  const ctx=vm.createContext(sandbox);
  vm.runInContext(extractFn(WORK,'rSettings'),ctx);
  vm.runInContext('rSettings('+JSON.stringify(tab)+')',ctx);
  return store['MC'].innerHTML;
}

console.log('\n=== Settings (rSettings) restyle sim ===');

const TABS=['invoice','prices','sources','data'];

// [1] every tab: no 1.5px / blue / danger / var(--bg) box
(function(){
  console.log('\n[1] per-tab clean-up');
  TABS.forEach(function(t){
    const h=render(t);
    ok(typeof h==='string'&&h.length>100,'['+t+'] renders non-empty HTML');
    ok(h.indexOf('1.5px')<0,'['+t+'] no 1.5px borders');
    ok(h.indexOf('#EFF6FF')<0 && h.indexOf('#BFDBFE')<0,'['+t+'] no blue (#EFF6FF/#BFDBFE)');
    ok(h.indexOf('color:var(--danger)')<0,'['+t+'] no var(--danger)');
    ok(h.indexOf('background:var(--bg);border:1px solid var(--border);border-radius:8px')<0,'['+t+'] no var(--bg) ROW-BOX background');
    ok(h.indexOf('background:var(--bg);border:1px solid var(--border);border-radius:10px')<0,'['+t+'] no var(--bg) CARD background');
  });
})();

// [2] prices tab — surf rows + grey input field + muted Remove
(function(){
  console.log('\n[2] prices tab');
  const h=render('prices');
  ok(h.indexOf('background:var(--surf);border:1px solid var(--border);border-radius:8px')>=0,'[2] price-override + custom rows are var(--surf)+1px');
  ok(h.indexOf('background:var(--bg);border:1px solid var(--border);border-radius:6px')>=0,'[2] price input keeps the grey var(--bg) field (by design)');
  ok(h.indexOf('style="color:var(--muted)" onclick="removeCustomSvc(')>=0,'[2] custom-service Remove is var(--muted)');
  ok(h.indexOf('Bridal')>=0 && h.indexOf('Saree draping')>=0,'[2] price + custom rows render');
})();

// [3] sources tab — surf rows + muted Remove
(function(){
  console.log('\n[3] sources tab');
  const h=render('sources');
  ok(h.indexOf('background:var(--surf);border:1px solid var(--border);border-radius:8px')>=0,'[3] source rows are var(--surf)+1px');
  ok(h.indexOf('style="color:var(--muted)" onclick="removeSrc(')>=0,'[3] source Remove is var(--muted)');
  ok(h.indexOf('WhatsApp')>=0 && h.indexOf('Referral')>=0,'[3] source rows render');
})();

// [4] data tab — de-blued Backfill card
(function(){
  console.log('\n[4] data tab');
  const h=render('data');
  ok(h.indexOf('background:var(--surf);border:1px solid var(--border);border-radius:10px')>=0,'[4] Backfill card is a flat var(--surf) card');
  ok(h.indexOf('Backfill Missing Leads')>=0 && h.indexOf('backfillLeads()')>=0,'[4] Backfill heading + button intact');
})();

// [5] TITLES.customers -> Profiles; rest unchanged
(function(){
  console.log('\n[5] TITLES');
  const w=titlesLine(WORK), hh=titlesLine(HEAD);
  ok(w.indexOf("customers:'Profiles'")>=0,'[5] TITLES.customers === Profiles');
  ok(w.indexOf("Customer Profiles")<0,'[5] old "Customer Profiles" gone');
  ok(hh.replace("customers:'Customer Profiles'","customers:'Profiles'")===w,'[5] rest of TITLES byte-identical');
})();

// [6] regression — handlers byte-identical vs HEAD
(function(){
  console.log('\n[6] regression vs HEAD');
  ['saveInvS','savePriceS','saveCustomSvcs','addCustomSvc','removeCustomSvc','readCustomSvcRows',
   'saveSrcs','addSrc','removeSrc','backfillLeads','getCustomSvcs','getSources','gSet','sSet']
    .forEach(n=>ok(extractFn(HEAD,n)===extractFn(WORK,n),'[6] unchanged: '+n));
})();

console.log('\n=== '+(fails===0?'ALL PASS':fails+' FAILURE(S)')+' ===\n');
process.exit(fails===0?0:1);
