#!/usr/bin/env node
/*
 * Batch A sim — projection fields (#4), pipeline sort (#2), notification read-stick (#3).
 *
 *  #4 projectViews: lost/lostReason/lostAt/remindersStopped/nextReminderAt/contactAttempts carried
 *     into leads[]; rPipeline excludes lost from the active stack + counts it as closed-lost; reminder carried.
 *  #2 rPipeline sort: the five sortFns order correctly; unknown _pipeSort falls back to wedding; control renders.
 *  #3 notifications: markNotifRead hides + records _readIds; a poll returning read:false stays hidden
 *     (read re-applied); badge unchanged; markAll empties the feed.
 *
 * Run: node sim/batchA.sim.js   (exit 0 = pass)
 */
const fs=require('fs');const vm=require('vm');const cp=require('child_process');const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const WORK=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
let fails=0; function ok(c,m){if(c){console.log('  ✓ '+m);}else{console.log('  ✗ '+m);fails++;}}
function extractFn(src,name){const sig='function '+name+'(';const i=src.indexOf(sig);if(i<0)throw new Error('fn '+name);let k=src.indexOf('{',i),d=0,inS=null,esc=false,lc=false,bc=false,prev='';for(;k<src.length;k++){const c=src[k],n=src[k+1];if(lc){if(c==='\n')lc=false;continue;}if(bc){if(c==='*'&&n==='/'){bc=false;k++;}continue;}if(inS){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===inS){inS=null;prev=c;}continue;}if(c==='/'&&n==='/'){lc=true;k++;continue;}if(c==='/'&&n==='*'){bc=true;k++;continue;}if(c==='/'){if(!/[A-Za-z0-9_$)\]}'"`]/.test(prev)){k++;let cl=false;for(;k<src.length;k++){const r=src[k];if(r==='\\'){k++;continue;}if(r==='[')cl=true;else if(r===']')cl=false;else if(r==='/'&&!cl)break;}prev='/';continue;}prev=c;continue;}if(c==='\''||c==='"'||c==='`'){inS=c;prev=c;continue;}if(c==='{')d++;else if(c==='}'){d--;if(d===0)return src.slice(i,k+1);}if(!/\s/.test(c))prev=c;}throw new Error('unbalanced '+name);}
function extractDecl(src,name){const m=src.match(new RegExp('^(?:var|const) '+name.replace('$','\\$')+'\\s*=.*;$','m'));if(!m)throw new Error('decl '+name);return m[0].replace(/^const /,'var ');}
const DAY=86400000, NOW=Date.now();
const dago=n=>new Date(NOW-n*DAY).toISOString();
const din=n=>new Date(NOW+n*DAY).toISOString().slice(0,10);

console.log('\n=== Batch A sim (projection / sort / notif read-stick) ===');

// ---------------------------------------------------------------------------
// #4 — projectViews carries the new fields
(function(){
  console.log('\n[#4] projectViews field carry');
  const ctx=vm.createContext({Object,Array,Number,String,Date,Math,JSON,
    brides:{
      b1:{id:'b1',name:'Lost Lead',stage:1,createdAt:dago(20),lost:true,lostReason:'budget',lostReasonNote:'too high',lostAt:dago(2)},
      b2:{id:'b2',name:'Active Reminder',stage:1,createdAt:dago(5),nextReminderAt:dago(-1),contactAttempts:{a:{at:dago(3),outcome:'no_answer'}}},
      b3:{id:'b3',name:'Plain',stage:0,createdAt:dago(1)}
    }, leads:{}, custs:{}});
  vm.runInContext(extractFn(WORK,'projectViews'),ctx);
  vm.runInContext('projectViews();',ctx);
  const L=ctx.leads;
  ok(L.b1.lost===true,'[#4] lost:true carried into leads[]');
  ok(L.b1.lostReason==='budget' && L.b1.lostReasonNote==='too high' && L.b1.lostAt===dago(2),'[#4] lostReason/Note/At carried');
  ok(L.b3.lost===false,'[#4] non-lost bride -> lost:false (coerced)');
  ok(L.b2.nextReminderAt===dago(-1),'[#4] nextReminderAt carried');
  ok(L.b2.contactAttempts && L.b2.contactAttempts.a && L.b2.contactAttempts.a.outcome==='no_answer','[#4] contactAttempts carried');
  ok(L.b2.remindersStopped===false && L.b3.remindersStopped===false,'[#4] remindersStopped coerced to bool');
  // cust projection unchanged (no lost field leaked in)
  ok(ctx.custs.b1 && ctx.custs.b1.lost===undefined,'[#4] cust projection unchanged (no lost field)');
})();

