#!/usr/bin/env node
/*
 * Daily Brief render sim — Phase 4 (Today / Daily Brief redesign).
 *
 * The repo has no test harness (index.html is a single hand-maintained file),
 * and CLAUDE.md mandates a runtime sim for any JS render change. This file is
 * that harness for the Today screen; later phases (5–6) reuse and extend it.
 *
 * What it does, with NO browser and NO Firebase:
 *   1. Extracts the touched render functions + the shared _brief* vocabulary +
 *      the untouched compute helpers live from index.html (by name, brace-matched).
 *   2. Mounts them in a sandbox with a mocked DOM, localStorage and leaf utils,
 *      then renders rDailyBrief() across 6 scenarios, asserting it never throws
 *      and returns sane HTML (right markers, no undefined/NaN/[object Object],
 *      balanced angle brackets, search filtering behaves).
 *   3. Regression-diff: every function this phase did NOT touch is asserted
 *      byte-for-byte identical to git HEAD.
 *
 * Run:  node sim/dailyBrief.sim.js     (exit 0 = pass, 1 = fail)
 */
const fs = require('fs');
const vm = require('vm');
const cp = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WORK = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const HEAD = cp.execSync('git show HEAD:index.html', { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString();

let fails = 0;
function ok(cond, msg){ if(cond){ console.log('  ✓ ' + msg); } else { console.log('  ✗ ' + msg); fails++; } }

// --- String/comment/regex-aware brace matcher: returns full `function NAME(...){...}` text.
// Regex-aware so literals like /'/g (a quote inside a regex) don't desync string tracking. ---
function extractFn(src, name){
  const sig = 'function ' + name + '(';
  const i = src.indexOf(sig);
  if(i < 0) throw new Error('function not found: ' + name);
  let k = src.indexOf('{', i);
  let depth = 0, inS = null, esc = false, lineC = false, blockC = false, prev = '';
  for(; k < src.length; k++){
    const c = src[k], n = src[k + 1];
    if(lineC){ if(c === '\n') lineC = false; continue; }
    if(blockC){ if(c === '*' && n === '/'){ blockC = false; k++; } continue; }
    if(inS){ if(esc){ esc = false; } else if(c === '\\'){ esc = true; } else if(c === inS){ inS = null; prev = c; } continue; }
    if(c === '/' && n === '/'){ lineC = true; k++; continue; }
    if(c === '/' && n === '*'){ blockC = true; k++; continue; }
    if(c === '/'){
      // regex literal vs division: division only when prev token ends a value
      if(!/[A-Za-z0-9_$)\]}'"`]/.test(prev)){
        k++; let inClass = false;
        for(; k < src.length; k++){
          const rc = src[k];
          if(rc === '\\'){ k++; continue; }
          if(rc === '['){ inClass = true; }
          else if(rc === ']'){ inClass = false; }
          else if(rc === '/' && !inClass){ break; }
        }
        prev = '/'; continue;
      }
      prev = c; continue;
    }
    if(c === '\'' || c === '"' || c === '`'){ inS = c; prev = c; continue; }
    if(c === '{'){ depth++; }
    else if(c === '}'){ depth--; if(depth === 0) return src.slice(i, k + 1); }
    if(!/\s/.test(c)) prev = c;
  }
  throw new Error('unbalanced braces in: ' + name);
}
// Single-line `var NAME = '...';`
function extractVarLine(src, name){
  const m = src.match(new RegExp('^var ' + name + ' = .*;$', 'm'));
  if(!m) throw new Error('var not found: ' + name);
  return m[0];
}

// Functions/vars pulled LIVE from the working file and executed.
const LIVE_FNS = [
  // touched render functions
  'rDailyBrief', 'renderTodaysActions', 'renderNewEnquiries', 'renderApprovalRequests',
  // new shared vocabulary (Phase 5/6 reuse)
  '_apptTypeDot', '_briefMatchesQ', '_briefSection', '_briefList', '_briefEmpty', '_briefDot', '_briefMain', '_briefRow',
  // untouched compute helpers that feed the render
  'computeTodaysActions', '_briefWeddings', '_briefAppointments', '_briefSinceLastVisit',
  '_briefNeedsAttention', '_briefLastVisit', '_humanAgo', 'isQuietMode'
];
const LIVE_VARS = ['_icoWA', '_icoCall'];

function buildSource(src){
  return LIVE_VARS.map(v => extractVarLine(src, v)).join('\n') + '\n' +
         LIVE_FNS.map(f => extractFn(src, f)).join('\n');
}

