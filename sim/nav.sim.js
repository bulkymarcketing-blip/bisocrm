#!/usr/bin/env node
/*
 * Nav IA sim — Messages moved into its own "Communication" section (2nd item).
 * Proves the NAV array order/sections and that buildNav renders a Communication header
 * with Messages beneath it, while every other NAV entry + the renderer stay byte-identical.
 *
 * Run: node sim/nav.sim.js   (exit 0 = pass)
 */
const fs=require('fs');const vm=require('vm');const cp=require('child_process');const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const WORK=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const HEAD=cp.execSync('git show HEAD:index.html',{cwd:ROOT,maxBuffer:64*1024*1024}).toString();
let fails=0; function ok(c,m){if(c){console.log('  ✓ '+m);}else{console.log('  ✗ '+m);fails++;}}
function extractFn(src,name){const sig='function '+name+'(';const i=src.indexOf(sig);if(i<0)throw new Error('fn '+name);let k=src.indexOf('{',i),d=0,inS=null,esc=false,lc=false,bc=false,prev='';for(;k<src.length;k++){const c=src[k],n=src[k+1];if(lc){if(c==='\n')lc=false;continue;}if(bc){if(c==='*'&&n==='/'){bc=false;k++;}continue;}if(inS){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===inS){inS=null;prev=c;}continue;}if(c==='/'&&n==='/'){lc=true;k++;continue;}if(c==='/'&&n==='*'){bc=true;k++;continue;}if(c==='/'){if(!/[A-Za-z0-9_$)\]}'"`]/.test(prev)){k++;let cl=false;for(;k<src.length;k++){const r=src[k];if(r==='\\'){k++;continue;}if(r==='[')cl=true;else if(r===']')cl=false;else if(r==='/'&&!cl)break;}prev='/';continue;}prev=c;continue;}if(c==='\''||c==='"'||c==='`'){inS=c;prev=c;continue;}if(c==='{')d++;else if(c==='}'){d--;if(d===0)return src.slice(i,k+1);}if(!/\s/.test(c))prev=c;}throw new Error('unbalanced '+name);}
function navArr(src){const m=src.match(/const NAV=(\[[\s\S]*?\n\]);/);if(!m)throw new Error('NAV not found');return vm.runInContext('('+m[1]+')',vm.createContext({}));}

console.log('\n=== Nav IA (Messages → Communication) sim ===');

const W=navArr(WORK), H=navArr(HEAD);

// [1] NAV order + sections
(function(){
  console.log('\n[1] NAV order + sections');
  const ids=W.map(n=>n.id);
  ok(JSON.stringify(ids)===JSON.stringify(['dailyBrief','messages','pipeline','analytics','customers','schedule','quotations','invoices','finance','settings']),'[1] order: dailyBrief, messages, pipeline, …, finance, settings');
  ok(W[0].id==='dailyBrief' && W[0].sec==='Today','[1] index 0 = dailyBrief (Today)');
  ok(W[1].id==='messages' && W[1].sec==='Communication','[1] index 1 = messages (Communication)');
  ok(W[2].id==='pipeline' && W[2].sec==='Sales','[1] pipeline starts Sales');
  const fin=W.filter(n=>['quotations','invoices','finance'].includes(n.id));
  ok(fin[0].id==='quotations' && fin[0].sec==='Finance','[1] Finance group starts at quotations (sec Finance)');
  ok(W.find(n=>n.id==='invoices').sec===null,'[1] invoices continues Finance (sec null)');
  ok(W.find(n=>n.id==='finance').sec===null,'[1] finance continues Finance (sec null)');
  ok(W.find(n=>n.id==='messages').sec!=='Finance','[1] Messages no longer under Finance');
})();

// [2] every other entry unchanged vs HEAD; only messages moved + its sec changed
(function(){
  console.log('\n[2] other entries byte-identical vs HEAD');
  ok(W.length===H.length,'[2] same entry count ('+W.length+')');
  W.forEach(function(n){
    const h=H.find(x=>x.id===n.id);
    ok(h && n.lbl===h.lbl && n.ic===h.ic,'[2] '+n.id+' lbl + ic unchanged');
    if(n.id!=='messages') ok(n.sec===h.sec,'[2] '+n.id+' sec unchanged');
  });
  const hm=H.find(x=>x.id==='messages');
  ok(hm.sec===null && W[1].sec==='Communication','[2] messages sec null → Communication (only change to messages)');
})();

// [3] buildNav renders a Communication header with Messages beneath
(function(){
  console.log('\n[3] buildNav render');
  const store={};
  const sandbox={console,Object,Array,String,
    NAV:W, view:'dailyBrief', canViewPage(){return true;},
    document:{getElementById:function(id){return store[id]||(store[id]={innerHTML:''});}}
  };
  const ctx=vm.createContext(sandbox);
  vm.runInContext(extractFn(WORK,'buildNav'),ctx);
  vm.runInContext('buildNav();',ctx);
  const sn=store['SN'].innerHTML;
  ok(sn.indexOf('<div class="nav-sec">Communication</div>')>=0,'[3] Communication section header rendered');
  // Communication header immediately followed by the Messages nav-item (each item carries an onclick)
  ok(sn.indexOf('<div class="nav-sec">Communication</div><div class="nav-item" onclick="sv(\'messages\');closeSB()">Messages</div>')>=0,'[3] Messages sits directly under Communication');
  // section order: Today < Communication < Sales < Schedule < Finance < Settings
  const order=['Today','Communication','Sales','Schedule','Finance','Settings'].map(s=>sn.indexOf('>'+s+'</div>'));
  ok(order.every((v,i)=>v>=0 && (i===0||v>order[i-1])),'[3] section headers in order Today→Communication→Sales→Schedule→Finance→Settings');
  // Messages appears before Finance header (not under Finance)
  ok(sn.indexOf('>Messages</div>') < sn.indexOf('<div class="nav-sec">Finance</div>'),'[3] Messages renders above the Finance section');
  ok(store['MN'].innerHTML.indexOf('Messages')>=0,'[3] Messages still in the bottom (mobile) nav');
})();

// [4] regression — buildNav + TITLES byte-identical vs HEAD
(function(){
  console.log('\n[4] regression vs HEAD');
  ok(extractFn(HEAD,'buildNav')===extractFn(WORK,'buildNav'),'[4] buildNav byte-identical');
  ok(extractFn(HEAD,'setPT')===extractFn(WORK,'setPT'),'[4] setPT byte-identical');
  const tl=src=>src.match(/^const TITLES=\{.*\};$/m)[0];
  ok(tl(HEAD)===tl(WORK),'[4] TITLES byte-identical');
})();

console.log('\n=== '+(fails===0?'ALL PASS':fails+' FAILURE(S)')+' ===\n');
process.exit(fails===0?0:1);
