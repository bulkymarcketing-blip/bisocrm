#!/usr/bin/env node
/*
 * Detail view restyle sim — Phase 8 PART 1 (Overview tab + Payment tab + stage CTA + 2 CSS tweaks).
 * Mounts buildOverviewTab / buildPaymentTab / buildStageCta on a mocked DOM + leads and proves
 * the warm-flat rebuild while the act-now reds stay where they belong:
 *
 *  - buildOverviewTab: no '✎'; cancelled lockNote is a NEUTRAL box (no var(--danger)/#FEF2F2);
 *    event boxes are var(--surf)+1px (not var(--bg)+1.5px); "Bride info" sentence-case;
 *  - buildPaymentTab: var(--danger) ONLY in the <=7-day overdue attention card; summary box var(--surf),
 *    summary labels NOT uppercase; quote/invoice badges are .tag-family (ts/twg/ti), UNPAID -> ti (de-redded);
 *  - buildStageCta: WhatsApp button is btn-primary, NO btn-gold anywhere in its output;
 *  - .stitle CSS: navy, no border-bottom;  .pf CSS: solid var(--success), no gold/gradient;
 *  - logic parity: brideTotal/brideCollected/brideOutstanding + the stage-CTA branch match an independent recompute;
 *  - regression: openDetail, the Part-2 build tabs, nextActionLabel, evTrue, the helpers + every other r* byte-identical.
 *
 * Run: node sim/detail.sim.js   (exit 0 = pass)
 */
const fs=require('fs');const vm=require('vm');const cp=require('child_process');const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const WORK=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const HEAD=cp.execSync('git show HEAD:index.html',{cwd:ROOT,maxBuffer:64*1024*1024}).toString();
let fails=0; function ok(c,m){if(c){console.log('  ✓ '+m);}else{console.log('  ✗ '+m);fails++;}}
function extractFn(src,name){const sig='function '+name+'(';const i=src.indexOf(sig);if(i<0)throw new Error('fn '+name);let k=src.indexOf('{',i),d=0,inS=null,esc=false,lc=false,bc=false,prev='';for(;k<src.length;k++){const c=src[k],n=src[k+1];if(lc){if(c==='\n')lc=false;continue;}if(bc){if(c==='*'&&n==='/'){bc=false;k++;}continue;}if(inS){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===inS){inS=null;prev=c;}continue;}if(c==='/'&&n==='/'){lc=true;k++;continue;}if(c==='/'&&n==='*'){bc=true;k++;continue;}if(c==='/'){if(!/[A-Za-z0-9_$)\]}'"`]/.test(prev)){k++;let cl=false;for(;k<src.length;k++){const r=src[k];if(r==='\\'){k++;continue;}if(r==='[')cl=true;else if(r===']')cl=false;else if(r==='/'&&!cl)break;}prev='/';continue;}prev=c;continue;}if(c==='\''||c==='"'||c==='`'){inS=c;prev=c;continue;}if(c==='{')d++;else if(c==='}'){d--;if(d===0)return src.slice(i,k+1);}if(!/\s/.test(c))prev=c;}throw new Error('unbalanced '+name);}
function cssBlock(src){const a=src.indexOf('<style>');const b=src.indexOf('</style>',a);return src.slice(a,b);}
function cssRule(css,sel){const i=css.indexOf(sel);if(i<0)return null;const j=css.indexOf('}',i);return j<0?null:css.slice(i,j+1);}
function iso(off){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+off);return d.toISOString().slice(0,10);}
const SOON=iso(5), FAR=iso(200);

// ---- mocked leads ----
function lead0(){return {id:'l0',name:'New Lead',stage:0,phone:'+94 77 123 4567',email:'',events:{}};}
function confirmedSoon(){return {id:'lc',name:'Bride C',confirmed:true,weddingDate:SOON,
  events:{wedding:{enabled:true,date:SOON}},appointments:{},
  invoices:{i1:{id:'BI-1',date:'2026-06-01',items:{a:{qty:1,unit:200000,disc:0}},advance:100000,payments:{}}}};}
