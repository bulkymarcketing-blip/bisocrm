#!/usr/bin/env node
/*
 * Document v4 redesign sim — STYLING pass on docCSS/docLogo/parties (+ .lq/.vq
 * grand-total chrome). Verifies the restyle without a browser, and proves the
 * #5 structural logic is untouched.
 *
 *  1. Static value check on the REAL docCSS source (it is otherwise MOCKED in the
 *     render mount, because its in-string braces are exactly what the brief warns
 *     about) — asserts the v4 values landed and the old Cycle-C values are gone.
 *  2. Render scenarios via buildPDF / buildReceipt with a mocked DOM + utils and a
 *     stub docCSS: quote, invoice (paid→badges), receipt (amount box), package
 *     quote (pkglabel/pkgsub), custom-installment quote (payrows), plain legacy
 *     quote. Asserts: logo renders as <img max-height:52px> WITH logoUrl and as the
 *     Biso/BY DINUSHI text fallback WITHOUT; NO bride phone in either parties block;
 *     the .lq/.vq grand-total chrome; #5 sub-labels + custom schedule intact.
 *  3. Structural regression: byte-identical diff vs git HEAD of every structural/
 *     grouping fn we did NOT touch — proof the document structure is unchanged.
 *
 * Run: node sim/docRedesign.sim.js   (exit 0 = pass)
 */
const fs=require('fs');const vm=require('vm');const cp=require('child_process');const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const WORK=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const HEAD=cp.execSync('git show HEAD:index.html',{cwd:ROOT,maxBuffer:64*1024*1024}).toString();
let fails=0;
function ok(c,m){if(c){console.log('  ✓ '+m);}else{console.log('  ✗ '+m);fails++;}}

function extractFn(src,name){const sig='function '+name+'(';const i=src.indexOf(sig);if(i<0)throw new Error('fn '+name);let k=src.indexOf('{',i),d=0,inS=null,esc=false,lc=false,bc=false,prev='';for(;k<src.length;k++){const c=src[k],n=src[k+1];if(lc){if(c==='\n')lc=false;continue;}if(bc){if(c==='*'&&n==='/'){bc=false;k++;}continue;}if(inS){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===inS){inS=null;prev=c;}continue;}if(c==='/'&&n==='/'){lc=true;k++;continue;}if(c==='/'&&n==='*'){bc=true;k++;continue;}if(c==='/'){if(!/[A-Za-z0-9_$)\]}'"`]/.test(prev)){k++;let cl=false;for(;k<src.length;k++){const rc=src[k];if(rc==='\\'){k++;continue;}if(rc==='[')cl=true;else if(rc===']')cl=false;else if(rc==='/'&&!cl)break;}prev='/';continue;}prev=c;continue;}if(c==='\''||c==='"'||c==='`'){inS=c;prev=c;continue;}if(c==='{')d++;else if(c==='}'){d--;if(d===0)return src.slice(i,k+1);}if(!/\s/.test(c))prev=c;}throw new Error('unbalanced '+name);}
function extractVar(src,n){return src.match(new RegExp('^var '+n+'\\s*=.*;$','m'))[0];}

console.log('\n=== Document v4 redesign sim ===');

// [1] STATIC: real docCSS source carries v4 values, old values gone
(function(){
  console.log('\n[1] docCSS values (real source — mocked in the render mount)');
  const css=extractFn(WORK,'docCSS');
  const must=[
    'background:#FFFFFF','max-width:760px','padding:30px 32px','font-size:16px;line-height:1.5',
    'background:#A8862E;margin-bottom:18px',                 // topline gold
    '.bdoc .dname{font-family:\\\'Cinzel\\\',serif;font-size:32px',
    '.bdoc .pname{font-size:19px;color:#142440;font-weight:600}',
    '.bdoc .lbl{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#8A6D24',
    'border-bottom:1.5px solid #A8862E',                      // sechead gold underline
    '.bdoc .item{display:flex;justify-content:space-between;gap:16px;padding:9px 2px;border-bottom:1px solid #F0F1F4}',
    '.bdoc .item .q{display:block;font-size:13px;color:#5A6678;margin-top:2px;font-weight:400}', // non-italic, larger, darker
    '.bdoc .item .a{font-size:16px;color:#142440;white-space:nowrap;font-weight:600}',
    '.bdoc .subtot{display:flex;justify-content:space-between;padding:8px 2px 0}', // no border-top
    '.bdoc .trow.grand .lq{','.bdoc .trow.grand .vq{font-family:\\\'Cinzel\\\',serif;font-size:23px',
    '.bdoc .nh{font-size:11.5px;letter-spacing:1.5px;text-transform:uppercase;color:#586374',
    '.bdoc .nb{font-size:13px;color:#3D4758;line-height:1.5',
    '.bdoc .ftag{font-style:italic;font-size:14px;color:#8A6D24',
    // preserved live-only classes still present
    '.bdoc .pbadge{','.bdoc .amt{','.bdoc .fbank{','.bdoc .pkglabel{'
  ];
  must.forEach(s=>ok(css.indexOf(s)>=0,'has: '+s.slice(0,46)));
  const gone=['#FDFBF7','EB Garamond',"font-family:\\'Cinzel\\',serif}'\n  +'.bdoc .dsub"]; // old bg, old font, Cinzel on dsub
  ok(css.indexOf('#FDFBF7')<0,'old background #FDFBF7 gone');
  ok(css.indexOf('EB Garamond')<0,'EB Garamond gone from docCSS');
  ok(css.indexOf('.bdoc .trow.grand span{')<0,'old .trow.grand span rule replaced by .lq/.vq');
  // Cinzel only on display titles: dsub/lbl/pname/nh must NOT carry Cinzel
  ['.bdoc .dsub{','.bdoc .lbl{','.bdoc .pname{','.bdoc .nh{'].forEach(sel=>{
    const seg=css.slice(css.indexOf(sel),css.indexOf('}',css.indexOf(sel)));
    ok(seg.indexOf('Cinzel')<0,'no Cinzel on '+sel);
  });
})();