// ---------------------------------------------------------------------------
// rPipeline harness (mirrors sim/pipeline.sim.js)
const MOCKS=`
  var q='';var _expandedCards={};var brides={};
  function lA(){return Object.values(brides);}
  function pipelineMetrics(){return {thisWeek:3,weekDelta:10,convRate:40,bookedCount:2,leadCount:5,avgResp:5,avgValue:300000,pipelineValue:840000,upcoming90:2};}
  function qTot(items){return (items||[]).reduce(function(s,i){return s+(Number(i.amount)||0);},0);}
  function dS(d){if(!d)return 0;return Math.floor((${NOW}-new Date(d).getTime())/${DAY});}
  function dU(d){if(!d)return null;var t=new Date(d);t.setHours(0,0,0,0);var n=new Date(${NOW});n.setHours(0,0,0,0);return Math.round((t-n)/86400000);}
  function fmt(s){return s?('['+String(s).slice(0,10)+']'):'TBD';}
  function fmtPhone(p){return String(p||'');}
  function escHtml(s){return s==null?'':String(s);}
  function escAttr(s){return s==null?'':String(s);}
  function isLeadOverdue(l){return !!l.__overdue;}
  function leadWedTs(l){return l.weddingDate?new Date(l.weddingDate).getTime():Infinity;}
  function overdueReason(l){return 'no follow-up scheduled';}
  function leadNeedsAttention(l){return false;}
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

// #2 — pipeline sort
(function(){
  console.log('\n[#2] pipeline sort control');
  // X='Aaa', Y='Ccc', Z='Bbb' (all stage 0, active). Distinct order per sort by design.
  const data={
    X:{id:'X',name:'Aaa',stage:0,weddingDate:din(5), createdAt:dago(10),lastActivity:dago(30),source:'whatsapp',phone:'9477'},
    Y:{id:'Y',name:'Ccc',stage:0,weddingDate:din(15),createdAt:dago(20),lastActivity:dago(2), source:'form',phone:'9477'},
    Z:{id:'Z',name:'Bbb',stage:0,weddingDate:din(25),createdAt:dago(1), lastActivity:dago(5), source:'form',phone:'9477'}
  };
  function orderFor(sort){
    const ctx=pctx();
    vm.runInContext('brides='+JSON.stringify(data)+';window._pipeStage=0;window._pipeSort='+JSON.stringify(sort)+';',ctx);
    vm.runInContext('rPipeline();',ctx);
    const h=vm.runInContext('__store["MC"].innerHTML',ctx);
    const pos={Aaa:h.indexOf('>Aaa<')>=0?h.indexOf('>Aaa<'):h.indexOf('Aaa'),Bbb:h.indexOf('Bbb'),Ccc:h.indexOf('Ccc')};
    return Object.keys(pos).sort((a,b)=>pos[a]-pos[b]); // names in render order
  }
  const expect={
    wedding:['Aaa','Ccc','Bbb'], // X,Y,Z
    active: ['Ccc','Bbb','Aaa'], // Y,Z,X
    newest: ['Bbb','Aaa','Ccc'], // Z,X,Y
    oldest: ['Ccc','Aaa','Bbb'], // Y,X,Z
    name:   ['Aaa','Bbb','Ccc']  // X,Z,Y
  };
  Object.keys(expect).forEach(function(s){
    ok(JSON.stringify(orderFor(s))===JSON.stringify(expect[s]),'[#2] '+s+' order = '+expect[s].join(','));
  });
  ok(JSON.stringify(orderFor('bogus'))===JSON.stringify(expect.wedding),'[#2] unknown _pipeSort falls back to wedding');
  // control markup present + the chosen option selected
  const ctx=pctx();
  vm.runInContext('brides='+JSON.stringify(data)+';window._pipeStage=0;window._pipeSort="newest";',ctx);
  vm.runInContext('rPipeline();',ctx);
  const h=vm.runInContext('__store["MC"].innerHTML',ctx);
  ok(h.indexOf('onchange="setPipeSort(this.value)"')>=0,'[#2] sort <select> wired to setPipeSort');
  ok(h.indexOf('<option value="newest" selected>Newest first</option>')>=0,'[#2] current sort is the selected option');
})();

// #4 (render) — rPipeline excludes lost from active + counts closed-lost
(function(){
  console.log('\n[#4] rPipeline lost handling');
  const data={
    g:{id:'g',name:'Good Active',stage:0,weddingDate:din(10),createdAt:dago(3),lastActivity:dago(1),source:'whatsapp',phone:'9477'},
    x:{id:'x',name:'Gone Lost',stage:0,weddingDate:din(8),createdAt:dago(9),lastActivity:dago(4),source:'form',lost:true,lostReason:'budget',lostAt:dago(2)}
  };
  const ctx=pctx();
  vm.runInContext('brides='+JSON.stringify(data)+';window._pipeStage=0;window._pipeSort="wedding";window._showLost=false;',ctx);
  vm.runInContext('rPipeline();',ctx);
  const h=vm.runInContext('__store["MC"].innerHTML',ctx);
  ok(h.indexOf('Good Active')>=0,'[#4] active lead renders in the stack');
  ok(h.indexOf('Gone Lost')<0,'[#4] lost lead NOT in the active stack (collapsed closed-lost)');
  ok(h.indexOf('1 closed-lost lead')>=0,'[#4] lost lead counted in closed-lost');
})();

// ---------------------------------------------------------------------------
// #3 — notification read-stick (async)
async function notifTest(){
  console.log('\n[#3] notification read-stick');
  const store={};
  let fbStore={}; // simulates /notifications/u1 on the "server"
  const sandbox={console,Object,Array,String,Number,Date,JSON,Boolean,
    window:{_auth:{enabled:true,user:{uid:'u1'}},_notif:{items:{},prefs:null,_iv:null,_readIds:{}}},
    notifIcon(){return '';}, escHtml(s){return s==null?'':String(s);}, escAttr(s){return s==null?'':String(s);}, notifAgo(){return '';},
    fbP(p,patch){ /* targeted write; not used for read-back here */ return Promise.resolve(); },
    fbG(p){ return Promise.resolve(JSON.parse(JSON.stringify(fbStore))); },
    document:{getElementById:function(id){return store[id]||(store[id]={innerHTML:'',textContent:'',classList:{_s:{},add(c){this._s[c]=1;},remove(c){delete this._s[c];},contains(c){return !!this._s[c];}}});}}
  };
  const ctx=vm.createContext(sandbox);
  ['notifUid','notifUnreadCount','notifSorted','renderNotifBadge','renderNotifList','markNotifRead','markAllNotifsRead','refreshNotifs']
    .forEach(function(f){
      var body=extractFn(WORK,f);
      if(WORK.indexOf('async function '+f+'(')>=0)body='async '+body; // extractFn drops the leading 'async '
      vm.runInContext(body,ctx);
    });
  // seed two unread
  const seed={n1:{at:'2026-06-10T00:00:00Z',title:'Alpha',read:false},n2:{at:'2026-06-09T00:00:00Z',title:'Beta',read:false}};
  ctx.window._notif.items=JSON.parse(JSON.stringify(seed));
  fbStore=JSON.parse(JSON.stringify(seed)); // server still has both unread
  vm.runInContext('renderNotifList();renderNotifBadge();',ctx);
  ok(store['NT-list'].innerHTML.indexOf('Alpha')>=0 && store['NT-list'].innerHTML.indexOf('Beta')>=0,'[#3] both unread shown initially');
  ok(store['NT-dot'].textContent==='2','[#3] badge shows 2');
  // tap n1
  await vm.runInContext('markNotifRead("n1")',ctx);
  ok(ctx.window._notif._readIds.n1===true,'[#3] markNotifRead records _readIds.n1');
  ok(store['NT-list'].innerHTML.indexOf('Alpha')<0 && store['NT-list'].innerHTML.indexOf('Beta')>=0,'[#3] tapped notification hidden from feed');
  ok(store['NT-dot'].textContent==='1','[#3] badge drops to 1');
  // poll returns the SAME items with n1.read:false (server lag) -> must stay hidden
  await vm.runInContext('refreshNotifs()',ctx);
  ok(ctx.window._notif.items.n1.read===true,'[#3] poll re-applies local read (n1 stays read)');
  ok(store['NT-dot'].textContent==='1','[#3] badge unchanged after poll (still 1)');
  // render again -> n1 still hidden
  vm.runInContext('renderNotifList();',ctx);
  ok(store['NT-list'].innerHTML.indexOf('Alpha')<0,'[#3] n1 not resurrected by the poll');
  // mark all
  await vm.runInContext('markAllNotifsRead()',ctx);
  ok(store['NT-list'].innerHTML.indexOf('No new notifications.')>=0,'[#3] markAll empties the feed');
  ok(store['NT-dot'].textContent==='','[#3] badge cleared after markAll');
  ok(ctx.window._notif._readIds.n2===true,'[#3] markAll records _readIds.n2');
}

notifTest().then(function(){
  console.log('\n=== '+(fails===0?'ALL PASS':fails+' FAILURE(S)')+' ===\n');
  process.exit(fails===0?0:1);
}).catch(function(e){console.error(e);process.exit(1);});