function cancelledBride(){return {id:'lx',name:'Bride X',cancelled:true,cancelReason:'Changed plans',refundAmount:50000,
  invoices:{i1:{id:'BI-2',date:'2026-05-01',items:{a:{qty:1,unit:100000,disc:0}},advance:60000,payments:{}}}};}
function paidUnpaid(){return {id:'lp',name:'Bride P',confirmed:true,weddingDate:FAR,appointments:{},
  quotations:{q1:{id:'BQ-1',date:'2026-05-01',items:{a:{qty:1,unit:50000,disc:0}},convertedToInvoice:false},
              q2:{id:'BQ-2',date:'2026-05-02',items:{a:{qty:1,unit:60000,disc:0}},convertedToInvoice:true}},
  invoices:{ip:{id:'BI-PAID',date:'2026-05-01',items:{a:{qty:1,unit:100000,disc:0}},advance:100000,payments:{}},
            iu:{id:'BI-UNPAID',date:'2026-05-02',items:{a:{qty:1,unit:80000,disc:0}},advance:0,payments:{}}}};}
// Appts cover every bucket (distinct reasons); upcoming-soon vs PAST scheduled; notes incl. an edited one; docs of each type.
function apptLead(){return {id:'la',name:'Appt Bride',stage:2,
  appointments:{
    kUp:{key:'kUp',reason:'Trial',date:iso(3)},                                  // upcoming (<=7d) -> amber
    kPast:{key:'kPast',reason:'Final Trial',date:iso(-2)},                        // PAST un-actioned scheduled -> red
    kNo:{key:'kNo',reason:'Fitting',date:iso(-5),noShow:true},
    kDone:{key:'kDone',reason:'Pickup',date:iso(-10),done:true,doneAt:iso(-10)},
    kResch:{key:'kResch',reason:'Consultation',date:iso(-3),rescheduled:true,rescheduledTo:'kUp',rescheduleReason:'Client busy'},
    kCanc:{key:'kCanc',reason:'Fabric Appointment',date:iso(-7),cancelled:true,cancelledAt:iso(-7),cancelReason:'Not needed'}
  },
  notesLog:{n1:{id:'n1',body:'First note',createdAt:iso(-1)},
            n2:{id:'n2',body:'Edited note',createdAt:iso(-2),editedAt:iso(-1)}},
  documents:{d1:{id:'d1',name:'quote.pdf',type:'application/pdf',size:2048,uploadedAt:iso(-1)},
             d2:{id:'d2',name:'photo.jpg',type:'image/jpeg',size:1024,uploadedAt:iso(-2)},
             d3:{id:'d3',name:'misc.txt',type:'text/plain',size:512,uploadedAt:iso(-3)}}};}
function onlyAppts(map){return {id:'la',name:'A',stage:2,appointments:map};}