// ---- Mock environment ----
const DAY = 86400000;
function isoDay(offset){ return new Date(Date.now() + offset * DAY).toISOString().slice(0, 10); }

function makeSandbox(){
  const store = {};                       // id -> innerHTML
  const els = {};
  function getEl(id){
    if(!els[id]) els[id] = { get innerHTML(){ return store[id]; }, set innerHTML(v){ store[id] = v; } };
    return els[id];
  }
  const sandbox = {
    console,
    Date, Math, Number, String, Object, Array, JSON, isNaN, parseFloat, parseInt,
    document: { getElementById: getEl },
    localStorage: { getItem(){ return null; }, setItem(){} },
    // data globals (overwritten per scenario)
    brides: {}, INTAKE: {}, REQUESTS: {}, q: '', window: {},
    _settings: {}, _role: 'owner',
    // leaf utils (mocked)
    escHtml(s){ if(s == null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); },
    escAttr(s){ if(s == null) return ''; return String(s).replace(/\\/g,'\\\\').replace(/'/g,'\\u0027').replace(/"/g,'\\u0022'); },
    fmt(iso){ try { return new Date(iso).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}); } catch(e){ return String(iso); } },
    fmtPhone(p){ return String(p || ''); },
    fR(n){ return 'Rs ' + (Number(n) || 0).toLocaleString('en-US'); },
    timeAgo(){ return '2h ago'; },
    dU(d){ if(!d) return null; return Math.floor((new Date(d).getTime() - Date.now()) / DAY); },
    qTot(items){ return (items || []).reduce((s,i) => s + (Number(i.amount) || (Number(i.qty || 1) * Number(i.price || 0))), 0); },
    invPaid(inv){ return Object.values((inv && inv.payments) || {}).reduce((s,p) => s + (Number(p.amount) || 0), 0); },
    gSet(){ return sandbox._settings; },
    currentRole(){ return sandbox._role; },
    isOwner(){ return sandbox._role === 'owner'; },
    isManager(){ return sandbox._role === 'manager'; },
    listIntake(){ return Object.values(sandbox.INTAKE || {}); },
    listPendingRequests(){ return Object.values(sandbox.REQUESTS || {}); },
    describeRequest(r){ return r && r.what ? String(r.what) : 'a request'; },
    _intakeEvents(b){ return (b && b.events) ? 'Wedding' : ''; },
    _intakeWhenLabel(){ return ''; }
  };
  return vm.createContext(sandbox);
}

// ---- Scenario data ----
function richBrides(){
  return {
    b1: { id:'b1', name:'Alice Perera', phone:'94771234567', stage:1, nextReminderAt: new Date(Date.now() - DAY).toISOString() }, // overdue follow-up
    b2: { id:'b2', name:'Bianca Silva', phone:'94772223333', appointments:{ a1:{ key:'a1', date: isoDay(0), time:'10:00', reason:'Consultation' } } }, // appt today
    b3: { id:'b3', name:'Carol Fernando', stage:3, lastActivity: new Date(Date.now() - 4*DAY).toISOString() }, // quote due
    b4: { id:'b4', name:'Dilini Jay', confirmed:true, weddingDate: isoDay(3),
          invoices:{ i1:{ items:[{amount:50000}], payments:{} } } }, // urgent payment + wedding this week
    b5: { id:'b5', name:'Erandi New', createdAt: new Date(Date.now() - 2*3600000).toISOString(), source:'WhatsApp' }, // since-last-visit new lead
    b6: { id:'b6', name:'Fiona Soon', confirmed:true, weddingDate: isoDay(14),
          appointments:{} } // needs attention: no final trial (7-21d)
  };
}

function render(ctx, src){
  vm.runInContext(src, ctx);   // (re)define functions, then render
  vm.runInContext('rDailyBrief();', ctx);
  return vm.runInContext("document.getElementById('MC').innerHTML", ctx);
}

function sane(html, label){
  ok(typeof html === 'string' && html.length > 50, label + ': returns non-empty HTML');
  ok(html.indexOf('undefined') < 0, label + ': no "undefined"');
  ok(html.indexOf('NaN') < 0, label + ': no "NaN"');
  ok(html.indexOf('[object') < 0, label + ': no "[object Object]"');
  ok(html.indexOf('`') < 0, label + ': no stray backtick (template-literal leak)');
  const lt = (html.match(/</g) || []).length, gt = (html.match(/>/g) || []).length;
  ok(lt === gt, label + ': balanced angle brackets (' + lt + '/' + gt + ')');
  ok(html.indexOf('>Today<') >= 0, label + ': renders the "Today" heading');
}