// [1b] PRINT-FILL: docCSS print override + unified @page margin
(function(){
  console.log('\n[1b] print layout (fill the page)');
  const css=extractFn(WORK,'docCSS');
  ok(css.indexOf('@media print{.bdoc{max-width:none;margin:0;padding:2px}}')>=0,'docCSS has @media print override (max-width:none;margin:0;padding:2px)');
  const pageHits=(WORK.match(/@page\{size:A4;margin:12mm 13mm\}/g)||[]).length;
  ok(pageHits===2,'both @page rules set to v4 12mm 13mm (found '+pageHits+')');
  ok(WORK.indexOf('margin:14mm 18mm')<0,'old 14mm 18mm @page gone');
  ok(WORK.indexOf('margin:12mm 15mm')<0,'old 12mm 15mm @page gone');
})();

// ---- render mount (docCSS STUBBED) ----
const MOCKS=`
  var __set={balanceDueDays:14,defaultBespeaking:50000,logoUrl:'',bankDetails:''};
  function gSet(){return __set;}
  function docCSS(){return '<style>STUB</style>';}
  function escHtml(s){return s==null?'':String(s);}
  function escAttr(s){return s==null?'':String(s);}
  function escHtmlMultiline(s){return s==null?'':String(s).replace(/\\n/g,'<br/>');}
  function fmt(s){return s?('['+s+']'):'—';}
  function dMoney(n){return 'Rs '+(Math.round(Number(n)||0));}
  function OM(){}function CM(){}
  var __store={};
  var document={getElementById:function(id){return __store[id]||(__store[id]={innerHTML:'',textContent:''});}};
`;
function mountRender(){
  const ctx=vm.createContext({console,Date,Math,Number,String,Object,Array,JSON,isNaN,parseInt,parseFloat});
  vm.runInContext(MOCKS,ctx);
  ['_CEREMONY_LABELS','_CEREMONY_ORDER'].forEach(v=>vm.runInContext(extractVar(WORK,v),ctx));
  ['cLine','qTot','invPaid','docSectionFor','docSections','docTotals','docSchedule','_docResolveDue','_docCustomSchedule','docLogo','docHeader','docFooter','docWrap','buildPDF','buildReceipt']
    .forEach(f=>vm.runInContext(extractFn(WORK,f),ctx));
  return ctx;
}
const ctx=mountRender();
function render(call){vm.runInContext(call,ctx);return vm.runInContext("document.getElementById('pdf-b').innerHTML",ctx);}
const L={name:'Alice Perera',phone:'94771234567',weddingDate:'2026-09-01',events:{wedding:{date:'2026-09-01',venue:'Galle'}}};
ctx.L=L;

// [2] quote (legacy flat)
(function(){
  console.log('\n[2] quote (legacy flat) + parties + grand-total chrome');
  ctx.Q={id:'BQ-2026-3062',date:'2026-06-09',expiry:'2026-12-31',notes:'Deposit non-refundable.',items:{
    a:{key:'a',desc:'Bridal',qty:1,unit:125000,disc:0,linkedTo:'wedding'},
    b:{key:'b',desc:'Bridesmaid',qty:3,unit:38000,disc:0,linkedTo:'bridesmaids'}}};
  const h=render("buildPDF('Q',L,Q)");
  ok(h.indexOf('QUOTATION')>=0&&h.indexOf('Prepared for')>=0&&h.indexOf('Celebration')>=0,'quote header + parties render');
  ok(h.indexOf('Alice Perera')>=0,'bride name present');
  ok(h.indexOf('94771234567')<0,'NO bride phone in parties');
  ok(h.indexOf('class="cz lq">Total')>=0&&h.indexOf('class="cz vq">')>=0,'grand-total uses .lq/.vq chrome');
  ok(h.indexOf('class="sechead"')>=0&&h.indexOf('class="item"')>=0&&h.indexOf('class="subtot"')>=0,'sections/items/subtotal render');
  ok(h.indexOf('Payment Schedule')>=0&&h.indexOf('class="ftag"')>=0,'auto schedule + tagline render');
})();