function ctxFor(){
  const sandbox={console,Date,Math,Number,String,Object,Array,JSON,parseFloat,parseInt,isNaN,
    brides:{}, leads:{}, // _canon returns the passed object when brides[id] is absent; leads[id] used by the rescheduled lookup
    getSources(){return [{value:'whatsapp',label:'WhatsApp'},{value:'referral',label:'Referral'}];},
    document:{getElementById:function(id){return {innerHTML:''};}}
  };
  const ctx=vm.createContext(sandbox);
  ['cLine','qTot','invPaid','invInvoiced','invCollected','invOutstanding','_canon','netHeld',
   'brideTotal','brideCollected','brideOutstanding','invCredit','brideCredit','dU','fmt','fR','escHtml','escAttr','escHtmlMultiline','evTrue',
   'buildOverviewTab','buildPaymentTab','buildStageCta','buildApptTab','buildNotesTab','buildDocsTab']
    .forEach(f=>vm.runInContext(extractFn(WORK,f),ctx));
  return ctx;
}
function ov(l,cancelled){const ctx=ctxFor();ctx.__l=l;ctx.__c=!!cancelled;return vm.runInContext('buildOverviewTab(__l.id,__l,__c)',ctx);}
function pay(l){const ctx=ctxFor();ctx.__l=l;return vm.runInContext('buildPaymentTab(__l.id,__l,!!__l.cancelled,Object.values(__l.quotations||{}),Object.values(__l.invoices||{}))',ctx);}
function cta(l){const ctx=ctxFor();ctx.__l=l;return vm.runInContext('buildStageCta(__l.id,__l)',ctx);}
function appt(l,cancelled){const ctx=ctxFor();ctx.__l=l;ctx.__c=!!cancelled;ctx.leads[l.id]=l;return vm.runInContext('buildApptTab(__l.id,__l,__c,Object.values(__l.appointments||{}))',ctx);}
function notesT(l,cancelled){const ctx=ctxFor();ctx.__l=l;ctx.__c=!!cancelled;return vm.runInContext('buildNotesTab(__l.id,__l,__c,Object.values(__l.notesLog||{}))',ctx);}
function docsT(l,cancelled){const ctx=ctxFor();ctx.__l=l;ctx.__c=!!cancelled;return vm.runInContext('buildDocsTab(__l.id,__l,__c,Object.values(__l.documents||{}))',ctx);}

console.log('\n=== Detail view restyle sim (Part 1 + Part 2) ===');

// [1] buildOverviewTab
(function(){
  console.log('\n[1] buildOverviewTab');
  const h=ov(confirmedSoon(),false);
  ok(h.indexOf('✎')<0,'[1] no ✎ glyph anywhere');
  ok(h.indexOf('Edit in Overview Form')>=0 && h.indexOf('btn-primary')>=0,'[1] "Edit in Overview Form" stays btn-primary');
  ok(h.indexOf('>Bride info<')>=0 && h.indexOf('>Bride Info<')<0,'[1] "Bride info" sentence-case');
  ok(h.indexOf('background:var(--surf);border:1px solid var(--border);border-radius:8px;padding:10px 12px')>=0,'[1] event box var(--surf)+1px');
  ok(h.indexOf('background:var(--bg);border:1.5px solid var(--border);border-radius:8px;padding:10px 12px')<0,'[1] no old var(--bg)+1.5px event box');
  // cancelled lockNote is a neutral box
  const hc=ov(cancelledBride(),true);
  ok(hc.indexOf('Booking cancelled')>=0 && hc.indexOf('Reason: Changed plans')>=0,'[1] cancelled note keeps its text');
  ok(hc.indexOf('Refund issued: Rs 50,000')>=0 && hc.indexOf('Still held: Rs 60,000')>=0,'[1] cancelled note keeps refund + held');
  ok(hc.indexOf('var(--danger)')<0 && hc.indexOf('#FEF2F2')<0 && hc.indexOf('#FECACA')<0,'[1] cancelled note de-redded (no danger/#FEF2F2/#FECACA)');
  ok(hc.indexOf('background:#F4F2EC;border:1px solid var(--border)')>=0 && hc.indexOf('color:var(--text2)')>=0,'[1] cancelled note neutral box');
})();