console.log('\n=== Daily Brief runtime sim ===');
const SRC = buildSource(WORK);

// A — empty / caught up
(function(){
  console.log('\n[A] empty — all caught up');
  const ctx = makeSandbox();
  const html = render(ctx, SRC);
  sane(html, 'A');
  ok(html.indexOf('caught up') >= 0, 'A: "You’re all caught up" summary');
  ok(html.indexOf('Upcoming weddings') < 0, 'A: empty weddings section hidden');
  ok(html.indexOf('This week’s appointments') < 0, 'A: empty appointments section hidden');
  // flat list primitives: rows sit on the canvas, no card surf/shadow/radius
  var lst = vm.runInContext("_briefList(['<div>x</div>','<div>y</div>'])", ctx);
  ok(lst.indexOf('var(--surf)') < 0 && lst.indexOf('box-shadow') < 0 && lst.indexOf('border-radius:12px') < 0, 'A: _briefList is flat (no card)');
  ok(lst.indexOf('border-bottom:1px solid var(--border)') >= 0, 'A: _briefList keeps the row hairline');
  var emp = vm.runInContext("_briefEmpty('x')", ctx);
  ok(emp.indexOf('var(--surf)') < 0 && emp.indexOf('box-shadow') < 0, 'A: _briefEmpty is flat (no card)');
})();

// B — owner, rich data
(function(){
  console.log('\n[B] owner — rich data');
  const ctx = makeSandbox();
  ctx.brides = richBrides();
  ctx.INTAKE = { e1:{ id:'e1', name:'Gaya Lead', phone:'94770000000', intakeAt:new Date().toISOString(), events:{wedding:{enabled:true}} } };
  ctx.REQUESTS = { r1:{ id:'r1', what:'Delete bride X', requestedBy:'manager@x', requestedAt:new Date().toISOString() } };
  const html = render(ctx, SRC);
  sane(html, 'B');
  ok(html.indexOf('need') >= 0 && html.indexOf('you today') >= 0, 'B: "N things need you today" summary');
  ok(html.indexOf('New enquiries') >= 0 && html.indexOf('Gaya Lead') >= 0, 'B: New enquiries section');
  ok(html.indexOf('Approval requests') >= 0, 'B: Approval requests section (owner)');
  ok(html.indexOf('Follow-ups') >= 0 && html.indexOf('Alice Perera') >= 0, 'B: Follow-ups task section');
  ok(html.indexOf('Appointments to confirm') >= 0 && html.indexOf('Bianca Silva') >= 0, 'B: Appointments to confirm');
  ok(html.indexOf('Quotes to send') >= 0 && html.indexOf('Carol Fernando') >= 0, 'B: Quotes to send');
  ok(html.indexOf('Payments') >= 0 && html.indexOf('Dilini Jay') >= 0, 'B: Payments task section');
  ok(html.indexOf('Upcoming weddings') >= 0, 'B: weddings section header');
  ok(html.indexOf('Needs attention') >= 0 && html.indexOf('Fiona Soon') >= 0, 'B: Needs attention');
  ok(html.indexOf('#5B7FA6') >= 0, 'B: appointment event-type dot colour present');
  ok(html.indexOf('openDetail(') >= 0 && html.indexOf('openDisp(') >= 0, 'B: row onclick actions wired');
})();

// C — manager hides approvals
(function(){
  console.log('\n[C] manager — approvals hidden');
  const ctx = makeSandbox();
  ctx._role = 'manager';
  ctx.brides = richBrides();
  ctx.REQUESTS = { r1:{ id:'r1', what:'Delete bride X', requestedAt:new Date().toISOString() } };
  const html = render(ctx, SRC);
  sane(html, 'C');
  ok(html.indexOf('Approval requests') < 0, 'C: approval requests NOT shown to manager');
  ok(html.indexOf('Follow-ups') >= 0, 'C: actions still shown to manager');
})();

// D — quiet mode
(function(){
  console.log('\n[D] quiet mode');
  const ctx = makeSandbox();
  ctx.brides = richBrides();
  ctx._settings = { quietUntil: new Date(Date.now() + 4*3600000).toISOString() };
  const html = render(ctx, SRC);
  sane(html, 'D');
  ok(html.indexOf('Quiet mode is on') >= 0, 'D: summary says quiet mode is on');
  ok(html.indexOf('Resume now') >= 0, 'D: quiet banner with resume');
  ok(html.indexOf('Follow-ups') < 0, 'D: action task sections suppressed');
})();