// [3] invoice (paid -> badges)
(function(){
  console.log('\n[3] invoice (paid → status badges)');
  ctx.INV={id:'BI-2026-1248',date:'2026-06-09',advance:50000,payments:{p:{amount:20000}},items:{
    a:{key:'a',desc:'Bridal',qty:1,unit:125000,disc:0,linkedTo:'wedding'}}};
  const h=render("buildPDF('I',L,INV)");
  ok(h.indexOf('INVOICE')>=0,'invoice title');
  ok(h.indexOf('class="pbadge"')>=0,'paid-status badge (.pbadge) intact');
  ok(h.indexOf('Paid to date')>=0,'invoice paid/balance totals render');
})();

// [4] receipt (amount box + balance chrome, no phone)
(function(){
  console.log('\n[4] receipt (amount box + balance)');
  ctx.RINV={id:'BI-2026-1248',advance:50000,payments:{p:{amount:50000,date:'2026-06-09',method:'Bank',receiptNo:'RC-2026-1001'}},items:{a:{key:'a',desc:'Bridal',qty:1,unit:125000,disc:0,linkedTo:'wedding'}}};
  ctx.PAY={amount:50000,date:'2026-06-09',method:'Bank',receiptNo:'RC-2026-1001'};
  const h=render("buildReceipt(L,RINV,PAY)");
  ok(h.indexOf('RECEIPT')>=0&&h.indexOf('Received from')>=0,'receipt header + parties');
  ok(h.indexOf('class="amt"')>=0&&h.indexOf('class="al"')>=0&&h.indexOf('class="av"')>=0,'receipt amount box (.amt/.al/.av) intact');
  ok(h.indexOf('class="cz lq">Balance')>=0&&h.indexOf('class="cz vq">')>=0,'receipt balance uses .lq/.vq chrome');
  ok(h.indexOf('94771234567')<0,'NO bride phone in receipt parties');
})();

// [5] package quote (#5 grouping intact)
(function(){
  console.log('\n[5] package quote (#5 sub-label intact)');
  ctx.PKG={id:'BQ-2026-3063',date:'2026-06-09',items:{
    w:{key:'w',desc:'Bridal',qty:1,unit:125000,disc:0,linkedTo:'wedding'},
    p:{key:'p',isPackage:true,desc:'Glam Add-ons',pkgCeremony:'wedding'},
    c:{key:'c',parentKey:'p',desc:'Hair',qty:1,unit:20000,disc:0,custom:true}}};
  const h=render("buildPDF('Q',L,PKG)");
  ok(h.indexOf('class="pkglabel">Glam Add-ons')>=0,'package name sub-label renders');
  ok(h.indexOf('item pkgsub')>=0&&h.indexOf('Hair')>=0,'package sub-line renders indented');
})();

// [6] custom-installment quote
(function(){
  console.log('\n[6] custom-installment quote');
  ctx.CS={id:'BQ-2026-3064',date:'2026-06-09',schedule:{mode:'custom',installments:[
    {id:'s1',label:'Deposit',amount:50000,due:{type:'confirmation'}},
    {id:'s2',label:'Balance',amount:75000,due:{type:'beforeWedding',days:30}}]},
    items:{a:{key:'a',desc:'Bridal',qty:1,unit:125000,disc:0,linkedTo:'wedding'}}};
  const h=render("buildPDF('Q',L,CS)");
  ok((h.match(/class="payrow"/g)||[]).length===2,'custom schedule renders 2 installment rows');
  ok(h.indexOf('Deposit')>=0&&h.indexOf('Balance')>=0,'installment labels render');
})();

// [7] docLogo branch: img with logoUrl, text fallback without
(function(){
  console.log('\n[7] docLogo (img with logoUrl / text fallback without)');
  ctx.__set.logoUrl='https://crm.bisobydinushi.com/logo-navy.png';
  const withImg=vm.runInContext('docLogo()',ctx);
  ok(withImg.indexOf('<img')>=0&&withImg.indexOf('max-height:52px')>=0,'logoUrl set → <img max-height:52px>');
  ok(withImg.indexOf('logo-navy.png')>=0,'img points at the configured logoUrl');
  ctx.__set.logoUrl='';
  const noImg=vm.runInContext('docLogo()',ctx);
  ok(noImg.indexOf('<img')<0&&noImg.indexOf('class="dname">Biso')>=0&&noImg.indexOf('BY DINUSHI')>=0,'no logoUrl → Biso / BY DINUSHI text fallback');
})();

// [8] structural regression — untouched fns byte-identical vs HEAD
(function(){
  console.log('\n[8] structural regression vs git HEAD (untouched fns)');
  ['docSections','docSchedule','_docCustomSchedule','_docResolveDue','docSectionFor',
   'docHeader','docFooter','docWrap','cLine','qTot','invPaid'
  ].forEach(n=>ok(extractFn(HEAD,n)===extractFn(WORK,n),'unchanged: '+n));
})();

console.log('\n=== '+(fails===0?'ALL PASS':fails+' FAILURE(S)')+' ===\n');
process.exit(fails===0?0:1);