// [2] buildPaymentTab — attention reds kept, summary + badges restyled
(function(){
  console.log('\n[2] buildPaymentTab');
  const h=pay(confirmedSoon());           // balance due, <=7 days -> OVERDUE attention (red kept)
  ok(h.indexOf('OVERDUE - PAY NOW')>=0 && h.indexOf('var(--danger)')>=0,'[2] <=7-day overdue attention keeps var(--danger)');
  ok(h.indexOf('border-radius:12px')>=0 && h.indexOf('border:1px solid #FCA5A5')>=0,'[2] attention card aligned to 1px + radius 12px');
  // summary box
  ok(h.indexOf('background:var(--surf);border:1px solid var(--border);border-radius:10px')>=0,'[2] summary box var(--surf)+1px');
  ok(h.indexOf('text-transform:uppercase')<0,'[2] summary labels not uppercase');
  ok(h.indexOf('>Total<')>=0 && h.indexOf('>Balance<')>=0,'[2] Total / Balance labels kept');
  ok(h.indexOf('class="pb"')>=0 && h.indexOf('class="pf"')>=0,'[2] .pb/.pf bar kept');
  // partial invoice (200k invoiced, 100k paid)
  ok(h.indexOf('<span class="tag twg">PARTIAL</span>')>=0,'[2] partial invoice -> tag twg');
  ok(h.indexOf('class="badge')<0,'[2] no legacy .badge spans');
  // paid + unpaid bride: no attention, UNPAID de-redded
  const h2=pay(paidUnpaid());
  ok(h2.indexOf('var(--danger)')<0,'[2] no var(--danger) anywhere when nothing is act-now');
  ok(h2.indexOf('<span class="tag ts">PAID</span>')>=0,'[2] paid invoice -> tag ts');
  ok(h2.indexOf('<span class="tag ti">UNPAID</span>')>=0,'[2] unpaid invoice -> tag ti (neutral, de-redded)');
  ok(h2.indexOf('<span class="tag ti">Open</span>')>=0,'[2] open quote -> tag ti');
  ok(h2.indexOf('<span class="tag ts">Invoiced</span>')>=0,'[2] converted quote -> tag ts');
  ok(h2.indexOf('background:var(--surf);border:1px solid var(--border);border-radius:8px')>=0,'[2] quote/invoice rows var(--surf)+1px');
  ok(h2.indexOf('+ Add payment')>=0 && h2.indexOf('+ Add Payment')<0,'[2] "+ Add payment" sentence-case');
})();

// [3] buildStageCta — WhatsApp de-golded
(function(){
  console.log('\n[3] buildStageCta');
  const h=cta(lead0());
  ok(h.indexOf('btn-gold')<0,'[3] no btn-gold anywhere in the CTA output');
  ok(h.indexOf('btn btn-primary btn-sm')>=0 && h.indexOf('wa.me')>=0,'[3] WhatsApp button is btn-primary');
  ok(h.indexOf('btn btn-outline btn-sm')>=0,'[3] Call stays btn-outline');
})();

// [4] CSS tweaks
(function(){
  console.log('\n[4] CSS tweaks');
  const st=cssRule(cssBlock(WORK),'.stitle{');
  ok(st && st.indexOf('color:var(--navy)')>=0,'[4] .stitle is navy');
  ok(st && st.indexOf('border-bottom')<0 && st.indexOf('padding-bottom')<0,'[4] .stitle dropped border-bottom + padding-bottom');
  const pf=cssRule(cssBlock(WORK),'.pf{');
  ok(pf && pf.indexOf('background:var(--success)')>=0,'[4] .pf solid var(--success)');
  ok(pf && pf.indexOf('linear-gradient')<0 && pf.indexOf('var(--gold)')<0,'[4] .pf no gold / no gradient');
})();

// [5] logic parity — money + stage-CTA branch selection
(function(){
  console.log('\n[5] logic parity');
  const ctx=ctxFor();ctx.__l=confirmedSoon();
  const tot=vm.runInContext('brideTotal(__l)',ctx);
  const coll=vm.runInContext('brideCollected(__l)',ctx);
  const out=vm.runInContext('brideOutstanding(__l)',ctx);
  ok(tot===200000 && coll===100000 && out===100000,'[5] brideTotal/Collected/Outstanding = 200000/100000/100000');
  // stage-CTA branch selection
  function ctaOf(l){const c=ctxFor();c.__l=l;return vm.runInContext('buildStageCta(__l.id,__l)',c);}
  ok(ctaOf({id:'a',stage:0,phone:'+94770000000'}).indexOf('WhatsApp')>=0,'[5] stage 0 + phone -> WhatsApp branch');
  ok(ctaOf({id:'a',stage:0}).indexOf('Mark Contacted')>=0,'[5] stage 0 no phone -> Mark Contacted fallback');
  ok(ctaOf({id:'a',stage:1}).indexOf('Book Consultation')>=0,'[5] stage 1 -> Book Consultation');
  ok(ctaOf({id:'a',stage:2}).indexOf('Mark Consultation Done')>=0,'[5] stage 2 -> Mark Consultation Done');
  ok(ctaOf({id:'a',stage:3}).indexOf('Create Quotation')>=0,'[5] stage 3 -> Create Quotation');
  ok(ctaOf({id:'a',stage:4,quotations:{q:{id:'BQ-9',convertedToInvoice:false}}}).indexOf('Convert to Invoice')>=0,'[5] stage 4 + open quote -> Convert to Invoice');
  ok(ctaOf({id:'a',confirmed:true})==='','[5] confirmed -> no CTA');
})();