// E — search match
(function(){
  console.log('\n[E] search "alice"');
  const ctx = makeSandbox();
  ctx.brides = richBrides();
  ctx.q = 'alice';
  const html = render(ctx, SRC);
  sane(html, 'E');
  ok(html.indexOf('Showing matches') >= 0, 'E: "Showing matches" summary');
  ok(html.indexOf('Alice Perera') >= 0, 'E: matching row present');
  ok(html.indexOf('Bianca Silva') < 0, 'E: non-matching row filtered out');
})();

// F — search no match
(function(){
  console.log('\n[F] search "zzzz"');
  const ctx = makeSandbox();
  ctx.brides = richBrides();
  ctx.q = 'zzzz';
  const html = render(ctx, SRC);
  sane(html, 'F');
  ok(html.indexOf('No matches in today’s view') >= 0, 'F: empty-search state shown');
})();

// ---- Regression diff: untouched functions must be byte-identical to HEAD ----
// G — topbar brand mark (setPT) + calm row actions + bicon tap target
(function(){
  console.log('\n[G] brand mark + calm actions');
  // setPT: brand mark on dailyBrief only, TITLES[v] elsewhere
  const titlesLine = WORK.match(/const TITLES=\{[^;]*\};/)[0].replace('const','var');
  const el = {};
  const sctx = vm.createContext({ document:{ getElementById(){ return el; } } });
  vm.runInContext(titlesLine + '\n' + extractFn(WORK,'setPT'), sctx);
  vm.runInContext("setPT('dailyBrief')", sctx);
  ok(el.textContent === 'BISO' && el.className === 'brand-mark', 'G: setPT(dailyBrief) → BISO + brand-mark class');
  vm.runInContext("setPT('pipeline')", sctx);
  ok(el.textContent === 'Pipeline' && el.className === 'page-title', 'G: setPT(pipeline) → TITLES + page-title (other screens unchanged)');

  // calm action classes used in the Brief; .lcard-* left for Pipeline
  const ctx = makeSandbox();
  ctx.brides = richBrides();
  const html = render(ctx, SRC);
  ok(html.indexOf('class="bicon"') >= 0, 'G: WhatsApp/Call use calm .bicon');
  ok(html.indexOf('class="bact"') >= 0, 'G: Log/Create-quote use calm .bact');
  ok(html.indexOf('lcard-icon-btn') < 0 && html.indexOf('lcard-cta-btn') < 0, 'G: no heavy .lcard-* buttons in the Brief');

  // static CSS: new classes exist; .bicon keeps a ~40px tap target; brand mark is its own style
  ok(/\.bicon\{[^}]*width:40px[^}]*height:40px/.test(WORK), 'G: .bicon has a 40px tap target');
  ok(WORK.indexOf(".bact{") >= 0, 'G: .bact class defined');
  ok(/\.brand-mark\{[^}]*letter-spacing:4px/.test(WORK), 'G: .brand-mark is its own letter-spaced style');
})();