// [6] buildApptTab
(function(){
  console.log('\n[6] buildApptTab');
  const h=appt(apptLead(),false);
  ok(h.indexOf('✓')<0 && h.indexOf('↻')<0 && h.indexOf('⚠')<0,'[6] no ✓/↻/⚠ glyphs anywhere');
  ok(h.indexOf('1.5px')<0,'[6] no 1.5px borders remain');
  // scheduled date proximity colour: red ONLY for past; amber (never red) for upcoming <=7d
  const past=appt(onlyAppts({k:{key:'k',reason:'X',date:iso(-2)}}),false);
  ok(past.indexOf('color:var(--danger)')>=0,'[6] PAST un-actioned scheduled date -> var(--danger)');
  const up=appt(onlyAppts({k:{key:'k',reason:'X',date:iso(3)}}),false);
  ok(up.indexOf('color:var(--warn)')>=0 && up.indexOf('var(--danger)')<0,'[6] upcoming <=7d -> var(--warn), never red');
  // no-show: calm box + tag twg, no solid amber badge
  ok(h.indexOf('<span class="tag twg">No-show</span>')>=0,'[6] no-show -> tag twg "No-show"');
  ok(h.indexOf('#FEF7E5')<0 && h.indexOf('background:var(--warn);color:#fff')<0,'[6] no amber fill / solid NO-SHOW badge');
  // completed: calm box + tag ts "Done", no ✓
  ok(h.indexOf('<span class="tag ts">Done</span>')>=0,'[6] completed -> tag ts "Done"');
  // action-button colour overrides dropped (Complete / Did come / No-show)
  ok(h.indexOf('var(--success)')<0,'[6] no var(--success) literal (Complete/Did-come/Completed all de-coloured)');
  ok(h.indexOf('border-color:var(--success)')<0,'[6] no green border-color override on buttons');
  ok(h.indexOf('padding:4px 8px;color:var(--warn)')<0,'[6] No-show button has no amber colour override');
  // add form
  ok(h.indexOf('text-transform:uppercase')<0,'[6] add-form label not uppercase');
  ok(h.indexOf('>Schedule appointment<')>=0 && h.indexOf('Schedule Appointment')<0,'[6] "Schedule appointment" sentence-case');
  ok(h.indexOf('+ Add appointment')>=0 && h.indexOf('+ Add Appointment')<0,'[6] "+ Add appointment"');
  ok(h.indexOf('>Needs attention<')>=0,'[6] "Needs attention" sentence-case (keeps amber)');
  // every box is var(--surf)+1px
  ok(h.indexOf('background:var(--bg);border:1px')<0 && h.indexOf('background:var(--bg);border:1.5px')<0,'[6] no var(--bg) boxes in appt tab');
})();

// [7] buildApptTab — bucket parity (each appt lands in its section)
(function(){
  console.log('\n[7] appt bucket parity');
  const h=appt(apptLead(),false);
  function between(s,a,b){const i=s.indexOf(a);const j=b?s.indexOf(b,i):s.length;return s.slice(i,j<0?s.length:j);}
  const needs=between(h,'>Needs attention<','>Upcoming<');
  const upc=between(h,'>Upcoming<','>Completed<');
  const done=between(h,'>Completed<','>Rescheduled<');
  const resch=between(h,'>Rescheduled<','>Cancelled');
  const canc=between(h,'>Cancelled (record kept)<',null);
  ok(needs.indexOf('Fitting')>=0,'[7] no-show "Fitting" under Needs attention');
  ok(upc.indexOf('Trial')>=0 && upc.indexOf('Final Trial')>=0,'[7] both scheduled (upcoming + past) under Upcoming');
  ok(done.indexOf('Pickup')>=0,'[7] completed "Pickup" under Completed');
  ok(resch.indexOf('Consultation')>=0 && resch.indexOf('Moved to')>=0,'[7] rescheduled-source under Rescheduled (Moved to …)');
  ok(canc.indexOf('Fabric Appointment')>=0,'[7] cancelled under Cancelled (record kept)');
})();

// [8] buildNotesTab
(function(){
  console.log('\n[8] buildNotesTab');
  const h=notesT(apptLead(),false);
  ok(h.indexOf('1.5px')<0,'[8] no 1.5px borders');
  ok(h.indexOf('background:var(--surf);border:1px solid var(--border)')>=0,'[8] note + add boxes var(--surf)+1px');
  ok(h.indexOf('background:var(--bg);border')<0,'[8] add box no longer var(--bg)');
  ok(h.indexOf('style="color:var(--danger)" onclick="delNote(')>=0,'[8] Delete STILL red (intentional)');
  ok(h.indexOf('+ Add note')>=0 && h.indexOf('+ Add Note')<0,'[8] "+ Add note"');
  ok(h.indexOf('id="ne-t-n1"')>=0,'[8] inline edit textarea preserved');
})();

// [9] buildDocsTab
(function(){
  console.log('\n[9] buildDocsTab');
  const h=docsT(apptLead(),false);
  ok(h.indexOf('1.5px')<0,'[9] no 1.5px borders');
  ok(h.indexOf('>PDF<')>=0 && h.indexOf('>IMG<')>=0 && h.indexOf('>FILE<')>=0,'[9] navy icon chips PDF/IMG/FILE kept');
  ok(h.indexOf('background:var(--surf);border:1px dashed var(--border)')>=0,'[9] upload box var(--surf)+1px dashed');
  ok(h.indexOf('style="color:var(--danger)" onclick="delDoc(')>=0,'[9] Delete STILL red (intentional)');
  ok(h.indexOf('Choose file')>=0 && h.indexOf('Choose File')<0,'[9] "Choose file"');
})();

// [10] regression — Part-1 tabs, openDetail, helpers + every other r* byte-identical
(function(){
  console.log('\n[10] regression vs HEAD');
  // Part 1's surfaces stay byte-identical; Part 2 owns buildApptTab/buildNotesTab/buildDocsTab now.
  // buildPaymentTab + rInvoices intentionally NOT pinned here — P2-8 (overpayment-as-credit)
  // legitimately edits both; sim/p2-8.sim.js is the authority for those (detail.sim still RENDERS buildPaymentTab above).
  ['openDetail','buildOverviewTab','buildStageCta','nextActionLabel','evTrue',
   'brideTotal','brideCollected','brideOutstanding','netHeld','qTot','invPaid','invInvoiced','invCollected','invOutstanding','cLine','_canon',
   'fR','fmt','dU','escHtml','escAttr','getSources',
   '_briefSection','_briefList','_briefRow','_briefRowLead','_briefMain','_briefDot','_briefEmpty','computeTodaysActions',
   'renderTodaysActions','rSchedule','rQuotations','rFinance','rAnalytics',
   'aLeadSourcePerf','aConversionFunnel','rClients','rMessages','lCard','cardCTA'
  ].forEach(n=>ok(extractFn(HEAD,n)===extractFn(WORK,n),'[10] unchanged: '+n));
})();

console.log('\n=== '+(fails===0?'ALL PASS':fails+' FAILURE(S)')+' ===\n');
process.exit(fails===0?0:1);