// H — filter pills (Daily Brief only)
(function(){
  console.log('\n[H] filter pills');
  function r(filter){
    const ctx = makeSandbox();
    ctx.brides = richBrides();
    ctx.INTAKE = { e1:{ id:'e1', name:'Gaya Lead', phone:'9477', intakeAt:new Date().toISOString(), events:{wedding:{enabled:true}} } };
    if(filter) vm.runInContext("window._briefFilter='"+filter+"'", ctx);
    return render(ctx, SRC);
  }
  const all = r(null);
  ok(all.indexOf('class="fpill') >= 0, 'H: filter pills render');
  ['All','Leads','Quotes','Visits'].forEach(function(l){ ok(all.indexOf('>'+l+'</button>') >= 0, 'H: pill '+l+' present'); });
  ok(all.indexOf('class="fpill on" onclick="setBriefFilter(\'all\')"') >= 0, 'H: default All pill is active (.on)');
  ok(all.indexOf('Follow-ups')>=0 && all.indexOf('Quotes to send')>=0 && all.indexOf('Payments')>=0 && all.indexOf('Upcoming weddings')>=0 && all.indexOf('New enquiries')>=0 && all.indexOf('Since last visit')>=0, 'H: All shows every section');

  const q = r('quotes');
  ok(q.indexOf('Quotes to send') >= 0, 'H: quotes shows Quotes to send');
  ok(q.indexOf('Follow-ups')<0 && q.indexOf('Appointments to confirm')<0 && q.indexOf('Payments')<0 && q.indexOf('New enquiries')<0 && q.indexOf('Needs attention')<0 && q.indexOf('Upcoming weddings')<0 && q.indexOf('This week’s appointments')<0 && q.indexOf('Since last visit')<0, 'H: quotes hides every non-Quotes section');
  ok(q.indexOf('class="fpill on" onclick="setBriefFilter(\'quotes\')"') >= 0, 'H: Quotes pill is the active (gold) one');

  const ld = r('leads');
  ok(ld.indexOf('Follow-ups')>=0 && ld.indexOf('New enquiries')>=0 && ld.indexOf('Needs attention')>=0, 'H: leads shows Follow-ups / New enquiries / Needs attention');
  ok(ld.indexOf('Quotes to send')<0 && ld.indexOf('Payments')<0 && ld.indexOf('Appointments to confirm')<0 && ld.indexOf('This week’s appointments')<0 && ld.indexOf('Since last visit')<0, 'H: leads hides non-lead sections');

  // empty state when the active filter has nothing (only a follow-up exists, filter=visits)
  const ctx2 = makeSandbox();
  ctx2.brides = { b:{ id:'b', name:'Solo Lead', phone:'9477', stage:1, nextReminderAt:new Date(Date.now()-DAY).toISOString() } };
  vm.runInContext("window._briefFilter='visits'", ctx2);
  const ev = render(ctx2, SRC);
  ok(ev.indexOf('Nothing under Visits today') >= 0, 'H: empty filter shows quiet "Nothing under Visits today"');
  ok(ev.indexOf('var(--surf)') < 0, 'H: empty filter state is not a boxed card');
  ok(/\.fpill\.on\{[^}]*background:var\(--gold\)/.test(WORK), 'H: .fpill.on active state is gold');
})();

// I — Pipeline unaffected: renderTodaysActions (no arg / 'all') byte-identical to HEAD
(function(){
  console.log('\n[I] Pipeline action widget — HEAD-identical after the Phase-5 stage relabel');
  const ctx = makeSandbox();
  ctx.brides = richBrides();
  vm.runInContext(SRC, ctx);
  const headFn = extractFn(HEAD,'renderTodaysActions')
    .replace('function renderTodaysActions(actions, filter)','function renderTodaysActions_HEAD(actions, filter)')
    .replace('function renderTodaysActions(actions)','function renderTodaysActions_HEAD(actions)');
  vm.runInContext(headFn, ctx);
  const out = vm.runInContext("(function(){var a=computeTodaysActions();return [renderTodaysActions(a), renderTodaysActions(a,'all'), renderTodaysActions_HEAD(a)];})()", ctx);
  // Phase 5 relabels only the Quotes-to-send copy; everything else stays byte-identical.
  const relabel = function(x){ return x.replace(/Consultation (\d+d ago)/g,'Visited $1').replace('consultation done','visited'); };
  ok(out[0] === relabel(out[2]), 'I: renderTodaysActions(actions) [no arg, as Pipeline calls] === HEAD after stage relabel');
  ok(out[1] === relabel(out[2]), "I: renderTodaysActions(actions,'all') === HEAD after stage relabel");
})();

// W — wedding-nears feature: 60d window, surface only when outstanding, milestone band, balance colour.
(function(){
  console.log('\n[W] upcoming weddings (60d window + outstanding gate + bands)');
  var paidInv  = {i:{items:[{amount:100000}],payments:{p:{amount:100000}}}}; // due 100k, paid 100k -> balance 0
  var oweInv   = {i:{items:[{amount:100000}],payments:{p:{amount:40000}}}};   // balance 60k
  var ftAppt   = {t:{reason:'Final Trial',date:isoDay(2)}};
  function bride(id,off,inv,appts){return {id:id,name:id,confirmed:true,weddingDate:isoDay(off),invoices:inv,appointments:appts||{}};}
  function wHtml(b){ const ctx=makeSandbox(); ctx.brides={x:b}; return render(ctx, SRC); }
  // Slice ONLY the "Upcoming weddings" section (it precedes "This week’s appointments")
  // so a Final-Trial appt surfacing the bride in the appointments section can't false-match.
  function wSec(b){ var h=wHtml(b); var i=h.indexOf('Upcoming weddings'); if(i<0) return ''; var j=h.indexOf('This week’s appointments', i); return h.slice(i, j<0?h.length:j); }

  // included / excluded (scoped to the weddings section)
  ok(wSec(bride('W5paid',5,paidInv,ftAppt)).indexOf('W5paid')>=0,'[W] 5d paid+trial INCLUDED (<=7 always)');
  ok(wSec(bride('W13paid',13,paidInv,ftAppt)).indexOf('W13paid')<0,'[W] 13d paid+trial EXCLUDED (nothing outstanding)');
  ok(wSec(bride('W13bal',13,oweInv,ftAppt)).indexOf('W13bal')>=0,'[W] 13d balance>0 INCLUDED');
  ok(wSec(bride('W28nt',28,paidInv,{})).indexOf('W28nt')>=0,'[W] 28d trial MISSING INCLUDED');
  ok(wSec(bride('W55bal',55,oweInv,ftAppt)).indexOf('W55bal')>=0,'[W] 55d balance>0 INCLUDED');
  ok(wSec(bride('W50paid',50,paidInv,ftAppt)).indexOf('W50paid')<0,'[W] 50d paid+trial EXCLUDED');
  ok(wSec(bride('W65bal',65,oweInv,ftAppt)).indexOf('W65bal')<0,'[W] 65d EXCLUDED (outside 60d window)');

  // band labels (within the weddings section)
  ok(wSec(bride('W5paid',5,paidInv,ftAppt)).indexOf('This week')>=0,'[W] 5d band "This week"');
  ok(wSec(bride('W13bal',13,oweInv,ftAppt)).indexOf('2 weeks')>=0,'[W] 13d band "2 weeks"');
  ok(wSec(bride('W28nt',28,paidInv,{})).indexOf('1 month')>=0,'[W] 28d band "1 month"');
  ok(wSec(bride('W55bal',55,oweInv,ftAppt)).indexOf('2 months')>=0,'[W] 55d band "2 months"');

  // balance colour: red only when imminent (<=7d), amber otherwise
  ok(wSec(bride('W5bal',5,oweInv,ftAppt)).indexOf('color:var(--danger)">Balance')>=0,'[W] 5d balance shown RED (<=7d)');
  var s13=wSec(bride('W13bal',13,oweInv,ftAppt));
  ok(s13.indexOf('color:var(--warn)">Balance')>=0,'[W] 13d balance shown AMBER (>7d)');
  ok(s13.indexOf('color:var(--danger)">Balance')<0,'[W] 13d balance NOT red');
  ok(wSec(bride('W55bal',55,oweInv,ftAppt)).indexOf('color:var(--warn)">Balance')>=0,'[W] 55d balance shown AMBER');

  // section title + guard
  ok(wHtml(bride('W5paid',5,paidInv,ftAppt)).indexOf('Upcoming weddings')>=0,'[W] section title "Upcoming weddings"');
  var canc={id:'Wcanc',name:'Wcanc',confirmed:true,cancelled:true,weddingDate:isoDay(10),invoices:oweInv,appointments:{}};
  ok(wSec(canc).indexOf('Wcanc')<0,'[W] cancelled bride never appears');
  var unconf={id:'Wunc',name:'Wunc',confirmed:false,weddingDate:isoDay(10),invoices:oweInv,appointments:{}};
  ok(wSec(unconf).indexOf('Wunc')<0,'[W] unconfirmed bride never appears');
})();

console.log('\n[REGRESSION] untouched functions vs git HEAD');
const UNTOUCHED = [
  // _briefWeddings intentionally NOT pinned — the wedding-nears feature (60d window + outstanding/band)
  // legitimately edits it; the [W] scenarios below are its behavioral authority.
  'computeTodaysActions', '_briefAppointments', '_briefSinceLastVisit',
  '_briefNeedsAttention', '_briefLastVisit', '_humanAgo', 'isQuietMode', 'setQuietMode',
  'toggleActionGroup', 'openQuietPicker', 'applyQuiet', 'resumeReminders',
  'listIntake', 'listPendingRequests', 'describeRequest', '_intakeEvents', '_intakeWhenLabel',
  'acceptIntake', 'dismissIntake', 'escHtml', 'escAttr', 'escHtmlMultiline', 'timeAgo',
  'approveReqUI', 'rejectReqUI'
];
UNTOUCHED.forEach(function(name){
  const a = extractFn(HEAD, name), b = extractFn(WORK, name);
  ok(a === b, 'unchanged: ' + name);
});

console.log('\n=== ' + (fails === 0 ? 'ALL PASS' : fails + ' FAILURE(S)') + ' ===\n');
process.exit(fails === 0 ? 0 : 1);
