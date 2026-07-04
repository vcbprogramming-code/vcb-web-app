/**
 * ระบบบันทึกการทำงาน HR — Google Apps Script Web App (ADMIN-ENTRY edition)
 *
 * Each site's HR/admin records EVERY worker's daily log here. Mirrors the
 * monthly source workbooks: two log styles per site —
 *   • ฝ่ายสนับสนุน (support) : per-employee daily diary (date · detail · note)
 *   • ปฏิบัติการ (operation) : per-employee daily team/role + OT hours
 *
 * SETUP — paste this whole file into the bound Sheet's Apps Script as "Code.gs",
 * run SETUP once (Run menu), then Deploy ▸ New deployment ▸ Web app.
 * The script is BOUND to its Sheet, so it uses the active spreadsheet directly
 * (no Drive-by-id lookup at runtime → no permission hang / endless spinner).
 */

var PAGE_HTML_ = `<!DOCTYPE html>
<html lang="th">
<head>
  <base target="_top">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#1d4e89">
  <script>
  /* Mobile detection — runs in <head> so .is-mobile is set BEFORE first paint,
     avoiding a desktop flash on phones. We can't trust @media (max-width)
     alone because Gmail webview, Slack, Apps Script iframe wrappers, etc.
     misreport viewport at 980+ on actual phones. Belt-and-braces: any of
     three signals (UA, screen.width, innerWidth) being phone-ish flips the
     flag. Re-runs on resize/orientationchange so split-view + browser
     resizing both work. */
  (function(){
    function detect(){
      var ua = navigator.userAgent || '';
      var uaMobile = /iPhone|iPod|Android.+Mobile|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      // iPads since iPadOS 13 report MacIntel + touch — treat as mobile only
      // when screen is < 1024px so we don't downgrade large iPad Pros.
      var iPadOS = (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
      var sw = (window.screen && window.screen.width) || 0;
      var iw = window.innerWidth || 0;
      var isPhone = uaMobile || (iPadOS && sw < 1024) || sw < 768 || iw < 768;
      document.documentElement.classList.toggle('is-mobile', !!isPhone);
    }
    detect();
    window.addEventListener('resize', detect, {passive:true});
    window.addEventListener('orientationchange', detect, {passive:true});
  })();
  </script>
  <style>
:root{--blue:#1d4e89;--blue-d:#163a66;--blue-l:#2f6fb3;--bg:#eef1f6;--card:#fff;
  --line:#e1e6ee;--ink:#1f2933;--muted:#6b7785;--ok:#1f9d55;--warn:#c2410c;--weekend:#faf2ea;
  --shadow:0 1px 3px rgba(22,40,80,.06),0 1px 2px rgba(22,40,80,.04);
  /* table/row surfaces — switched in dark mode so cells auto-invert */
  --thead-bg:#eef2f8;--thead-ink:#2d3b52;
  --zebra:#fafbfd;--hover:#f1f5fa;
  --wkend-cell:#fdf6ec;--wkend-cell-alt:#faf0dc;--wkend-th-bg:#f1e6d2;--wkend-th-ink:#7a4d18;
  --sett-bg:#eef2f8;--sett-cardline:#e4e9f1;
  --input-bg:#fff;
  --dirty-bg:#fff7d6;--dirty-bd:#e7c560;--dirty-ink:#a16207;
  --saving-bg:#e7f0fb;--saving-bd:#9ec1ea;--saving-ink:#1d4e89;
  --saved-bg:#daf0e3;--saved-bd:#9ed3b3;--saved-ink:#14532b;
  --locked-a:#f5f6f8;--locked-b:#eef0f3;--locked-alt-a:#f1f3f6;--locked-alt-b:#eaecf0;--locked-ink:#6b7785;
  /* AM (morning, cool) / PM (afternoon, warm) shift tints + left edges + code badge */
  --am-tint:#f1f7ff;--am-edge:#5b8fd0;--pm-tint:#fff6ed;--pm-edge:#d98a4e;
  --jc-bg:#e7eef9;--jc-ink:#2f6fb3}
*{box-sizing:border-box}
/* Always reserve the scrollbar gutter so the layout doesn't jump sideways when
   the page grows tall enough to need a scrollbar (e.g. spinner → loaded cards). */
html{scrollbar-gutter:stable}
body{margin:0;background:var(--bg);color:var(--ink);font-size:15px;line-height:1.5;
  font-family:"Sarabun","Segoe UI",Tahoma,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--blue);text-decoration:none}
.topbar{background:linear-gradient(135deg,#1F3864 0%,#2E75B6 100%);color:#fff;
  padding:16px 30px;display:flex;gap:1.1rem;flex-wrap:wrap;
  align-items:center;position:sticky;top:0;z-index:10;box-shadow:0 2px 12px rgba(31,56,100,.25)}
.topbar .brand{font-weight:800;font-size:1.55rem;letter-spacing:.3px;color:#fff;line-height:1;text-decoration:none;cursor:pointer;transition:opacity .15s}
.topbar a.brand:hover{opacity:.8;text-decoration:none}
.topbar .brand-div{width:1px;align-self:center;height:38px;background:rgba(255,255,255,.28)}
.topbar .brand-titles{display:flex;flex-direction:column;justify-content:center;gap:2px}
.topbar .brand-t1{text-transform:uppercase;letter-spacing:1.6px;font-weight:700;font-size:.82rem;color:#fff;line-height:1.15}
.topbar .brand-t2{font-size:.8rem;color:#a9c6e6;line-height:1.15}
.topbar nav{margin-left:auto;display:flex;gap:.45rem;flex-wrap:wrap;align-items:center}
.topbar nav a{color:#fff;padding:.55rem 1.15rem;border-radius:9px;cursor:pointer;font-size:1rem;font-weight:700;
  letter-spacing:.02em;transition:background .14s,box-shadow .14s,transform .08s;
  background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18);line-height:1.2}
.topbar nav a:hover{background:rgba(255,255,255,.22);border-color:rgba(255,255,255,.32);
  box-shadow:0 2px 8px rgba(0,0,0,.18)}
.topbar nav a:active{transform:translateY(1px)}
.topbar nav a.on{background:#fff;color:var(--blue);font-weight:800;border-color:#fff;
  box-shadow:0 3px 10px rgba(0,0,0,.22),inset 0 -2px 0 rgba(29,78,137,.25)}
.topbar nav a.on:hover{background:#fff;color:var(--blue);box-shadow:0 4px 14px rgba(0,0,0,.26),inset 0 -2px 0 rgba(29,78,137,.25)}
.topbar .who{color:#cdddee;font-size:.83rem;padding-left:.3rem}
.wrap{max-width:none;margin:1rem auto;padding:0 1.1rem}
@media(min-width:1600px){.wrap{padding:0 1.8rem}}
.wrap.narrow{max-width:1120px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:1.2rem 1.3rem;margin-bottom:1.1rem;box-shadow:var(--shadow)}
h1{font-size:1.4rem;margin:.1rem 0 .25rem;font-weight:700}
h2{font-size:1.1rem;font-weight:700;margin:.2rem 0 .5rem}
.sub{color:var(--muted);font-size:.9rem;margin-bottom:.6rem}
.flash{padding:.65rem 1rem;border-radius:10px;margin-bottom:.8rem;font-size:.92rem;display:none}
.flash.ok{background:#e7f6ec;color:#13744a;border:1px solid #b7e1c4}
.flash.error{background:#fdecea;color:#b3261e;border:1px solid #f3c3bd}
.btn{display:inline-block;background:var(--blue);color:#fff;border:0;padding:.55rem 1.15rem;border-radius:9px;
  font-size:.95rem;cursor:pointer;font-family:inherit;font-weight:600;transition:background .12s,box-shadow .12s;box-shadow:0 1px 2px rgba(22,40,80,.18)}
.btn:hover{background:var(--blue-d)}
.btn.sec{background:#eef2f8;color:var(--blue);box-shadow:none;font-weight:600}
.btn.sec:hover{background:#e1e9f5}
.idx-tabs{display:flex;gap:.4rem;border-bottom:1px solid var(--line);margin-top:.2rem}
.idx-tab{appearance:none;border:0;background:transparent;font:inherit;font-weight:700;font-size:.92rem;color:var(--muted);
  padding:.55rem .9rem;cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-1px}
.idx-tab:hover{color:var(--ink)}
.idx-tab.on{color:var(--blue);border-bottom-color:var(--blue)}
.idx-toolbar{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.6rem}
.idx-actions{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-left:auto}
/* mobile: keep the toolbar buttons on ONE aligned row (not stacked) */
html.is-mobile .idx-toolbar{align-items:stretch}
html.is-mobile .idx-actions{margin-left:0;width:100%;flex-wrap:nowrap}
html.is-mobile .idx-actions .btn{flex:1 1 0;min-width:0;padding:0 .4rem;font-size:.82rem;white-space:nowrap;justify-content:center}
/* Excel import is a desktop task — hide it on mobile (export + add stay) */
html.is-mobile .idx-import{display:none}
/* import dialog: clear step-by-step guide + column order */
.imp-steps{background:#eef4fb;border:1px solid #cdddf2;border-radius:10px;padding:.6rem .75rem;font-size:.82rem;line-height:1.55;margin:0 0 .15rem}
.imp-steps>b{display:block;margin-bottom:.25rem;color:var(--blue)}
.imp-cols{margin-top:.4rem;display:flex;flex-wrap:wrap;gap:.35rem;align-items:center}
.imp-col{background:#fff;border:1px solid #cdddf2;border-radius:6px;padding:.12rem .45rem;font-size:.74rem;white-space:nowrap}
.imp-col b{color:var(--blue);margin-right:.25rem}
.imp-btnrow{display:flex;gap:.6rem;margin:.8rem 0 .1rem}
.imp-btnrow .btn{flex:1 1 0;justify-content:center;white-space:nowrap}
html.is-mobile .imp-btnrow{flex-direction:column}
body.dark .imp-steps{background:#142440;border-color:#1d3a5f}
body.dark .imp-col{background:#0f1722;border-color:#1d3a5f}
body.dark .idx-tab.on{color:#9dc4f0;border-bottom-color:#9dc4f0}
.btn:disabled{opacity:.45;cursor:default;box-shadow:none}
input,select,textarea{font-family:inherit;font-size:.92rem;padding:0 .7rem;border:1px solid var(--line);
  border-radius:8px;width:100%;background:#fff;color:var(--ink);transition:border-color .12s,box-shadow .12s;
  height:38px;box-sizing:border-box}
textarea{padding:.45rem .6rem;height:auto;min-height:38px;resize:vertical}
input:focus,select:focus,textarea:focus{outline:0;border-color:var(--blue-l);box-shadow:0 0 0 3px rgba(47,111,179,.13)}
label{font-size:.78rem;color:var(--muted);display:block;margin:0 0 .25rem;font-weight:700;letter-spacing:.02em;text-transform:uppercase}
.fld>label+div,.fld>label+input,.fld>label+select{margin:0}
table{width:100%;border-collapse:separate;border-spacing:0;font-size:.9rem;border:1px solid var(--line);border-radius:11px;overflow:hidden}
th,td{border-bottom:1px solid var(--line);border-right:1px solid var(--line);padding:.5rem .6rem;text-align:left;vertical-align:top}
th:last-child,td:last-child{border-right:0}
tr:last-child td{border-bottom:0}
th{background:#f1f5fa;font-weight:600;color:#41506a}
tbody tr:hover td{background:#f7fafd}
tr.weekend td{background:var(--weekend)}
tr.weekend:hover td{background:#f6ece1}
tr.today td{box-shadow:inset 0 0 0 2px var(--blue)}
.daycol{white-space:nowrap;font-weight:600;width:118px;color:#41506a}
.otcol{width:92px}
.pill{display:inline-block;padding:.13rem .6rem;border-radius:999px;font-size:.76rem;font-weight:600}
.pill.sup{background:#e6effb;color:var(--blue)}
.pill.op{background:#fdf0e3;color:var(--warn)}
.statrow{display:flex;gap:.7rem;flex-wrap:wrap;align-items:end;margin-bottom:.9rem}
.statrow .fld{min-width:140px;flex:0 0 auto}
.statrow .fld.grow{flex:1 1 auto}
.bar{height:7px;border-radius:5px;background:#e7ecf3;overflow:hidden;margin-top:.35rem}
.bar>i{display:block;height:100%;background:linear-gradient(90deg,#27ae60,#1f9d55);border-radius:5px}
.savebar{position:sticky;bottom:0;background:rgba(255,255,255,.96);backdrop-filter:blur(4px);
  border-top:1px solid var(--line);padding:.8rem 0;margin-top:1rem;display:flex;gap:1rem;align-items:center;z-index:5}
.center{max-width:480px;margin:6vh auto}
.muted{color:var(--muted)}
.right{text-align:right}
.hint{color:var(--muted);font-size:.78rem}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#fff;height:38px;box-sizing:border-box;flex-wrap:nowrap}
.seg button{border:0;background:#fff;padding:0 .9rem;cursor:pointer;font:inherit;font-weight:600;color:var(--muted);height:36px;font-size:.9rem;white-space:nowrap}
.seg button.on{background:var(--blue);color:#fff}
.seg button:not(:last-child){border-right:1px solid var(--line)}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.7rem;margin:.5rem 0 1.1rem}
.stat{background:linear-gradient(160deg,#fbfcfe,#f1f5fa);border:1px solid var(--line);border-radius:13px;padding:.85rem 1rem}
.stat-l{display:block;font-size:.77rem;color:var(--muted);font-weight:600}
.stat b{font-size:1.55rem;color:var(--blue);display:block;margin:.18rem 0 0}
.spinner{border:3px solid #dde3ea;border-top-color:var(--blue);border-radius:50%;width:34px;height:34px;animation:sp 1s linear infinite;margin:3rem auto}
@keyframes sp{to{transform:rotate(360deg)}}
.emp-head{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;flex-wrap:wrap}
.prog{text-align:center;background:#f1f5fa;border:1px solid var(--line);border-radius:12px;padding:.45rem 1rem;min-width:98px}
.prog b{font-size:1.55rem;color:var(--blue);display:block;line-height:1.05}
.prog span{font-size:.76rem;color:var(--muted)}
/* ----- wide month grid (admin entry) ----- */
.gridwrap{overflow:auto;max-height:calc(100vh - 200px);border:1px solid var(--line);border-radius:11px;background:var(--card);box-shadow:var(--shadow)}
table.mgrid{border-collapse:separate;border-spacing:0;font-size:.78rem;width:max-content;min-width:100%}
/* Week grid (NOT the coverage heatmap, which has up to 31 columns): use a fixed
   layout so the 7 day columns fill the width evenly (no right-gap inside cells)
   and can't be stretched by long values. min-width = horizontal-scroll floor. */
table.mgrid:not(.covgrid){width:100%;min-width:880px;table-layout:fixed}
.mgrid:not(.covgrid) thead th.emp-col{width:208px}
.mgrid th,.mgrid td{border-bottom:1px solid var(--line);border-right:1px solid var(--line);padding:.25rem .3rem;vertical-align:top;background:var(--card);position:relative}
.mgrid thead th{position:sticky;top:0;background:var(--thead-bg);z-index:2;font-weight:700;color:var(--thead-ink);text-align:center;min-width:96px;font-size:.74rem;line-height:1.15;padding:.4rem .25rem}
.mgrid thead th .dow{font-size:.7rem;font-weight:500;color:var(--muted);display:block;margin-top:1px}
.mgrid thead th.weekend{background:var(--wkend-th-bg);color:var(--wkend-th-ink)}
.mgrid thead th.today{background:var(--blue);color:#fff}
.mgrid thead th.today .dow{color:#cde0f5}
.mgrid .emp-col{position:sticky;left:0;background:var(--card);z-index:1;min-width:208px;max-width:208px;font-weight:600;color:var(--ink);font-size:.8rem}
.mgrid thead th.emp-col{z-index:3;background:var(--thead-bg);text-align:left;font-size:.78rem}
.mgrid .emp-col .emp-name{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.25;max-height:2.5em}
.mgrid .emp-col .sub{color:var(--muted);font-weight:400;font-size:.7rem;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}
.mgrid .emp-col .kpill{float:right;margin-left:.3rem;padding:.05rem .42rem;border-radius:999px;font-size:.65rem;font-weight:700}
.mgrid .emp-col .kpill.op{background:#fdf0e3;color:var(--warn)}
.mgrid .emp-col .kpill.sup{background:#e6effb;color:var(--blue)}
.mgrid tbody tr:nth-child(even) .emp-col{background:var(--zebra)}
.mgrid tbody tr:nth-child(even) td{background:var(--zebra)}
.mgrid tbody tr:hover td{background:var(--hover)}
.mgrid tbody tr:hover .emp-col{background:var(--hover)}
.mgrid td.weekend{background:var(--wkend-cell)}
.mgrid tbody tr:nth-child(even) td.weekend{background:var(--wkend-cell-alt)}
.mgrid td.today{outline:2px solid var(--blue);outline-offset:-2px;z-index:1}
.mgrid .cell input{width:100%;border:1px solid var(--line);border-radius:5px;padding:.18rem .3rem;font-size:.73rem;font-family:inherit;background:var(--input-bg);color:var(--ink);height:24px}
.mgrid .cell input:focus{outline:none;border-color:var(--blue-l);box-shadow:0 0 0 2px rgba(47,111,179,.18);position:relative;z-index:3}
.mgrid .cell .ot{margin-top:2px;width:62px;font-size:.7rem;color:var(--warn);text-align:right;height:20px}
/* Each day cell stacks an AM row + a PM row. Plain, uncolored: each row is a
   small neutral AM/PM label + an input-style display box. A FIXED slot width
   (--cellw) keeps every column the same size — long values clip with an
   ellipsis instead of stretching the column (display divs size to their text,
   unlike the old <input>s, which is why a fixed width is required). */
.mgrid .cell{padding:.25rem .3rem;font-variant-numeric:tabular-nums}
.mgrid .cell .shift{display:flex;align-items:center;gap:3px;width:100%;box-sizing:border-box}
.mgrid .cell .shift+.shift{margin-top:3px}
/* Second task = optional and HIDDEN by default so the grid is clean (one box).
   It appears only when you hover/focus that cell, or stays visible if it already
   holds a value. A filled second task uses the SAME font size as the first. */
.mgrid .cell .shift.second{display:none;margin-top:2px}
/* A 2nd task that ALREADY has a value is always shown (even on locked cells) so a
   filled second task is never hidden. The "+ งานที่ 2" ADD option appears only on a
   fillable cell AND only once the FIRST task is filled — never on hover. Live via :has. */
.mgrid td.cell:has(.shift.second .cval:not(.empty)) .shift.second{display:flex}
.mgrid td.cell:not(.locked):not(.future):has(.shift.primary .cval:not(.empty)) .shift.second{display:flex}
.mgrid .cell .shift.second .cval.empty{min-height:12px;border-style:dashed;border-color:var(--line);background:transparent;opacity:.7}
.mgrid .cell .shift.second .cval.empty::before{content:attr(data-ph);opacity:.4;font-size:.55rem;color:var(--muted)}
.mgrid .cell:hover .shift.second .cval.empty{opacity:1}
.mgrid .cell .shift input{flex:1 1 auto;min-width:0;width:100%;border:1px solid var(--line);border-radius:5px;padding:.18rem .3rem;font-size:.73rem;font-family:inherit;background:var(--input-bg);color:var(--ink);height:24px}
.mgrid .cell .shift input:focus{outline:none;border-color:var(--blue-l);box-shadow:0 0 0 2px rgba(47,111,179,.18);position:relative;z-index:3}
/* Display slot — looks like the old input box, but is a div (so it's cheap). */
.mgrid .cell .cval{flex:1 1 auto;min-width:0;min-height:24px;box-sizing:border-box;border:1px solid var(--line);border-radius:5px;padding:.18rem .3rem;font-size:.73rem;background:var(--input-bg);color:var(--ink);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.45}
.mgrid .cell .cval:hover{border-color:var(--blue-l)}
.mgrid .cell .cval:focus{outline:none;border-color:var(--blue-l);box-shadow:0 0 0 2px rgba(47,111,179,.18);position:relative;z-index:3}
.mgrid .cell .cval.empty::before{content:attr(data-ph);opacity:.4}
/* FILLED editable cells get a clear green tint so the MISSING (white) cells pop at
   a glance. Locked cells keep their hatch; empty editable cells stay plain white. */
.mgrid td.cell:not(.locked):not(.future) .cval:not(.empty){background:var(--saved-bg);border-color:var(--saved-bd);color:var(--saved-ink);font-weight:600}
/* "Click to add" affordance on empty, fillable primary cells: a faint "+" that
   brightens to "+ เลือกงาน" with a highlight on hover. Scoped away from
   locked/future/weekend cells so only truly fillable cells invite a click. */
.mgrid td.cell:not(.locked):not(.future) .cval.pe.empty::before{content:"+";opacity:.62;font-weight:700;font-size:.95rem;color:var(--blue-l)}
.mgrid td.cell:not(.locked):not(.future):hover .cval.pe.empty{border-color:var(--blue-l);background:#f1f7ff}
.mgrid td.cell:not(.locked):not(.future):hover .cval.pe.empty::before{content:"+ เลือกงาน";opacity:.75;font-weight:600;color:var(--blue);font-size:.68rem}
/* Row-hover: tint the employee name so the eye tracks one person across the week */
.mgrid tbody tr:hover td.emp-col{background:#eef4fb}
/* dirty/saving are intentionally invisible — a filled cell goes straight to the
   green "saved" confirmation (no yellow flash). Classes kept only for save logic. */
.mgrid .cell.saved .cval{background:var(--saved-bg);border-color:var(--saved-bd);color:var(--saved-ink);transition:all .8s}
.mgrid .cell.locked{background:repeating-linear-gradient(45deg,var(--locked-a),var(--locked-a) 4px,var(--locked-b) 4px,var(--locked-b) 8px)}
.mgrid tbody tr:nth-child(even) td.cell.locked{background:repeating-linear-gradient(45deg,var(--locked-alt-a),var(--locked-alt-a) 4px,var(--locked-alt-b) 4px,var(--locked-alt-b) 8px)}
.mgrid .cell.locked input{background:transparent;color:var(--locked-ink);cursor:not-allowed;border-color:transparent}
.mgrid .cell.locked .cval{background:transparent;color:var(--locked-ink);cursor:not-allowed;border-color:transparent}
.mgrid .cell.locked::after{content:"🔒";position:absolute;top:2px;right:4px;font-size:.55rem;opacity:.55;pointer-events:none}
/* retroactive-correction note (admin re-edited a locked cell): small amber TEXT */
.mgrid .cell.redited{box-shadow:inset 3px 0 0 #f59e0b}
.mgrid .cell .reditxt{margin-top:2px;font-size:.58rem;line-height:1.2;color:#b45309;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:help}
body.dark .mgrid .cell .reditxt{color:#fbbf24}
/* Future days (beyond tomorrow): plain grey "not yet", not the past-locked hatch. */
.mgrid td.cell.future,.mgrid tbody tr:nth-child(even) td.cell.future{background:#f2f5f9}
.mgrid td.cell.future .cval,.mgrid td.cell.future input{background:transparent;border-color:transparent;color:#aab3c0;cursor:not-allowed}
.mgrid td.cell.future::after{content:"";}
/* Migration: AWAY days (employee belongs to another site that day) = neutral hatch,
   non-interactive. MOVED-IN day carries a green top edge + "ย้ายเข้า" marker. */
.mgrid td.cell.away{background:repeating-linear-gradient(45deg,#eef1f5,#eef1f5 5px,#e7ebf1 5px,#e7ebf1 10px);cursor:default}
body.dark .mgrid td.cell.away{background:repeating-linear-gradient(45deg,#1a1f29,#1a1f29 5px,#1e2530 5px,#1e2530 10px)}
.mgrid td.cell.away .awaytxt{font-size:.58rem;color:#8a93a3;font-weight:700;padding:2px 3px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mgrid td.cell.movedin{box-shadow:inset 0 3px 0 #16a34a}
.mgrid td.cell .inmark{margin-top:2px;font-size:.58rem;font-weight:800;color:#15803d;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
body.dark .mgrid td.cell .inmark{color:#4ade80}
/* emp-col: per-employee migrate/remove actions (reveal on row hover) + move note */
.mgrid .emp-col .emp-acts{float:right;display:inline-flex;gap:2px;opacity:0;transition:opacity .12s}
.mgrid tbody tr:hover .emp-col .emp-acts{opacity:1}
.emp-act{border:1px solid var(--line);background:var(--card);border-radius:6px;font-size:.72rem;line-height:1;padding:2px 5px;cursor:pointer;color:var(--muted)}
.emp-act:hover{border-color:var(--blue-l);color:var(--blue)}
.mgrid .emp-col .migsub{font-size:.62rem;color:#15803d;font-weight:700;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:195px}
.mgrid .emp-col .migsub.out{color:#b45309}
.saveind{font-size:.85rem;color:var(--muted);margin-left:auto;font-weight:600;padding:.4rem .8rem;border-radius:9px;background:#f1f5fa;white-space:nowrap;min-width:148px;text-align:center;box-sizing:border-box}
.saveind.dirty{color:var(--dirty-ink);background:var(--dirty-bg)}
.saveind.saving{color:var(--saving-ink);background:var(--saving-bg)}
.saveind.saved{color:var(--saved-ink);background:var(--saved-bg)}
.saveind.error{color:#b3261e;background:#fdecea}
.viewseg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#fff;font-size:.88rem;height:38px;box-sizing:border-box;flex-wrap:nowrap}
.viewseg button{border:0;background:#fff;padding:0 .9rem;cursor:pointer;font:inherit;font-weight:600;color:var(--muted);height:36px;white-space:nowrap}
.viewseg button.on{background:var(--blue);color:#fff}
.viewseg button:not(:last-child){border-right:1px solid var(--line)}
.lockchip{display:inline-flex;align-items:center;gap:.35rem;padding:0 .9rem;border-radius:8px;border:1px solid var(--line);background:#fff;font-size:.85rem;font-weight:600;cursor:pointer;color:var(--muted);height:38px;box-sizing:border-box}
.lockchip.on{background:#fff7d6;border-color:#e7c560;color:#a16207}
.legend{display:flex;gap:1rem;font-size:.74rem;color:var(--muted);margin-top:.55rem;flex-wrap:wrap;padding-top:.5rem;border-top:1px dashed var(--line)}
.legend .sw{display:inline-block;width:12px;height:12px;border-radius:3px;border:1px solid var(--line);vertical-align:middle;margin-right:.3rem}
.weekbar{display:inline-flex;align-items:center;gap:.4rem;border:1px solid var(--line);border-radius:8px;background:#fff;padding:0 .35rem;height:38px;box-sizing:border-box}
.weekbar button{height:30px;padding:0 .55rem;font-weight:700;background:transparent;color:var(--blue);border:0;cursor:pointer;border-radius:6px;font-size:1.05rem}
.weekbar button:hover{background:#eef2f8}
.weekbar button:disabled{opacity:.3;cursor:default}
.weekbar .lbl{font-size:.88rem;font-weight:700;color:var(--ink);min-width:130px;text-align:center}
.mp-trigger{border:0;background:#fff;height:36px;padding:0 .8rem;cursor:pointer;font:inherit;font-weight:700;color:var(--ink);min-width:170px;display:inline-flex;align-items:center;justify-content:center;gap:.4rem;font-size:.92rem}
.mp-trigger:hover{background:#f1f5fa;color:var(--blue)}
.mp-caret{opacity:.55;font-size:.72rem;color:var(--muted);transition:transform .15s}
.mp-trigger:hover .mp-caret{color:var(--blue)}
.mp-pop{display:none;position:fixed;z-index:9999;background:#fff;border:1px solid var(--line);border-radius:11px;box-shadow:0 12px 32px rgba(22,40,80,.22)}
.mp-pop.open{display:block}
.mp-years{display:flex;border-bottom:1px solid var(--line);background:#f6f9fd;border-radius:11px 11px 0 0;overflow:hidden}
.mp-year{flex:1;padding:.55rem .3rem;text-align:center;font:inherit;font-weight:700;font-size:.85rem;color:var(--muted);background:transparent;border:0;cursor:pointer;border-bottom:2px solid transparent;letter-spacing:.02em}
.mp-year:hover{background:#eef4fb;color:var(--ink)}
.mp-year.on{color:var(--blue);background:#fff;border-bottom-color:var(--blue)}
.mp-months{display:grid;grid-template-columns:repeat(3,1fr);gap:.35rem;padding:.6rem}
.mp-month{padding:.55rem .3rem;text-align:center;font:inherit;font-weight:600;font-size:.84rem;color:var(--ink);background:#fafbfd;border:1px solid var(--line);border-radius:7px;cursor:pointer;transition:background .12s,color .12s}
.mp-month:hover{background:#eef4fb;color:var(--blue);border-color:#bcd2e8}
.mp-month.cur{border-color:var(--blue);color:var(--blue)}
.mp-month.on{background:var(--blue);color:#fff;border-color:var(--blue)}
.mp-month.on:hover{background:var(--blue-d);color:#fff}
.mp-month.disabled,.mp-month:disabled{color:#cbd0d8;background:#f8f9fb;border-color:#eef0f3;cursor:not-allowed;opacity:.7}
.mp-month.disabled:hover,.mp-month:disabled:hover{background:#f8f9fb;color:#cbd0d8;border-color:#eef0f3}
.fld.fld-disabled{opacity:.4;pointer-events:none;user-select:none}
.fld.fld-disabled label::after{content:" · เลือกหน่วยงานก่อน";font-weight:500;text-transform:none;font-size:.7rem;color:var(--muted);letter-spacing:0}
/* Call-to-action highlight on the site dropdown when nothing is picked yet —
   orange dashed border + soft peach fill + gentle pulse so the user's eye
   lands on it first. The class is added to the .fld wrapper. */
.fld.needs-pick label{color:var(--warn)}
.fld.needs-pick select{border:1.5px dashed var(--warn);background:#fff4e6;color:var(--warn);font-weight:700;
  box-shadow:0 0 0 3px rgba(194,65,12,.08);animation:needsPickPulse 1.8s ease-in-out infinite}
.fld.needs-pick select:hover{background:#ffe7cc}
.fld.needs-pick select:focus{animation:none;box-shadow:0 0 0 3px rgba(194,65,12,.22);outline:none}
@keyframes needsPickPulse{
  0%,100%{box-shadow:0 0 0 3px rgba(194,65,12,.08)}
  50%   {box-shadow:0 0 0 6px rgba(194,65,12,.18)}
}
body.dark .fld.needs-pick select{background:#2a1d10;color:#f4b27a;border-color:#f4b27a}
body.dark .fld.needs-pick select:hover{background:#3a2614}
body.dark .fld.needs-pick label{color:#f4b27a}
/* ----- Mobile entry view (<768px) ----- */
.m-toolbar{display:flex;flex-direction:column;gap:.6rem;padding:.6rem .8rem;background:#fff;border:1px solid var(--line);border-radius:12px;margin-bottom:.8rem;box-shadow:var(--shadow)}
.m-toolbar .fld{min-width:0}
.m-tb-row{display:flex;gap:.6rem;align-items:flex-end}
.m-tb-row .fld{flex:1 1 auto;margin:0;min-width:0}
.m-tb-row #mExport{flex:0 0 auto;justify-content:center;white-space:nowrap}
.dash-mrow{display:flex;gap:.9rem;align-items:flex-end}
/* Month picker + Excel/report button share one row with matching chip height.
   Identical sizing on dashboard + entry: month fills the left, button is a fixed
   equal width on both pages (so left widths match too). */
html.is-mobile .dash-mrow{width:100%;gap:.6rem;flex-wrap:wrap;margin-left:0}
html.is-mobile .dash-mrow .fld{flex:1 1 auto;min-width:0;max-width:none !important}
html.is-mobile .dash-mrow .fld:first-child{flex:1 1 100%}
html.is-mobile .dash-mrow .fld:last-child{flex:0 0 104px;width:104px}
html.is-mobile .m-tb-row .seg{width:100%}
html.is-mobile .m-tb-row .seg>button{flex:1 1 0}
html.is-mobile .m-tb-row #mExport{flex:0 0 104px;width:104px;justify-content:center}
html.is-mobile .dash-mrow .btn.xls-btn{width:100%;justify-content:center}
html.is-mobile .m-tb-row .seg,html.is-mobile .dash-mrow .seg{height:44px}
html.is-mobile .m-tb-row .seg button,html.is-mobile .dash-mrow .seg button{height:100%}
html.is-mobile .m-tb-row .btn.xls-btn,html.is-mobile .dash-mrow .btn.xls-btn{height:44px;min-height:44px}
.m-toolbar select,.m-toolbar input{font-size:16px;height:42px}
.m-back{display:inline-flex;align-items:center;gap:.4rem;background:none;border:0;font:inherit;color:var(--blue);cursor:pointer;padding:.4rem .2rem;font-weight:600;font-size:.95rem}
.m-back:hover{color:var(--blue-d)}
.m-emp-head{display:flex;align-items:center;gap:.8rem;padding:.8rem 1rem;background:linear-gradient(180deg,var(--site-tint,#eef2f8),#fff);border:1px solid var(--line);border-radius:12px;margin-bottom:.7rem;box-shadow:var(--shadow)}
.m-emp-avatar{width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;background:var(--site,var(--blue));font-size:1.1rem;flex:0 0 46px}
.m-emp-info{flex:1 1 auto;min-width:0}
.m-emp-info .nm{font-weight:700;font-size:1.05rem;color:var(--ink);line-height:1.2}
.m-emp-info .meta{font-size:.78rem;color:var(--muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.m-emp-list{background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);overflow:hidden}
.m-emp-row{display:flex;align-items:center;gap:.7rem;padding:.65rem .8rem;border-bottom:1px solid #f1f4f9;cursor:pointer;-webkit-tap-highlight-color:rgba(47,111,179,.18)}
.m-emp-row:last-child{border-bottom:0}
.m-emp-row:active,.m-emp-row:hover{background:#eef4fb}
.m-emp-row .nm{font-weight:600;font-size:.95rem;color:var(--ink);flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.m-emp-row .kpill{font-size:.62rem;padding:.1rem .45rem;border-radius:999px;font-weight:700;flex:0 0 auto}
.m-emp-row .kpill.op{background:#fdf0e3;color:var(--warn)}
.m-emp-row .kpill.sup{background:#e6effb;color:var(--blue)}
.m-emp-row .chev{color:var(--muted);font-size:1.1rem;flex:0 0 auto}
.m-day-card{border:1px solid var(--line);border-radius:12px;padding:.7rem .8rem;margin-bottom:.55rem;background:#fff;box-shadow:0 1px 2px rgba(22,40,80,.04)}
.m-day-card.today{border-color:var(--blue);border-width:2px;padding:.65rem .75rem}
.m-day-card.weekend{background:#fdf6ec}
.m-day-card.away{background:repeating-linear-gradient(45deg,#eef1f5,#eef1f5 6px,#e7ebf1 6px,#e7ebf1 12px);opacity:.92}
.m-day-card .m-away-note{font-size:.78rem;color:#6b7280;font-weight:600;margin-top:.2rem}
.m-day-badge.movedin{background:#dcfce7;color:#15803d}
.m-day-card.locked{opacity:.65;background:#f5f6f8}
.m-day-card.saved{background:#e9f7ee;border-color:#a3d6b6;transition:all .8s}
.m-day-head{display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem}
.m-day-num{font-size:1.05rem;font-weight:800;color:var(--ink);min-width:1.6rem}
.m-day-dow{font-size:.78rem;color:var(--muted);font-weight:600}
.m-day-badges{margin-left:auto;display:flex;gap:.3rem}
.m-day-badge{font-size:.62rem;padding:.1rem .5rem;border-radius:999px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.m-day-badge.today{background:var(--blue);color:#fff}
.m-day-badge.wknd{background:#fdf0d4;color:#a16207}
.m-day-badge.locked{background:#e8ecf2;color:#6b7785}
.m-day-card input,.m-day-card textarea{font-size:16px;height:42px}
.m-day-card .row{display:flex;gap:.5rem;align-items:center}
.m-day-card .row+.row{margin-top:.4rem}
.m-day-card .row input[data-f="team"],.m-day-card .row input[data-f="detail"],.m-day-card .row input[data-f="pm"]{flex:1 1 auto;min-width:0}
/* Mobile: the optional second task is hidden until you tap into that day (focus)
   or it already has a value — keeps each day-card clean for one-task entry. */
.m-day-card .m-shift.second{display:none;margin-top:.3rem}
/* same rule as desktop: show 2nd task once the 1st is filled, or if it has a value */
.m-day-card:has(.m-shift.second input:not(:placeholder-shown)) .m-shift.second,
.m-day-card:has(.m-shift.primary input:not(:placeholder-shown)) .m-shift.second{display:flex}
.m-day-card .m-shift.second input:placeholder-shown{border-style:dashed;background:transparent;color:var(--muted)}
.m-day-card .row input.ot{flex:0 0 70px;text-align:right;color:var(--warn);font-weight:700}
.m-empty{text-align:center;padding:2.5rem 1rem;color:var(--muted)}
.m-empty .icon{font-size:2.2rem;line-height:1;margin-bottom:.6rem}
.m-fab{position:fixed;right:.85rem;bottom:.85rem;z-index:50;background:var(--blue);color:#fff;border:0;width:48px;height:48px;border-radius:50%;font-size:1.5rem;box-shadow:0 6px 14px rgba(22,40,80,.3);cursor:pointer;font-weight:700;line-height:1;display:flex;align-items:center;justify-content:center}
.m-fab:hover{background:var(--blue-d)}
@media(max-width:767px){.wrap{padding:0 .6rem;margin:.6rem auto}.card{padding:.85rem .9rem}.topbar{padding:.5rem .8rem}.topbar .brand{font-size:1.3rem}.topbar .brand-titles{display:none}}
.btn.sec{height:38px;padding:0 1rem;display:inline-flex;align-items:center}
/* coverage view */
.cov-days{background:#fff;border:1px solid var(--line);border-radius:11px;padding:.7rem .8rem;margin-bottom:.8rem;box-shadow:var(--shadow)}
.cov-days-row{display:flex;gap:3px;flex-wrap:nowrap;overflow-x:auto}
.cov-day{flex:1 1 0;min-width:38px;text-align:center;border-radius:6px;padding:.35rem .15rem;cursor:pointer;line-height:1.05;font-size:.7rem;font-weight:600}
.cov-day .d{font-size:1.1rem;font-weight:800}
.cov-day .x{font-size:.65rem;opacity:.85}
.cov-day .p{font-size:.7rem;opacity:.95;margin-top:1px}
/* coverage code-highlighter bar + matched-cell styling */
.cov-hl{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;background:#fff;border:1px solid var(--line);border-radius:11px;padding:.5rem .7rem;margin-bottom:.8rem;box-shadow:var(--shadow)}
.cov-hl-lbl{font-weight:700;font-size:.82rem;color:var(--ink);white-space:nowrap}
.cov-hl-sel{font-size:.78rem;padding:.28rem .4rem;border:1px solid var(--line);border-radius:7px;background:var(--input-bg);color:var(--ink);max-width:280px}
.cov-hl-chips{display:flex;gap:.35rem;flex-wrap:wrap}
.cov-hl-chip{display:inline-flex;align-items:center;gap:.3rem;background:#f3e8ff;color:#6b21a8;border:1px solid #d8b4fe;border-radius:999px;padding:.12rem .25rem .12rem .55rem;font-size:.72rem;font-weight:600}
.cov-hl-chip b{font-weight:800}
.cov-hl-chip .x{cursor:pointer;font-weight:800;opacity:.65;padding:0 .28rem;border-radius:999px;line-height:1}
.cov-hl-chip .x:hover{opacity:1;background:rgba(107,33,168,.16)}
.cov-hl-count{margin-left:auto;font-size:.76rem;font-weight:700;color:#6b21a8;white-space:nowrap}
.mgrid.covgrid.hl-on td.cov-cell:not(.hl) .ccell{opacity:.24}
.mgrid.covgrid td.cov-cell.hl .ccell{outline:3px solid #7c3aed;outline-offset:-2px;box-shadow:0 0 0 2px rgba(124,58,237,.45);position:relative;z-index:4}
body.dark .cov-hl{background:var(--card)}
body.dark .cov-hl-chip{background:#3b2357;color:#e9d5ff;border-color:#6d28d9}
body.dark .cov-hl-count{color:#c4b5fd}
/* coverage view: full-width heatmap with status codes in each cell */
table.mgrid.covgrid{table-layout:fixed;width:100%;border-collapse:separate;border-spacing:3px;min-width:0}
.mgrid.covgrid th,.mgrid.covgrid td{border:0;padding:0;background:transparent;position:relative}
.mgrid.covgrid thead th{position:sticky;top:0;background:transparent;z-index:2;color:var(--thead-ink)}
.mgrid.covgrid th.cov-th{height:36px;font-size:.72rem;font-weight:700;line-height:1.05;padding:3px 0;text-align:center;overflow:hidden}
.mgrid.covgrid th.cov-th .dow{font-size:.62rem;font-weight:500;color:var(--muted);display:block;margin-top:1px}
.mgrid.covgrid th.cov-th.weekend{color:var(--wkend-th-ink);background:var(--wkend-cell);border-radius:6px}
.mgrid.covgrid th.cov-th.today{background:var(--blue);color:#fff;border-radius:6px}
.mgrid.covgrid th.cov-th.today .dow{color:#cde0f5}
.mgrid.covgrid .emp-col{position:sticky;left:0;background:var(--card);width:220px;padding:.35rem .55rem .35rem .25rem;font-weight:600;border-right:1px solid var(--line);font-size:.8rem;z-index:1}
.mgrid.covgrid thead th.emp-col{z-index:3;background:var(--thead-bg);font-size:.78rem;color:var(--thead-ink);border-bottom:1px solid var(--line)}
.mgrid.covgrid tbody tr:nth-child(even) .emp-col{background:var(--zebra)}
.mgrid.covgrid td.cov-cell{height:34px;cursor:pointer;text-align:center}
.mgrid.covgrid td.cov-cell .ccell{display:flex;align-items:center;justify-content:center;width:100%;height:100%;border-radius:5px;font-weight:700;font-size:.8rem;color:#fff;letter-spacing:.02em;box-shadow:inset 0 0 0 1px rgba(0,0,0,.05);transition:transform .12s,box-shadow .12s;line-height:1}
.mgrid.covgrid td.cov-cell .ccell.codes{flex-direction:column;gap:0;line-height:1.05;padding:0 1px}
/* yellow ring marks cells that are still within the editable window */
.mgrid.covgrid td.cov-cell .ccell[data-s="editable"]{color:#5a4500}
.mgrid td.cell.cellfocus{outline:3px solid var(--blue);outline-offset:-3px;background:#eaf2fd}
body.dark .mgrid td.cell.cellfocus{background:#1b2c44}
.mgrid.covgrid td.cov-cell .ccell .cc{font-size:.55rem;font-weight:800;line-height:1.18;letter-spacing:0;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.mgrid.covgrid td.cov-cell .ccell[data-s="future"]{color:#9aa5b4;font-size:.65rem}
.mgrid.covgrid td.cov-cell .ccell[data-s="weekend"]{color:#6b5232;font-size:.65rem}
.mgrid.covgrid td.cov-cell .ccell[data-s="away"]{color:#9aa5b4;font-size:.85rem;font-weight:700}
.mgrid.covgrid td.cov-cell .ccell[data-s="today"]{outline:2px solid #fff;outline-offset:-2px;box-shadow:0 0 0 2px var(--blue)}
.mgrid.covgrid td.cov-cell:hover .ccell{transform:scale(1.12);box-shadow:0 3px 7px rgba(0,0,0,.2);position:relative;z-index:5}
/* per-site dashboard cards */
.site-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(440px,1fr));gap:1.1rem}
.s-card{display:flex;flex-direction:column;padding:0;margin:0;overflow:hidden;background:linear-gradient(180deg,var(--site-tint,#fff) 0,#fff 90px);border:1px solid var(--line);box-shadow:0 1px 3px rgba(22,40,80,.06),0 4px 12px rgba(22,40,80,.04);transition:transform .14s,box-shadow .14s}
.s-card:hover{transform:translateY(-2px);box-shadow:0 4px 10px rgba(22,40,80,.10),0 12px 28px rgba(22,40,80,.08)}
.s-card .s-bar{height:5px;background:var(--site,var(--blue))}
.s-card .s-body{padding:1rem 1.1rem 1.05rem;display:flex;flex-direction:column;flex:1 1 auto}
.s-card .s-cta{margin-top:auto;padding-top:.8rem}
.s-head{display:flex;justify-content:space-between;gap:1rem;align-items:start;margin-bottom:.9rem}
.s-head h2{font-size:1.18rem;line-height:1.2}
.s-ringwrap{display:flex;align-items:center;gap:.6rem}
.s-ring{position:relative;width:64px;height:64px;flex:0 0 64px}
.s-ring circle.ring-fill{animation:ringFill .9s cubic-bezier(.22,1,.36,1) .15s forwards;transition:stroke-dashoffset .35s ease-out}
@keyframes ringFill{to{stroke-dashoffset:var(--ring-end,0)}}
.s-ring-pct{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.92rem}
.s-ring-lbl{font-size:.74rem;color:var(--muted);line-height:1.25;text-align:right;white-space:nowrap}
.s-ring-lbl b{color:var(--ink);font-size:.95rem;font-weight:800;letter-spacing:.01em}
.s-stats{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:.6rem;margin-bottom:.7rem;padding:.7rem .8rem;background:#f8fafd;border:1px solid var(--line);border-radius:10px}
.s-stats>div{font-size:.78rem;color:var(--muted)}
.s-stats b{font-size:1.35rem;color:var(--site,var(--blue));display:block;font-weight:800;line-height:1.05}
.s-stats span{font-weight:600;font-size:.75rem}
.s-stats .hint{font-size:.7rem;margin-top:.15rem}
.mini-cal{display:flex;gap:2px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:4px;overflow-x:auto}
.mini-cal .mc{flex:1 1 0;min-width:18px;border-radius:4px;text-align:center;padding:.3rem 1px;font-size:.65rem;line-height:1}
.mini-cal .mc .mcd{font-weight:700;font-size:.72rem}
.s-card .btn.s-go:hover{filter:brightness(.92)}
.s-stats-mini{display:flex;flex-direction:column;align-items:flex-end;line-height:1.1;color:var(--muted);font-size:.78rem;font-weight:600}
.s-stats-mini b{font-size:1.6rem;display:block;letter-spacing:.01em}
.top-acts{display:flex;flex-direction:column;gap:.3rem;margin:.3rem 0 .45rem}
/* compact: full name on line 1 (never cut off) + % at right, thin bar on line 2 */
.ta-row{display:grid;grid-template-columns:1fr auto;align-items:baseline;column-gap:.5rem;row-gap:.06rem;font-size:.8rem}
.ta-name{min-width:0;color:var(--ink);font-weight:600;line-height:1.2;overflow-wrap:anywhere}
.ta-bar{grid-column:1/-1;height:5px;background:#eef2f8;border-radius:4px;overflow:hidden;min-width:30px}
.ta-bar>i{display:block;height:100%;border-radius:4px;animation:taFill .65s cubic-bezier(.22,1,.36,1) forwards;width:0%}
@keyframes taFill{to{width:var(--w,0)}}
.btn-spin{display:inline-block;width:12px;height:12px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:btnSpin .8s linear infinite;flex:0 0 12px;vertical-align:-1px}
@keyframes btnSpin{to{transform:rotate(360deg)}}
.ta-num{color:var(--site);font-variant-numeric:tabular-nums;font-weight:700;font-size:.78rem;text-align:right;white-space:nowrap}
.ta-num .ta-pct{color:var(--muted);font-weight:600;font-size:.72rem;margin-left:.15rem}
.ta-row.ta-other .ta-name{color:var(--muted);font-style:italic;font-weight:500}
.top-acts .ta-row.ta-extra{display:none}
.top-acts.expanded .ta-row.ta-extra{display:grid}
.ta-expand{display:block;width:100%;margin:.1rem 0 .5rem;padding:.28rem;background:none;border:0;border-radius:7px;color:var(--site);font-weight:700;font-size:.76rem;cursor:pointer}
.ta-expand:hover{background:var(--site-tint)}
@media(max-width:680px){.statrow .fld{min-width:46%}th,td{padding:.4rem}.daycol{width:auto}.stats{grid-template-columns:repeat(2,1fr)}}
/* ----- Operation work-type picker (floating popover anchored to cell) ----- */
#opPicker{position:fixed;z-index:9999;background:#fff;border:1px solid var(--line);border-radius:11px;
  box-shadow:0 12px 32px rgba(22,40,80,.22),0 2px 6px rgba(22,40,80,.10);
  width:700px;max-width:94vw;max-height:68vh;display:none;flex-direction:column;overflow:hidden}
#opPicker.open{display:flex}
#opPickerTitle{padding:.45rem .65rem;font-size:.78rem;font-weight:700;color:var(--blue);background:#eaf1fb;border-bottom:1px solid var(--line);flex:0 0 auto;display:flex;align-items:center;gap:.35rem}
#opPickerTitle.back{cursor:pointer}
#opPickerTitle.back:hover{background:#dfeafb}
#opPickerTitle .opp-step{background:var(--blue);color:#fff;border-radius:6px;font-size:.66rem;padding:.05rem .4rem}
#opPickerTitle .opp-back{font-size:1.05rem;font-weight:800;line-height:1}
body.dark #opPickerTitle{background:#142440;color:#9dc4f0;border-color:var(--line)}
#opPickerHead{display:flex;align-items:center;gap:.4rem;padding:.5rem .6rem;border-bottom:1px solid var(--line);background:#f6f9fd;flex:0 0 auto}
#opPickerSearch{flex:1 1 auto;height:36px;border:1px solid var(--line);border-radius:8px;padding:0 .6rem;font:inherit;font-size:.92rem;background:#fff}
#opPickerSearch:focus{outline:0;border-color:var(--blue-l);box-shadow:0 0 0 3px rgba(47,111,179,.13)}
#opPickerCount{font-size:.72rem;color:var(--muted);font-weight:600;white-space:nowrap;padding:0 .3rem}
/* Two-column list so all 42 work types fit with far less scrolling. Category
   headers span both columns; items flow left→right then down. */
#opPickerList{overflow-y:auto;flex:1 1 auto;padding:.25rem 0;display:grid;grid-template-columns:1fr 1fr;align-content:start}
.opp-cat{grid-column:1/-1;position:sticky;top:0;background:linear-gradient(180deg,#fafcfe,#f1f5fa);font-size:.68rem;color:#41506a;
  font-weight:800;text-transform:uppercase;letter-spacing:.06em;padding:.4rem .8rem .25rem;border-bottom:1px solid var(--line);z-index:1}
.opp-item{padding:.45rem .8rem;cursor:pointer;border-bottom:1px solid #f1f4f9}
.opp-item:last-child{border-bottom:0}
.opp-item:hover,.opp-item.kbd{background:#eef4fb}
.opp-item.kbd{box-shadow:inset 3px 0 0 var(--blue)}
.opp-name{font-size:.88rem;font-weight:600;color:var(--ink);line-height:1.25}
.opp-code{display:inline-block;background:#eef4fb;color:var(--blue);font-family:Menlo,Consolas,monospace;
  font-size:.72rem;font-weight:700;padding:1px 6px;border-radius:5px;margin-right:.4rem;letter-spacing:.04em}
/* tiny mapping indicator: green = auto cost (1 step) · amber = pick cost (2 steps) */
.opp-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:.45rem;vertical-align:middle;opacity:.85}
.opp-dot.fixed{background:#1f9d55}
.opp-dot.many{background:#d9a23a}
th.mi-sortable{cursor:pointer;user-select:none;transition:background .12s}
th.mi-sortable:hover{background:#dde6f0}
.mi-sort-ind{display:inline-block;margin-left:.3rem;color:var(--blue);font-size:.82em;min-width:.8em}
.btn.xls-btn{background:#107c41;color:#fff;height:38px;padding:0 1rem;font-weight:700;display:inline-flex;align-items:center;gap:.35rem}
.btn.xls-btn:hover{background:#0e6e3a}
.btn.xls-btn:disabled{background:#a4c9b3;color:#fff;cursor:wait}
.msel{position:relative;display:inline-block;min-width:240px;max-width:320px;width:100%}
.msel-trigger{display:flex;width:100%;align-items:center;justify-content:space-between;background:#fff;border:1px solid var(--line);border-radius:8px;padding:.3rem .65rem;cursor:pointer;font:inherit;font-size:.88rem;text-align:left;height:38px;font-family:inherit;color:var(--ink)}
.msel-trigger:hover{border-color:#bcc6d6}
.msel.open .msel-trigger{border-color:var(--blue-l);box-shadow:0 0 0 3px rgba(47,111,179,.13)}
.msel-label{flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.msel-label.placeholder{color:var(--muted)}
.msel-caret{color:var(--muted);font-size:.7rem;margin-left:.4rem;transition:transform .15s}
.msel.open .msel-caret{transform:rotate(180deg);color:var(--blue)}
.msel-pop{display:none;position:fixed;min-width:240px;background:#fff;
  border:1px solid var(--line);border-radius:9px;box-shadow:0 12px 32px rgba(22,40,80,.22);z-index:9999;
  max-height:60vh;overflow-y:auto;padding:.25rem 0}
.msel.open .msel-pop{display:block}
.msel-opt{display:flex;align-items:center;gap:.55rem;padding:.42rem .75rem;cursor:pointer;font-size:.86rem;user-select:none}
.msel-opt:hover{background:#eef4fb}
.msel-opt input{width:auto;height:auto;margin:0;accent-color:var(--blue);cursor:pointer}
.msel-readonly{padding:.55rem .7rem;color:var(--muted);font-size:.85rem;background:#f4f7fb;border-radius:8px;display:inline-block}
.opp-desc{font-size:.74rem;color:var(--muted);margin-top:2px;line-height:1.35;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.opp-empty{padding:1.1rem .8rem;color:var(--muted);text-align:center;font-size:.85rem}
.opp-clear{height:36px;padding:0 .7rem;border:0;background:#eef2f8;color:var(--blue);font:inherit;font-weight:600;
  border-radius:8px;cursor:pointer;font-size:.85rem;white-space:nowrap}
.opp-clear:hover{background:#dfe8f4}

/* New-user row in the Users & Permissions table — tinted to stand out as
   the "add new" affordance. Uses --thead-bg so it themes with the rest. */
tr.row-newuser td{background:var(--thead-bg)}

/* Settings popup-overlay (asModal mode). Everything below is scoped under
   .settings-card so the desktop "page" version of Settings is untouched. */
.overlay-card.settings-card{ padding:0; width:920px; max-width:95vw; max-height:94vh; display:flex; flex-direction:column }
.settings-card .settings{ display:flex; flex-direction:column; min-height:0; flex:1 1 auto; padding:0 }
/* Sticky header */
.settings-card .settings-head{ display:flex; align-items:center; justify-content:space-between;
  gap:.6rem; padding:.62rem 1.1rem; position:sticky; top:0; background:var(--card); z-index:2;
  border-bottom:1px solid var(--line); flex:0 0 auto }
.settings-card .settings-head h1{ font-size:1.02rem; line-height:1.15 }
.settings-card .sub{ padding:.5rem 1.1rem .15rem; font-size:.73rem; margin:0; background:var(--sett-bg) }
.settings-close{ width:30px; height:30px; padding:0; border:0; background:rgba(0,0,0,.05);
  color:var(--ink); font-size:1.3rem; line-height:1; border-radius:50%; cursor:pointer;
  display:inline-flex; align-items:center; justify-content:center }
.settings-close:hover{ background:rgba(0,0,0,.10) }
body.dark .settings-close{ background:rgba(255,255,255,.08); color:var(--ink) }
body.dark .settings-close:hover{ background:rgba(255,255,255,.14) }
/* Section list — scroll only INSIDE this region, header/footer stay fixed */
/* Two balanced columns so everything fits on one screen without scrolling; each
   section stays intact (never splits across the column break). */
.settings-card .settings-body{ overflow-y:auto; -webkit-overflow-scrolling:touch;
  padding:.75rem 1.1rem 1rem; flex:1 1 auto; min-height:0; background:var(--sett-bg) }
/* Two balanced columns of card-style sections (replaces the old column-count flow
   that piled everything onto one side). */
.settings-cols{ display:flex; gap:.7rem; align-items:flex-start }
.settings-cols .settings-col{ flex:1 1 0; min-width:0; display:flex; flex-direction:column; gap:.45rem; align-self:flex-start; justify-content:flex-start }
.settings-card .settings .sect{ flex:0 0 auto; background:var(--card); border:1px solid var(--sett-cardline); border-radius:11px;
  padding:.55rem .8rem; margin:0; box-shadow:0 1px 2px rgba(22,40,80,.04) }
/* the page-form rule zeroes the LAST section's bottom padding/border — restore it
   for the modal cards (each is a self-contained box, not a list item) */
.settings-card .settings .sect:last-child{ padding-bottom:.55rem; margin-bottom:0; border-bottom:1px solid var(--sett-cardline) }
.settings-card .sect h2{ position:relative; padding-left:.55rem; font-size:.78rem; font-weight:800; margin:0 0 .32rem; line-height:1.2; color:var(--ink); letter-spacing:.01em }
.settings-card .sect h2::before{ content:""; position:absolute; left:0; top:.15em; bottom:.15em; width:3px; border-radius:2px; background:var(--blue); opacity:.8 }
.settings-card .sect .desc{ display:none }   /* compact modal: titles are self-explanatory (full text on the manual) */
/* connected segmented control — fills the card, reads as one professional control */
.settings-card .opts{ display:flex; gap:0; border:1px solid var(--sett-cardline); border-radius:8px; overflow:hidden }
.settings-card .opt-pill{ flex:1 1 0; text-align:center; white-space:nowrap; font-size:.8rem; padding:.48rem .4rem; min-height:0; border:0; border-right:1px solid var(--sett-cardline); border-radius:0; font-weight:600; background:var(--card); color:var(--ink); box-shadow:none }
.settings-card .opt-pill:last-child{ border-right:0 }
.settings-card .opt-pill.on{ background:var(--blue); color:#fff }
.settings-card .opt-pill:not(.on):hover{ background:var(--sett-bg) }
/* standalone action buttons fill their card and read as real buttons (consistent
   soft-blue style with the how-to button + the segmented pills) */
.settings-card .sect > .btn,
.settings-card .lockrow .btn{ background:#eaf1fb; color:var(--blue); border:1px solid #cdddf2;
  font-weight:700; border-radius:9px; box-shadow:none }
.settings-card .sect > .btn{ width:100%; padding:.55rem; font-size:.83rem; min-height:0 }
.settings-card .sect > .btn:hover,
.settings-card .lockrow .btn:hover{ background:#dfeafb }
body.dark .settings-card .sect > .btn,
body.dark .settings-card .lockrow .btn{ background:#142440; border-color:#1d3a5f; color:#9dc4f0 }
.settings-card .lockrow{ display:flex; align-items:center; gap:.5rem }
.settings-card .lockrow input[type=number]{ height:36px; width:64px; font-size:.95rem; padding:.1rem .45rem; text-align:center }
.settings-card .lockrow .btn.sec{ flex:0 0 auto; height:36px; min-height:0; padding:0 1.2rem; font-size:.85rem }
.settings-card .lockrow .muted{ font-size:.82rem }
.settings-card .about-grid{ font-size:.8rem; grid-template-columns:104px 1fr; gap:.22rem .6rem; margin:.1rem 0 }
.settings-card .about-grid dt,
.settings-card .about-grid dd{ line-height:1.3 }
.settings-card .users-toggle{ padding:.18rem 0 }
.settings-card .users-toggle h2{ font-size:.82rem }
/* Collapsible Users section — heavy table starts hidden so the rest fits.
   Toggle reads as a real button row (background, hover, prominent chevron) so
   it doesn't get mistaken for plain text. */
.settings-card .sect.users-sect{ position:relative; padding:.2rem 0 }
.settings-card .users-toggle{ background:#f1f5fa; border:1px solid var(--line); border-radius:8px;
  padding:.5rem .75rem; cursor:pointer; font:inherit; color:inherit;
  display:flex; align-items:center; gap:.5rem; width:100%; text-align:left; transition:background .12s }
.settings-card .users-toggle:hover{ background:#e6effb }
.settings-card .users-toggle h2{ font-size:.85rem; margin:0; line-height:1.2 }
.settings-card .users-toggle .chev{ margin-left:auto; transition:transform .18s;
  color:var(--blue); font-size:1.1rem; font-weight:800; line-height:1;
  width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center;
  background:rgba(29,78,137,.10); border-radius:50% }
.settings-card .users-sect.open .users-toggle{ background:#e6effb; border-color:var(--blue-l) }
.settings-card .users-sect.open .users-toggle .chev{ transform:rotate(90deg) }
.settings-card .users-sect #uBody{ display:none; margin-top:.5rem }
.settings-card .users-sect.open #uBody{ display:block }
/* ===== Audit-log overlay (its own wide card, not the cramped settings popup) ===== */
.overlay-card.audit-card{ width:min(1120px,96vw); max-width:none; height:90vh; max-height:90vh;
  padding:0; display:flex; flex-direction:column; overflow:hidden }
.audit-card .audit-head{ display:flex; align-items:center; justify-content:space-between;
  padding:.6rem .9rem; border-bottom:1px solid var(--line) }
.audit-card .audit-head h1{ font-size:1rem; line-height:1.15 }
.audit-card .audit-filters{ display:flex; gap:.5rem; align-items:center; flex-wrap:wrap;
  padding:.55rem .9rem; border-bottom:1px solid var(--line) }
.audit-card .audit-filters input, .audit-card .audit-filters select{
  height:32px; font-size:.82rem; padding:.2rem .5rem; border:1px solid var(--line);
  border-radius:7px; background:var(--card); color:var(--ink) }
.audit-card .audit-filters input{ flex:1 1 220px; min-width:150px }
.audit-card .audit-filters #auditCount{ margin-left:auto; font-size:.75rem; white-space:nowrap }
.audit-wrap{ flex:1 1 auto; overflow:auto; -webkit-overflow-scrolling:touch }
.audit-tbl{ border-collapse:collapse; width:100%; font-size:.78rem }
.audit-tbl th, .audit-tbl td{ padding:.32rem .55rem; border-bottom:1px solid var(--line);
  text-align:left; vertical-align:top }
.audit-tbl thead th{ position:sticky; top:0; background:#f1f5fa; font-weight:600;
  white-space:nowrap; z-index:1 }
.audit-tbl tbody tr:hover{ background:#f6f9fd }
.audit-tbl .muted{ opacity:.45 }
body.dark .audit-tbl thead th{ background:#1f2a3b }
body.dark .audit-tbl tbody tr:hover{ background:#222f44 }
html.is-mobile .overlay-card.audit-card{ width:100%; height:92vh; max-height:92vh; border-radius:16px 16px 0 0 }
body.dark .settings-card .users-toggle{ background:#1f2a3b; border-color:var(--line) }
body.dark .settings-card .users-toggle:hover,
body.dark .settings-card .users-sect.open .users-toggle{ background:#27344a }
body.dark .settings-card .users-toggle .chev{ color:#9dc4f0; background:rgba(157,196,240,.15) }

/* User table inside the popup → stack into per-row cards so columns don't
   get clipped (e.g. "manager" → "mar") and the popup never needs horizontal
   scroll. Each user row becomes a labeled mini-card. */
/* Per-user "card" layout. Each table row is a CSS grid:
     row 1 — email (full width)
     row 2 — role dropdown (left, fixed width) + site multi-select (fills rest)
     row 3 — action buttons (right-aligned)
   Puts manager + site selector on the SAME row so the card stays compact. */
.settings-card .usersTable{ display:block; border:0; width:100% }
.settings-card .usersTable thead{ display:none }
.settings-card .usersTable tbody{ display:block; width:100% }
.settings-card .usersTable tr{ display:grid; width:100%; box-sizing:border-box;
  background:var(--card); border:1px solid var(--line);
  border-radius:10px; padding:.5rem .65rem; margin-bottom:.45rem; box-shadow:0 1px 2px rgba(22,40,80,.04);
  grid-template-columns:auto 1fr; grid-template-areas: "email email" "role sites" "actions actions";
  gap:.3rem .4rem; align-items:center }
.settings-card .usersTable tr.row-newuser{ background:var(--thead-bg); border-style:dashed }
.settings-card .usersTable td{ display:block; border:0; padding:0; min-width:0 }
.settings-card .usersTable td:nth-child(1){ grid-area:email; font-weight:700; word-break:break-all; font-size:.85rem }
.settings-card .usersTable td:nth-child(1) input{ width:100%; font-size:.85rem; height:32px }
.settings-card .usersTable td:nth-child(2){ grid-area:role }
.settings-card .usersTable td:nth-child(3){ grid-area:sites; min-width:0 }
.settings-card .usersTable .uRole{ width:auto; min-width:108px; height:32px; font-size:.85rem }
.settings-card .usersTable .msel{ width:100% }
.settings-card .usersTable .msel-trigger{ width:100%; height:32px; font-size:.82rem }
.settings-card .usersTable .msel-readonly{ font-size:.78rem; padding:.35rem .55rem; height:32px;
  display:inline-flex; align-items:center; box-sizing:border-box }
.settings-card .usersTable td:nth-child(4){ grid-area:actions;
  display:flex; gap:.4rem; justify-content:flex-end; padding-top:.15rem }
.settings-card .usersTable .btn{ height:30px; min-height:0; padding:0 .7rem; font-size:.8rem }

/* ===== Settings page ===== */
.settings .sect{margin:0 0 1.4rem;padding:0 0 1.1rem;border-bottom:1px dashed var(--line)}
.settings .sect:last-child{border-bottom:0;padding-bottom:0;margin-bottom:0}
.settings .sect h2{font-size:.98rem;margin:0 0 .15rem;letter-spacing:.01em;color:var(--ink);font-weight:800}
.settings .sect .desc{color:var(--muted);font-size:.83rem;margin:0 0 .65rem}
.opts{display:inline-flex;gap:.4rem;flex-wrap:wrap}
.opt-pill{border:1px solid var(--line);background:var(--card);color:var(--ink);padding:.45rem .9rem;border-radius:999px;
  font:inherit;font-weight:600;font-size:.88rem;cursor:pointer;transition:background .12s,border-color .12s,color .12s}
.opt-pill:hover{border-color:var(--blue-l);color:var(--blue)}
.opt-pill.on{background:var(--blue);color:#fff;border-color:var(--blue)}
.opt-pill.on:hover{background:var(--blue-d);color:#fff}
.lockrow{display:inline-flex;align-items:center;gap:.5rem}
.lockrow input[type=number]{width:80px;text-align:center}
/* visible-sites toggle list */
.site-vis{display:flex;flex-direction:column}
.vis-row{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.5rem .1rem;border-bottom:1px solid var(--line);cursor:pointer}
.vis-row:last-child{border-bottom:0}
.vis-name{font-size:.9rem;color:var(--ink);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vis-tog{appearance:none;-webkit-appearance:none;width:46px;height:26px;border-radius:13px;background:#cfd6e0;position:relative;cursor:pointer;transition:background .15s;flex:0 0 46px;margin:0}
.vis-tog::before{content:"";position:absolute;top:2px;left:2px;width:22px;height:22px;border-radius:50%;background:#fff;transition:left .15s;box-shadow:0 1px 2px rgba(0,0,0,.25)}
.vis-tog:checked{background:var(--blue)}
.vis-tog:checked::before{left:22px}
body.dark .vis-tog{background:#33404f}
/* how-to button — full width above the two columns */
.settings-card .howto-sect{background:none;border:0;box-shadow:none;padding:0;margin:0 0 .45rem}
.how-btn{width:100%;background:#eaf1fb;color:var(--blue);border:1px solid #cdddf2;font-weight:700;padding:.48rem;border-radius:10px;font-size:.86rem}
.how-btn:hover{background:#dfeafb}
body.dark .how-btn{background:#142440;border-color:#1d3a5f;color:#9dc4f0}
.settings-card .vis-row{padding:.3rem .1rem}
.settings-card .vis-name{font-size:.84rem}
/* show all projects (no inner scroll); only an unusually long list (rare) caps */
.settings-card .site-vis{max-height:62vh;overflow-y:auto}
html.is-mobile .settings-cols{flex-direction:column}
/* how-to overlay */
.howto-card{width:560px;max-width:94vw;padding:0;display:flex;flex-direction:column}
.howto-steps{list-style:none;counter-reset:ht;margin:0;padding:.6rem .95rem 1rem}
.howto-steps li{counter-increment:ht;position:relative;padding:.55rem 0 .55rem 2.5rem;border-bottom:1px dashed var(--line)}
.howto-steps li:last-child{border-bottom:0}
.howto-steps li::before{content:counter(ht);position:absolute;left:0;top:.5rem;width:1.7rem;height:1.7rem;border-radius:50%;background:var(--blue);color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:.85rem}
.howto-steps li b{display:block;font-size:.94rem;color:var(--ink);margin-bottom:.12rem}
.howto-steps li span{font-size:.83rem;color:var(--muted);line-height:1.4}
.about-grid{display:grid;grid-template-columns:140px 1fr;gap:.35rem .9rem;font-size:.88rem}
.about-grid dt{color:var(--muted);font-weight:600}
.about-grid dd{margin:0;color:var(--ink);font-weight:600}

/* ===== Dark mode ===== */
body.dark{
  --bg:#0f141c; --card:#1a212d; --line:#2a3344; --ink:#e6ecf3; --muted:#9aa6b6;
  --weekend:#26221b; --shadow:0 1px 3px rgba(0,0,0,.45),0 1px 2px rgba(0,0,0,.35);
  /* table/row surfaces re-defined for dark mode */
  --thead-bg:#101620; --thead-ink:#cdd6e4;
  --zebra:#161d28; --hover:#1f2a3b;
  --wkend-cell:#26221b; --wkend-cell-alt:#2c2620; --wkend-th-bg:#2a221a; --wkend-th-ink:#d6b27b;
  --sett-bg:#0e131b;--sett-cardline:#28303d;
  --input-bg:#101620;
  --dirty-bg:#3a3014; --dirty-bd:#8a6d2a; --dirty-ink:#fff2c0;
  --saving-bg:#152840; --saving-bd:#3a6aa1; --saving-ink:#cfe2fb;
  --saved-bg:#163524; --saved-bd:#3f7a55; --saved-ink:#bce6c8;
  --locked-a:#161d28; --locked-b:#1c2533; --locked-alt-a:#1a2230; --locked-alt-b:#202a3a; --locked-ink:#8593a7;
  --am-tint:#13202f; --am-edge:#3f6aa1; --pm-tint:#2a2014; --pm-edge:#a9763e;
  --jc-bg:#1f2f45; --jc-ink:#9dc4f0;
}
body.dark .topbar{background:linear-gradient(90deg,#0b1828 0%,#12345a 55%,#205180 100%);
  border-top-color:#03070d;box-shadow:0 2px 8px rgba(0,0,0,.55)}
body.dark .topbar nav a{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.14);color:#eaf2fb}
body.dark .topbar nav a:hover{background:rgba(255,255,255,.18)}
body.dark .topbar nav a.on{background:#eaf2fb;color:var(--blue);border-color:#eaf2fb;
  box-shadow:0 3px 10px rgba(0,0,0,.5),inset 0 -2px 0 rgba(29,78,137,.35)}
body.dark .topbar .who{color:#a8c0dd}
body.dark input[type=text],body.dark input[type=number],body.dark input[type=email],
body.dark input:not([type]),body.dark select,body.dark textarea{
  background:#101620;color:var(--ink);border-color:var(--line)}
body.dark .seg,body.dark .seg button,body.dark .viewseg button,body.dark .mp-trigger,body.dark .lockchip{background:#101620;color:var(--ink)}
body.dark .seg{border-color:var(--line)}
body.dark .viewseg button.on,body.dark .seg button.on{background:var(--blue);color:#fff}
body.dark .weekbar{background:#101620;border-color:var(--line)}
body.dark .weekbar button{color:#9dc4f0}
body.dark .weekbar button:hover{background:#1f2a3b}
body.dark .weekbar .lbl{color:var(--ink)}
body.dark .mp-pop{background:var(--card);border-color:var(--line)}
body.dark .mp-month{background:#101620;color:var(--ink);border-color:var(--line)}
body.dark .mp-year:hover,body.dark .mp-month:hover{background:#1f2a3b;color:#fff}
body.dark #opPicker,body.dark .msel-pop{background:var(--card);border-color:var(--line);color:var(--ink)}
body.dark #opPickerSearch{background:#101620;color:var(--ink);border-color:var(--line)}
body.dark .msel-opt:hover,body.dark .opp-item:hover,body.dark .opp-item.kbd{background:#1f2a3b}
body.dark .opp-cat{background:#101620;color:var(--muted);border-color:var(--line)}
body.dark .msel-readonly{background:#101620}
body.dark .saveind{background:#1f2a3b;color:var(--muted)}
body.dark .flash{background:#0c2418;color:#9be4b7}
body.dark .flash.error{background:#3b1313;color:#ffb5b0}
body.dark th,body.dark td{border-color:var(--line)}
body.dark thead th{background:#101620;color:var(--muted)}
body.dark tbody tr:nth-child(even){background:#161d28}
body.dark .opt-pill{background:#101620}
body.dark .btn.sec{background:#101620;color:var(--ink);border-color:var(--line)}
body.dark .btn.sec:hover{background:#1f2a3b}

/* Dashboard site cards in dark mode: the colored 5px top strip stays so each
   site keeps its identity, but the body is forced dark so text reads. Kills
   the hardcoded light-tint→white gradient on .s-card and any inner panels
   that hardcoded #fff / #f8fafd / pale-blue backgrounds. */
body.dark .s-card{background:var(--card);border-color:var(--line);
  box-shadow:0 1px 3px rgba(0,0,0,.45),0 4px 12px rgba(0,0,0,.35)}
body.dark .s-card:hover{box-shadow:0 4px 10px rgba(0,0,0,.55),0 12px 28px rgba(0,0,0,.5)}
body.dark .s-stats{background:#101620;border-color:var(--line)}
body.dark .mini-cal{background:#101620;border-color:var(--line)}
body.dark .ta-bar{background:#101620}
body.dark .m-emp-head{background:linear-gradient(180deg,#1f2a3b,var(--card));border-color:var(--line)}
body.dark .s-ring-lbl b{color:#eaf2fb}

/* Entry grid (mgrid) cells now read everything from CSS variables redefined
   on body.dark above — no per-element dark overrides needed. The few items
   below are dark-only color tweaks for things that don't have a var. */
body.dark .mgrid .emp-col .kpill.op{background:#3a2a18;color:#f0b27a}
body.dark .mgrid .emp-col .kpill.sup{background:#142440;color:#7eb0e8}
body.dark .mgrid .cell input::placeholder{color:#5f6a7a}
body.dark .mgrid.covgrid td.cov-cell .ccell[data-s="future"]{color:#5f6a7a}

/* Legend swatches in the entry header still reference real cell colors */
body.dark .legend{border-top-color:var(--line)}

/* Master Index table */
body.dark .table-clean tbody tr:nth-child(even){background:#161d28}
body.dark .table-clean thead th{background:#101620;color:#cdd6e4;border-color:var(--line)}
body.dark .table-clean td{border-color:var(--line)}

/* ===== Dark-mode gap fixes — components that hardcoded light backgrounds ===== */
/* Base classes for elements converted away from inline light styles (light mode) */
.empty-hero{background:linear-gradient(180deg,#f7faff,#fff)}
#histBanner{background:linear-gradient(135deg,#fffbe6,#fdf0d4);border:1px solid #e7c560}
.viewonly-note{background:#f4f7fb;border-radius:8px}
.errbox{white-space:pre-wrap;font-family:inherit;color:#b3261e;background:#fdecea;padding:.8rem;border-radius:8px}
/* Dashboard cards */
body.dark .stat{background:linear-gradient(160deg,#161d28,#101620);border-color:var(--line)}
body.dark .prog{background:#101620;border-color:var(--line)}
body.dark .bar{background:#101620}
body.dark .pill.op{background:#3a2a18;color:#f0b27a}
body.dark .pill.sup{background:#142440;color:#7eb0e8}
/* Coverage day strip */
body.dark .cov-days{background:var(--card);border-color:var(--line)}
/* Pickers / popovers */
body.dark .mp-years{background:#101620;border-color:var(--line)}
body.dark .mp-month.disabled,body.dark .mp-month:disabled,
body.dark .mp-month.disabled:hover,body.dark .mp-month:disabled:hover{background:#161d28;color:#5a6678;border-color:var(--line)}
body.dark #opPickerHead{background:#101620;border-color:var(--line)}
body.dark .opp-code{background:#142440;color:#9dc4f0}
body.dark .opp-clear{background:#1f2a3b;color:#9dc4f0}
body.dark .msel-trigger{background:#101620;color:var(--ink);border-color:var(--line)}
/* Generic (non-grid) tables */
body.dark th{background:#101620;color:var(--muted)}
body.dark tbody tr:hover td,body.dark tr.weekend:hover td{background:var(--hover)}
/* Mobile entry surfaces */
body.dark .m-toolbar{background:var(--card);border-color:var(--line)}
body.dark .m-emp-list{background:var(--card);border-color:var(--line)}
body.dark .m-emp-row:hover,body.dark .m-emp-row:active{background:#1f2a3b}
body.dark .m-emp-row .kpill.op{background:#3a2a18;color:#f0b27a}
body.dark .m-emp-row .kpill.sup{background:#142440;color:#7eb0e8}
body.dark .m-day-card{background:var(--card);border-color:var(--line)}
body.dark .m-day-card.weekend{background:var(--wkend-cell)}
body.dark .m-day-card.locked{background:var(--locked-a)}
body.dark .m-day-card.saved{background:var(--saved-bg);border-color:var(--saved-bd)}
body.dark .m-day-badge.wknd{background:#2a221a;color:#d6b27b}
body.dark .m-day-badge.locked{background:#1f2a3b;color:#8593a7}
/* Elements converted from inline light styles */
body.dark .empty-hero{background:var(--card)}
body.dark #histBanner{background:linear-gradient(135deg,#2a2410,#332a14);border-color:#6e5a1f}
body.dark .viewonly-note{background:#101620}
body.dark .errbox{background:#3b1313;color:#ffb5b0}

/* ===== Shared modal/overlay shell (used by miOverlay, addOverlay, etc.) =====
   The HTML for those modals now uses class="overlay" and class="overlay-card"
   instead of inline styles, so we can theme them as bottom sheets on phones
   via the html.is-mobile .overlay rules below. */
.overlay{position:fixed;inset:0;background:rgba(20,30,50,.45);display:flex;align-items:center;justify-content:center;z-index:50;
  padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
.overlay-card{background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:14px;padding:1.2rem 1.3rem;
  box-shadow:0 12px 40px rgba(0,0,0,.25);max-width:520px;width:92%;max-height:92vh;overflow:auto}
.confirm-card{max-width:420px}
.confirm-msg{margin:0;color:var(--ink);line-height:1.55;font-size:.95rem}
.btn.btn-danger{background:#d23f31;border-color:#d23f31;color:#fff}
.btn.btn-danger:hover{background:#bb3327;border-color:#bb3327}

/* ============================================================================
   MOBILE LAYER (html.is-mobile *)
   Scoped strictly under html.is-mobile — never modifies desktop. Driven by the
   <head> boot script's detection (UA + screen + innerWidth) so in-app browsers
   that misreport viewport still get the phone layout. Wraps the same content
   the desktop renders; the entry view also has a dedicated renderEntryMobile()
   for stack-nav (site → employee → day-cards).
   ============================================================================ */
html.is-mobile{ -webkit-text-size-adjust:100%; }
html.is-mobile body{
  /* Stop pull-to-refresh chaining into Safari's gesture; keep tap highlight on-brand */
  overscroll-behavior-y:contain;
  -webkit-tap-highlight-color:rgba(47,111,179,.18);
}
/* Inputs default to 16px so iOS Safari doesn't zoom the page on focus */
html.is-mobile input,
html.is-mobile select,
html.is-mobile textarea{ font-size:16px; }

/* Wrap padding — small horizontal gutter + safe-area awareness */
html.is-mobile .wrap{
  padding:.6rem max(.6rem, env(safe-area-inset-right)) calc(.8rem + env(safe-area-inset-bottom)) max(.6rem, env(safe-area-inset-left));
  margin:.4rem auto;
}

/* Topbar — compact on phones. Brand shrinks, sub-line hides if cramped, nav
   wraps to its own row. safe-area top padding so iOS notch doesn't overlap. */
html.is-mobile .topbar{
  padding:max(.4rem, env(safe-area-inset-top)) max(.6rem, env(safe-area-inset-right)) .45rem max(.6rem, env(safe-area-inset-left));
  gap:.5rem; row-gap:.35rem;
}
/* Keep the brand block on phones (like other VCB apps do) but pack it tight:
   logo + divider + titles + gear icon all on row 1, then the 3 text nav
   buttons spread evenly across row 2. The gear is absolute-positioned to the
   top-right of the topbar (matches VCB's other apps where settings sits at
   the far right of the banner). */
html.is-mobile .topbar{ row-gap:.4rem; position:relative }
html.is-mobile .topbar .brand{ font-size:1.1rem }
html.is-mobile .topbar .brand-div{ height:30px }
html.is-mobile .topbar .brand-titles{ display:flex; flex-direction:column; justify-content:center; min-width:0; flex:1 1 auto;
  min-height:40px; /* match the floating gear so row 1 contains it instead of letting it dip into row 2 */
  padding-right:50px /* leave room for floating gear */ }
html.is-mobile .topbar .brand-t1{ font-size:.72rem; letter-spacing:.1em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
html.is-mobile .topbar .brand-t2{ font-size:.68rem; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
html.is-mobile .topbar .who{ display:none } /* email lives in Settings → About */

/* Row 2 — text nav buttons spread evenly */
html.is-mobile .topbar nav{ width:100%; margin-left:0; gap:.4rem; display:flex; flex-wrap:nowrap; padding-bottom:.15rem; align-items:stretch }
html.is-mobile .topbar nav a{ padding:.55rem .85rem; font-size:.92rem; min-height:44px;
  display:inline-flex; align-items:center; justify-content:center; box-sizing:border-box;
  flex:1 1 0; min-width:0 }   /* equal-width tabs fill the row */

/* Gear icon — floats to the top-right of the banner, NOT in the nav row.
   The gear nav item carries an inline style="font-size:1.15rem;padding:.45rem .8rem"
   for desktop; on mobile we override it (!important is required) and pull it
   out of nav's flex flow with position:absolute so it sits beside the brand
   titles on row 1 while the three text buttons evenly share row 2. */
html.is-mobile .topbar nav a.gear{
  position:absolute;
  top:max(.55rem, env(safe-area-inset-top));
  right:max(.65rem, env(safe-area-inset-right));
  z-index:3;
  flex:0 0 auto !important;
  width:36px; height:36px; padding:0 !important; min-height:0 !important;
  display:inline-flex; align-items:center; justify-content:center;
  /* Pixel-match the gear button in VCB's other web apps: translucent white
     fill over the topbar gradient, hairline border, ~8px radius, white icon. */
  background:rgba(255,255,255,.18) !important;
  border:1px solid rgba(255,255,255,.30) !important;
  border-radius:8px !important;
  color:#fff !important;
  font-size:1.05rem !important;
  line-height:1 !important;
}
html.is-mobile .topbar nav a.gear:hover,
html.is-mobile .topbar nav a.gear:active{
  background:rgba(255,255,255,.28) !important;
  border-color:rgba(255,255,255,.42) !important;
}

/* Dashboard / entry header .statrow was inline-styled with margin-left:auto
   and max-width:230px to right-pack widgets on desktop. On mobile those rules
   leave awkward empty gutters when the row wraps. Force each child to the full
   row width and remove the auto-margin so things stack flush left. */
html.is-mobile .statrow{ gap:.35rem; align-items:stretch; margin-bottom:.4rem }
html.is-mobile .statrow > div{ width:100%; max-width:100% !important; margin-left:0 !important; min-width:0 }
html.is-mobile .statrow .viewseg,
html.is-mobile .statrow .seg{ display:flex; width:100% }
html.is-mobile .statrow .viewseg button,
html.is-mobile .statrow .seg button{ flex:1 1 0 }

/* Slim down the dashboard "filter" card (title + subtitle + view-toggle +
   month-picker). It was eating ~1cm of vertical that the user can't get back
   on a phone — every pixel before the first site card counts. */
html.is-mobile #view > .card:first-child{ padding:.6rem .85rem .65rem !important; margin-bottom:.6rem }
html.is-mobile #view > .card:first-child h1{ font-size:1.25rem; line-height:1.2 }
html.is-mobile #view > .card:first-child .sub{ font-size:.78rem; line-height:1.25; margin-bottom:.45rem !important }
html.is-mobile .statrow .fld label{ margin-bottom:.1rem; font-size:.7rem }
html.is-mobile .statrow .fld{ display:flex; flex-direction:column; gap:.05rem }

/* Cards: a bit more vertical room so taps don't feel cramped */
html.is-mobile .card{ padding:1rem 1rem; border-radius:12px }

/* Dashboard grid → single column on phones (desktop uses min 440px tiles) */
html.is-mobile .site-grid{ grid-template-columns:1fr; gap:.85rem }
html.is-mobile .s-card{ border-radius:14px }
html.is-mobile .s-card .s-body{ padding:1rem .95rem 1.1rem }
html.is-mobile .s-card .btn.s-go{ min-height:48px; font-size:1rem }

/* Site card header on phones: title gets full width on top, the ring/label
   group sits BELOW centered, instead of fighting for horizontal space.
   Eliminates the "company name wrapping into 3 lines" problem from the
   original phone screenshot. */
html.is-mobile .s-head{ flex-direction:column; align-items:stretch; gap:.65rem; margin-bottom:.7rem }
html.is-mobile .s-head h2{ font-size:1.05rem; line-height:1.25 }
html.is-mobile .s-head .hint{ font-size:.78rem; white-space:normal }
html.is-mobile .s-ringwrap{ align-self:center; gap:.7rem }
html.is-mobile .s-ring{ width:54px; height:54px; flex:0 0 54px }
html.is-mobile .s-ring svg{ width:54px; height:54px }
html.is-mobile .s-ring-pct{ font-size:.82rem }
html.is-mobile .s-ring-lbl{ font-size:.78rem; text-align:left }
html.is-mobile .s-stats-mini b{ font-size:1.4rem }

/* Stats grid (107 / 967 / 33%): keep 3 columns but tighten so labels don't
   wrap mid-word ("ปฏิบัติ / การ"). */
html.is-mobile .s-stats{ grid-template-columns:1fr 1fr 1fr; gap:.4rem; padding:.6rem .55rem }
html.is-mobile .s-stats b{ font-size:1.15rem }
html.is-mobile .s-stats span{ font-size:.7rem; line-height:1.15; display:block }
html.is-mobile .s-stats .hint{ font-size:.62rem; line-height:1.2; margin-top:.1rem }

/* Mini-calendar day strip: explicit horizontal scroll with a soft right-edge
   fade so users know there's more month off-screen. */
html.is-mobile .mini-cal{ overflow-x:auto; -webkit-overflow-scrolling:touch;
  -webkit-mask-image:linear-gradient(90deg,#000 92%,transparent);
          mask-image:linear-gradient(90deg,#000 92%,transparent);
  padding-right:14px }
html.is-mobile .mini-cal::-webkit-scrollbar{ display:none }
html.is-mobile .mini-cal .mc{ min-width:24px; font-size:.62rem }

/* Touch-friendly buttons everywhere */
html.is-mobile .btn{ min-height:44px; padding:0 1rem }
html.is-mobile .btn.sec{ min-height:42px }

/* Mobile employee-list rows (renderMobileEmpList) — ≥48px tall */
html.is-mobile .m-emp-row{ min-height:56px; padding:.85rem 1rem }
html.is-mobile .m-emp-row .nm{ font-size:1rem }
html.is-mobile .m-emp-avatar{ width:36px; height:36px; font-size:1rem }

/* Sticky back bar at the top of stack-nav child panes */
html.is-mobile .m-back{
  position:sticky; top:0; z-index:8;
  display:flex; align-items:center; gap:.4rem;
  width:100%; min-height:44px;
  background:var(--card); border:0; border-bottom:1px solid var(--line);
  padding:.6rem .9rem; margin:-.4rem -.6rem .55rem; /* bleed to the wrap edges */
  font:inherit; font-weight:700; font-size:.95rem; color:var(--blue);
  cursor:pointer;
}
html.is-mobile .m-back:active{ background:#eef4fb }
body.dark.is-mobile .m-back:active,
html.is-mobile body.dark .m-back:active{ background:#1f2a3b }

/* Day cards — pad scroll bottom so the last card clears the home-bar area */
html.is-mobile .m-day-card{ padding:.85rem .95rem; border-radius:12px }
html.is-mobile .m-day-card:last-child{ margin-bottom:calc(.55rem + env(safe-area-inset-bottom)) }

/* Tables that don't fit phone width → horizontal scroll instead of breaking layout */
html.is-mobile .gridwrap{ -webkit-overflow-scrolling:touch }

/* Master Index becomes per-row cards on phones (the desktop table is unusable
   at 390px). Render layer is unchanged — we just stack visually. */
html.is-mobile #miTable{ display:block; border:0 }
html.is-mobile #miTable thead{ display:none }
html.is-mobile #miTable tbody,
html.is-mobile #miTable tr,
html.is-mobile #miTable td{ display:block; width:auto }
html.is-mobile #miTable tr{ background:var(--card); border:1px solid var(--line); border-radius:12px; padding:.7rem .9rem; margin-bottom:.55rem; box-shadow:var(--shadow) }
html.is-mobile #miTable td{ border:0; padding:.22rem 0; min-height:0 }
html.is-mobile #miTable td:empty{ display:none }

/* Settings page — slimmer section gutter on phones */
html.is-mobile .settings .sect{ margin-bottom:1.05rem; padding-bottom:.85rem }
html.is-mobile .opt-pill{ min-height:44px; padding:.6rem 1rem }

/* ----- Overlays as bottom sheets on phones -----
   Backdrop aligns to bottom; card snaps to full width with rounded TOP corners
   only, drag-bar grabbie hint, and safe-area bottom padding so the last button
   sits above the home indicator. */
html.is-mobile .overlay{ align-items:flex-end; padding:0 }
html.is-mobile .overlay-card{
  width:100%; max-width:100%; max-height:92vh;
  border-radius:18px 18px 0 0; border-bottom:0;
  padding:1.1rem 1.1rem calc(1.1rem + env(safe-area-inset-bottom));
  box-shadow:0 -8px 32px rgba(0,0,0,.28);
  animation:sheetSlideUp .22s ease-out;
}
html.is-mobile .overlay-card::before{
  content:""; display:block; width:36px; height:4px;
  background:var(--line); border-radius:2px;
  margin:-.45rem auto .65rem;
}
@keyframes sheetSlideUp{
  from{ transform:translateY(100%); opacity:.6 }
  to  { transform:translateY(0);    opacity:1  }
}
</style>
</head>
<body>
  <div class="topbar" id="topbar" style="display:none">
    <a class="brand" id="brandLink" href="https://script.google.com/a/macros/vcb-con.com/s/AKfycbxqIk8Qql3XWXIWn_p0f0FSd04i-FcWZjoXgRErlU5bTXUkpujbQ4ZN4mWco6HEQFUB/exec" target="_top" title="กลับไปหน้าหลัก VCB Connect">VCB Group</a>
    <span class="brand-div"></span>
    <div class="brand-titles">
      <div class="brand-t1">HR Daily Work Log</div>
      <div class="brand-t2">กลุ่มวิจิตรภัณฑ์ก่อสร้าง · บันทึกการทำงานรายวัน</div>
    </div>
    <nav id="nav"></nav>
  </div>

  <div class="wrap">
    <div class="flash" id="flash"></div>
    <div id="loading"><div class="spinner"></div>
      <p class="muted" style="text-align:center">กำลังโหลด… <span id="bootStage"></span></p></div>
    <div id="view"></div>
  </div>

<script>
var TH_M = ['', 'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
var TH_M_SHORT = ['', 'ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
var EN_M = ['', 'January','February','March','April','May','June','July','August','September','October','November','December'];
var EN_M_SHORT = ['', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
// Language-aware accessors. Use these instead of TH_M[m] / TH_M_SHORT[m]
// anywhere we render to the user. Keep TH_M_* around because some code
// reads canonical Thai for non-UI purposes (export filenames, server msgs).
function MNAME(m){ return (LANG==='en' ? EN_M : TH_M)[m] || ''; }
function MSHORT(m){ return (LANG==='en' ? EN_M_SHORT : TH_M_SHORT)[m] || ''; }
var TH_DOW = ['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.'];
// Distinct accent color per project site — for cards, headers, buttons.
var SITE_COLORS = {
  bangtoei:       { c:'#0d9488', tint:'#e6f5f3' },   // teal
  bangwua:        { c:'#e76f51', tint:'#fdeee7' },   // coral
  phutthamonthon: { c:'#2563eb', tint:'#e6edfd' },   // royal blue
  sai5:           { c:'#d97706', tint:'#fdefdb' },   // amber
  suphanburi:     { c:'#7c3aed', tint:'#efe7fd' },   // violet
  banphaeo:       { c:'#0891b2', tint:'#dff3f8' },   // cyan
  drivers:        { c:'#be185d', tint:'#fbe5ee' }    // rose
};
function siteAccent(key){ return SITE_COLORS[key] || { c:'#1d4e89', tint:'#e6effb' }; }
var BOOT = null, TODAY = new Date();
var CUR = { y: TODAY.getFullYear(), m: TODAY.getMonth() + 1 };
// entry-screen state
var ES = { site:'', data:null, queue:{}, saveTimer:null, saveState:'idle',
           viewMode:'week', weekStart:0, adminUnlock:false,
           mobileEid:'' };  // mobile-only: selected employee for the per-emp month view
/* ========== PREFERENCES (settings page) ========== */
function _ls(k, def){ try { return localStorage.getItem(k) || def; } catch(e){ return def; } }
function _lsSet(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
var LANG = _ls('hr_lang', 'th');           // 'th' | 'en'
var THEME = _ls('hr_theme', 'light');      // 'light' | 'dark' | 'auto'
var YEAR_FMT = _ls('hr_yearfmt', 'be');    // 'be' (2569) | 'g' (2026)
var DASH_DEFAULT = _ls('hr_dashview', 'progress'); // 'progress' | 'topact'
var CELL_NAMES = _ls('hr_cellnames', 'code');  // weekly grid: 'code' (A-1 / 5) | 'name' (full activity name / 5)
// Per-device list of site keys the user has hidden (e.g. finished projects).
// Hidden sites drop out of the dashboard and the entry site dropdown.
var HIDDEN_SITES = (function(){ try { return JSON.parse(_ls('hr_hidden_sites','[]')) || []; } catch(e){ return []; } })();
var _sitesVisChanged = false;
function isSiteHidden(k){ return HIDDEN_SITES.indexOf(k) >= 0; }
function setSiteHidden(k, hide){
  var i = HIDDEN_SITES.indexOf(k);
  if(hide && i < 0) HIDDEN_SITES.push(k);
  else if(!hide && i >= 0) HIDDEN_SITES.splice(i,1);
  _lsSet('hr_hidden_sites', JSON.stringify(HIDDEN_SITES));
}
function visibleSites(){ return (BOOT.sites||[]).filter(function(s){ return !isSiteHidden(s.key); }); }
var DASH = { view: DASH_DEFAULT };   // 'progress' (ความคืบหน้า) | 'topact' (งานหลัก)

/* Remember where the user was so an accidental refresh returns them to the same
   page (and, mid-entry, the same site/month/week) instead of always bouncing to
   the dashboard. Snapshotted on every go() and again on page-hide so the live
   entry sub-state is captured even after the initial render. */
function saveNavState(){
  try{
    _lsSet('hr_nav', JSON.stringify({
      v: window._curView || 'dashboard',
      y: CUR.y, m: CUR.m,
      site: ES.site || '', vm: ES.viewMode || 'week', ws: ES.weekStart || 0
    }));
  }catch(e){}
}
function restoreNavState(){
  var st=null;
  try{ var raw=_ls('hr_nav',''); st = raw ? JSON.parse(raw) : null; }catch(e){ st=null; }
  if(!st || !st.v) return go('dashboard');
  // Restore the selected month only if it isn't in the future (no future data).
  if(st.y && st.m){
    var fy=TODAY.getFullYear(), fm=TODAY.getMonth()+1;
    if(st.y < fy || (st.y===fy && st.m<=fm)){ CUR.y=st.y; CUR.m=st.m; }
  }
  var view=st.v;
  // Drop routes this account can't (or no longer) access.
  if(view==='entry'    && !BOOT.canEntry) view='dashboard';
  if(view==='index'    && !BOOT.isAdmin)  view='dashboard';
  if(view==='settings' && !BOOT.isAdmin)  view='dashboard';
  if(view==='entry'){
    var ok = st.site && (BOOT.sites||[]).some(function(s){return s.key===st.site;});
    if(ok){ ES.site=st.site; ES.viewMode=(st.vm==='coverage'?'coverage':'week'); ES.weekStart=st.ws||0; }
  }
  go(view);
}

/* Minimal i18n. Strings not in this dictionary fall back to the literal text
   passed to t(). That lets us translate gradually — high-visibility chrome
   first, edge-case messages later. */
var T = {
  'แดชบอร์ด':                 { en: 'Dashboard' },
  'บันทึกงาน':                 { en: 'Entry' },
  'ดัชนีงาน':                  { en: 'Work Index' },
  'กำหนดสิทธิ์':                { en: 'Permissions' },
  'ความคืบหน้า':              { en: 'Progress' },
  'งานหลัก':                   { en: 'Top Activities' },
  'รายอาทิตย์':                { en: 'Weekly' },
  'ภาพรวม':                    { en: 'Overview' },
  'หน่วยงาน':                  { en: 'Site' },
  'เดือน':                     { en: 'Month' },
  'มุมมอง':                    { en: 'View' },
  'สัปดาห์':                   { en: 'Week' },
  'พนักงาน':                   { en: 'Employees' },
  'สนับสนุน':                  { en: 'Support' },
  'ปฏิบัติการ':                { en: 'Operation' },
  'เปิดบันทึก →':              { en: 'Open log →' },
  'เริ่มบันทึกแล้ว':           { en: 'Started recording' },
  'รายการ':                    { en: 'entries' },
  'เติมข้อมูล':                { en: 'Fill rate' },
  'ช่อง':                      { en: 'cells' },
  'มุมมองอย่างเดียว — ติดต่อแอดมินเพื่อขอสิทธิ์บันทึก': { en: 'View only — contact admin for edit access' },
  'อื่นๆ':                     { en: 'Others' },
  'ยังไม่มีบันทึกในเดือนนี้':  { en: 'No entries this month' },
  'ยังไม่มีหน่วยงานในสิทธิ์ของคุณ': { en: 'No sites in your access' },
  'ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์ดูหน่วยงาน': { en: 'Contact admin for site access' },
  'พร้อมแก้ไข':                { en: 'Ready' },
  'แก้ไขที่ยังไม่บันทึก':      { en: 'Unsaved changes' },
  'กำลังบันทึก…':              { en: 'Saving…' },
  'กำลังบันทึก...':            { en: 'Saving…' },
  'บันทึกแล้ว':                { en: 'Saved' },
  'บันทึกไม่สำเร็จ':           { en: 'Save failed' },
  'กำลังโหลด…':                { en: 'Loading…' },
  'กำลังเตรียมไฟล์…':          { en: 'Preparing file…' },
  'บันทึก':                    { en: 'Save' },
  'เพิ่ม':                     { en: 'Add' },
  'ลบ':                        { en: 'Delete' },
  'แก้ไข':                     { en: 'Edit' },
  'ยกเลิก':                    { en: 'Cancel' },
  'ตกลง':                      { en: 'OK' },
  'ยืนยัน':                    { en: 'Confirm' },
  'อีเมล':                     { en: 'Email' },
  'บทบาท':                     { en: 'Role' },
  'ดัชนีงาน (Master Work Index)': { en: 'Work Index (Master)' },
  'รหัสงาน':                   { en: 'Job Code' },
  'ชื่อ':                      { en: 'Name' },
  'คำอธิบาย':                  { en: 'Description' },
  'หมวดหมู่':                  { en: 'Category' },
  'ใช้ที่หน่วยงาน':            { en: 'Used at sites' },
  '+ เพิ่มรายการ':             { en: '+ Add entry' },
  '+ เพิ่มพนักงาน':            { en: '+ Add employee' },
  'ผู้ใช้และสิทธิ์':           { en: 'Users & Permissions' },
  'ตั้งค่า':                   { en: 'Settings' },
  'กลับไปหน้าหลัก VCB Connect': { en: 'Back to VCB Connect home' },
  'ธีม':                       { en: 'Theme' },
  'สว่าง':                     { en: 'Light' },
  'มืด':                       { en: 'Dark' },
  'อัตโนมัติ (ตามระบบ)':       { en: 'Auto (system)' },
  'ภาษา':                      { en: 'Language' },
  'ไทย':                       { en: 'Thai' },
  'อังกฤษ':                    { en: 'English' },
  'รูปแบบปี':                  { en: 'Year format' },
  'พุทธศักราช (2569)':         { en: 'Buddhist Era (2569)' },
  'คริสต์ศักราช (2026)':       { en: 'Gregorian (2026)' },
  'มุมมองเริ่มต้นของแดชบอร์ด': { en: 'Default dashboard view' },
  'การแสดงในตารางสัปดาห์': { en: 'Weekly grid display' },
  'ไฮไลต์รหัส': { en: 'Highlight code' },
  '+ เลือกรหัสเพื่อเน้น…': { en: '+ Pick a code to highlight…' },
  'เซลล์': { en: 'cells' },
  'คน': { en: 'people' },
  'เอาออก': { en: 'Remove' },
  'ย้ายหน่วยงาน': { en: 'Transfer site' },
  'ย้ายพนักงาน': { en: 'Transfer employee' },
  'ลบพนักงาน': { en: 'Remove employee' },
  'ย้ายเข้าจาก': { en: 'Moved in from' },
  'ย้ายออกไป': { en: 'Moved out to' },
  'ย้ายเข้า': { en: 'Moved in' },
  'ไม่ได้สังกัดหน่วยงานนี้': { en: 'Not at this site on this day' },
  'ไม่มีหน่วยงานปลายทาง': { en: 'No destination site' },
  'ย้ายไปหน่วยงาน': { en: 'Move to site' },
  'มีผลตั้งแต่วันที่': { en: 'Effective from' },
  'พนักงานจะอยู่หน่วยงานเดิมก่อนวันที่นี้ และอยู่หน่วยงานใหม่ตั้งแต่วันนี้เป็นต้นไป — อยู่ได้ทีละหน่วยงานต่อวันเท่านั้น': { en: 'They stay at the old site before this date and the new site from this date on — only one site per day.' },
  'ย้าย': { en: 'Move' },
  'กรอกข้อมูลให้ครบ': { en: 'Fill in all fields' },
  'กำลังย้าย…': { en: 'Moving…' },
  'ย้ายหน่วยงานแล้ว': { en: 'Transferred' },
  'ย้ายไม่สำเร็จ': { en: 'Transfer failed' },
  'ประวัติการบันทึกจะยังอยู่ แต่จะไม่แสดงในรายชื่ออีก': { en: 'Their logged history is kept, but they will no longer appear in the list.' },
  'ลบพนักงานแล้ว': { en: 'Employee removed' },
  'ลบไม่สำเร็จ': { en: 'Remove failed' },
  'เป็นหน่วยงานเดิมอยู่แล้ว': { en: 'Already at that site' },
  'วันที่ต้องไม่ก่อนการย้ายครั้งก่อน': { en: 'Date cannot be before the previous transfer' },
  'ปัจจุบัน': { en: 'Currently at' },
  'ย้ายผิด? เลือกหน่วยงานเดิมแล้วใช้วันที่เดียวกัน เพื่อย้ายกลับ/ยกเลิกการย้าย': { en: 'Wrong move? Pick the old site with the SAME date to move back / undo it.' },
  'ไม่พบหน่วยงานปลายทาง': { en: 'Destination site not found' },
  'ไม่พบพนักงาน': { en: 'Employee not found' },
  'ข้อมูลไม่ครบ': { en: 'Incomplete data' },
  'แก้ไขย้อนหลังล่าสุด': { en: 'Last back-dated edit' },
  'แก้ไขย้อนหลัง': { en: 'edited' },
  'แก้ไขย้อนหลัง (admin)': { en: 'Back-date edit (admin)' },
  'แก้ไขย้อนหลังเปิดอยู่': { en: 'Back-date edit ON' },
  'ผู้ดูแลระบบเท่านั้น': { en: 'Admins only' },
  'โดย': { en: 'by' },
  'กิจกรรมหลัก': { en: 'Top Activities' },
  'หมวดงานหลัก': { en: 'Top Categories' },
  'วันทำงาน': { en: 'mandays' },
  'ดูทั้งหมด': { en: 'Show all' },
  'ย่อ': { en: 'Collapse' },
  'แสดงกิจกรรมเป็นรหัส (A-1) หรือชื่อเต็ม — หมวดงานยังคงเป็นตัวเลขเสมอ': { en: 'Show the activity as a code (A-1) or its full name — Work Category stays a number' },
  'รหัส (A-1 / 5)': { en: 'Code (A-1 / 5)' },
  'ชื่อกิจกรรม (เต็ม) / 5': { en: 'Activity name (full) / 5' },
  'ระยะเวลาแก้ย้อนหลัง':       { en: 'Edit-back window' },
  'วัน':                       { en: 'days' },
  'เกี่ยวกับระบบ':             { en: 'About' },
  'เวอร์ชัน':                  { en: 'Version' },
  'หน่วยงานที่ดูแล':           { en: 'Sites managed' },
  'เลือกหน่วยงาน...':          { en: 'Choose site...' },
  'เลือกหน่วยงาน':              { en: 'Choose site' },
  'ภาพรวมการบันทึกการทำงานรายหน่วยงาน': { en: 'Daily work-log overview by site' },
  'การตั้งค่าจะถูกเก็บไว้ในเครื่อง (แต่ละเครื่องอาจไม่เหมือนกัน)': { en: 'Preferences are saved per device (each device can differ)' },
  'โหมดสว่าง โหมดมืด หรือทำตามระบบของเครื่อง': { en: 'Light, dark, or follow the system theme' },
  'สลับภาษาที่แสดงในเมนูและฉลาก (ข้อมูลจริงคงเดิม)': { en: 'Switch the language for menus & labels (data is unchanged)' },
  'แสดงปีในเครื่องมือเลือกเดือนเป็น พ.ศ. หรือ ค.ศ.': { en: 'Show year in the month picker as Buddhist or Gregorian Era' },
  'เลือกว่าจะเปิดแดชบอร์ดด้วยมุมมองไหนเป็นค่าเริ่มต้น': { en: 'Choose which view the dashboard opens with by default' },
  'Manager แก้ไขเซลล์ย้อนหลังได้กี่วัน · admin แก้ได้ตลอด · บังคับใช้ทั้งระบบ': { en: 'How many days back managers can edit · admin always can · applies system-wide' },
  'เพิ่มอีเมลเจ้าหน้าที่ที่จะบันทึกข้อมูล แล้วกำหนดบทบาท/หน่วยงาน': { en: 'Add the email of an HR user, then assign role/site' },
  'ไม่สำเร็จ':                 { en: 'Failed' },
  'รายการใน':                  { en: 'entries in' },
  'รายการ':                    { en: 'records' },
  'พนักงานที่บันทึกอย่างน้อย 1 วันใน': { en: 'Employees with at least 1 day recorded in ' },
  'พนักงานทั้งหมดในหน่วยงาน':  { en: 'Total employees at this site' },
  // Company names — the two known VCB entities. Free-text DB field, so other
  // companies just pass through t() unchanged.
  'บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด': { en: 'Vichitbhan Construction Co.,Ltd.' },
  'บริษัท ชวนา เอ็นจิเนียริ่ง จำกัด': { en: 'Chavana Engineering Co.,Ltd.' },
  'แตะชื่อพนักงานเพื่อดู/บันทึกของเดือน': { en: 'Tap an employee to view/record their entries for' },
  'ลบสิทธิ์ของ':                { en: 'Revoke access for' },
  'กำลังลบ…':                   { en: 'Deleting…' },
  'ลบแล้ว':                     { en: 'Deleted' },
  'ลบไม่สำเร็จ':                { en: 'Delete failed' },
  'กรอกอีเมล':                  { en: 'Enter an email' },
  'บันทึกผู้ใช้แล้ว':           { en: 'User saved' },
  'รายการมาตรฐานของทีมงาน/ประเภทงานที่ใช้ทุกหน่วยงาน · ใช้เป็นตัวเลือกในการบันทึกงานปฏิบัติการ': { en: 'Standard list of teams / work types shared across all sites — used as picker options when recording operation logs' },
  'ส่งออกดัชนีงานทั้งหมดเป็นไฟล์ Excel (.xlsx) โดยคงรูปแบบเดิมไว้': { en: 'Export the full Work Index as Excel (.xlsx) with formatting preserved' },
  '(ทุกหน่วยงาน — admin)':     { en: '(All sites — admin)' },
  'admin เข้าถึงทุกหน่วยงานโดยอัตโนมัติ · manager คลิกดรอปดาวน์เพื่อเลือกหลายหน่วยงาน': { en: 'admin = all sites automatically · manager = click dropdown to pick multiple sites' },
  'หน่วยงานทั้งหมดถูกซ่อนอยู่ — เปิดได้ที่ ⚙ ตั้งค่า': { en: 'All sites are hidden — re-enable in ⚙ Settings' },
  'กิจกรรม': { en: 'Activities' },
  'รายงานวันทำงาน': { en: 'Manday report' },
  'รายงาน': { en: 'Report' },
  'ส่งออกสรุปวันทำงานรายหมวดงาน/กิจกรรม สำหรับเดือนนี้ (Excel)': { en: 'Export this month manday summary by Work Category / Activity (Excel)' },
  'หมวดงาน': { en: 'Work Categories' },
  'หน่วยงานทั้งหมดถูกซ่อนอยู่': { en: 'All sites are hidden' },
  'เปิดหน่วยงานที่ต้องการได้ที่ ⚙ ตั้งค่า › หน่วยงานที่แสดง': { en: 'Re-enable sites in ⚙ Settings › Visible sites' },
  'ความสมบูรณ์ของการบันทึก (เฉพาะวันทำงานที่ผ่านมา) ใน': { en: 'Recording completeness (workdays passed only) in ' },
  'บันทึกครบ': { en: 'Complete' },
  'พนักงานที่ลงอย่างน้อย 1 วัน': { en: 'Employees with at least 1 day logged' },
  'รายการมาตรฐานที่ใช้บันทึกงาน — แต่ละเซลล์เลือก 2 ชั้น: กิจกรรม แล้วตามด้วย หมวดงาน': { en: 'Standard list for logging work — each cell picks 2 layers: Activity, then Work Category' },
  'กิจกรรม (Activity)': { en: 'Activity' },
  'หมวดงาน (Work Category)': { en: 'Work Category' },
  'นำเข้ารายการดัชนีงาน': { en: 'Import index items' },
  'นำเข้าหมวดงาน': { en: 'Import Work Categories' },
  'วิธีนำเข้า': { en: 'How to import' },
  'กดปุ่ม “ดาวน์โหลดเทมเพลต” เพื่อรับไฟล์ Excel ที่มีหัวคอลัมน์ถูกต้อง': { en: 'Click "Download template" to get an Excel file with the correct column headers.' },
  'กรอกข้อมูลในไฟล์ตามคอลัมน์ที่กำหนด (มีตัวอย่างให้ในแถวที่ 2)': { en: 'Fill in the file following the given columns (row 2 shows an example).' },
  'เลือกทุกแถวที่กรอกแล้วใน Excel → คัดลอก (Ctrl+C) → วางในช่องด้านล่าง (Ctrl+V)': { en: 'Select your filled rows in Excel → copy (Ctrl+C) → paste in the box below (Ctrl+V).' },
  'ลำดับคอลัมน์:': { en: 'Column order:' },
  'ดาวน์โหลดเทมเพลต Excel': { en: 'Download Excel template' },
  'ส่งออก Excel': { en: 'Export Excel' },
  'ดาวน์โหลดเทมเพลตเปล่า': { en: 'Download blank template' },
  'เลือกไฟล์ที่กรอกแล้ว': { en: 'Choose filled file' },
  'ดาวน์โหลดเทมเพลตเปล่าด้านล่าง': { en: 'Download the blank template below' },
  'กรอกข้อมูลลงในไฟล์ Excel ตามคอลัมน์ที่กำหนด (เขียนทับแถวตัวอย่างได้)': { en: 'Fill in the Excel file following the columns (overwrite the example row)' },
  'กด “เลือกไฟล์ที่กรอกแล้ว” แล้วเลือกไฟล์ที่บันทึกไว้ — ระบบจะนำเข้าให้ทันที': { en: 'Click “Choose filled file” and pick your saved file — it imports immediately' },
  'อ่านไฟล์ไม่สำเร็จ': { en: 'Could not read the file' },
  'ปิด': { en: 'Close' },
  'ลบรายการ': { en: 'Delete item' },
  'ออกจากดัชนี?': { en: 'from the index?' },
  'ลบสิทธิ์ผู้ใช้': { en: 'Remove user access' },
  'วางข้อมูลจาก Excel — หนึ่งบรรทัดต่อหนึ่งหมวดงาน · คอลัมน์: รหัส, ชื่อ (ไทย), ชื่อ (อังกฤษ) (คั่นด้วย Tab หรือ ,) · แถวหัวตารางใส่หรือไม่ก็ได้': { en: 'Paste from Excel — one row per Work Category · columns: code, name (Thai), name (English) (Tab or comma separated) · header row optional' },
  'วางข้อมูลจาก Excel — หนึ่งบรรทัดต่อหนึ่งงาน · คอลัมน์: ชื่อ, คำอธิบาย, หมวดหมู่, รหัส (คั่นด้วย Tab หรือ ,) · แถวหัวตารางใส่หรือไม่ก็ได้': { en: 'Paste from Excel — one row per item · columns: name, description, category, code (Tab or comma separated) · header row optional' },
  'นำเข้า': { en: 'Import' },
  'ยังไม่มีข้อมูลที่จะนำเข้า': { en: 'Nothing to import' },
  'กำลังนำเข้า…': { en: 'Importing…' },
  'นำเข้าแล้ว': { en: 'Imported' },
  'อัปเดต': { en: 'Updated' },
  'ข้าม': { en: 'Skipped' },
  'นำเข้าไม่สำเร็จ': { en: 'Import failed' },
  'หมวดงาน (ชั้นที่ 2)': { en: 'Work Category (layer 2)' },
  '+ เพิ่มหมวดงาน': { en: '+ Add Work Category' },
  'รหัส': { en: 'Code' },
  'หมวดงาน (ไทย)': { en: 'Name (Thai)' },
  'ยังไม่มีรายการ': { en: 'No items yet' },
  'เพิ่มหมวดงาน': { en: 'Add Work Category' },
  'แก้ไขหมวดงาน': { en: 'Edit Work Category' },
  'เว้นว่างเพื่อสร้างเลขถัดไปอัตโนมัติ': { en: 'Leave blank to auto-number' },
  'กรอกชื่อ': { en: 'Enter a name' },
  'คลิกหัวคอลัมน์เพื่อจัดเรียง': { en: 'Click a column header to sort' },
  '+ เพิ่มกิจกรรม': { en: '+ Add Activity' },
  'เลือกหรือพิมพ์หมวดหมู่ใหม่': { en: 'Select or type a new category' },
  'เลือกหน่วยงานและสัปดาห์': { en: 'Choose site and week' },
  'แถบด้านบน: เลือกหน่วยงาน เดือน และสัปดาห์ที่ต้องการบันทึก': { en: 'Top bar: choose the site, month, and week to log' },
  'คลิกช่องว่างของพนักงาน': { en: 'Click an empty cell for the employee' },
  'คลิกช่องที่ขึ้น “+ เลือกงาน” แล้วเลือกกิจกรรม — ถ้าระบบถามหมวดงาน ให้เลือกต่ออีกหนึ่งครั้ง': { en: 'Click a cell showing “+ Select work”, choose the Activity — if it asks for a Work Category, pick one more' },
  'ไม่ต้องกดบันทึก': { en: 'No need to save' },
  'ระบบบันทึกให้อัตโนมัติ — ช่องจะแสดงรหัสงานเมื่อบันทึกเสร็จ': { en: 'It saves automatically — the cell shows the code once saved' },
  'ทำ 2 งานในวันเดียว': { en: 'Two tasks in one day' },
  'หลังกรอกงานแรกแล้ว ปุ่ม “+ งานที่ 2” จะปรากฏใต้ช่อง · ระบบถ่วงน้ำหนักให้อัตโนมัติงานละ 50% (0.5 วันทำงาน) รวมเป็น 1 วันทำงานต่อคนต่อวันเสมอ — บนแดชบอร์ดจึงแบ่งครึ่ง-ครึ่ง ไม่ใช่ 1 วันทำงานต่องาน เพื่อไม่ให้วันทำงานรวมเกินจำนวนพนักงาน': { en: 'After the first task, a “+ Task 2” button appears below · the system auto-weights each task at 50% (0.5 man-day), always totaling 1 man-day per person per day — so the dashboard splits it half-and-half, not 1 man-day per task, keeping total man-days within headcount' },
  'แก้ไข & ดูภาพรวม': { en: 'Edit & Overview' },
  'แก้ย้อนหลังได้ตามกำหนด และกรอกล่วงหน้าได้ถึงพรุ่งนี้ · แท็บ “ภาพรวม” = แผนที่สี: เขียว = ครบ, เหลือง = ยังแก้ได้, แดง = ขาด': { en: 'Edit back within the limit, and log up to tomorrow · the “Overview” tab is a colour map: green = complete, yellow = still editable, red = missing' },
  'วิธีใช้งานหน้าบันทึกงาน': { en: 'How to use the work-log page' },
  'วิธีใช้งานหน้านี้ (อ่านก่อนเริ่ม)': { en: 'How to use this page (read first)' },
  'หน่วยงานที่แสดง': { en: 'Visible sites' },
  'ปิดหน่วยงานที่จบแล้วเพื่อซ่อนจากแดชบอร์ดและรายการเลือก (เฉพาะเครื่องนี้)': { en: 'Turn off finished sites to hide them from the dashboard and pickers (this device only)' },
  'ไม่มีหน่วยงาน': { en: 'No sites' },
  'ประวัติการแก้ไข': { en: 'Edit history' },
  'ดูบันทึกว่าใครแก้ไขอะไร เมื่อไร พร้อมค้นหาและกรอง': { en: 'See who changed what and when, with search and filters' },
  'เปิดประวัติการแก้ไข': { en: 'Open edit history' },
  'หมายเหตุ': { en: 'Note' },
  'งานที่ 1': { en: 'Task 1' },
  'งานที่ 2': { en: 'Task 2' },
  'งาน': { en: 'Work' },
  'ทุกหน่วยงาน': { en: 'All sites' },
  'ค้นหา อีเมล / ชื่อ / ค่า': { en: 'Search email / name / value' },
  'ทุกช่อง': { en: 'All fields' },
  'ไม่พบรายการ': { en: 'No results' },
  'เวลา': { en: 'Time' },
  'ผู้แก้ไข': { en: 'Edited by' },
  'วันที่': { en: 'Date' },
  'เดิม': { en: 'Old' },
  'ใหม่': { en: 'New' },
  'โหลดไม่สำเร็จ': { en: 'Load failed' },
  'ยังไม่มีประวัติการแก้ไข': { en: 'No edit history yet' },
};
function t(s){
  if(!s) return s;
  var rec = T[s];
  if(!rec || LANG==='th') return s;
  return rec[LANG] || s;
}
function setLang(lang){
  LANG = lang; _lsSet('hr_lang', lang);
  if(!BOOT) return;
  buildNav();
  go(window._curView || 'dashboard');
  // If the settings sheet is open, re-render its body too so all its labels
  // (sections, buttons, hints) flip to the new language immediately instead
  // of staying frozen until close/reopen.
  if($('settingsBody')) renderSettings($('settingsBody'), { asModal:true });
}
function applyTheme(){
  var mode = THEME;
  if(mode === 'auto'){
    mode = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  document.body.classList.toggle('dark', mode === 'dark');
}
function setTheme(th){
  THEME = th; _lsSet('hr_theme', th); applyTheme();
}
function setYearFmt(f){
  YEAR_FMT = f; _lsSet('hr_yearfmt', f);
  if(BOOT){ go(window._curView || 'dashboard'); }
}
function setDashDefault(v){
  DASH_DEFAULT = v; _lsSet('hr_dashview', v); DASH.view = v;
}
function setCellNames(v){
  CELL_NAMES = v; _lsSet('hr_cellnames', v);
  // Re-render the weekly grid live if it's the current view, so the change shows
  // immediately. ES.data is reused (no refetch); only the displayed text differs.
  if(window._curView === 'entry' && ES && ES.data){ renderEntry(); }
}
// Source of truth is the is-mobile class set in the <head> boot script
// (which uses UA + screen.width + innerWidth so in-app browsers can't fool us).
// Re-checks innerWidth as a fallback in case the early script was stripped.
function isMobile(){
  return document.documentElement.classList.contains('is-mobile') || window.innerWidth < 768;
}

function $(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);}); }

/* ----- Operation work-type picker -----
   Floating popover anchored to the focused operation cell input. Lets admins
   search/scroll the full MasterIndex in a comfortable 420×62vh panel instead
   of scrolling the cramped native <datalist>. Typing in the cell still works
   as a fallback (the input keeps its list= attribute). */
// OPP.target is the thing the picked value flows into: either an <input>
// (mobile day-cards) or a desktop display cell <td.cell> (the fast grid).
// Two-step pick: step 1 = Work Type, step 2 = Location/Cost Type. The final
// cell value is "<workCode> / <costCode>" (e.g. "A-1 / 5").
var OPP = { target:null, items:[], filtered:[], kbdIdx:-1, step:1, pendingWork:null };
// Write a picked/cleared value into either target type and trigger the save flow.
function oppApply_(target, value){
  if(!target) return;
  if(target.tagName === 'INPUT'){
    var oldVal = target.value;
    target.value = value;
    target.dispatchEvent(new Event('input',{bubbles:true}));
    target.dispatchEvent(new Event('change',{bubbles:true}));
    mirrorAmToPmInput_(target, oldVal, value);   // mobile day-card AM→PM mirror
  } else {
    setDeskCell_(target, value);   // desktop display <td.cell> (mirrors internally)
  }
}
/* Auto-fill DISABLED: the second slot is now optional "งานเสริม" (extra work),
   not a duplicate afternoon shift — copying งานหลัก into it would turn every
   single-task day into a 2-task day and break the 1-manday-per-day math. */
function mirrorAmToPmInput_(inp, oldVal, newVal){ /* no-op (see comment above) */ }
function oppEnsure(){
  if($('opPicker')) return;
  var p = document.createElement('div');
  p.id = 'opPicker';
  p.innerHTML =
    '<div id="opPickerTitle"></div>'
    +'<div id="opPickerHead">'
      +'<input id="opPickerSearch" type="text" placeholder="ค้นหา…" autocomplete="off">'
      +'<span id="opPickerCount"></span>'
      +'<button class="opp-clear" id="opPickerClear" title="ล้างเซลล์">ล้าง</button>'
    +'</div>'
    +'<div id="opPickerList"></div>';
  document.body.appendChild(p);
  $('opPickerSearch').addEventListener('input', function(){ oppRender(this.value); });
  $('opPickerSearch').addEventListener('keydown', oppKey);
  $('opPickerClear').addEventListener('click', function(){
    oppApply_(OPP.target, '');      // clear the whole cell
    oppClose();
  });
  $('opPickerTitle').addEventListener('mousedown', function(e){
    e.preventDefault();
    if(OPP.step === 2) oppSetStep_(1);   // tapping the title in step 2 goes back
  });
}
// Switch the picker between step 1 (Work Type) and step 2 (Location/Cost Type).
function oppSetStep_(n){
  OPP.step = n;
  OPP.kbdIdx = -1;
  var title = $('opPickerTitle');
  if(n === 1){
    OPP.items = (ES.data && ES.data.teams) ? ES.data.teams : [];
    if(title){ title.innerHTML = '<span class="opp-step">1/2</span> เลือกกิจกรรม (Activity)'; title.classList.remove('back'); }
  } else {
    var allCosts = (ES.data && ES.data.costs) ? ES.data.costs : [];
    var wc = OPP.pendingWork ? OPP.pendingWork.code : '';
    // Restrict STEP 2 to the Cost Types this work type is allowed to use. An empty
    // allowed list means "no restriction" (legacy one-to-many) → show every cost.
    var meta = (ES.workMeta && ES.workMeta[wc]) || null;
    var allowed = (meta && meta.allowed) ? meta.allowed : [];
    OPP.items = allowed.length
      ? allCosts.filter(function(c){ return allowed.indexOf(String(c.code)) >= 0; })
      : allCosts;
    if(title){ title.innerHTML = '<span class="opp-back">‹</span> <span class="opp-step">2/2</span> เลือกหมวดงาน · งาน: <b>'+esc(wc)+'</b>'; title.classList.add('back'); }
  }
  if($('opPickerSearch')) $('opPickerSearch').value = '';
  oppRender('');
}
function oppOpen(target){
  oppEnsure();
  OPP.target = target;
  OPP.pendingWork = null;
  var p = $('opPicker');
  // Anchor to the cell, but ALWAYS fit the viewport: open on whichever side has
  // more room and clamp the height to that room so the list scrolls internally
  // (otherwise a middle-of-page cell pushes the bottom of the list off-screen).
  var r = target.getBoundingClientRect();
  var vw = window.innerWidth, vh = window.innerHeight, margin = 8, gap = 4;
  var w = Math.min(700, vw - 2*margin);
  var left = Math.max(margin, Math.min(r.left, vw - w - margin));
  var spaceBelow = vh - r.bottom - margin - gap;
  var spaceAbove = r.top - margin - gap;
  var h, top;
  if(Math.max(spaceBelow, spaceAbove) < 260){
    // Middle of a short viewport: neither side fits → detach and fill the screen
    // vertically (centered) so the whole list is visible and scrolls internally.
    h = Math.min(460, vh - 2*margin);
    top = Math.max(margin, Math.round((vh - h) / 2));
  } else if(spaceBelow >= spaceAbove){
    h = Math.min(460, spaceBelow);  top = r.bottom + gap;
  } else {
    h = Math.min(460, spaceAbove);  top = Math.max(margin, r.top - gap - h);
  }
  p.style.left = left + 'px'; p.style.top = top + 'px';
  p.style.width = w + 'px'; p.style.maxHeight = h + 'px';   // inline clamp wins over the CSS 68vh
  p.classList.add('open');
  oppSetStep_(1);   // always start at the Work Type step with the full list
  setTimeout(function(){ $('opPickerSearch').focus(); }, 0);
}
function oppClose(){
  var p = $('opPicker'); if(p) p.classList.remove('open');
  OPP.target = null; OPP.pendingWork = null; OPP.step = 1;
}
function oppRender(q){
  q = String(q||'').trim().toLowerCase();
  var items = OPP.items;
  OPP.filtered = q ? items.filter(function(t){
    return String(t.name||'').toLowerCase().indexOf(q) >= 0
        || String(t.desc||'').toLowerCase().indexOf(q) >= 0
        || String(t.category||'').toLowerCase().indexOf(q) >= 0
        || String(t.code||'').toLowerCase().indexOf(q) >= 0;
  }) : items.slice();
  $('opPickerCount').textContent = OPP.filtered.length + '/' + items.length;
  // group by category preserving sorted order
  var groups = {}, order = [];
  OPP.filtered.forEach(function(t){
    var c = String(t.category||'').trim() || 'อื่น ๆ';
    if(!groups[c]){ groups[c] = []; order.push(c); }
    groups[c].push(t);
  });
  var html = '';
  var idx = 0;
  order.forEach(function(c){
    html += '<div class="opp-cat">'+esc(c)+'</div>';
    groups[c].forEach(function(t){
      // Tiny color-coded dot instead of the (irrelevant-to-staff) cost name:
      //   green = cost auto-assigned, one step · amber = pick the cost, two steps.
      var tag = '';
      if(OPP.step===1 && t.code){
        var oneToOne = String(t.mapping||'one-to-many')==='one-to-one';
        tag = '<span class="opp-dot '+(oneToOne?'fixed':'many')+'" title="'
            + esc(oneToOne ? 'กำหนดต้นทุนอัตโนมัติ · เลือกขั้นตอนเดียว' : 'เลือกหมวดต้นทุนต่อ · 2 ขั้นตอน')+'"></span>';
      }
      html += '<div class="opp-item" data-i="'+idx+'" data-name="'+esc(t.name||'')+'" data-code="'+esc(t.code||'')+'">'
            + '<div class="opp-name">'+(t.code?'<span class="opp-code">'+esc(t.code)+'</span>'+tag:'')+esc(t.name||'')+'</div>'
            + (t.desc ? '<div class="opp-desc">'+esc(t.desc)+'</div>' : '')
            + '</div>';
      idx++;
    });
  });
  if(!html) html = '<div class="opp-empty">ไม่พบรายการที่ตรงกับ "'+esc(q)+'"</div>';
  $('opPickerList').innerHTML = html;
  Array.prototype.forEach.call($('opPickerList').querySelectorAll('.opp-item'), function(el){
    el.addEventListener('mousedown', function(e){ e.preventDefault(); oppPick(el.getAttribute('data-name'), el.getAttribute('data-code')); });
    el.addEventListener('mouseenter', function(){
      Array.prototype.forEach.call($('opPickerList').querySelectorAll('.opp-item.kbd'), function(x){ x.classList.remove('kbd'); });
      el.classList.add('kbd');
      OPP.kbdIdx = Number(el.getAttribute('data-i'));
    });
  });
  // pre-highlight first item for keyboard nav
  var first = $('opPickerList').querySelector('.opp-item');
  if(first){ first.classList.add('kbd'); OPP.kbdIdx = 0; }
}
function oppSiblingCode_(target){
  // Return the work-type code already in the OTHER slot of the same cell.
  // Desktop: target is a .cval inside .shift; the sibling .shift has a .cval
  //          with data-val = raw composite like "A-1 / 5" or just "A-1".
  // Mobile:  target is an <input> inside .m-shift; the sibling .m-shift has an input.
  if(!target) return '';
  var parentShift = target.closest && (target.closest('.shift') || target.closest('.m-shift'));
  if(!parentShift) return '';
  var cell = parentShift.parentNode;
  if(!cell) return '';
  var siblings = cell.querySelectorAll(target.tagName === 'INPUT' ? '.m-shift input' : '.shift .cval');
  var code = '';
  Array.prototype.forEach.call(siblings, function(el){
    if(el === target) return;
    var raw = el.tagName === 'INPUT' ? el.value : (el.getAttribute('data-val') || '');
    var slash = raw.indexOf(' / ');
    code = slash >= 0 ? raw.slice(0, slash).trim() : raw.trim();
  });
  return code;
}
function oppPick(name, code){
  if(!OPP.target) return;
  code = code || '';
  if(OPP.step === 1){
    // Step 1 chose the Work Type.
    // Reject if the other slot in the same cell already has this work type.
    var sibCode = oppSiblingCode_(OPP.target);
    if(code && sibCode && code === sibCode){
      flash('งานทั้งสองช่องเหมือนกัน — เลือกงานคนละประเภทเพื่อบันทึก 2 งาน', 'error');
      return;
    }
    OPP.pendingWork = { code: code, name: name };
    // A work type with exactly ONE allowed Cost Type → skip STEP 2 and auto-assign
    // it. (Z/Standby has no allowed cost and mapping one-to-one → just the code.)
    var meta = (ES.workMeta && ES.workMeta[code]) || null;
    var allowed = (meta && meta.allowed) ? meta.allowed : [];
    if(allowed.length === 1 || (allowed.length === 0 && meta && meta.mapping === 'one-to-one')){
      var fixed = allowed.length === 1 ? allowed[0] : (meta ? meta.fixed : '');
      var tg1 = OPP.target;
      oppApply_(tg1, fixed ? (code + ' / ' + fixed) : code);
      oppClose();
      if(tg1 && tg1.tagName === 'INPUT') tg1.focus();
      return;
    }
    // Two or more allowed Cost Types → advance to the filtered Location/Cost step.
    var costs = (ES.data && ES.data.costs) ? ES.data.costs : [];
    if(!costs.length){
      // Cost Types not loaded yet → don't strand the user at an empty step 2;
      // fill with the work code alone and hint to load the standard set.
      var tg0 = OPP.target;
      oppApply_(tg0, code);
      oppClose();
      if(tg0 && tg0.tagName === 'INPUT') tg0.focus();
      flash('ยังไม่มีรายการหมวดงาน — เพิ่มได้ที่ ดัชนีงาน › แท็บ หมวดงาน', 'error');
      return;
    }
    oppSetStep_(2);
    setTimeout(function(){ var s=$('opPickerSearch'); if(s) s.focus(); }, 0);
    return;
  }
  // Step 2 chose the Cost Type → write the composite "<workCode> / <costCode>".
  var workCode = OPP.pendingWork ? OPP.pendingWork.code : '';
  var composite = workCode + ' / ' + code;
  var tg = OPP.target;
  oppApply_(tg, composite);
  oppClose();
  if(tg.tagName === 'INPUT') tg.focus();   // mobile: return focus to the cell input
}
function oppKey(e){
  if(e.key === 'Escape'){
    if(OPP.step === 2){ oppSetStep_(1); setTimeout(function(){ var s=$('opPickerSearch'); if(s) s.focus(); },0); }
    else oppClose();
    return;
  }
  var items = $('opPickerList').querySelectorAll('.opp-item');
  if(!items.length) return;
  if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
    e.preventDefault();
    OPP.kbdIdx = OPP.kbdIdx < 0 ? 0
      : (e.key === 'ArrowDown' ? Math.min(items.length-1, OPP.kbdIdx+1)
                                : Math.max(0, OPP.kbdIdx-1));
    Array.prototype.forEach.call(items, function(x){ x.classList.remove('kbd'); });
    var cur = items[OPP.kbdIdx]; cur.classList.add('kbd');
    cur.scrollIntoView({block:'nearest'});
  } else if(e.key === 'Enter'){
    e.preventDefault();
    var cur = items[Math.max(0,OPP.kbdIdx)];
    if(cur) oppPick(cur.getAttribute('data-name'), cur.getAttribute('data-code'));
  }
}
// Global click-outside + scroll-close. MUST run in the CAPTURE phase: picking a
// work type re-renders the list (step 2), which detaches the clicked element —
// in the bubble phase p.contains(e.target) would then be false and wrongly
// close the picker. Capture runs BEFORE that mutation, so the test is correct.
document.addEventListener('mousedown', function(e){
  var p = $('opPicker'); if(!p || !p.classList.contains('open')) return;
  if(p.contains(e.target)) return;
  // keep open when the click lands inside the current target (input or cell)
  if(OPP.target && (e.target === OPP.target || (OPP.target.contains && OPP.target.contains(e.target)))) return;
  oppClose();
}, true);
window.addEventListener('resize', oppClose);

function be(y){ return YEAR_FMT === 'be' ? (y + 543) : y; }
function show(el,on){ el.style.display = on ? '' : 'none'; }
function busy(on){ show($('loading'),on); show($('view'),!on); }
// Breadcrumb shown inside the loading spinner so a stuck boot reveals its stage.
function bootStage(s){ try { var el=$('bootStage'); if(el) el.textContent=s; } catch(e){} }

function fatal(msg){
  show($('loading'),false);
  var v=$('view'); if(!v) return;
  v.style.display='';
  v.innerHTML='<div class="card"><h1>⚠️ โหลดแอปไม่สำเร็จ</h1>'
    +'<pre class="errbox">'+esc(msg)+'</pre>'
    +'<p><button class="btn" onclick="location.reload()">ลองใหม่</button></p>'
    +'<p class="hint">คัดลอกข้อความสีแดงทั้งหมดส่งให้ผู้ดูแลระบบ</p></div>';
}
function flash(msg,kind){
  var f=$('flash'); f.className='flash '+(kind||'ok'); f.textContent=msg; f.style.display='';
  if(kind!=='error') setTimeout(function(){ f.style.display='none'; },3500);
}

// google.script.run wrapper with a hard timeout so the UI never hangs forever.
function call(name,args,cb){
  var done=false;
  var timer=setTimeout(function(){ if(done)return; done=true;
    fatal('หมดเวลาเชื่อมต่อเซิร์ฟเวอร์ ('+name+'). \\n• ตรวจว่าได้รัน SETUP แล้ว\\n• ตรวจว่า Deploy เป็น Web app และเปิดลิงก์ /exec ล่าสุด\\n• ตรวจว่าบัญชีของคุณมีสิทธิ์เปิดไฟล์ Sheet ฐานข้อมูล');
  },25000);
  google.script.run
    .withSuccessHandler(function(r){ if(done)return; done=true; clearTimeout(timer); cb(r); })
    .withFailureHandler(function(e){ if(done)return; done=true; clearTimeout(timer);
      fatal('เซิร์ฟเวอร์: '+(e&&e.message?e.message:e)); })
    [name].apply(google.script.run, args||[]);
}

function boot(){
  applyTheme();
  // Keep "auto" theme in sync with OS color-scheme toggles in real time.
  try {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function(){ if(THEME==='auto') applyTheme(); };
    if(mq.addEventListener) mq.addEventListener('change', onChange);
    else if(mq.addListener) mq.addListener(onChange);
  } catch(e){}
  // Re-render the active view when the mobile flag flips (orientation change,
  // window resize, splitting/un-splitting on iPad). The flag itself is kept
  // current by the <head> boot script — we only listen so the render layer
  // catches up.
  (function(){
    var wasMobile = isMobile();
    function onSizeChange(){
      var nowMobile = isMobile();
      if(nowMobile !== wasMobile){
        wasMobile = nowMobile;
        if(BOOT && window._curView) go(window._curView);
      }
    }
    window.addEventListener('resize', onSizeChange, {passive:true});
    window.addEventListener('orientationchange', onSizeChange, {passive:true});
  })();
  // Capture the live page/entry state right before the page goes away so an
  // accidental refresh (or tab switch) can restore it. pagehide is the reliable
  // unload signal; visibilitychange covers mobile where pagehide can be skipped.
  window.addEventListener('pagehide', saveNavState);
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState==='hidden') saveNavState();
  });
  busy(true);
  bootStage('1·เชื่อมต่อ');
  call('api_bootstrap',[],function(r){
    bootStage('2·ได้ข้อมูล');
    if(!r||!r.ok){ return onBootError(r); }
    BOOT=r;
    // Surface ANY render error instead of dying on the loading spinner. Clear
    // the spinner FIRST so a later render bug can't trap the whole app on
    // "กำลังโหลด…"; then restore the saved view inside its own guard so a single
    // broken view falls back to the dashboard rather than a blank/stuck page.
    try { bootStage('3·เมนู'); buildNav(); } catch(e1){ return fatal('NAV: '+(e1&&e1.stack||e1)); }
    busy(false);
    try { bootStage('4·แสดงผล'); restoreNavState(); }
    catch(e2){
      try { go('dashboard'); }
      catch(e3){ fatal('VIEW: '+(e2&&e2.message||e2)+' / '+(e3&&e3.stack||e3)); }
    }
  });
}
function onBootError(r){
  var code=r&&r.error||'UNKNOWN';
  if(code==='NO_SETUP'){ fatal('ยังไม่ได้ติดตั้งฐานข้อมูล — เปิด Apps Script แล้วรันฟังก์ชัน SETUP หนึ่งครั้ง'); return; }
  if(code==='NO_EMAIL'){ fatal('ระบบอ่านอีเมลผู้ใช้ไม่ได้ — ตั้งค่า Deploy ▸ Execute as = User accessing the web app'); return; }
  if(code==='NO_ACCESS'){
    show($('loading'),false); show($('view'),true);
    $('view').innerHTML='<div class="card center"><h1>ไม่มีสิทธิ์ใช้งาน</h1>'
      +'<p class="muted">บัญชี <b>'+esc(r.email||'')+'</b> ยังไม่ได้รับสิทธิ์บันทึกข้อมูล</p>'
      +'<p class="hint">โปรดแจ้งผู้ดูแลระบบ (admin) ให้เพิ่มอีเมลของคุณในหน้า “ผู้ใช้” และกำหนดหน่วยงาน</p></div>';
    return;
  }
  fatal('SERVER: '+code);
}

/* ---------- nav / routing ---------- */
function buildNav(){
  var n=$('nav'); var items=[];
  items.push(['dashboard', t('แดชบอร์ด')]);
  if(BOOT.canEntry) items.push(['entry', t('บันทึกงาน')]);
  if(BOOT.isAdmin)  items.push(['index', t('ดัชนีงาน')]);
  // Settings (admin only) consolidates user-perms + theme + lang + about.
  // Use the text-style gear (U+2699) — not the emoji ⚙️ (U+2699 U+FE0F) —
  // so it renders monochrome and follows the surrounding white nav color
  // instead of as a multicolor emoji glyph.
  if(BOOT.isAdmin)  items.push(['settings', '⚙']);
  n.innerHTML=items.map(function(it){
    var isIcon = it[1] === '⚙';
    return '<a data-go="'+it[0]+'"' + (isIcon ? ' class="gear" style="font-size:1.15rem;padding:.45rem .8rem" title="'+esc(t('ตั้งค่า'))+'"' : '') + '>'+it[1]+'</a>';
  }).join('')
    +'<span class="who">'+esc(BOOT.email)+(BOOT.role?(' · '+BOOT.role):'')+'</span>';
  Array.prototype.forEach.call(n.querySelectorAll('a[data-go]'),function(a){
    a.onclick=function(){
      var id=a.getAttribute('data-go');
      // Settings opens as a popup overlay — never navigate. The underlying
      // page (dashboard/entry/index) stays mounted behind the sheet so
      // closing the gear returns you exactly where you were.
      if(id==='settings'){ openSettings(); return; }
      if(id==='entry') ES.site='';
      go(id);
    };
  });
  $('topbar').style.display='';
  // Brand wordmark doubles as "back to VCB Connect"; its tooltip is static
  // HTML, so refresh it here (runs on boot and on every setLang) to follow LANG.
  var bl=$('brandLink'); if(bl) bl.title=t('กลับไปหน้าหลัก VCB Connect');
}
function setActive(id){
  Array.prototype.forEach.call($('nav').querySelectorAll('a[data-go]'),function(a){
    a.classList.toggle('on', a.getAttribute('data-go')===id);
  });
}
function go(id){
  window._curView = id;     // remember current view so setLang/setYearFmt can re-render
  setActive(id);
  saveNavState();           // persist page (+ entry context) for refresh recovery
  if(id==='entry')     return renderEntry();
  if(id==='dashboard') return renderDashboard();
  if(id==='index')     return renderMasterIndex();
  if(id==='settings')  return renderSettings();
  if(id==='users')     return renderSettings();    // legacy alias — old links land on Settings
}

/* ---------- month navigator ---------- */
function monthNav(){
  // Chevron + calendar-style picker trigger + chevron. The trigger opens a
  // popover with year tabs on top and a 3×4 month grid below.
  return '<div class="seg">'
    +'<button id="mPrev" title="เดือนก่อนหน้า">‹</button>'
    +'<button id="mPickerTrigger" class="mp-trigger">'+MNAME(CUR.m)+' '+be(CUR.y)+' <span class="mp-caret">▾</span></button>'
    +'<button id="mNext" title="เดือนถัดไป">›</button></div>';
}
function wireMonthNav(onPick){
  $('mPrev').onclick=function(){ CUR.m--; if(CUR.m<1){CUR.m=12;CUR.y--;} onPick(); };
  $('mNext').onclick=function(){ CUR.m++; if(CUR.m>12){CUR.m=1;CUR.y++;} onPick(); };
  $('mPickerTrigger').onclick=function(e){
    e.stopPropagation();
    openMonthPicker($('mPickerTrigger'), onPick);
  };
}
/* Calendar-style month picker: year tabs + month grid in a floating popover.
   Reused by every monthNav() instance (dashboard, entry, mobile). */
function ensureMonthPickerPop(){
  if($('mPickerPop')) return;
  var p = document.createElement('div');
  p.id = 'mPickerPop';
  p.className = 'mp-pop';
  document.body.appendChild(p);
}
function openMonthPicker(trig, onPick){
  ensureMonthPickerPop();
  var pop = $('mPickerPop');
  if(pop.classList.contains('open')){ pop.classList.remove('open'); return; }
  // Year tabs: -2 to current. No future years — entries can't be recorded
  // ahead of time. Also floored at BE 2569 (2026) — the app's first data year.
  var baseY = CUR.y || TODAY.getFullYear();
  var FIRST_YEAR_G = 2026;
  var thisY = TODAY.getFullYear();
  var years = [];
  for(var i=-2; i<=0; i++){
    var y = baseY + i;
    if(y < FIRST_YEAR_G || y > thisY) continue;
    years.push(y);
  }
  // Always ensure the current year is included even if baseY drifted backward
  if(years.indexOf(thisY) < 0 && thisY >= FIRST_YEAR_G) years.push(thisY);
  pop._selectedYear = CUR.y;
  pop._onPick = onPick;
  pop._years = years;
  renderMonthPicker(pop);
  // Position
  var r = trig.getBoundingClientRect();
  var w = 288;
  pop.style.width = w + 'px';
  pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
  var popH = 280, topPos = r.bottom + 4;
  if(topPos + popH > window.innerHeight - 8) topPos = Math.max(8, r.top - popH - 4);
  pop.style.top = topPos + 'px';
  pop.classList.add('open');
}
function renderMonthPicker(pop){
  var displayYear = pop._selectedYear;
  var years = pop._years;
  var html = '<div class="mp-years">'
    + years.map(function(y){
        var on = (y === displayYear) ? ' on' : '';
        return '<button type="button" class="mp-year'+on+'" data-y="'+y+'">'+be(y)+'</button>';
      }).join('')
    + '</div>'
    + '<div class="mp-months">'
    + [1,2,3,4,5,6,7,8,9,10,11,12].map(function(m){
        var on = (displayYear === CUR.y && m === CUR.m) ? ' on' : '';
        var thisY = TODAY.getFullYear(), thisM = TODAY.getMonth()+1;
        var isCur = (thisY === displayYear && thisM === m) ? ' cur' : '';
        // future months can't have data, so disable them
        var isFuture = (displayYear > thisY) || (displayYear === thisY && m > thisM);
        var dis = isFuture ? ' disabled' : '';
        return '<button type="button" class="mp-month'+on+isCur+dis+'" data-y="'+displayYear+'" data-m="'+m+'"'+(isFuture?' disabled':'')+'>'+MSHORT(m)+'</button>';
      }).join('')
    + '</div>';
  pop.innerHTML = html;
  Array.prototype.forEach.call(pop.querySelectorAll('.mp-year'), function(el){
    el.onclick = function(e){
      e.stopPropagation();
      pop._selectedYear = Number(el.getAttribute('data-y'));
      renderMonthPicker(pop);
    };
  });
  Array.prototype.forEach.call(pop.querySelectorAll('.mp-month'), function(el){
    el.onclick = function(e){
      e.stopPropagation();
      CUR.y = Number(el.getAttribute('data-y'));
      CUR.m = Number(el.getAttribute('data-m'));
      pop.classList.remove('open');
      if(pop._onPick) pop._onPick();
    };
  });
}
// Global outside-click close for the month picker
document.addEventListener('mousedown', function(e){
  var pop = $('mPickerPop');
  if(!pop || !pop.classList.contains('open')) return;
  if(pop.contains(e.target)) return;
  if(e.target.closest && e.target.closest('#mPickerTrigger')) return;
  pop.classList.remove('open');
});

/* ============================ ENTRY (wide month grid) ============================ */
function renderEntry(){
  // Below 768px viewport, hand off to the touch-friendly per-employee mobile
  // flow (pick site → pick employee → tap through day-cards). Desktop grid
  // is unchanged above 768px.
  if(isMobile()) return renderEntryMobile();
  var sites=visibleSites();
  if(!sites.length){ $('view').innerHTML='<div class="card"><p class="muted">'+((BOOT.sites||[]).length?t('หน่วยงานทั้งหมดถูกซ่อนอยู่ — เปิดได้ที่ ⚙ ตั้งค่า'):t('ยังไม่มีหน่วยงานในสิทธิ์ของคุณ'))+'</p></div>'; return; }
  // do NOT auto-pick a site — make the admin choose explicitly so we don't waste
  // a load on a site they didn't want. Only validate that an existing ES.site
  // is still in scope (otherwise clear it).
  if(ES.site && !sites.some(function(s){return s.key===ES.site;})) ES.site='';
  // collapse stale 'month' viewMode (button was removed) → 'week'
  if(ES.viewMode==='month') ES.viewMode='week';
  var adminTools = BOOT.isAdmin
    ? '<button class="lockchip'+(ES.adminUnlock?' on':'')+'" id="eUnlock" title="'+esc(t('ผู้ดูแลระบบเท่านั้น'))+'">'
      +(ES.adminUnlock?('🔓 '+t('แก้ไขย้อนหลังเปิดอยู่')):('🔒 '+t('แก้ไขย้อนหลัง (admin)')))+'</button>'
    : '';
  var exportBtn = ES.site
    ? '<button class="btn xls-btn" id="eExport" title="ส่งออกบันทึกทั้งหมดของหน่วยงานนี้เป็นไฟล์ Excel (.xlsx) โดยคงรูปแบบเดิมไว้">⬇ Excel</button>'
    : '';
  var siteName = (sites.find(function(s){return s.key===ES.site;})||{}).name || '';
  var acc = (typeof siteAccent === 'function') ? siteAccent(ES.site) : { c:'#1d4e89', tint:'#e6effb' };
  $('view').innerHTML=
    '<div class="card s-accent" style="padding:0;overflow:hidden;--site:'+acc.c+'">'
      +'<div style="height:4px;background:var(--site)"></div>'
      +'<div style="padding:.85rem 1.1rem">'
      +'<div class="statrow" style="align-items:end;gap:.9rem;margin-bottom:.4rem">'
        +'<div class="fld grow'+(ES.site?'':' needs-pick')+'" style="max-width:340px;min-width:200px"><label>'+t('หน่วยงาน')+'</label><select id="eSite">'
          +'<option value=""'+(!ES.site?' selected':'')+'>— '+t('เลือกหน่วยงาน')+' —</option>'
          +sites.map(function(s){return '<option value="'+esc(s.key)+'"'+(s.key===ES.site?' selected':'')+'>'+esc(s.name)+'</option>';}).join('')
        +'</select></div>'
        +'<div class="fld'+(ES.site?'':' fld-disabled')+'"><label>'+t('เดือน')+'</label><div id="eMonth">'+monthNav()+'</div></div>'
        +'<div class="fld'+(ES.site?'':' fld-disabled')+'"><label>'+t('มุมมอง')+'</label>'
          +'<div class="viewseg" id="eView">'
            +'<button data-v="coverage" class="'+(ES.viewMode==='coverage'?'on':'')+'">'+t('ภาพรวม')+'</button>'
            +'<button data-v="week" class="'+(ES.viewMode==='week'?'on':'')+'">'+t('รายอาทิตย์')+'</button>'
          +'</div>'
        +'</div>'
        +'<div class="fld'+(ES.site?'':' fld-disabled')+'" id="eWeekNavWrap" style="'+(ES.viewMode==='week'?'':'display:none')+'">'
          +'<label>'+t('สัปดาห์')+'</label><div class="weekbar"><button id="wPrev">‹</button>'
            +'<span class="lbl" id="wLbl">—</span>'
            +'<button id="wNext">›</button>'
          +'</div>'
        +'</div>'
        +'<div style="margin-left:auto;display:flex;align-items:center;gap:.6rem;flex-wrap:wrap">'+exportBtn+adminTools
          +'<div class="saveind" id="eSaveInd">'+t('พร้อมแก้ไข')+'</div>'
        +'</div>'
      +'</div>'
      +'<div class="legend">'
        +'<span><span class="sw" style="background:var(--wkend-cell)"></span>วันหยุด</span>'
        +'<span><span class="sw" style="background:var(--blue)"></span>วันนี้</span>'
        +'<span><span class="sw" style="background:repeating-linear-gradient(45deg,var(--locked-a),var(--locked-a) 3px,var(--locked-b) 3px,var(--locked-b) 6px)"></span>ล็อก (อ่านอย่างเดียว · เกิน 3 วัน)</span>'
        +'<span><span class="sw" style="background:var(--saved-bg)"></span>บันทึกแล้ว</span>'
      +'</div>'
      +'</div>'
    +'</div>'
    +'<div id="eGrid"><div class="spinner"></div></div>';
  $('eSite').onchange=function(){
    ES.site=this.value;
    // Jump the grid to whichever week contains today (same behavior as the
    // dashboard's "เปิดบันทึก →" button), instead of starting at week 1.
    if(ES.site){ ES.viewMode='week'; ES.jumpToToday=true; }
    renderEntry();
  };
  wireMonthNav(function(){ $('eMonth').innerHTML=monthNav(); wireMonthNav(arguments.callee); ES.weekStart=0; loadGrid(); });
  Array.prototype.forEach.call($('eView').querySelectorAll('button'),function(b){
    b.onclick=function(){
      ES.viewMode=b.getAttribute('data-v');
      if(ES.viewMode==='week') ES.weekStart = clampWeekStart();
      Array.prototype.forEach.call($('eView').querySelectorAll('button'),function(x){
        x.classList.toggle('on', x.getAttribute('data-v')===ES.viewMode);
      });
      var ww=$('eWeekNavWrap'); if(ww) ww.style.display = (ES.viewMode==='week')?'':'none';
      if(ES.data) renderGrid(); else loadGrid();
      // re-wire week nav buttons (they get a fresh DOM when entering week mode)
      if(ES.viewMode==='week'){
        $('wPrev').onclick=function(){ ES.weekStart=Math.max(0, ES.weekStart-7); renderGrid(); };
        $('wNext').onclick=function(){ var n=ES.data?ES.data.days.length:30;
          ES.weekStart=Math.min(Math.max(0,n-7), ES.weekStart+7); renderGrid(); };
      }
    };
  });
  if(ES.viewMode==='week'){
    $('wPrev').onclick=function(){ ES.weekStart=Math.max(0, ES.weekStart-7); renderGrid(); };
    $('wNext').onclick=function(){
      var n=ES.data?ES.data.days.length:30;
      ES.weekStart=Math.min(Math.max(0,n-7), ES.weekStart+7); renderGrid();
    };
  }
  if(BOOT.isAdmin){
    $('eUnlock').onclick=function(){ ES.adminUnlock=!ES.adminUnlock; renderEntry(); };
  }
  if($('eExport')){
    $('eExport').onclick=function(){ exportSiteXlsx(ES.site, this); };
  }
  loadGrid();
}
/* Generic xlsx download: calls a server api that returns {ok, filename, mime,
   data:base64} and triggers a browser download. Used for both site logs and
   the Master Work Index. btn (optional) gets disabled with a spinner label. */
function downloadXlsx(apiName, args, btn){
  var orig = btn ? btn.innerHTML : '';
  if(btn){ btn.disabled = true; btn.innerHTML = '⏳ กำลังเตรียมไฟล์…'; }
  call(apiName, args || [], function(r){
    if(btn){ btn.disabled = false; btn.innerHTML = orig; }
    if(!r || !r.ok){ flash('ส่งออกไม่สำเร็จ: ' + ((r&&r.error)||'?'), 'error'); return; }
    var bin = atob(r.data);
    var bytes = new Uint8Array(bin.length);
    for(var i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
    var blob = new Blob([bytes], { type: r.mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = r.filename;
    document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 200);
    flash('ส่งออก ' + r.filename + ' สำเร็จ', 'ok');
  });
}
function exportSiteXlsx(siteKey, btn){ if(siteKey) downloadXlsx('api_exportSiteXlsx', [siteKey, CUR.y, CUR.m], btn); }
function exportMasterIndexXlsx(btn){ downloadXlsx('api_exportMasterIndexXlsx', [], btn); }
function exportCostIndexXlsx(btn){ downloadXlsx('api_exportCostIndexXlsx', [], btn); }
/* In-app confirmation dialog — replaces the browser's native confirm() black box
   so every prompt matches the app's look. uiConfirm(msgOrOpts, onYes). opts:
   {title, message, okText, cancelText, danger}. onYes runs only on confirm. */
function uiConfirm(opts, onYes){
  opts = (typeof opts==='string') ? { message:opts } : (opts||{});
  if($('uiConfirmOverlay')) return;
  var title = opts.title || t('ยืนยัน');
  var okText = opts.okText || t('ตกลง');
  var cancelText = opts.cancelText || t('ยกเลิก');
  var html =
    '<div id="uiConfirmOverlay" class="overlay">'
    +'<div class="overlay-card confirm-card">'
      +'<h2 style="margin:.1rem 0 .5rem">'+esc(title)+'</h2>'
      +'<p class="confirm-msg">'+esc(opts.message||'')+'</p>'
      +'<div style="display:flex;gap:.6rem;margin-top:1.1rem;justify-content:flex-end">'
        +'<button class="btn sec" id="uiConfirmNo">'+esc(cancelText)+'</button>'
        +'<button class="btn'+(opts.danger?' btn-danger':'')+'" id="uiConfirmYes">'+esc(okText)+'</button>'
      +'</div>'
    +'</div></div>';
  var div=document.createElement('div'); div.innerHTML=html; document.body.appendChild(div.firstChild);
  var ov=$('uiConfirmOverlay');
  function onKey(e){ if(e.key==='Escape'){ close(); } else if(e.key==='Enter'){ close(); if(onYes) onYes(); } }
  function close(){ if(ov) ov.remove(); document.removeEventListener('keydown', onKey); }
  $('uiConfirmNo').onclick=close;
  ov.addEventListener('mousedown',function(e){ if(e.target===this) close(); });
  $('uiConfirmYes').onclick=function(){ close(); if(onYes) onYes(); };
  document.addEventListener('keydown', onKey);
  setTimeout(function(){ var y=$('uiConfirmYes'); if(y) y.focus(); },0);
}
function clampWeekStart(){
  // pick the week containing today (or 0)
  var today=isoToday();
  if(ES.data && ES.data.days){
    for(var i=0;i<ES.data.days.length;i++) if(ES.data.days[i].date===today) return Math.floor(i/7)*7;
  }
  return 0;
}
function setSaveState(s, msg){
  ES.saveState=s;
  var el=$('eSaveInd'); if(!el) return;
  // 'dirty' reads as "saving" (not "editing") and shares the saving style — there
  // is no separate yellow unsaved state; cells go straight to the green confirmation.
  el.className='saveind '+(s==='dirty'?'saving':(s||''));
  var key = ({idle:'พร้อมแก้ไข', dirty:'กำลังบันทึก…', saving:'กำลังบันทึก…', saved:'บันทึกแล้ว', error:'บันทึกไม่สำเร็จ'}[s]||'');
  el.textContent= msg || (key ? t(key) : '');
}
/* ============================ MOBILE ENTRY VIEW ============================
   Below 768px viewport. Three states:
     (1) no site → pick site
     (2) site picked, no employee → list of employees
     (3) employee picked → vertical scroll of day-cards for that employee
   Reuses api_siteMonth / api_saveCells — same data, different rendering. */
function renderEntryMobile(){
  var sites = visibleSites();
  if(!sites.length){ $('view').innerHTML='<div class="card"><p class="muted">'+((BOOT.sites||[]).length?t('หน่วยงานทั้งหมดถูกซ่อนอยู่ — เปิดได้ที่ ⚙ ตั้งค่า'):t('ยังไม่มีหน่วยงานในสิทธิ์ของคุณ'))+'</p></div>'; return; }
  if(ES.site && !sites.some(function(s){return s.key===ES.site;})) ES.site='';

  // Toolbar (always shown): site + month
  function toolbarHtml(){
    return '<div class="m-toolbar">'
      + '<div class="fld'+(ES.site?'':' needs-pick')+'"><label>'+t('หน่วยงาน')+'</label><select id="mSite">'
      +   '<option value=""'+(!ES.site?' selected':'')+'>— '+t('เลือกหน่วยงาน')+' —</option>'
      +   sites.map(function(s){return '<option value="'+esc(s.key)+'"'+(s.key===ES.site?' selected':'')+'>'+esc(s.name)+'</option>';}).join('')
      + '</select></div>'
      + '<div class="fld'+(ES.site?'':' fld-disabled')+'"><label>'+t('เดือน')+'</label><div id="eMonth">'+monthNav()+'</div></div>'
      + '</div>';
  }
  function wireToolbar(){
    $('mSite').onchange = function(){
      ES.site = this.value; ES.mobileEid = ''; ES.data = null; renderEntryMobile();
    };
    if(ES.site){
      wireMonthNav(function(){
        ES.data = null; ES.mobileEid = '';
        $('eMonth').innerHTML = monthNav();
        wireMonthNav(arguments.callee);
        renderEntryMobile();
      });
    }
  }

  // No site picked: empty state
  if(!ES.site){
    $('view').innerHTML = toolbarHtml()
      + '<div class="card m-empty"><div class="icon">📋</div>'
      + '<h2 style="margin:0">เลือกหน่วยงานเพื่อเริ่มบันทึก</h2>'
      + '<p class="hint" style="margin-top:.5rem">เลือกจากดรอปดาวน์ <b>หน่วยงาน</b> ด้านบน</p></div>';
    wireToolbar();
    return;
  }

  // Site picked — need data (employees + entries)
  if(!ES.data){
    $('view').innerHTML = toolbarHtml() + '<div class="card"><div class="spinner"></div></div>';
    wireToolbar();
    call('api_siteMonth', [ES.site, CUR.y, CUR.m], function(d){
      if(!d || !d.ok){
        $('view').innerHTML = toolbarHtml() + '<div class="card flash error" style="display:block">'+esc((d&&d.error)||'?')+'</div>';
        wireToolbar(); return;
      }
      ES.data = d; renderEntryMobile();
    });
    return;
  }

  // Employee picked — show their month as day-cards
  if(ES.mobileEid){
    var emp = ES.data.employees.find(function(e){ return String(e.eid)===String(ES.mobileEid); });
    if(!emp){ ES.mobileEid = ''; return renderEntryMobile(); }
    renderMobileEmpMonth(emp);
    return;
  }

  // Site + month picked, no employee — show employee list
  renderMobileEmpList();
  wireToolbar();
}

function renderMobileEmpList(){
  var sites = BOOT.sites || [];
  var d = ES.data;
  var acc = (typeof siteAccent === 'function') ? siteAccent(ES.site) : { c:'#1d4e89', tint:'#e6effb' };

  // Toolbar at top
  var html = '<div class="m-toolbar">'
    + '<div class="fld'+(ES.site?'':' needs-pick')+'"><label>'+t('หน่วยงาน')+'</label><select id="mSite">'
    +   '<option value=""'+(!ES.site?' selected':'')+'>— '+t('เลือกหน่วยงาน')+' —</option>'
    +   sites.map(function(s){return '<option value="'+esc(s.key)+'"'+(s.key===ES.site?' selected':'')+'>'+esc(s.name)+'</option>';}).join('')
    + '</select></div>'
    + '<div class="m-tb-row">'
    +   '<div class="fld"><label>'+t('เดือน')+'</label><div id="eMonth">'+monthNav()+'</div></div>'
    +   '<button class="btn xls-btn" id="mExport">⬇ Excel</button>'
    + '</div>'
    + '</div>';

  if(!d.employees.length){
    html += '<div class="card m-empty"><p class="muted">ยังไม่มีพนักงานในหน่วยงานนี้</p></div>';
  } else {
    html += '<div class="hint" style="padding:0 .3rem .4rem">'+t('แตะชื่อพนักงานเพื่อดู/บันทึกของเดือน')+' '+MNAME(CUR.m)+' '+be(CUR.y)+'</div>'
      + '<div class="m-emp-list" style="--site:'+acc.c+'">'
      + d.employees.map(function(e){
          var op = e.kind === 'operation';
          var firstChar = (String(e.name||'').trim().charAt(0) || '?');
          // Count days entered for this emp in current month — quick visual
          var byDate = d.entries[e.eid] || {};
          var fillCount = Object.keys(byDate).filter(function(dt){
            var v = byDate[dt]; return v && (v.team || v.detail);
          }).length;
          var totalDays = d.days.length;
          return '<div class="m-emp-row" data-eid="'+e.eid+'">'
            + '<div class="m-emp-avatar" style="background:var(--site)">'+esc(firstChar)+'</div>'
            + '<div class="m-emp-info">'
            +   '<div class="nm">'+esc(e.name)+'</div>'
            +   '<div class="meta">'+esc(e.emp_id||'')+(e.position?(' · '+esc(e.position)):'')+' · '+fillCount+'/'+totalDays+'</div>'
            + '</div>'
            + '<span class="kpill '+(op?'op':'sup')+'">'+(op?'OP':'SUP')+'</span>'
            + '<span class="chev">›</span>'
            + '</div>';
        }).join('')
      + '</div>';
  }

  $('view').innerHTML = html;
  // wire site + month
  $('mSite').onchange = function(){ ES.site = this.value; ES.mobileEid=''; ES.data=null; renderEntryMobile(); };
  var mExp=$('mExport'); if(mExp) mExp.onclick=function(){ exportSiteXlsx(ES.site, this); };
  wireMonthNav(function(){
    ES.data = null; ES.mobileEid = '';
    $('eMonth').innerHTML = monthNav();
    wireMonthNav(arguments.callee);
    renderEntryMobile();
  });
  Array.prototype.forEach.call($('view').querySelectorAll('.m-emp-row'), function(row){
    row.onclick = function(){
      ES.mobileEid = row.getAttribute('data-eid');
      renderEntryMobile();
    };
  });
}

function renderMobileEmpMonth(emp){
  var d = ES.data;
  var op = emp.kind === 'operation';
  var today = d.today || isoToday();
  var lockDays = Number(d.lockDays || 3);
  var lockCutoff = isoMinusDays(today, lockDays);
  var lockAhead = isoPlusDays(today, 1);   // can't fill past tomorrow
  var canBypass = BOOT.isAdmin && ES.adminUnlock;
  var acc = (typeof siteAccent === 'function') ? siteAccent(ES.site) : { c:'#1d4e89', tint:'#e6effb' };

  // Header: back button + employee card + month picker
  var html = '<button class="m-back" id="mBack">‹ กลับสู่รายชื่อ</button>'
    + '<div class="m-emp-head" style="--site:'+acc.c+';--site-tint:'+acc.tint+'">'
    +   '<div class="m-emp-avatar">'+esc((String(emp.name||'').charAt(0)||'?'))+'</div>'
    +   '<div class="m-emp-info">'
    +     '<div class="nm">'+esc(emp.name)+'</div>'
    +     '<div class="meta">'+esc(emp.emp_id||'')+(emp.position?(' · '+esc(emp.position)):'')+' · '+(op?'ปฏิบัติการ':'สนับสนุน')+'</div>'
    +   '</div>'
    + '</div>'
    + '<div class="m-toolbar"><div class="fld"><label>เดือน</label><div id="eMonth">'+monthNav()+'</div></div></div>';

  // Day cards
  var entries = d.entries[emp.eid] || {};
  // sup-defs datalist for support
  if(!op){ html += '<datalist id="supDefs">'+SUP_DEFAULTS.map(function(v){return '<option value="'+esc(v)+'"></option>';}).join('')+'</datalist>'; }

  var awaySet={}; (emp.away||[]).forEach(function(dd){ awaySet[dd]=1; });
  html += d.days.map(function(day){
    if(awaySet[day.date]){
      var isOut=(day.date===emp.movedOut);
      var note=t('ไม่ได้สังกัดหน่วยงานนี้')+(isOut?(' · '+t('ย้ายออกไป')+' '+emp.movedOutTo):(emp.movedInFrom?(' · '+t('ย้ายเข้าจาก')+' '+emp.movedInFrom):''));
      return '<div class="m-day-card away" data-date="'+day.date+'"><div class="m-day-head">'
        +'<span class="m-day-num">'+Number(day.date.slice(8,10))+'</span>'
        +'<span class="m-day-dow">'+TH_DOW[day.dow]+'</span></div>'
        +'<div class="m-away-note">'+esc(note)+'</div></div>';
    }
    var v = entries[day.date] || {};
    var amVal = op ? (v.team||'') : (v.detail||'');
    var pmVal = v.pm||'';
    var locked = !canBypass && (day.date < lockCutoff || day.date > lockAhead);
    var ro = locked ? ' readonly tabindex="-1"' : '';
    var dd = Number(day.date.slice(8,10));
    var cls = 'm-day-card';
    if(day.weekend) cls += ' weekend';
    if(day.date === today) cls += ' today';
    if(locked) cls += ' locked';
    var badges = '';
    if(day.date === today) badges += '<span class="m-day-badge today">วันนี้</span>';
    else if(day.weekend) badges += '<span class="m-day-badge wknd">วันหยุด</span>';
    if(locked) badges += '<span class="m-day-badge locked">🔒 ล็อก</span>';
    if(day.date === emp.movedIn) badges += '<span class="m-day-badge movedin">→ '+t('ย้ายเข้า')+'</span>';
    var ph = day.weekend ? ' placeholder="วันหยุด"' : '';

    // One task is the norm; the second row is an optional add-on ("+ งานที่ 2").
    var amF = op ? 'team' : 'detail';
    var mkRow = function(val, f, isSecond){
      var phTxt = isSecond ? '+ งานที่ 2 (ถ้ามี)' : (day.weekend ? 'วันหยุด' : 'เลือกงาน');
      var phAttr = ' placeholder="'+phTxt+'"';
      // ALL cells (op + sup) are picker-driven and read-only — tap opens the same
      // searchable popup, no free typing and no native datalist.
      var inp = '<input data-f="'+f+'" value="'+esc(val)+'"'+(locked? ro : ' readonly')+phAttr+'>';
      return '<div class="row m-shift '+(isSecond?'second':'primary')+'">'+inp+'</div>';
    };
    var inputs = mkRow(amVal, amF, false) + mkRow(pmVal, 'pm', true);

    return '<div class="'+cls+'" data-date="'+day.date+'" data-eid="'+emp.eid+'" data-kind="'+emp.kind+'">'
      + '<div class="m-day-head">'
      +   '<span class="m-day-num">'+dd+'</span>'
      +   '<span class="m-day-dow">'+TH_DOW[day.dow]+'</span>'
      +   '<span class="m-day-badges">'+badges+'</span>'
      + '</div>'
      + inputs
      + '</div>';
  }).join('');

  $('view').innerHTML = html;

  // wire back button
  $('mBack').onclick = function(){ ES.mobileEid = ''; renderEntryMobile(); };

  // wire month picker — same month-change behavior
  wireMonthNav(function(){
    ES.data = null;  // force reload for new month
    $('eMonth').innerHTML = monthNav();
    wireMonthNav(arguments.callee);
    renderEntryMobile();
  });

  // wire day-card edits — reuse existing onCellChange via a small adapter
  Array.prototype.forEach.call($('view').querySelectorAll('.m-day-card:not(.locked) input'), function(inp){
    inp.addEventListener('input', function(){ mobileOnCellChange(inp); });
    inp.addEventListener('change', function(){ mobileOnCellChange(inp); });
    // EVERY cell (op + sup) opens the same searchable picker on tap.
    inp.addEventListener('click', function(){ oppOpen(inp); });
  });

  // auto-scroll to today's card if present
  setTimeout(function(){
    var todayCard = $('view').querySelector('.m-day-card.today');
    if(todayCard) todayCard.scrollIntoView({block:'center', behavior:'smooth'});
  }, 50);
}

// Mobile-cell-change adapter — uses the m-day-card wrapper instead of td.cell.
// Reuses the same ES.queue + flushSave machinery as desktop.
function mobileOnCellChange(inp){
  var card = inp.closest('.m-day-card');
  if(!card) return;
  var key = card.getAttribute('data-eid')+'|'+card.getAttribute('data-date');
  var cur = ES.queue[key] || {
    eid: card.getAttribute('data-eid'),
    kind: card.getAttribute('data-kind'),
    date: card.getAttribute('data-date'),
    fields: {}
  };
  Array.prototype.forEach.call(card.querySelectorAll('input'), function(x){
    cur.fields[x.getAttribute('data-f')] = x.value;
  });
  ES.queue[key] = cur;
  card.classList.remove('saved');
  card.classList.add('dirty');
  setSaveState('dirty');
  clearTimeout(ES.saveTimer);
  ES.saveTimer = setTimeout(flushSaveMobile, 900);
}
function flushSaveMobile(){
  var keys = Object.keys(ES.queue);
  if(!keys.length){ setSaveState('idle'); return; }
  // Take items out now so in-flight edits aren't clobbered on save success.
  var sending={}; var items=keys.map(function(k){ sending[k]=ES.queue[k]; delete ES.queue[k]; return sending[k]; });
  setSaveState('saving');
  Array.prototype.forEach.call($('view').querySelectorAll('.m-day-card.dirty'), function(c){
    c.classList.remove('dirty'); c.classList.add('saving');
  });
  call('api_saveCells', [ES.site, items], function(r){
    Array.prototype.forEach.call($('view').querySelectorAll('.m-day-card.saving'), function(c){
      c.classList.remove('saving'); c.classList.add('saved');
      setTimeout(function(){ c.classList.remove('saved'); }, 1500);
    });
    if(r && r.ok){
      setSaveState(Object.keys(ES.queue).length ? 'dirty' : 'saved');
      setTimeout(function(){ if(ES.saveState==='saved') setSaveState('idle'); }, 1800);
    } else {
      keys.forEach(function(k){ if(!ES.queue[k]) ES.queue[k]=sending[k]; });
      clearTimeout(ES.saveTimer); ES.saveTimer=setTimeout(flushSaveMobile,1500);
      setSaveState('error', 'บันทึกไม่สำเร็จ: '+((r&&r.error)||'?'));
    }
  });
}

function loadGrid(){
  ES.queue={}; setSaveState('idle');
  if(!ES.site){
    $('eGrid').innerHTML =
      '<div class="card empty-hero" style="text-align:center;padding:3rem 1.2rem">'
      +'<div style="font-size:2.4rem;line-height:1;margin-bottom:.6rem">📋</div>'
      +'<h2 style="margin:0">เลือกหน่วยงานเพื่อเริ่มบันทึก</h2>'
      +'<p class="muted" style="margin:.5rem auto 0;max-width:520px">เลือกจากดรอปดาวน์ <b>หน่วยงาน</b> ด้านบน หรือกลับไปยัง <b>แดชบอร์ด</b> แล้วกด «เปิดบันทึก →» ในการ์ดของโครงการที่ต้องการ</p>'
      +'</div>';
    return;
  }
  $('eGrid').innerHTML='<div class="spinner"></div>';
  call('api_siteMonth',[ES.site,CUR.y,CUR.m],function(d){
    if(!d||!d.ok){ $('eGrid').innerHTML='<div class="card flash error" style="display:block">'+esc((d&&d.error)||'?')+'</div>'; return; }
    ES.data=d;
    // If we just navigated in from the dashboard (or any caller set the flag),
    // position the week on whichever one contains today.
    if(ES.jumpToToday){ ES.weekStart = clampWeekStart(); ES.jumpToToday = false; }
    renderGrid();
  });
}
var SUP_DEFAULTS = ['ทำงาน','วันหยุด','ลาพักผ่อน','ลาป่วย','ลากิจ','สงกรานต์','วันแรงงาน','อื่น ๆ'];
function isoMinusDays(iso, n){
  var d=new Date(iso+'T00:00:00'); d.setDate(d.getDate()-n);
  return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
}
function isoPlusDays(iso, n){
  var d=new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n);
  return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
}
function fmtDayRange(days, start, count){
  if(!days.length) return '';
  var a=days[start], b=days[Math.min(days.length-1, start+count-1)];
  return a.date.slice(8,10)+' – '+b.date.slice(8,10)+' '+MSHORT(Number(a.date.slice(5,7)));
}
function renderGrid(){
  if(ES.viewMode==='coverage') return renderCoverage();
  var d=ES.data;
  if(!d.employees.length){ $('eGrid').innerHTML='<div class="card"><p class="muted">ยังไม่มีพนักงานในหน่วยงานนี้</p></div>'; return; }
  var today=d.today||isoToday();
  var lockDays = Number(d.lockDays||3);
  var lockCutoff = isoMinusDays(today, lockDays);  // dates < cutoff are locked
  var lockAhead = isoPlusDays(today, 1);           // can't fill past tomorrow
  var canBypass = BOOT.isAdmin && ES.adminUnlock;

  // visible day slice
  var days=d.days, start=0, count=days.length;
  if(ES.viewMode==='week'){
    start = Math.min(Math.max(0, ES.weekStart), Math.max(0, days.length-1));
    count = Math.min(7, days.length-start);
  }
  var visible = days.slice(start, start+count);

  // update week label if present
  var wlbl=$('wLbl'); if(wlbl) wlbl.textContent = fmtDayRange(days, start, count);
  if(ES.viewMode==='week'){
    $('wPrev').disabled = (start<=0);
    $('wNext').disabled = (start+count>=days.length);
  }

  // Op team cells use the custom searchable picker — no native datalist needed
  // (and including one causes the black native popup to flash on click).
  var teamsHtml = '';
  var supHtml  = '<datalist id="supDefs">'+SUP_DEFAULTS.map(function(v){return '<option value="'+esc(v)+'"></option>';}).join('')+'</datalist>';

  // value(name) → Job Code lookup (legacy badge helper).
  ES.codeMap = {}; (d.teams||[]).forEach(function(tm){ if(tm.name) ES.codeMap[tm.name]=String(tm.code||''); });
  var codeOf = ES.codeMap;
  // code → full name maps for the two-layer cell tooltip ("A-1 / 5" → names).
  ES.workByCode = {}; (d.teams||[]).forEach(function(tm){ if(tm.code) ES.workByCode[String(tm.code)]=tm.name; });
  ES.costByCode = {}; (d.costs||[]).forEach(function(c){ if(c.code) ES.costByCode[String(c.code)]=c.name; });
  // Work-type → mapping metadata. one-to-one work types skip the Cost step and
  // auto-assign their fixed cost code; one-to-many let the user pick the cost.
  ES.workMeta = {}; (d.teams||[]).forEach(function(tm){ if(tm.code) ES.workMeta[String(tm.code)]={
    mapping:String(tm.mapping||'one-to-many'), fixed:String(tm.fixed_cost||''),
    allowed:String(tm.allowed_cost||'').split(',').map(function(s){return s.trim();}).filter(Boolean) }; });

  var head='<tr><th class="emp-col">พนักงาน <span class="hint" style="font-weight:500">('+d.employees.length+')</span></th>'
    + visible.map(function(day){
        var dd=Number(day.date.slice(8,10));
        var cls=(day.weekend?'weekend':'')+(day.date===today?' today':'');
        return '<th class="'+cls.trim()+'" data-date="'+day.date+'">'+dd+'<span class="dow">'+TH_DOW[day.dow]+'</span></th>';
      }).join('')
    +'</tr>';

  var body=d.employees.map(function(e){
    var op=e.kind==='operation';
    // Migration: which days this person is NOT at this site (greyed), and the
    // day they moved in/out (markers). awaySet → O(1) per-cell lookup.
    var awaySet={}; (e.away||[]).forEach(function(dd){ awaySet[dd]=1; });
    var migNote = e.movedIn ? ('<div class="migsub" title="'+esc(t('ย้ายเข้าจาก')+' '+e.movedInFrom+' '+e.movedIn)+'">→ '+esc(e.movedInFrom)+'</div>')
                : e.movedOut ? ('<div class="migsub out" title="'+esc(t('ย้ายออกไป')+' '+e.movedOutTo+' '+e.movedOut)+'">'+esc(e.movedOutTo)+' →</div>') : '';
    return '<tr data-eid="'+e.eid+'" data-kind="'+e.kind+'">'
      +'<td class="emp-col">'
        +'<span class="kpill '+(op?'op':'sup')+'">'+(op?'OP':'SUP')+'</span>'
        +'<span class="emp-acts">'
          +'<button class="emp-act mig" data-eid="'+esc(e.eid)+'" data-name="'+esc(e.name)+'" data-site="'+esc(ES.site||'')+'" title="'+esc(t('ย้ายหน่วยงาน'))+'">⇄</button>'
        +'</span>'
        +'<span class="emp-name">'+esc(e.name)+'</span>'
        +'<div class="sub">'+esc(e.emp_id||'')+(e.department?(' · '+esc(e.department)):'')+(e.position?(' · '+esc(e.position)):'')+'</div>'
        +migNote
      +'</td>'
      + visible.map(function(day){
          if(awaySet[day.date]){
            var isOut=(day.date===e.movedOut);
            var aTip=t('ไม่ได้สังกัดหน่วยงานนี้')+(isOut?(' · '+t('ย้ายออกไป')+' '+e.movedOutTo+' '+e.movedOut):(e.movedInFrom?(' · '+t('ย้ายเข้าจาก')+' '+e.movedInFrom+' '+e.movedIn):''));
            return '<td class="cell away'+(day.date===today?' today':'')+'" data-date="'+day.date+'" title="'+esc(aTip)+'">'
              +(isOut?'<div class="awaytxt">'+esc(e.movedOutTo)+' →</div>':'')+'</td>';
          }
          var v=(d.entries[e.eid]||{})[day.date]||{};
          var amVal = op ? (v.team||'') : (v.detail||'');
          var pmVal = v.pm||'';
          var locked = !canBypass && (day.date < lockCutoff || day.date > lockAhead);
          var cls=(day.weekend?'weekend':'')+(day.date===today?' today':'')+(locked?' locked':'')+(day.date>lockAhead?' future':'');
          // Two stacked slots per day: AM (top, cool tint) + PM (bottom, warm
          // tint). Each row shows its AM/PM label so the two fields are always
          // self-explanatory. A small Job-Code badge precedes the value on filled
          // op cells. The .cval is a lightweight display <div> (no per-cell
          // <input>); ONE delegated handler opens the picker (op) or inline input.
          var tab = locked ? '' : ' tabindex="0"';
          // One task is the norm. The first slot is the task; the SECOND slot is
          // an optional add-on (shown quiet/dashed with a "+ งานที่ 2" hint) so it
          // reads as "usually one, up to two" — no AM/PM or หลัก/เสริม labels.
          var slot = function(val, f, isSecond){
            var phText = isSecond ? '+ งานที่ 2' : (day.weekend ? 'วันหยุด' : '');
            var ph = (!val && phText) ? (' data-ph="'+phText+'"') : '';
            var pick = ' data-pick="1"';   // ALL cells (op + sup) use the searchable picker — no free text
            var ttl = val ? (' title="'+esc(cellTitle_(val))+'"') : '';
            // Empty PRIMARY cell (not weekend) gets the "click to add" affordance:
            // a faint "+" by default, "+ เลือกงาน" + highlight on hover. (CSS scopes
            // it away from locked/future cells.)
            var pe = (!isSecond && !val && !day.weekend) ? ' pe' : '';
            return '<div class="shift '+(isSecond?'second':'primary')+'">'
              + '<div class="cval'+(val?'':' empty')+pe+'" data-f="'+f+'"'+pick+tab+ph+ttl+' data-val="'+esc(val)+'">'+esc(cellDisplay_(val))+'</div>'
              + '</div>';
          };
          var amF = op ? 'team' : 'detail';
          // Retroactive-correction note: ONLY for an already-locked cell whose saved
          // value was later changed via the override. Shown as a small TEXT line
          // (date + who), not a symbol, so it reads as a clear remark and stays rare.
          var ed = (d.edits && d.edits[e.eid+'|'+day.date]) || null;
          var rmark = '';
          if(ed){
            var byShort = ed.by ? String(ed.by).split('@')[0] : '';
            var full = t('แก้ไขย้อนหลัง')+' '+ed.date+(ed.by?(' · '+t('โดย')+' '+ed.by):'');
            rmark = '<div class="reditxt" title="'+esc(full)+'">'+t('แก้ไขย้อนหลัง')+' '+esc(ed.date)+(byShort?(' · '+esc(byShort)):'')+'</div>';
          }
          // Migration-in marker: the exact day this employee joined THIS site.
          var inMark = (day.date===e.movedIn)
            ? '<div class="inmark" title="'+esc(t('ย้ายเข้าจาก')+' '+e.movedInFrom+' '+e.movedIn)+'">→ '+t('ย้ายเข้า')+'</div>' : '';
          return '<td class="cell '+cls.trim()+(ed?' redited':'')+(day.date===e.movedIn?' movedin':'')+'" data-date="'+day.date+'">'
            + slot(amVal, amF, false) + slot(pmVal, 'pm', true) + rmark + inMark
            + '</td>';
        }).join('')
      +'</tr>';
  }).join('');

  $('eGrid').innerHTML = teamsHtml + supHtml
    +'<div class="gridwrap"><table class="mgrid"><thead>'+head+'</thead><tbody>'+body+'</tbody></table></div>'
    +'<div style="display:flex;gap:.6rem;margin-top:.7rem;align-items:center;flex-wrap:wrap">'
      +'<button class="btn sec" id="eAdd">+ เพิ่มพนักงาน</button>'
      +'<span class="hint">เซลล์ที่เกิน '+lockDays+' วันจะล็อกอัตโนมัติ (เฉพาะผู้ดูแลระบบเท่านั้นแก้ย้อนหลังได้) · บันทึกอัตโนมัติทุก ~1 วินาทีหลังพิมพ์เสร็จ · ปกติเลือกงานเดียวต่อวัน หากทำ 2 งานให้เพิ่มที่ช่อง “+ งานที่ 2” (1 วัน = 1 วันทำงาน, ถ้าทำ 2 งานจะนับงานละ 0.5)</span>'
    +'</div>';
  // ONE delegated click handler for the whole grid (replaces ~hundreds of
  // per-cell listeners). Assigned via .onclick so re-renders don't stack it.
  // Open the editor for a single SLOT div (.cval). op slots (data-pick) use the
  // searchable picker; sup slots get a transient inline input.
  var openSlotEditor = function(cv){
    var td = cv && cv.closest('td.cell');
    if(!cv || !td || td.classList.contains('locked')) return;
    if(cv.style.display === 'none') return;          // already swapped to an inline input
    if(cv.getAttribute('data-pick')) oppOpen(cv);    // op → searchable picker
    else openSupEditor(cv);                          // sup → inline input
  };
  $('eGrid').onclick = function(ev){
    // per-employee migrate / remove buttons in the sticky name column
    var act = ev.target.closest && ev.target.closest('.emp-act.mig');
    if(act){
      ev.stopPropagation();
      openMigrateEmp(act.getAttribute('data-eid'), act.getAttribute('data-name'), act.getAttribute('data-site'));
      return;
    }
    var shift = ev.target.closest && ev.target.closest('td.cell:not(.locked) .shift');
    if(!shift) return;
    var cv = shift.querySelector('.cval');
    if(cv) openSlotEditor(cv);
  };
  // Keyboard: Tab moves between slots (native, via tabindex) WITHOUT opening;
  // Enter/Space on a focused slot opens its editor — matches prior behavior.
  $('eGrid').onkeydown = function(ev){
    if(ev.key!=='Enter' && ev.key!==' ') return;
    var cv = ev.target; if(!cv || !cv.classList || !cv.classList.contains('cval')) return;
    ev.preventDefault();
    openSlotEditor(cv);
  };
  $('eAdd').onclick=openAddEmp;
  // auto-scroll horizontally so today's column is visible — OR, if we arrived by
  // clicking an Overview cell, land directly on that employee×day cell instead.
  setTimeout(function(){
    if(ES.focusCell){ var fc=ES.focusCell; ES.focusCell=null; focusEntryCell_(fc.eid, fc.date); return; }
    var gw=$('eGrid').querySelector('.gridwrap');
    var th=gw && gw.querySelector('th.today');
    if(gw && th){ gw.scrollLeft = Math.max(0, th.offsetLeft - 230); }
  }, 30);
}

// Compact code display for the coverage heatmap: one line, or AM/PM stacked
// when they differ. " / " is compressed to "/" to fit the narrow cells.
function covCodeHtml_(am, pm){
  // NOTE: avoid regex literals here — this code lives inside the PAGE_HTML_
  // template literal, which strips single backslashes (\\s -> s), corrupting
  // regexes and breaking the whole client script. Use plain string ops.
  var a=String(am||'').trim().split(' / ').join('/');
  var p=String(pm||'').trim().split(' / ').join('/');
  if(a && p && a!==p) return '<span class="cc">'+esc(a)+'</span><span class="cc">'+esc(p)+'</span>';
  return '<span class="cc">'+esc(a||p)+'</span>';
}
/* ----- Coverage view: read-only heatmap of who filled which day ----- */
function renderCoverage(){
  var d=ES.data;
  if(!d.employees.length){ $('eGrid').innerHTML='<div class="card"><p class="muted">ยังไม่มีพนักงานในหน่วยงานนี้</p></div>'; return; }
  // code→name maps so the hover tooltip can show the full breakdown (like the
  // weekly grid). renderGrid builds these too, but coverage is a separate path.
  ES.workByCode = {}; (d.teams||[]).forEach(function(tm){ if(tm.code) ES.workByCode[String(tm.code)]=tm.name; });
  ES.costByCode = {}; (d.costs||[]).forEach(function(c){ if(c.code) ES.costByCode[String(c.code)]=c.name; });
  var today=d.today||isoToday();
  var lockDays = Number(d.lockDays||3);
  var lockCutoff = isoMinusDays(today, lockDays);
  var lockAhead = isoPlusDays(today, 1);   // can fill up to tomorrow only
  // per-day filled count (for calendar summary). Employees who are NOT at this
  // site on a given day (migrated in/out) are excluded from that day's total, so
  // their away days never count as "missing".
  var perDay={}; d.days.forEach(function(day){ perDay[day.date]={f:0,t:0}; });
  d.employees.forEach(function(e){
    var by=d.entries[e.eid]||{}, aw={}; (e.away||[]).forEach(function(dd){ aw[dd]=1; });
    d.days.forEach(function(day){
      if(aw[day.date]) return;            // not here that day → not expected
      perDay[day.date].t++;
      var v=by[day.date]||{};
      if(v.team||v.detail||v.pm) perDay[day.date].f++;
    });
  });
  // top: per-day summary strip
  var daysStrip = '<div class="cov-days"><div class="cov-days-row">'
    + d.days.map(function(day){
        var dd=Number(day.date.slice(8,10));
        var s=perDay[day.date], pct = s.t? Math.round(s.f/s.t*100):0;
        // 3-colour semantic, aligned with the cells below:
        //  yellow = still editable (in progress) · green = locked-in & 100% complete
        //  red = locked & not everyone filled · grey = future · พัก = weekend.
        var isToday=day.date===today, isWk=day.weekend;
        var isFut=day.date>lockAhead, isEdit=(day.date>=lockCutoff && day.date<=lockAhead);
        var bg,fg='#fff',ptxt=pct+'%',lbl;
        if(isToday){ bg='#1d4e89'; lbl='วันนี้ · ยังแก้ไขได้'; }
        else if(isWk){ bg='#fdf0d4'; fg='#6b5232'; ptxt='พัก'; lbl='วันหยุด'; }
        else if(isFut){ bg='#eef2f8'; fg='#9aa5b4'; ptxt='—'; lbl='ยังไม่ถึงกำหนด'; }
        else if(isEdit){ bg='#e8b500'; fg='#5a4500'; lbl='ยังแก้ไขได้'; }
        else if(pct>=100){ bg='#1f9d55'; lbl='ครบ 100% (ล็อกแล้ว)'; }
        else { bg='#e0533a'; lbl='ไม่ครบ (ล็อกแล้ว)'; }
        var tip = day.date+' · '+lbl+' · '+s.f+'/'+s.t+' ('+pct+'%)';
        return '<div class="cov-day" title="'+esc(tip)+'" data-date="'+day.date+'" style="background:'+bg+';color:'+fg+'">'
          +'<div class="d">'+dd+'</div><div class="x">'+TH_DOW[day.dow]+'</div><div class="p">'+ptxt+'</div></div>';
      }).join('')
    +'</div><div class="hint" style="margin-top:.35rem">เหลือง = ยังแก้ไขได้ (ย้อนหลัง '+lockDays+' วัน ถึงพรุ่งนี้) · เขียว = บันทึกครบ 100% (ล็อกแล้ว) · แดง = ขาด/ไม่ครบ · เทา = ยังไม่ถึงกำหนด · พัก = วันหยุด</div></div>';
  // employee × day heatmap
  var head='<tr><th class="emp-col">พนักงาน <span class="hint" style="font-weight:500">('+d.employees.length+')</span></th>'
    + d.days.map(function(day){
        var dd=Number(day.date.slice(8,10));
        var cls=(day.weekend?'weekend':'')+(day.date===today?' today':'');
        return '<th class="cov-th '+cls.trim()+'" data-date="'+day.date+'">'+dd+'<span class="dow">'+TH_DOW[day.dow]+'</span></th>';
      }).join('')
    +'</tr>';
  var body=d.employees.map(function(e){
    var op=e.kind==='operation', by=d.entries[e.eid]||{};
    var awaySet={}; (e.away||[]).forEach(function(dd){ awaySet[dd]=1; });
    return '<tr data-eid="'+e.eid+'">'
      +'<td class="emp-col"><span class="kpill '+(op?'op':'sup')+'">'+(op?'OP':'SUP')+'</span>'
        +esc(e.name)+'<div class="sub">'+esc(e.emp_id||'')+(e.department?(' · '+esc(e.department)):'')+'</div></td>'
      + d.days.map(function(day){
          if(awaySet[day.date]){
            var aTip=day.date+' · '+t('ไม่ได้สังกัดหน่วยงานนี้');
            return '<td class="cov-cell" data-date="'+day.date+'" data-acts="" title="'+esc(aTip)+'"><div class="ccell" style="background:#e7ebf1" data-s="away">—</div></td>';
          }
          var v=by[day.date]||{};
          var amv = v.team||v.detail||'';   // AM composite "A-1 / 5"
          var pmv = v.pm||'';               // PM composite
          var has = !!(amv||pmv);
          var future  = day.date > lockAhead;     // beyond tomorrow → can't fill yet
          var locked  = day.date < lockCutoff;     // past the window → finalized
          var editable = !future && !locked;       // [today-lockDays … tomorrow]
          // Three colours, no frames: YELLOW = still editable (filled shows its code,
          // empty stays blank) · GREEN = locked-in & filled · RED = locked & missing.
          // Future (beyond tomorrow) = grey · พัก = weekend.
          var status, bg, inner;
          if(future){           status='future';   bg='#eef2f8'; inner=''; }
          else if(day.weekend){ status='weekend';  bg='#fdf0d4'; inner='พัก'; }
          else if(editable){    status='editable'; bg='#e8b500'; inner=has?covCodeHtml_(amv,pmv):''; }
          else if(has){         status='ok';       bg='#1f9d55'; inner=covCodeHtml_(amv,pmv); }
          else {                status='miss';     bg='#e0533a'; inner=''; }   // empty + locked → RED
          var statusLabel = {ok:'บันทึกครบ (ล็อกแล้ว)',editable:has?'บันทึกแล้ว · ยังแก้ไขได้':'ว่าง · ยังแก้ไขได้',weekend:'วันหยุดสุดสัปดาห์',miss:'ขาดบันทึก (เลยกำหนด)',future:'ยังไม่ถึงกำหนด'}[status];
          // Hover shows the SAME full breakdown as the weekly grid (code + work
          // name · cost code + name), not just the bare code — staff forget codes.
          var tip = day.date+' · '+statusLabel+(has?(' · '+cellTitle_(amv)+(pmv&&pmv!==amv?('  ·  งานที่ 2: '+cellTitle_(pmv)):'')):'');
          var todayCls = (day.date===today) ? ' today' : '';
          var codesCls = ((status==='ok')||(status==='editable'&&has)) ? ' codes' : '';
          // Activity code(s) in this cell (the part before " / "), space-joined, for
          // the in-place code highlighter. e.g. "A-1 / 5" + "Z-1" → data-acts="A-1 Z-1".
          var aCode = amv ? String(amv).split(' / ')[0].trim() : '';
          var pCode = pmv ? String(pmv).split(' / ')[0].trim() : '';
          var acts  = (aCode + ' ' + pCode).trim();
          return '<td class="cov-cell" data-date="'+day.date+'" data-acts="'+esc(acts)+'" title="'+esc(tip)+'"><div class="ccell'+todayCls+codesCls+'" style="background:'+bg+'" data-s="'+status+'">'+inner+'</div></td>';
        }).join('')
      +'</tr>';
  }).join('');
  // In-place code highlighter: pick one or more activity codes and every matching
  // cell gets a purple ring while the rest dim — no page jump. Codes come from this
  // site's activity list (d.teams); selection persists per-device (COV_HL).
  var hlBar = '<div class="cov-hl" id="covHl">'
    + '<span class="cov-hl-lbl">🔦 '+t('ไฮไลต์รหัส')+'</span>'
    + '<select id="covHlAdd" class="cov-hl-sel"><option value="">'+t('+ เลือกรหัสเพื่อเน้น…')+'</option>'
    +   (d.teams||[]).map(function(tm){ return '<option value="'+esc(tm.code||'')+'">'+esc((tm.code||'')+' · '+(tm.name||''))+'</option>'; }).join('')
    + '</select>'
    + '<span class="cov-hl-chips" id="covHlChips"></span>'
    + '<span class="cov-hl-count" id="covHlCount"></span>'
    + '</div>';
  $('eGrid').innerHTML = daysStrip + hlBar
    +'<div class="gridwrap"><table class="mgrid covgrid"><thead>'+head+'</thead><tbody>'+body+'</tbody></table></div>'
    +'<div style="margin-top:.7rem"><span class="hint">คลิกเซลล์เพื่อกระโดดไปแก้พนักงาน/วันนั้นในมุมมองสัปดาห์ · 🔦 เลือกรหัสด้านบนเพื่อเน้นทุกเซลล์ของงานนั้น</span></div>';
  // wire the highlighter (chips + live count), then paint the current selection
  var hlAdd = $('covHlAdd');
  if(hlAdd) hlAdd.onchange = function(){
    var c = this.value; this.value = '';
    if(c && COV_HL.indexOf(c) < 0){ setCovHL(COV_HL.concat([c])); renderCovChips_(); applyCovHighlight_(); }
  };
  renderCovChips_();
  applyCovHighlight_();
  // click → jump to that week in edit mode, landing ON the exact employee×day cell
  Array.prototype.forEach.call($('eGrid').querySelectorAll('td.cov-cell,div.cov-day'),function(el){
    el.addEventListener('click', function(){
      var date=el.getAttribute('data-date'); if(!date) return;
      var idx=-1; for(var i=0;i<d.days.length;i++) if(d.days[i].date===date){ idx=i; break; }
      if(idx<0) return;
      var tr=el.closest && el.closest('tr[data-eid]');
      var eid=tr?tr.getAttribute('data-eid'):'';        // cov-day (strip) has no row
      ES.viewMode='week'; ES.weekStart=Math.floor(idx/7)*7;
      ES.focusCell = eid ? {eid:eid, date:date} : null;
      renderEntry();
    });
  });
}
/* ---- Overview code highlighter ---- selected activity codes (persisted) ---- */
var COV_HL = (function(){ try{ return JSON.parse(_ls('hr_covhl','[]')) || []; }catch(e){ return []; } })();
function setCovHL(arr){ COV_HL = arr; _lsSet('hr_covhl', JSON.stringify(arr)); }
function renderCovChips_(){
  var box = $('covHlChips'); if(!box) return;
  box.innerHTML = COV_HL.map(function(c){
    var nm = (ES.workByCode && ES.workByCode[c]) || '';
    return '<span class="cov-hl-chip"><b>'+esc(c)+'</b>'+(nm?(' '+esc(nm)):'')+'<span class="x" data-c="'+esc(c)+'" title="'+esc(t('เอาออก'))+'">×</span></span>';
  }).join('');
  Array.prototype.forEach.call(box.querySelectorAll('.x'), function(x){
    x.onclick = function(){
      var c = x.getAttribute('data-c');
      setCovHL(COV_HL.filter(function(k){ return k !== c; }));
      renderCovChips_(); applyCovHighlight_();
    };
  });
}
function applyCovHighlight_(){
  var grid = $('eGrid') && $('eGrid').querySelector('.covgrid'); if(!grid) return;
  var on = COV_HL.length > 0;
  grid.classList.toggle('hl-on', on);
  var hitCells = 0, emps = {};
  Array.prototype.forEach.call(grid.querySelectorAll('td.cov-cell'), function(td){
    var acts = (td.getAttribute('data-acts')||'').split(' ').filter(Boolean);
    var match = on && acts.some(function(a){ return COV_HL.indexOf(a) >= 0; });
    td.classList.toggle('hl', match);
    if(match){ hitCells++; var tr = td.closest('tr[data-eid]'); if(tr) emps[tr.getAttribute('data-eid')] = 1; }
  });
  var cnt = $('covHlCount');
  if(cnt) cnt.textContent = on ? (hitCells + ' ' + t('เซลล์') + ' · ' + Object.keys(emps).length + ' ' + t('คน')) : '';
}
// After the weekly grid renders, scroll the requested employee×day cell into view
// (both axes) and flash a highlight so the eye lands on it. Cleared after ~2.2s.
function focusEntryCell_(eid, date){
  var gw=$('eGrid').querySelector('.gridwrap'); if(!gw) return;
  var tr=gw.querySelector('tr[data-eid="'+eid+'"]'); if(!tr) return;
  var td=tr.querySelector('td.cell[data-date="'+date+'"]'); if(!td) return;
  // horizontal scroll within the grid; vertical via the page
  gw.scrollLeft = Math.max(0, td.offsetLeft - gw.clientWidth/2 + td.offsetWidth/2);
  try{ td.scrollIntoView({block:'center',inline:'nearest'}); }catch(e){ td.scrollIntoView(); }
  td.classList.add('cellfocus');
  setTimeout(function(){ td.classList.remove('cellfocus'); }, 2200);
}
function onCellChange(inp){
  var td=inp.closest('td.cell'), tr=inp.closest('tr[data-eid]');
  var key=tr.getAttribute('data-eid')+'|'+td.getAttribute('data-date');
  var cur=ES.queue[key]||{eid:tr.getAttribute('data-eid'),kind:tr.getAttribute('data-kind'),date:td.getAttribute('data-date'),fields:{}};
  Array.prototype.forEach.call(td.querySelectorAll('input'),function(x){ cur.fields[x.getAttribute('data-f')]=x.value; });
  ES.queue[key]=cur;
  td.classList.remove('saved'); td.classList.add('dirty'); setSaveState('dirty');
  clearTimeout(ES.saveTimer);
  ES.saveTimer=setTimeout(flushSave, 900);
}

/* ----- Desktop fast-grid cells (display <div>, no per-cell <input>) -----
   Each day cell holds one or two slots (AM, and PM if split). A slot is a
   lightweight <div class="cval" data-f="team|detail|pm">. Values flow in from
   the picker (op) or a short-lived inline input (sup). Helpers operate on the
   specific SLOT div so AM and PM are independent within the same cell. */
// Tooltip for a two-layer value "A-1 / 5" → "A-1 <work name> · 5 <cost name>".
function cellTitle_(v){
  v = String(v||'').trim(); if(!v) return '';
  var parts = v.split(' / ');
  var wc = (parts[0]||'').trim(), cc = (parts[1]||'').trim();
  var wn = (ES.workByCode && ES.workByCode[wc]) || '';
  var cn = (ES.costByCode && ES.costByCode[cc]) || '';
  var out = wc + (wn ? (' '+wn) : '');
  if(cc) out += '  ·  ' + cc + (cn ? (' '+cn) : '');
  return out;
}
// What a cell SHOWS (vs. what it stores). Default = the raw composite code
// "A-1 / 5". When the user turns on full names (Settings), the ACTIVITY part is
// swapped for its full name while the Work Category stays a number: "งานผูกเหล็ก / 5".
// The stored value never changes — only the display text — so saving is unaffected.
function cellDisplay_(v){
  v = String(v||'').trim(); if(!v) return '';
  if(CELL_NAMES !== 'name') return v;                 // show the code (default)
  var parts = v.split(' / ');
  var wc = (parts[0]||'').trim(), cc = (parts[1]||'').trim();
  var wn = (ES.workByCode && ES.workByCode[wc]) || '';
  if(!wn) return v;                                   // unknown code (or sup free-text) → raw
  return wn + (cc ? (' / ' + cc) : '');
}
function setDeskCell_(cv, value){
  if(!cv) return;
  var oldVal = cv.getAttribute('data-val') || '';
  cv.setAttribute('data-val', value);     // data-val = source of truth for saving
  cv.textContent = cellDisplay_(value);   // text = code OR full name, per setting
  cv.classList.toggle('empty', !value);
  cv.title = cellTitle_(value);   // full names on hover
  deskCellChange_(cv);
  mirrorAmToPmDesk_(cv, oldVal, value);
}
/* Auto-fill DISABLED — see mirrorAmToPmInput_. The second slot (งานเสริม) is
   optional extra work and must stay empty unless the user fills it on purpose,
   so each day stays 1 manday (split 0.5/0.5 only when two tasks are logged). */
function mirrorAmToPmDesk_(cv, oldVal, newVal){ /* no-op (see comment above) */ }
function deskCellChange_(cv){
  var td = cv.closest('td.cell'), tr = cv.closest('tr[data-eid]'); if(!td || !tr) return;
  var key = tr.getAttribute('data-eid')+'|'+td.getAttribute('data-date');
  var cur = ES.queue[key] || {eid:tr.getAttribute('data-eid'),kind:tr.getAttribute('data-kind'),date:td.getAttribute('data-date'),fields:{}};
  cur.fields[cv.getAttribute('data-f')] = cv.getAttribute('data-val') || '';
  ES.queue[key] = cur;
  td.classList.remove('saved'); td.classList.add('dirty'); setSaveState('dirty');
  clearTimeout(ES.saveTimer);
  ES.saveTimer = setTimeout(flushSave, 900);
}
// Inline editor for support (free-text) slots — only one input exists at a time.
var DESK_SUP = null;
function openSupEditor(cv){
  if(DESK_SUP) commitSupEditor();
  if(!cv) return;
  var orig = cv.getAttribute('data-val') || '';   // raw stored text (not the display)
  var inp = document.createElement('input');
  inp.setAttribute('list','supDefs');
  inp.className = 'cval-edit';
  inp.value = orig;
  cv.style.display = 'none';
  cv.parentNode.insertBefore(inp, cv.nextSibling);
  DESK_SUP = { cv:cv, inp:inp, orig:orig };
  inp.focus(); inp.select();
  inp.addEventListener('blur', commitSupEditor);
  inp.addEventListener('keydown', function(e){
    if(e.key==='Enter'){ e.preventDefault(); inp.blur(); }
    else if(e.key==='Escape'){ e.preventDefault(); cancelSupEditor(); }
  });
}
function commitSupEditor(){
  if(!DESK_SUP) return;
  var s = DESK_SUP; DESK_SUP = null;
  var val = s.inp.value;
  s.inp.remove(); s.cv.style.display = '';
  if(val !== s.orig) setDeskCell_(s.cv, val);
}
function cancelSupEditor(){
  if(!DESK_SUP) return;
  var s = DESK_SUP; DESK_SUP = null;
  s.inp.remove(); s.cv.style.display = '';
}
function flushSave(){
  var keys=Object.keys(ES.queue);
  if(!keys.length){ setSaveState('idle'); return; }
  // Take the queued items OUT of the queue NOW. Any cell edited while this save
  // is in flight goes into a fresh queue and is flushed by its own timer — so a
  // returning save can never wipe an edit the user just made (the old code blew
  // away the WHOLE queue on success, dropping in-flight edits).
  var sending={}; var items=keys.map(function(k){ sending[k]=ES.queue[k]; delete ES.queue[k]; return sending[k]; });
  setSaveState('saving');
  Array.prototype.forEach.call($('eGrid').querySelectorAll('td.cell.dirty'),function(td){ td.classList.remove('dirty'); td.classList.add('saving'); });
  call('api_saveCells',[ES.site,items],function(r){
    Array.prototype.forEach.call($('eGrid').querySelectorAll('td.cell.saving'),function(td){
      td.classList.remove('saving'); td.classList.add('saved');
      setTimeout(function(){ td.classList.remove('saved'); },1500);
    });
    if(r&&r.ok){
      setSaveState(Object.keys(ES.queue).length ? 'dirty' : 'saved');
      setTimeout(function(){ if(ES.saveState==='saved') setSaveState('idle'); }, 1800);
    } else {
      // restore the failed items (without clobbering newer edits) and retry
      keys.forEach(function(k){ if(!ES.queue[k]) ES.queue[k]=sending[k]; });
      clearTimeout(ES.saveTimer); ES.saveTimer=setTimeout(flushSave,1500);
      setSaveState('error','บันทึกไม่สำเร็จ: '+((r&&r.error)||'?'));
    }
  });
}
function openAddEmp(){
  var html=
    '<div id="addOverlay" class="overlay">'
    +'<div class="overlay-card" style="max-width:460px">'
      +'<h2>เพิ่มพนักงานในหน่วยงาน</h2>'
      +'<label>ชื่อ-สกุล</label><input id="aeName" placeholder="นาย/นาง/นางสาว…">'
      +'<label>รหัสพนักงาน (ถ้ามี)</label><input id="aeEmpId">'
      +'<label>ตำแหน่ง</label><input id="aePos">'
      +'<div class="statrow">'
        +'<div class="fld"><label>ประเภท</label><div class="seg" id="aeKindSeg">'
          +'<button data-k="operation" class="on">ปฏิบัติการ</button>'
          +'<button data-k="support">สนับสนุน</button>'
        +'</div></div>'
        +'<div class="fld"><label>แผนก/หน่วยย่อย</label><input id="aeDept" placeholder="เช่น สำนักงาน / Operation"></div>'
      +'</div>'
      +'<div style="display:flex;gap:.6rem;margin-top:.8rem;justify-content:flex-end">'
        +'<button class="btn sec" id="aeCancel">ยกเลิก</button>'
        +'<button class="btn" id="aeOk">เพิ่ม</button>'
      +'</div>'
    +'</div></div>';
  var div=document.createElement('div'); div.innerHTML=html; document.body.appendChild(div.firstChild);
  var kind='operation';
  Array.prototype.forEach.call(document.querySelectorAll('#aeKindSeg button'),function(b){
    b.onclick=function(){ kind=b.getAttribute('data-k');
      Array.prototype.forEach.call(document.querySelectorAll('#aeKindSeg button'),function(x){x.classList.toggle('on',x===b);});
      $('aeDept').value = kind==='operation' ? 'Operation' : 'สำนักงาน';
    };
  });
  $('aeDept').value='Operation';
  $('aeCancel').onclick=function(){ document.getElementById('addOverlay').remove(); };
  $('aeOk').onclick=function(){
    var name=$('aeName').value.trim(); if(!name){ flash('กรอกชื่อ-สกุล','error'); return; }
    var data={ site_key:ES.site, name:name, emp_id:$('aeEmpId').value.trim(),
               position:$('aePos').value.trim(), department:$('aeDept').value.trim(), kind:kind };
    withBtnLoading($('aeOk'), 'กำลังเพิ่ม…', function(done){
      call('api_addEmployee',[data],function(r){
        done();
        if(r&&r.ok){ document.getElementById('addOverlay').remove(); flash('เพิ่มพนักงานแล้ว','ok'); loadGrid(); }
        else flash('เพิ่มไม่สำเร็จ','error');
      });
    });
  };
}
function migErrMsg_(code){
  return ({ SAME_SITE:'เป็นหน่วยงานเดิมอยู่แล้ว', DATE_TOO_EARLY:'วันที่ต้องไม่ก่อนการย้ายครั้งก่อน',
    NO_SITE:'ไม่พบหน่วยงานปลายทาง', NO_EMP:'ไม่พบพนักงาน', FORBIDDEN:'ไม่มีสิทธิ์', MISSING:'ข้อมูลไม่ครบ' }[code]) || code || '';
}
function openMigrateEmp(eid, name, curSite){
  var curName=((BOOT.sites||[]).filter(function(s){return s.key===curSite;})[0]||{}).name||curSite;
  var opts=(BOOT.sites||[]).filter(function(s){return s.key!==curSite;})
    .map(function(s){return '<option value="'+esc(s.key)+'">'+esc(s.name)+'</option>';}).join('');
  if(!opts){ flash(t('ไม่มีหน่วยงานปลายทาง'),'error'); return; }
  var html='<div id="migOverlay" class="overlay"><div class="overlay-card" style="max-width:440px">'
    +'<h2>'+t('ย้ายหน่วยงาน')+'</h2>'
    +'<p class="desc" style="font-weight:700;color:var(--ink)">'+esc(name)+'</p>'
    +'<p class="hint" style="margin:0 0 .5rem">'+t('ปัจจุบัน')+': '+esc(curName)+'</p>'
    +'<label>'+t('ย้ายไปหน่วยงาน')+'</label><select id="migSite">'+opts+'</select>'
    +'<label>'+t('มีผลตั้งแต่วันที่')+'</label><input id="migDate" type="date" value="'+isoToday()+'">'
    +'<p class="hint" style="margin:.55rem 0 0;line-height:1.45">'+t('พนักงานจะอยู่หน่วยงานเดิมก่อนวันที่นี้ และอยู่หน่วยงานใหม่ตั้งแต่วันนี้เป็นต้นไป — อยู่ได้ทีละหน่วยงานต่อวันเท่านั้น')+'</p>'
    +'<p class="hint" style="margin:.35rem 0 0;line-height:1.45">'+t('ย้ายผิด? เลือกหน่วยงานเดิมแล้วใช้วันที่เดียวกัน เพื่อย้ายกลับ/ยกเลิกการย้าย')+'</p>'
    +'<div style="display:flex;gap:.6rem;margin-top:.9rem;justify-content:flex-end">'
      +'<button class="btn sec" id="migCancel">'+t('ยกเลิก')+'</button>'
      +'<button class="btn" id="migOk">'+t('ย้าย')+'</button>'
    +'</div></div></div>';
  var div=document.createElement('div'); div.innerHTML=html; document.body.appendChild(div.firstChild);
  $('migCancel').onclick=function(){ document.getElementById('migOverlay').remove(); };
  $('migOk').onclick=function(){
    var toSite=$('migSite').value, date=$('migDate').value;
    if(!toSite||!date){ flash(t('กรอกข้อมูลให้ครบ'),'error'); return; }
    withBtnLoading($('migOk'), t('กำลังย้าย…'), function(done){
      call('api_migrateEmployee',[eid,toSite,date],function(r){
        done();
        if(r&&r.ok){ document.getElementById('migOverlay').remove(); flash(t('ย้ายหน่วยงานแล้ว'),'ok'); loadGrid(); }
        else flash(t('ย้ายไม่สำเร็จ')+(r&&r.error?(' · '+t(migErrMsg_(r.error))):''),'error');
      });
    });
  };
}
function isoToday(){
  var d=new Date(); return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
}

/* ============================ DASHBOARD ============================ */
function statCard(label,value,sub){
  return '<div class="stat"><span class="stat-l">'+esc(label)+'</span><b>'+esc(value)+'</b>'+(sub?'<span class="hint">'+esc(sub)+'</span>':'')+'</div>';
}
function renderDashboard(){
  var v=$('view');
  v.innerHTML=
    '<div class="card" style="padding:.85rem 1.1rem">'
      +'<div class="statrow" style="align-items:end;gap:.9rem;margin-bottom:0">'
        +'<div><h1 style="margin:0">'+t('แดชบอร์ด')+'</h1>'
          +'<div class="sub" style="margin:0">'+t('ภาพรวมการบันทึกการทำงานรายหน่วยงาน')+' · '+MNAME(CUR.m)+' '+be(CUR.y)+'</div></div>'
        +'<div class="dash-mrow" style="margin-left:auto">'
          +'<div class="fld"><label>'+t('มุมมอง')+'</label>'
            +'<div class="viewseg" id="dView">'
              +'<button data-v="progress" class="'+(DASH.view==='progress'?'on':'')+'">'+t('ความคืบหน้า')+'</button>'
              +'<button data-v="topact"   class="'+(DASH.view==='topact'?'on':'')+'">'+t('กิจกรรมหลัก')+'</button>'
              +'<button data-v="topcost"  class="'+(DASH.view==='topcost'?'on':'')+'">'+t('หมวดงานหลัก')+'</button>'
            +'</div>'
          +'</div>'
          +'<div class="fld"><label>'+t('เดือน')+'</label><div id="dMonth">'+monthNav()+'</div></div>'
          +'<div class="fld"><label>&nbsp;</label><button class="btn xls-btn" id="dExport" title="'+esc(t('ส่งออกสรุปวันทำงานรายหมวดงาน/กิจกรรม สำหรับเดือนนี้ (Excel)'))+'">⬇ '+(isMobile()?t('รายงาน'):t('รายงานวันทำงาน'))+'</button></div>'
        +'</div>'
      +'</div>'
    +'</div>'
    +'<div id="histSlot"></div>'
    +'<div id="dBody"><div class="spinner"></div></div>';
  wireMonthNav(function(){ $('dMonth').innerHTML=monthNav(); wireMonthNav(arguments.callee); loadDash(); });
  Array.prototype.forEach.call($('dView').querySelectorAll('button'), function(b){
    b.onclick = function(){
      DASH.view = b.getAttribute('data-v');
      Array.prototype.forEach.call($('dView').querySelectorAll('button'), function(x){
        x.classList.toggle('on', x.getAttribute('data-v') === DASH.view);
      });
      loadDash();   // data already returned both views' info; just re-render
    };
  });
  var dExp=$('dExport'); if(dExp) dExp.onclick=function(){ downloadXlsx('api_exportMandayReport', [CUR.y, CUR.m], this); };
  loadDash();
  if(BOOT.isAdmin) maybeHistoryImporter();
}
function loadDash(){
  $('dBody').innerHTML='<div class="spinner"></div>';
  call('api_adminSummary',[CUR.y,CUR.m],function(d){
    var rows = (d.rows||[]).filter(function(r){ return !isSiteHidden(r.site_key); });
    if(!rows.length){
      var allHidden = (d.rows && d.rows.length);   // sites exist but all toggled off
      $('dBody').innerHTML =
        '<div class="card empty-hero" style="text-align:center;padding:3rem 1.2rem">'
        +'<div style="font-size:2.4rem;line-height:1;margin-bottom:.6rem">🗓️</div>'
        +'<h2 style="margin:0">'+(allHidden ? t('หน่วยงานทั้งหมดถูกซ่อนอยู่') : t('ยังไม่มีหน่วยงานในสิทธิ์ของคุณ'))+'</h2>'
        +'<p class="muted" style="margin:.5rem auto 0;max-width:520px">'
        +(allHidden ? t('เปิดหน่วยงานที่ต้องการได้ที่ ⚙ ตั้งค่า › หน่วยงานที่แสดง') : t('ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์ดูหน่วยงาน'))+'</p>'
        +'</div>';
      return;
    }
    $('dBody').innerHTML = '<div class="site-grid">' + rows.map(function(r){return siteCard(r,d.today,d.lockDays);}).join('') + '</div>';
    Array.prototype.forEach.call($('dBody').querySelectorAll('.s-go'),function(b){
      b.onclick=function(){
        ES.site = b.getAttribute('data-site');
        // Land on the OVERVIEW first — it gives the clearest picture of what's
        // filled / missing for the month; the user then drills into the weekly
        // view to actually enter data.
        ES.viewMode = 'coverage';
        ES.jumpToToday = true;   // keeps the right month/week if they switch to weekly
        go('entry');
      };
    });
    Array.prototype.forEach.call($('dBody').querySelectorAll('.ta-expand'),function(btn){
      btn.onclick=function(){
        var list=btn.previousElementSibling; if(!list) return;
        var exp=list.classList.toggle('expanded');
        btn.innerHTML = exp ? (t('ย่อ')+' ▴')
          : (t('ดูทั้งหมด')+' ('+list.querySelectorAll('.ta-row').length+') ▾');
      };
    });
    Array.prototype.forEach.call($('dBody').querySelectorAll('.s-cov'),function(b){
      b.onclick=function(){ ES.site=b.getAttribute('data-site'); ES.viewMode='coverage'; go('entry'); };
    });
  });
}
// Company names are stored inconsistently in the DB (some Thai, some English),
// which made cards flip language. Normalize any known variant to ONE canonical
// pair and render the form matching the current UI language.
function companyDisp(raw){
  var s=String(raw||'').trim(); if(!s) return '';
  var low=s.toLowerCase();
  var V={th:'บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด', en:'Vichitbhan Construction Co., Ltd.'};
  var C={th:'บริษัท ชนา เอ็นจิเนียริ่ง จำกัด',   en:'Chana Engineering Co., Ltd.'};
  var rec = (s.indexOf('วิจิตรภัณฑ์')>=0 || low.indexOf('vichitbhan')>=0) ? V
          : (s.indexOf('ชนา')>=0       || low.indexOf('chana')>=0)      ? C : null;
  if(rec) return (LANG==='en') ? rec.en : rec.th;
  return s;   // unknown company → show exactly as stored
}
function siteCard(r, today, lockDays){
  var tot=r.n_emp, started=r.support_started+r.operation_started;
  var pct=(r.fillRate==null?0:r.fillRate);   // ring now = fill completeness (workdays)
  var monthLbl = MNAME(CUR.m)+' '+be(CUR.y);
  var acc = siteAccent(r.site_key);
  // mini calendar strip — SAME 3-colour rule as the Overview: green = everyone
  // logged (100%) on a locked day · red = a passed day that isn't 100% · yellow =
  // still within the editable window · grey = future · weekend = rest day.
  var lkD = Number(lockDays||3);
  var lockCutoff = isoMinusDays(today, lkD), lockAhead = isoPlusDays(today, 1);
  var strip = '<div class="mini-cal">'
    + r.daysFilled.map(function(day){
        var full = (day.total>0 && day.filled>=day.total);
        var bg, fg='#fff';
        if(day.date===today){ bg=acc.c; }
        else if(day.weekend){ bg='#fdf6ec'; fg='#b9a47e'; }            // rest day (Sunday)
        else if(day.date>lockAhead){ bg='#eef2f8'; fg='#6b7785'; }     // future
        else if(day.date>=lockCutoff){ bg='#e8b500'; }                 // still editable
        else { bg = full ? '#1f9d55' : '#e0533a'; }                    // locked: 100% green else red
        var dd=Number(day.date.slice(8,10));
        return '<div class="mc" title="'+day.date+' · '+day.filled+'/'+day.total+'" style="background:'+bg+';color:'+fg+'">'
          +'<div class="mcd">'+dd+'</div></div>';
      }).join('')
    +'</div>';
  // Top block — two dimensions: 'topact' = กิจกรรม (Activities), 'topcost' = หมวดงาน (Work Categories)
  var isTop = (DASH.view === 'topact' || DASH.view === 'topcost');
  var topArr = (DASH.view === 'topcost') ? (r.topCostCodes||[]) : (r.topActivities||[]);
  var hasTop = topArr.length;
  var emptyMsg;
  if(r.entries > 0 && !hasTop){
    emptyMsg = 'บันทึก ' + r.entries + ' รายการ แต่ไม่ตรงกับดัชนี<br>'
             + '<span style="font-size:.72rem">(เป็นวันหยุด/ลา หรือยังไม่ได้เพิ่มเข้าดัชนีงาน)</span>';
  } else {
    emptyMsg = 'ยังไม่มีบันทึกในเดือนนี้';
  }
  // Show the top 5 by default; rows past that are hidden until the expand button
  // reveals them. Each row shows the manday count (วันทำงาน) + its share %.
  var TA_LIMIT = 5;
  var topList = hasTop
    ? '<div class="top-acts">'
      + topArr.map(function(a, i){
          var pctBar = Math.max(2, Math.min(100, a.pct||0));
          var rowCls = 'ta-row' + (i >= TA_LIMIT ? ' ta-extra' : '');
          return '<div class="'+rowCls+'" title="'+esc(a.name)+' — '+a.count+' วันทำงาน ('+a.pct+'%)">'
            +'<div class="ta-name">'+esc(a.name)+'</div>'
            +'<div class="ta-num"><b>'+a.count+'</b> '+t('วันทำงาน')+' <span class="ta-pct">'+a.pct+'%</span></div>'
            +'<div class="ta-bar"><i style="--w:'+pctBar+'%;background:var(--site)"></i></div>'
            +'</div>';
        }).join('')
      + '</div>'
      + (topArr.length > TA_LIMIT
          ? '<button class="ta-expand" type="button">'+t('ดูทั้งหมด')+' ('+topArr.length+') ▾</button>'
          : '')
    : '<div class="hint" style="text-align:center;padding:1.2rem .5rem;line-height:1.45">'+emptyMsg+'</div>';
  // Heading block (shared)
  // Company name is a free-text DB field; route through t() so the two known
  // VCB companies render in English when the user has switched languages.
  // Unknown companies pass through untouched.
  var headInner = '<div><h2 style="margin:0;color:var(--site)">'+esc(r.site_name)+'</h2><div class="hint">'+esc(companyDisp(r.company))+'</div></div>';
  // Right side of header changes per view
  var headRight = isTop
    ? '<div class="s-stats-mini" title="'+esc(t('พนักงานทั้งหมดในหน่วยงาน'))+'">'
      +   '<b style="color:var(--site)">'+r.entries+'</b><span> '+t('รายการ')+'</span>'
      + '</div>'
    : '<div class="s-ringwrap" title="'+esc(t('ความสมบูรณ์ของการบันทึก (เฉพาะวันทำงานที่ผ่านมา) ใน')+monthLbl)+'">'
      +'<div class="s-ring">'
        +'<svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" fill="none" stroke="#e6ecf3" stroke-width="7"/>'
        +'<circle class="ring-fill" cx="32" cy="32" r="27" fill="none" stroke="var(--site)" stroke-width="7" stroke-dasharray="169.65" stroke-dashoffset="169.65" style="--ring-end:'+(169.65 - pct*1.6965).toFixed(2)+'" transform="rotate(-90 32 32)" stroke-linecap="round"/></svg>'
        +'<span class="s-ring-pct" style="color:var(--site)">'+pct+'%</span>'
      +'</div>'
      +'<div class="s-ring-lbl">'+t('บันทึกครบ')+'<br><b>'+r.entries+' / '+(r.fillRateDenom||0)+'</b> '+t('ช่อง')+'</div>'
      +'</div>';
  return '<div class="card s-card" style="--site:'+acc.c+';--site-tint:'+acc.tint+'">'
    +'<div class="s-bar"></div>'
    +'<div class="s-body">'
      +'<div class="s-head">'+headInner+headRight+'</div>'
      + (isTop
          ? topList
          : '<div class="s-stats">'
            +'<div><b>'+r.n_emp+'</b><span>'+t('พนักงาน')+'</span><div class="hint">'+r.n_support+' '+t('สนับสนุน')+' · '+r.n_operation+' '+t('ปฏิบัติการ')+'</div></div>'
            +'<div><b>'+r.entries+'</b><span>'+t('รายการใน')+' '+esc(MNAME(CUR.m))+'</span></div>'
            +'<div><b>'+started+' / '+tot+'</b><span>'+t('เริ่มบันทึกแล้ว')+'</span><div class="hint">'+t('พนักงานที่ลงอย่างน้อย 1 วัน')+'</div></div>'
            +'</div>'
            + strip)
      +'<div class="s-cta">'
        +(BOOT.canEntry
          ? '<button class="btn s-go" data-site="'+esc(r.site_key)+'" style="width:100%;background:var(--site)">'+t('เปิดบันทึก →')+'</button>'
          : '<div class="hint viewonly-note" style="text-align:center;padding:.45rem">'+t('มุมมองอย่างเดียว — ติดต่อแอดมินเพื่อขอสิทธิ์บันทึก')+'</div>')
      +'</div>'
    +'</div>'
  +'</div>';
}
function maybeHistoryImporter(){
  // Use google.script.run directly (not the call() wrapper) so a slow / queued
  // response doesn't fatal the entire page. History import is a non-critical
  // background check — silent failure is fine.
  google.script.run
    .withSuccessHandler(function(r){ _handleHistoryStatus(r); })
    .withFailureHandler(function(e){ console.warn('api_historyStatus failed:', e && e.message); })
    .api_historyStatus();
}
function _handleHistoryStatus(r){
    if(!r||!r.ok||r.done||!r.sites||!r.sites.length) return;
    var sites=r.sites;
    $('histSlot').innerHTML=
      '<div class="card" id="histBanner">'
        +'<div style="display:flex;justify-content:space-between;gap:1rem;align-items:start;flex-wrap:wrap">'
          +'<div><h2 style="margin:.1rem 0">นำเข้าข้อมูลย้อนหลัง · ครั้งแรกเท่านั้น</h2>'
            +'<div class="sub" style="margin:0">พบไฟล์ Excel ต้นฉบับ '+sites.reduce(function(s,x){return s+x.total;},0)+' รายการ จาก '+sites.length+' หน่วยงาน — กำลังนำเข้าเข้าฐานข้อมูล…</div></div>'
        +'</div>'
        +'<div class="bar" style="height:12px;margin-top:.7rem"><i id="histBar" style="width:0%"></i></div>'
        +'<p id="histStatus" class="hint" style="margin-top:.5rem">เริ่ม…</p>'
      +'</div>';
    var idx=0;
    function next(){
      if(idx>=sites.length){
        call('api_finalizeHistory',[],function(){
          $('histStatus').textContent='เสร็จสมบูรณ์ — กำลังรีเฟรช';
          setTimeout(function(){ var b=$('histBanner'); if(b) b.remove(); loadDash(); },1200);
        });
        return;
      }
      var s=sites[idx];
      $('histStatus').textContent='กำลังนำเข้า '+(s.name||s.key)+' ('+(idx+1)+'/'+sites.length+') · '+s.total+' รายการ';
      call('api_importHistorySite',[s.key],function(rr){
        idx++;
        var pct=Math.round(idx/sites.length*100);
        $('histBar').style.width=pct+'%';
        next();
      });
    }
    next();
}

/* ============================ USERS (admin) ============================ */
/* ============================ MASTER WORK INDEX (admin) ============================ */
function renderMasterIndex(){
  if(MI.tab!=='cost') MI.tab='work';
  var v=$('view');
  v.innerHTML=
    '<div class="card" style="padding:.85rem 1.1rem .2rem">'
      +'<h1 style="margin:0">'+t('ดัชนีงาน')+'</h1>'
      +'<div class="sub" style="margin:.1rem 0 .55rem">'+t('รายการมาตรฐานที่ใช้บันทึกงาน — แต่ละเซลล์เลือก 2 ชั้น: กิจกรรม แล้วตามด้วย หมวดงาน')+'</div>'
      +'<div class="idx-tabs">'
        +'<button class="idx-tab'+(MI.tab==='work'?' on':'')+'" data-tab="work">'+t('กิจกรรม (Activity)')+'</button>'
        +'<button class="idx-tab'+(MI.tab==='cost'?' on':'')+'" data-tab="cost">'+t('หมวดงาน (Work Category)')+'</button>'
      +'</div>'
    +'</div>'
    +'<div class="card" id="miBody"><div class="spinner"></div></div>';
  Array.prototype.forEach.call(v.querySelectorAll('.idx-tab'),function(b){
    b.onclick=function(){ MI.tab=b.getAttribute('data-tab'); renderMasterIndex(); };
  });
  if(MI.tab==='cost') loadCost(); else loadMaster();
}
/* Bulk-import modal: paste rows copied from Excel (name, desc, category, code).
   On success the picker reflects the new items because the MasterIndex IS the
   picker's source — we also drop ES.data so the entry grid refetches the vocab. */
// Shared bulk-import modal. opts: {api, title, sub, placeholder, onDone}. Defaults
// to the Activity (MasterIndex) import; the Work Category tab passes cost options.
function miImportOpen(opts){
  if($('miImpOverlay')) return;
  opts = opts || {};
  var title = opts.title || t('นำเข้ารายการดัชนีงาน');
  var onDone = opts.onDone || loadMaster;
  var tmplKind = opts.templateKind || 'activity';
  // exact column order shown as a numbered guide so users can't guess wrong
  var cols = (tmplKind==='cost')
    ? ['รหัส (Code)', 'ชื่อ-ไทย (Name)', 'ชื่อ-อังกฤษ (English)']
    : ['ชื่อ (Name)', 'คำอธิบาย (Description)', 'หมวดหมู่ (Category)', 'รหัส (Code)'];
  var colGuide = cols.map(function(c,i){ return '<span class="imp-col"><b>'+(i+1)+'</b> '+esc(c)+'</span>'; }).join('');
  var html =
    '<div id="miImpOverlay" class="overlay">'
    +'<div class="overlay-card" style="max-width:560px">'
      +'<h2 style="margin:.1rem 0 .4rem">'+title+'</h2>'
      +'<div class="imp-steps">'
        +'<b>'+t('วิธีนำเข้า')+'</b>'
        +'<div>1. '+t('ดาวน์โหลดเทมเพลตเปล่าด้านล่าง')+'</div>'
        +'<div>2. '+t('กรอกข้อมูลลงในไฟล์ Excel ตามคอลัมน์ที่กำหนด (เขียนทับแถวตัวอย่างได้)')+'</div>'
        +'<div>3. '+t('กด “เลือกไฟล์ที่กรอกแล้ว” แล้วเลือกไฟล์ที่บันทึกไว้ — ระบบจะนำเข้าให้ทันที')+'</div>'
        +'<div class="imp-cols">'+t('ลำดับคอลัมน์:')+' '+colGuide+'</div>'
      +'</div>'
      +'<div class="imp-btnrow">'
        +'<button class="btn sec" id="miImpTmpl">⬇ '+t('ดาวน์โหลดเทมเพลตเปล่า')+'</button>'
        +'<button class="btn" id="miImpChoose">⬆ '+t('เลือกไฟล์ที่กรอกแล้ว')+'</button>'
      +'</div>'
      +'<input type="file" id="miImpFile" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" style="display:none">'
      +'<div id="miImpMsg" class="hint" style="margin-top:.6rem"></div>'
      +'<div style="display:flex;gap:.6rem;margin-top:.7rem;justify-content:flex-end">'
        +'<button class="btn sec" id="miImpCancel">'+t('ปิด')+'</button>'
      +'</div>'
    +'</div></div>';
  var div=document.createElement('div'); div.innerHTML=html; document.body.appendChild(div.firstChild);
  var close=function(){ var o=$('miImpOverlay'); if(o) o.remove(); };
  $('miImpCancel').onclick=close;
  $('miImpOverlay').addEventListener('mousedown',function(e){ if(e.target===this) close(); });
  $('miImpTmpl').onclick=function(){ downloadXlsx('api_importTemplateXlsx', [tmplKind], this); };
  $('miImpChoose').onclick=function(){ var fi=$('miImpFile'); if(fi) fi.click(); };
  $('miImpFile').onchange=function(){
    var file = this.files && this.files[0];
    this.value='';                       // allow re-picking the same filename later
    if(!file) return;
    var msg=$('miImpMsg'); if(msg){ msg.style.color=''; msg.textContent=t('กำลังนำเข้า…')+' '+file.name; }
    var choose=$('miImpChoose'); var orig=choose.innerHTML; choose.disabled=true; choose.innerHTML='⏳ '+t('กำลังนำเข้า…');
    var reset=function(){ var c=$('miImpChoose'); if(c){ c.disabled=false; c.innerHTML=orig; } };
    var fail=function(m){ reset(); var x=$('miImpMsg'); if(x){ x.style.color='#b3261e'; x.textContent=m; } };
    var fr=new FileReader();
    fr.onerror=function(){ fail(t('อ่านไฟล์ไม่สำเร็จ')); };
    fr.onload=function(){
      var s=String(fr.result||''); var i=s.indexOf(','); var b64 = i>=0 ? s.slice(i+1) : s;
      call('api_importIndexFile',[tmplKind, b64, file.type||''],function(r){
        if(r&&r.ok){
          ES.data=null;   // force the entry grid to refetch the (now larger) vocab
          close();
          flash(t('นำเข้าแล้ว')+': +'+r.added+' / '+t('อัปเดต')+' '+r.updated+(r.skipped?(' / '+t('ข้าม')+' '+r.skipped):''),'ok');
          onDone();
        } else {
          fail(t('นำเข้าไม่สำเร็จ')+': '+((r&&r.error)||'?'));
        }
      });
    };
    fr.readAsDataURL(file);
  };
}
/* MasterIndex admin: one flat sortable table.
   Sort cycle per column: 1st click = descending, 2nd = ascending, 3rd = original
   (server-side category→name order). Click another column header to restart. */
var MI = { list:[], original:[], sortCol:null, sortDir:0, tab:'work', costs:[] };
/* ---- Cost Type tab (the 2nd layer) ---- */
function loadCost(){
  $('miBody').innerHTML='<div class="spinner"></div>';
  call('api_costAdminList',[],function(list){ MI.costs=list||[]; renderCost(); });
}
function renderCost(){
  var toolbar='<div class="idx-toolbar"><span class="hint">'+esc(t('หมวดงาน (ชั้นที่ 2)'))+' · '+MI.costs.length+' '+t('รายการ')+'</span>'
    +'<div class="idx-actions">'
      +'<button class="btn xls-btn" id="ciExport">⬇ Excel</button>'
      +'<button class="btn sec idx-import" id="ciImport">⬆ '+t('นำเข้า')+'</button>'
      +'<button class="btn" id="ciAdd">'+t('+ เพิ่มหมวดงาน')+'</button>'
    +'</div></div>';
  var rows=MI.costs.map(function(r){
    return '<tr data-id="'+esc(r.id)+'">'
      +'<td><code style="font-weight:700;color:var(--blue)">'+esc(r.code||'')+'</code></td>'
      +'<td><b>'+esc(r.name||'')+'</b></td>'
      +'<td class="hint" style="font-size:.85rem">'+esc(r.name_en||'')+'</td>'
      +'<td class="right" style="white-space:nowrap"><button class="btn sec ciE">'+t('แก้ไข')+'</button> <button class="btn sec ciD" style="color:#b3261e">'+t('ลบ')+'</button></td></tr>';
  }).join('');
  $('miBody').innerHTML=toolbar+'<table><thead><tr><th style="width:80px">'+t('รหัส')+'</th><th style="width:320px">'+t('หมวดงาน (ไทย)')+'</th><th>Work Category (English)</th><th style="width:170px"></th></tr></thead><tbody>'+(rows||'<tr><td colspan="4" class="muted">'+t('ยังไม่มีรายการ')+'</td></tr>')+'</tbody></table>';
  $('ciAdd').onclick=function(){ costEdit(null); };
  $('ciExport').onclick=function(){ exportCostIndexXlsx(this); };
  $('ciImport').onclick=function(){ miImportOpen({
    api:'api_costImport', onDone:loadCost, templateKind:'cost',
    title:t('นำเข้าหมวดงาน'),
    placeholder:t('รหัส\tชื่อ (ไทย)\tชื่อ (อังกฤษ)')
  }); };
  Array.prototype.forEach.call($('miBody').querySelectorAll('.ciE'),function(b){ b.onclick=function(){ var id=b.closest('tr').getAttribute('data-id'); costEdit(MI.costs.find(function(x){return String(x.id)===String(id);})); }; });
  Array.prototype.forEach.call($('miBody').querySelectorAll('.ciD'),function(b){ b.onclick=function(){ var id=b.closest('tr').getAttribute('data-id'); var row=MI.costs.find(function(x){return String(x.id)===String(id);}); uiConfirm({title:t('ลบรายการ'), message:t('ลบ')+' "'+(row&&row.name||'?')+'" ?', okText:t('ลบ'), danger:true}, function(){ withBtnLoading(b,t('กำลังลบ…'),function(done){ call('api_costDelete',[id],function(r){ done(); if(r&&r.ok){ ES.data=null; flash(t('ลบแล้ว'),'ok'); loadCost(); } else flash(t('ลบไม่สำเร็จ'),'error'); }); }); }); }; });
}
function costEdit(row){
  if($('ciOverlay'))return; var isNew=!row;
  var html='<div id="ciOverlay" class="overlay"><div class="overlay-card" style="max-width:520px">'
    +'<h2 style="margin:.1rem 0 .6rem">'+(isNew?t('เพิ่มหมวดงาน'):t('แก้ไขหมวดงาน'))+'</h2>'
    +'<label>'+t('รหัส')+' <span class="hint">— '+t('เว้นว่างเพื่อสร้างเลขถัดไปอัตโนมัติ')+'</span></label><input id="ciCode" value="'+esc(row&&row.code||'')+'" placeholder="21">'
    +'<label>'+t('หมวดงาน (ไทย)')+' <span style="color:#b3261e">*</span></label><input id="ciName" value="'+esc(row&&row.name||'')+'">'
    +'<label>Work Category (English)</label><input id="ciEn" value="'+esc(row&&row.name_en||'')+'">'
    +'<div style="display:flex;gap:.6rem;margin-top:.8rem;justify-content:flex-end"><button class="btn sec" id="ciCancel">'+t('ยกเลิก')+'</button><button class="btn" id="ciOk">'+(isNew?t('เพิ่ม'):t('บันทึก'))+'</button></div></div></div>';
  var div=document.createElement('div'); div.innerHTML=html; document.body.appendChild(div.firstChild);
  $('ciCancel').onclick=function(){ var o=$('ciOverlay'); if(o) o.remove(); };
  $('ciOk').onclick=function(){ var name=$('ciName').value.trim(); if(!name){ flash(t('กรอกชื่อ'),'error'); return; }
    var data={ id:row&&row.id, code:$('ciCode').value.trim(), name:name, name_en:$('ciEn').value.trim() };
    withBtnLoading($('ciOk'),t('กำลังบันทึก…'),function(done){ call('api_costUpsert',[data],function(r){ done(); if(r&&r.ok){ ES.data=null; var o=$('ciOverlay'); if(o) o.remove(); flash(t('บันทึกแล้ว'),'ok'); loadCost(); } else flash(t('บันทึกไม่สำเร็จ'),'error'); }); });
  };
  setTimeout(function(){ var el=$('ciName'); if(el) el.focus(); },0);
}
function loadMaster(){
  $('miBody').innerHTML='<div class="spinner"></div>';
  call('api_masterList',[],function(list){
    if(!list||!list.length){ $('miBody').innerHTML='<p class="muted">ยังไม่มีรายการ</p>'; return; }
    MI.original = list.slice();
    MI.list = list.slice();
    MI.sortCol = null;
    MI.sortDir = 0;
    renderMaster();
  });
}
// Unique, sorted list of categories already in the index — powers the category
// dropdown so admins reuse existing categories instead of typing variants.
function miCategories_(){
  var seen={}, out=[];
  (MI.list||[]).forEach(function(r){
    var c=String(r.category||'').trim();
    if(c && !seen[c.toLowerCase()]){ seen[c.toLowerCase()]=1; out.push(c); }
  });
  return out.sort(function(a,b){ return a.localeCompare(b,'th'); });
}
function miSortableTh(col, label, width){
  var arrow = '';
  if(MI.sortCol === col){
    arrow = MI.sortDir === 1 ? ' ▼' : MI.sortDir === 2 ? ' ▲' : '';
  }
  var style = width ? ' style="width:'+width+'"' : '';
  return '<th class="mi-sortable" data-col="'+col+'"'+style+'>'+esc(label)
    + '<span class="mi-sort-ind">'+arrow+'</span></th>';
}
function renderMaster(){
  var toolbar = '<div class="idx-toolbar">'
    +'<span class="hint">'+esc(t('คลิกหัวคอลัมน์เพื่อจัดเรียง'))+' · '+MI.list.length+' '+t('รายการ')+'</span>'
    +'<div class="idx-actions">'
      +'<button class="btn xls-btn" id="miExport">⬇ Excel</button>'
      +'<button class="btn sec idx-import" id="miImport">⬆ '+t('นำเข้า')+'</button>'
      +'<button class="btn" id="miAdd">'+t('+ เพิ่มกิจกรรม')+'</button>'
    +'</div></div>';
  var html = toolbar
    + '<table id="miTable"><thead><tr>'
    + miSortableTh('code',     'รหัสงาน',         '90px')
    + miSortableTh('name',     'ชื่อ',            '260px')
    + miSortableTh('desc',     'คำอธิบาย',        '')
    + miSortableTh('category', 'หมวดหมู่',        '210px')
    + '<th style="width:180px;text-align:right;white-space:nowrap"></th>'
    + '</tr></thead><tbody>'
    + MI.list.map(function(r){
        return '<tr data-id="'+esc(r.id)+'">'
          + '<td><code style="font-weight:700;color:var(--blue)">'+esc(r.code||'')+'</code></td>'
          + '<td><b>'+esc(r.name||'')+'</b></td>'
          + '<td class="hint" style="font-size:.85rem">'+esc(r.desc||'')+'</td>'
          + '<td class="hint" style="font-size:.82rem;white-space:nowrap">'+esc(r.category||'')+'</td>'
          + '<td class="right" style="white-space:nowrap"><button class="btn sec miE">แก้ไข</button> <button class="btn sec miD" style="color:#b3261e">ลบ</button></td>'
          + '</tr>';
      }).join('')
    + '</tbody></table>';
  $('miBody').innerHTML = html;
  $('miAdd').onclick=function(){ miEdit(null); };
  $('miImport').onclick=function(){ miImportOpen({ templateKind:'activity' }); };
  $('miExport').onclick=function(){ exportMasterIndexXlsx(this); };
  Array.prototype.forEach.call($('miBody').querySelectorAll('th.mi-sortable'), function(th){
    th.onclick = function(){ miCycleSort(th.getAttribute('data-col')); };
  });
  Array.prototype.forEach.call($('miBody').querySelectorAll('.miE'),function(b){
    b.onclick=function(){
      var id=b.closest('tr').getAttribute('data-id');
      var row=MI.list.find(function(x){return String(x.id)===String(id);});
      miEdit(row);
    };
  });
  Array.prototype.forEach.call($('miBody').querySelectorAll('.miD'),function(b){
    b.onclick=function(){
      var id=b.closest('tr').getAttribute('data-id');
      var row=MI.list.find(function(x){return String(x.id)===String(id);});
      uiConfirm({title:t('ลบรายการ'), message:t('ลบ')+' "'+(row&&row.name||'?')+'" '+t('ออกจากดัชนี?'), okText:t('ลบ'), danger:true}, function(){
        withBtnLoading(b, t('กำลังลบ…'), function(done){
          call('api_masterDelete',[id],function(r){
            done();
            if(r&&r.ok){ ES.data=null; flash(t('ลบแล้ว'),'ok'); loadMaster(); } else flash(t('ลบไม่สำเร็จ'),'error');
          });
        });
      });
    };
  });
}
function miCycleSort(col){
  if(MI.sortCol === col){
    MI.sortDir = (MI.sortDir + 1) % 3;   // 0 → 1 (desc) → 2 (asc) → 0
    if(MI.sortDir === 0) MI.sortCol = null;
  } else {
    MI.sortCol = col;
    MI.sortDir = 1;                       // first click on a new col = desc
  }
  miApplySort();
  renderMaster();
}
function miApplySort(){
  if(MI.sortDir === 0 || !MI.sortCol){
    MI.list = MI.original.slice();
    return;
  }
  var col = MI.sortCol;
  var mul = MI.sortDir === 1 ? -1 : 1;   // desc = invert ascending compare
  MI.list = MI.original.slice().sort(function(a,b){
    var av = String(a[col]==null?'':a[col]).trim();
    var bv = String(b[col]==null?'':b[col]).trim();
    if(col === 'code'){
      var an = Number(av), bn = Number(bv);
      if(!isNaN(an) && !isNaN(bn) && av!=='' && bv!=='') return (an - bn) * mul;
    }
    if(av === '' && bv !== '') return 1;   // empty values always at the end
    if(bv === '' && av !== '') return -1;
    return av.localeCompare(bv, 'th') * mul;
  });
}
function miEdit(row){
  var isNew = !row;
  var html=
    '<div id="miOverlay" class="overlay">'
    +'<div class="overlay-card">'
      +'<h2 style="margin:.1rem 0 .6rem">'+(isNew?'เพิ่มรายการใหม่':'แก้ไขรายการ')+'</h2>'
      +'<label>รหัสงาน (Job Code) <span class="hint">— เว้นว่างเพื่อสร้างเลขลำดับอัตโนมัติ</span></label><input id="miCode" value="'+esc(row&&row.code||'')+'" placeholder="001">'
      +'<label>ชื่อ <span style="color:#b3261e">*</span></label><input id="miName" value="'+esc(row&&row.name||'')+'" placeholder="เช่น Survey 1 กลางวัน">'
      +'<label>คำอธิบาย</label><textarea id="miDesc" rows="3">'+esc(row&&row.desc||'')+'</textarea>'
      +'<label>หมวดหมู่ (เช่น Survey, Safety, ขนส่ง, ช่าง)</label>'
      +'<input id="miCat" list="miCatList" value="'+esc(row&&row.category||'')+'" autocomplete="off" placeholder="'+esc(t('เลือกหรือพิมพ์หมวดหมู่ใหม่'))+'">'
      +'<datalist id="miCatList">'+miCategories_().map(function(c){return '<option value="'+esc(c)+'"></option>';}).join('')+'</datalist>'
      +'<div style="display:flex;gap:.6rem;margin-top:.8rem;justify-content:flex-end">'
        +'<button class="btn sec" id="miCancel">ยกเลิก</button>'
        +'<button class="btn" id="miOk">'+(isNew?'เพิ่ม':'บันทึก')+'</button>'
      +'</div>'
    +'</div></div>';
  var div=document.createElement('div'); div.innerHTML=html; document.body.appendChild(div.firstChild);
  $('miCancel').onclick=function(){ document.getElementById('miOverlay').remove(); };
  $('miOk').onclick=function(){
    var name=$('miName').value.trim();
    if(!name){ flash('กรอกชื่อ','error'); return; }
    var data={ id: row&&row.id, code:$('miCode').value.trim(), name:name, desc:$('miDesc').value.trim(), category:$('miCat').value.trim() };
    withBtnLoading($('miOk'), 'กำลังบันทึก…', function(done){
      call('api_masterUpsert',[data],function(r){
        done();
        if(r&&r.ok){ ES.data=null; document.getElementById('miOverlay').remove(); flash('บันทึกแล้ว','ok'); loadMaster(); }
        else flash('บันทึกไม่สำเร็จ','error');
      });
    });
  };
}

/* Settings page — one screen consolidating UI preferences (theme, language,
   year format, default dashboard view), site-wide config (lock window), the
   full users/permissions admin table, and an about panel. Admin-only. */
/* Open Settings as a popup overlay instead of navigating to a new page.
   The overlay re-uses .overlay + .overlay-card (which already become a
   bottom-sheet on mobile via the html.is-mobile CSS layer). Underlying view
   (dashboard / entry / index) stays mounted behind the sheet, so closing
   the popup just dismisses the overlay — no re-render of the page beneath. */
function openSettings(){
  if($('settingsOverlay')) return;   // guard against double-tap
  var div = document.createElement('div');
  div.id = 'settingsOverlay';
  div.className = 'overlay';
  // Direct child IS the render target — no extra wrapper, so the .settings-card
  // CSS selectors land on the .settings root that renderSettings emits.
  div.innerHTML = '<div id="settingsBody" class="overlay-card settings-card"></div>';
  document.body.appendChild(div);
  renderSettings($('settingsBody'), { asModal:true });
  // Click-outside to dismiss (but not when clicking the card itself)
  div.addEventListener('mousedown', function(e){
    if(e.target === div) closeSettings();
  });
  // ESC to dismiss
  document.addEventListener('keydown', _settingsEsc);
}
function closeSettings(){
  var el = $('settingsOverlay'); if(el) el.remove();
  document.removeEventListener('keydown', _settingsEsc);
  // If site visibility changed, re-render the underlying view so the entry site
  // dropdown / dashboard reflect it (dashboard already updated live).
  if(_sitesVisChanged){
    _sitesVisChanged = false;
    if(window._curView && window._curView !== 'dashboard') go(window._curView);
  }
}
function _settingsEsc(e){ if(e.key === 'Escape' && !$('auditOverlay') && !$('howtoOverlay')) closeSettings(); }

/* Brief, straight-to-the-point how-to for the whole entry page. */
function openHowTo(){
  if($('howtoOverlay')) return;
  var steps=[
    [t('เลือกหน่วยงานและสัปดาห์'), t('แถบด้านบน: เลือกหน่วยงาน เดือน และสัปดาห์ที่ต้องการบันทึก')],
    [t('คลิกช่องว่างของพนักงาน'), t('คลิกช่องที่ขึ้น “+ เลือกงาน” แล้วเลือกกิจกรรม — ถ้าระบบถามหมวดงาน ให้เลือกต่ออีกหนึ่งครั้ง')],
    [t('ไม่ต้องกดบันทึก'), t('ระบบบันทึกให้อัตโนมัติ — ช่องจะแสดงรหัสงานเมื่อบันทึกเสร็จ')],
    [t('ทำ 2 งานในวันเดียว'), t('หลังกรอกงานแรกแล้ว ปุ่ม “+ งานที่ 2” จะปรากฏใต้ช่อง · ระบบถ่วงน้ำหนักให้อัตโนมัติงานละ 50% (0.5 วันทำงาน) รวมเป็น 1 วันทำงานต่อคนต่อวันเสมอ — บนแดชบอร์ดจึงแบ่งครึ่ง-ครึ่ง ไม่ใช่ 1 วันทำงานต่องาน เพื่อไม่ให้วันทำงานรวมเกินจำนวนพนักงาน')],
    [t('แก้ไข & ดูภาพรวม'), t('แก้ย้อนหลังได้ตามกำหนด และกรอกล่วงหน้าได้ถึงพรุ่งนี้ · แท็บ “ภาพรวม” = แผนที่สี: เขียว = ครบ, เหลือง = ยังแก้ได้, แดง = ขาด')]
  ];
  var div=document.createElement('div');
  div.id='howtoOverlay'; div.className='overlay';
  div.innerHTML='<div class="overlay-card howto-card">'
    +'<div class="settings-head"><h1 style="margin:0">📖 '+t('วิธีใช้งานหน้าบันทึกงาน')+'</h1>'
    +'<button class="settings-close" id="howtoClose" aria-label="ปิด" title="ปิด">×</button></div>'
    +'<ol class="howto-steps">'
    + steps.map(function(s){ return '<li><b>'+esc(s[0])+'</b><span>'+esc(s[1])+'</span></li>'; }).join('')
    +'</ol>'
    +'</div>';
  document.body.appendChild(div);
  $('howtoClose').onclick=closeHowTo;
  div.addEventListener('mousedown',function(e){ if(e.target===div) closeHowTo(); });
  document.addEventListener('keydown', _howtoEsc);
}
function closeHowTo(){ var el=$('howtoOverlay'); if(el) el.remove(); document.removeEventListener('keydown', _howtoEsc); }
function _howtoEsc(e){ if(e.key==='Escape') closeHowTo(); }

/* Render the Settings UI into a given container. Defaults to #view when no
   arg is supplied (legacy "go('settings')" / "go('users')" routes still
   work) — but the gear button now calls openSettings() which renders into
   a modal body instead. */
function renderSettings(target, opts){
  var v = target || $('view');
  var isModal = !!(opts && opts.asModal);
  var pill = function(group, value, label, active){
    return '<button type="button" class="opt-pill'+(active?' on':'')+'" data-grp="'+group+'" data-v="'+esc(value)+'">'+esc(label)+'</button>';
  };
  // In modal mode the structure is:
  //   <div class="settings">
  //     <div class="settings-head">…sticky header…</div>
  //     <p class="sub">…</p>
  //     <div class="settings-body">…scrollable section list…</div>
  //   </div>
  // The header stays fixed at the top while the user scrolls the body, which
  // keeps the × close button always reachable.
  var openTag  = isModal ? '<div class="settings">' : '<div class="card settings">';
  var closeTag = '</div>';
  var headerHtml, bodyOpen, bodyClose;
  if(isModal){
    // Bilingual title in the popup header so the page reads cleanly in either
    // language and matches the rest of VCB's sibling apps' header convention.
    headerHtml = '<div class="settings-head">'
      +   '<h1 style="margin:0">⚙ การตั้งค่า · Settings</h1>'
      +   '<button class="settings-close" id="settingsClose" aria-label="ปิด" title="ปิด">×</button>'
      + '</div>'
      + '<p class="sub">'+esc(t('การตั้งค่าจะถูกเก็บไว้ในเครื่อง (แต่ละเครื่องอาจไม่เหมือนกัน)'))+'</p>';
    bodyOpen  = '<div class="settings-body">';
    bodyClose = '</div>';
  } else {
    headerHtml = '<h1 style="margin:0 0 .15rem">⚙ '+t('ตั้งค่า')+'</h1>'
      +'<p class="sub" style="margin:0 0 1rem">'+esc(t('การตั้งค่าจะถูกเก็บไว้ในเครื่อง (แต่ละเครื่องอาจไม่เหมือนกัน)'))+'</p>';
    bodyOpen = bodyClose = '';
  }
  var themeSect =
      '<div class="sect">'
        +'<h2>'+t('ธีม')+'</h2>'
        +'<p class="desc">'+esc(t('โหมดสว่าง โหมดมืด หรือทำตามระบบของเครื่อง'))+'</p>'
        +'<div class="opts" id="optTheme">'
          + pill('theme','light',t('สว่าง'),  THEME==='light')
          + pill('theme','dark', t('มืด'),    THEME==='dark')
          + pill('theme','auto', t('อัตโนมัติ (ตามระบบ)'), THEME==='auto')
        +'</div>'
      +'</div>';
  var langSect =
      '<div class="sect">'
        +'<h2>'+t('ภาษา')+'</h2>'
        +'<p class="desc">'+esc(t('สลับภาษาที่แสดงในเมนูและฉลาก (ข้อมูลจริงคงเดิม)'))+'</p>'
        +'<div class="opts" id="optLang">'
          + pill('lang','th',t('ไทย'),     LANG==='th')
          + pill('lang','en',t('อังกฤษ'), LANG==='en')
        +'</div>'
      +'</div>';
  var yearSect =
      '<div class="sect">'
        +'<h2>'+t('รูปแบบปี')+'</h2>'
        +'<p class="desc">'+esc(t('แสดงปีในเครื่องมือเลือกเดือนเป็น พ.ศ. หรือ ค.ศ.'))+'</p>'
        +'<div class="opts" id="optYear">'
          + pill('year','be',t('พุทธศักราช (2569)'), YEAR_FMT==='be')
          + pill('year','g', t('คริสต์ศักราช (2026)'), YEAR_FMT==='g')
        +'</div>'
      +'</div>';
  var dashSect =
      '<div class="sect">'
        +'<h2>'+t('มุมมองเริ่มต้นของแดชบอร์ด')+'</h2>'
        +'<p class="desc">'+esc(t('เลือกว่าจะเปิดแดชบอร์ดด้วยมุมมองไหนเป็นค่าเริ่มต้น'))+'</p>'
        +'<div class="opts" id="optDash">'
          + pill('dash','progress',t('ความคืบหน้า'), DASH_DEFAULT==='progress')
          + pill('dash','topact',  t('กิจกรรมหลัก'), DASH_DEFAULT==='topact')
          + pill('dash','topcost', t('หมวดงานหลัก'), DASH_DEFAULT==='topcost')
        +'</div>'
      +'</div>';
  var weeklySect =
      '<div class="sect">'
        +'<h2>'+t('การแสดงในตารางสัปดาห์')+'</h2>'
        +'<p class="desc">'+esc(t('แสดงกิจกรรมเป็นรหัส (A-1) หรือชื่อเต็ม — หมวดงานยังคงเป็นตัวเลขเสมอ'))+'</p>'
        +'<div class="opts" id="optCellNames">'
          + pill('cellnames','code', t('รหัส (A-1 / 5)'),       CELL_NAMES!=='name')
          + pill('cellnames','name', t('ชื่อกิจกรรม (เต็ม) / 5'), CELL_NAMES==='name')
        +'</div>'
      +'</div>';
  var lockSect =
      '<div class="sect">'
        +'<h2>'+t('ระยะเวลาแก้ย้อนหลัง')+'</h2>'
        +'<p class="desc">'+esc(t('Manager แก้ไขเซลล์ย้อนหลังได้กี่วัน · admin แก้ได้ตลอด · บังคับใช้ทั้งระบบ'))+'</p>'
        +'<div class="lockrow">'
          +'<input id="lockDaysInput" type="number" min="0" max="30" step="1" value="">'
          +'<span class="muted">'+t('วัน')+'</span>'
          +'<button class="btn sec" id="lockDaysSave">'+t('บันทึก')+'</button>'
        +'</div>'
      +'</div>';
  var auditSect =
      '<div class="sect">'
        +'<h2>'+t('ประวัติการแก้ไข')+'</h2>'
        +'<p class="desc">'+esc(t('ดูบันทึกว่าใครแก้ไขอะไร เมื่อไร พร้อมค้นหาและกรอง'))+'</p>'
        +'<button class="btn sec" id="auditOpen">'+t('เปิดประวัติการแก้ไข')+' →</button>'
      +'</div>';
  var sitesSect =
      '<div class="sect">'
        +'<h2>'+t('หน่วยงานที่แสดง')+'</h2>'
        +'<p class="desc">'+esc(t('ปิดหน่วยงานที่จบแล้วเพื่อซ่อนจากแดชบอร์ดและรายการเลือก (เฉพาะเครื่องนี้)'))+'</p>'
        +'<div class="site-vis" id="siteVis">'
          +((BOOT.sites||[]).length
            ? (BOOT.sites||[]).map(function(s){
                return '<label class="vis-row"><span class="vis-name">'+esc(s.name)+'</span>'
                  +'<input type="checkbox" class="vis-tog" data-key="'+esc(s.key)+'"'+(isSiteHidden(s.key)?'':' checked')+'></label>';
              }).join('')
            : '<p class="muted" style="margin:0">'+t('ไม่มีหน่วยงาน')+'</p>')
        +'</div>'
      +'</div>';
  // Users & Permissions — heaviest section; collapsed by default in the modal.
  var usersSect = isModal
        ? '<div class="sect users-sect" id="usersSect">'
          + '<button type="button" class="users-toggle" id="usersToggle">'
          +   '<h2 style="margin:0">'+t('ผู้ใช้และสิทธิ์')+'</h2>'
          +   '<span class="chev">›</span>'
          + '</button>'
          + '<div id="uBody"><div class="spinner"></div></div>'
          +'</div>'
        : '<div class="sect">'
          +'<h2>'+t('ผู้ใช้และสิทธิ์')+'</h2>'
          +'<p class="desc">'+esc(t('เพิ่มอีเมลเจ้าหน้าที่ที่จะบันทึกข้อมูล แล้วกำหนดบทบาท/หน่วยงาน'))+'</p>'
          +'<div id="uBody"><div class="spinner"></div></div>'
          +'</div>';
  var aboutSect =
      '<div class="sect">'
        +'<h2>'+t('เกี่ยวกับระบบ')+'</h2>'
        +'<dl class="about-grid">'
          +'<dt>'+t('เวอร์ชัน')+'</dt><dd>v17+ (settings UI)</dd>'
          +'<dt>'+t('อีเมล')+'</dt><dd>'+esc(BOOT.email||'')+'</dd>'
          +'<dt>'+t('บทบาท')+'</dt><dd>'+esc(BOOT.role||'')+'</dd>'
          +'<dt>'+t('หน่วยงานที่ดูแล')+'</dt><dd>'+(BOOT.role==='admin' ? t('(ทุกหน่วยงาน — admin)') : ((BOOT.sites||[]).map(function(s){return s.name;}).join(', ') || '—'))+'</dd>'
        +'</dl>'
      +'</div>';
  v.innerHTML = ''
    + openTag
      + headerHtml
      + bodyOpen
      +'<div class="sect howto-sect">'
        +'<button class="btn how-btn" id="howtoOpen">📖 '+t('วิธีใช้งานหน้านี้ (อ่านก่อนเริ่ม)')+'</button>'
      +'</div>'
      +'<div class="settings-cols">'
        +'<div class="settings-col">'+ themeSect + langSect + yearSect + dashSect + weeklySect + lockSect +'</div>'
        +'<div class="settings-col">'+ sitesSect + usersSect + auditSect + aboutSect +'</div>'
      +'</div>'
    + bodyClose
    + closeTag;

  // ----- close button (modal mode) -----
  if(isModal){
    var x = $('settingsClose'); if(x) x.onclick = closeSettings;
  }

  // ----- pill wiring -----
  function wirePills(scopeId, onChange){
    var scope = $(scopeId); if(!scope) return;
    Array.prototype.forEach.call(scope.querySelectorAll('.opt-pill'), function(p){
      p.onclick = function(){
        Array.prototype.forEach.call(scope.querySelectorAll('.opt-pill'), function(x){ x.classList.remove('on'); });
        p.classList.add('on');
        onChange(p.getAttribute('data-v'));
      };
    });
  }
  wirePills('optTheme', function(v){ setTheme(v); });
  wirePills('optLang',  function(v){ setLang(v); });   // will re-render whole page via go()
  wirePills('optYear',  function(v){ setYearFmt(v); });
  wirePills('optDash',  function(v){ setDashDefault(v); flash(t('บันทึกแล้ว'),'ok'); });
  wirePills('optCellNames', function(v){ setCellNames(v); flash(t('บันทึกแล้ว'),'ok'); });

  // ----- how-to manual -----
  var howBtn = $('howtoOpen'); if(howBtn) howBtn.onclick = openHowTo;

  // ----- visible-sites toggles -----
  var siteVis = $('siteVis');
  if(siteVis){
    Array.prototype.forEach.call(siteVis.querySelectorAll('.vis-tog'), function(tg){
      tg.onchange = function(){
        setSiteHidden(tg.getAttribute('data-key'), !tg.checked);
        _sitesVisChanged = true;
        // live-update the dashboard behind the modal; other views refresh on close
        if(window._curView === 'dashboard' && typeof loadDash === 'function') loadDash();
      };
    });
  }

  // ----- lock-days editor -----
  var lockInput = $('lockDaysInput'), lockBtn = $('lockDaysSave');
  lockInput.disabled = true; lockBtn.disabled = true;
  call('api_adminGetLockDays', [], function(r){
    if(r && r.ok){ lockInput.value = r.lockDays; lockInput.disabled = false; lockBtn.disabled = false; }
  });
  lockBtn.onclick = function(){
    var n = Math.max(0, Math.min(30, parseInt(lockInput.value, 10) || 0));
    withBtnLoading(lockBtn, t('กำลังบันทึก…'), function(done){
      call('api_adminSetLockDays', [n], function(r){
        done();
        if(r && r.ok){ lockInput.value = r.lockDays; flash(t('บันทึกแล้ว'), 'ok'); }
        else flash(t('บันทึกไม่สำเร็จ'), 'error');
      });
    });
  };

  // ----- users table -----
  // In modal mode the section is collapsed by default and the table is only
  // fetched the FIRST time the user expands it (saves an api_adminListUsers
  // round-trip every time the gear opens).
  if(isModal){
    var sect = $('usersSect'), tog = $('usersToggle');
    if(tog) tog.onclick = function(){
      var willOpen = !sect.classList.contains('open');
      sect.classList.toggle('open', willOpen);
      if(willOpen && !sect.dataset.loaded){
        sect.dataset.loaded = '1';
        loadUsers();
      }
    };
  } else {
    loadUsers();
  }

  // ----- audit log launcher (opens its own wide overlay) -----
  var auditBtn = $('auditOpen');
  if(auditBtn) auditBtn.onclick = openAuditLog;
}
/* Full-width audit-log overlay. The Settings popup is far too narrow for the
   volume (~200 edits/day), so the log opens in its own large card with a
   search box + site/field filters (all client-side over the fetched rows). */
function openAuditLog(){
  if($('auditOverlay')) return;            // guard against double-open
  var siteName = {};
  (BOOT.sites||[]).forEach(function(s){ siteName[s.key] = s.name; });
  var pad2 = function(x){ return ('0'+(Number(x)||0)).slice(-2); };
  var fieldLabel = function(f){
    if(f==='note') return t('หมายเหตุ');
    if(f==='AM') return t('งานที่ 1');
    if(f==='PM') return t('งานที่ 2');
    return t('งาน');   // legacy 'work' rows
  };

  var div = document.createElement('div');
  div.id = 'auditOverlay'; div.className = 'overlay';
  var siteOpts = '<option value="">'+t('ทุกหน่วยงาน')+'</option>'
    + (BOOT.sites||[]).map(function(s){ return '<option value="'+esc(s.key)+'">'+esc(s.name)+'</option>'; }).join('');
  div.innerHTML =
    '<div class="overlay-card audit-card">'
    + '<div class="audit-head">'
    +   '<h1 style="margin:0">'+t('ประวัติการแก้ไข')+'</h1>'
    +   '<button class="settings-close" id="auditClose" aria-label="ปิด" title="ปิด">×</button>'
    + '</div>'
    + '<div class="audit-filters">'
    +   '<input id="auditSearch" type="text" autocomplete="off" placeholder="'+esc(t('ค้นหา อีเมล / ชื่อ / ค่า'))+'">'
    +   '<select id="auditSite">'+siteOpts+'</select>'
    +   '<select id="auditField">'
    +     '<option value="">'+t('ทุกช่อง')+'</option>'
    +     '<option value="work">'+t('งาน')+'</option>'
    +     '<option value="note">'+t('หมายเหตุ')+'</option>'
    +   '</select>'
    +   '<span id="auditCount" class="muted"></span>'
    + '</div>'
    + '<div class="audit-wrap"><div class="spinner"></div></div>'
    + '</div>';
  document.body.appendChild(div);

  var close = function(){ document.removeEventListener('keydown', onEsc); var o=$('auditOverlay'); if(o) o.remove(); };
  var onEsc = function(e){ if(e.key === 'Escape') close(); };
  $('auditClose').onclick = close;
  div.addEventListener('mousedown', function(e){ if(e.target === div) close(); });
  document.addEventListener('keydown', onEsc);

  var ALL = [];
  var render = function(){
    var wrap = div.querySelector('.audit-wrap'); if(!wrap) return;
    var q  = ($('auditSearch').value || '').trim().toLowerCase();
    var fs = $('auditSite').value, ff = $('auditField').value;
    var rows = ALL.filter(function(r){
      if(fs && r.site !== fs) return false;
      if(ff && r.field !== ff) return false;
      if(q){
        var hay = (r.email+' '+r.emp_name+' '+r.old_val+' '+r.new_val+' '+(siteName[r.site]||r.site)).toLowerCase();
        if(hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    $('auditCount').textContent = rows.length + ' / ' + ALL.length;
    if(!rows.length){ wrap.innerHTML = '<p class="desc" style="padding:1.2rem">'+esc(t('ไม่พบรายการ'))+'</p>'; return; }
    var dash = function(x){ return String(x)===''? '<span class="muted">—</span>' : esc(x); };
    var body = rows.map(function(r){
      return '<tr>'
        + '<td style="white-space:nowrap">'+esc(r.ts)+'</td>'
        + '<td>'+esc(r.email)+'</td>'
        + '<td>'+esc(siteName[r.site]||r.site)+'</td>'
        + '<td>'+esc(r.emp_name)+'</td>'
        + '<td style="white-space:nowrap">'+esc(r.year+'-'+pad2(r.month)+'-'+pad2(r.day))+'</td>'
        + '<td>'+esc(fieldLabel(r.field))+'</td>'
        + '<td>'+dash(r.old_val)+'</td>'
        + '<td>'+dash(r.new_val)+'</td>'
        + '</tr>';
    }).join('');
    wrap.innerHTML = '<table class="audit-tbl"><thead><tr>'
      + '<th>'+t('เวลา')+'</th><th>'+t('ผู้แก้ไข')+'</th><th>'+t('หน่วยงาน')+'</th>'
      + '<th>'+t('พนักงาน')+'</th><th>'+t('วันที่')+'</th><th>'+t('ช่อง')+'</th>'
      + '<th>'+t('เดิม')+'</th><th>'+t('ใหม่')+'</th>'
      + '</tr></thead><tbody>'+body+'</tbody></table>';
  };

  call('api_auditLog', [1000], function(d){
    var wrap = div.querySelector('.audit-wrap'); if(!wrap) return;
    if(!d || !d.ok){ wrap.innerHTML = '<p class="desc" style="padding:1.2rem">'+esc(t('โหลดไม่สำเร็จ'))+'</p>'; return; }
    ALL = d.rows || [];
    if(!ALL.length){ wrap.innerHTML = '<p class="desc" style="padding:1.2rem">'+esc(t('ยังไม่มีประวัติการแก้ไข'))+'</p>'; return; }
    $('auditSearch').oninput = render;
    $('auditSite').onchange  = render;
    $('auditField').onchange = render;
    render();
  });
}
function loadUsers(){
  call('api_adminListUsers',[],function(d){
    var roleOpts=function(sel){ return ['admin','manager'].map(function(r){return '<option value="'+r+'"'+(r===sel?' selected':'')+'>'+r+'</option>';}).join(''); };
    // Sites column: multi-select dropdown (a trigger button that opens a
    // checkbox list). Admins skip the dropdown — they always have all sites
    // via resolveUser_(). Stored as comma-separated keys in Users.site_key.
    var mselField=function(currentSel, currentRole){
      if(currentRole==='admin'){
        return '<span class="msel-readonly">'+t('(ทุกหน่วยงาน — admin)')+'</span>';
      }
      var selected = String(currentSel||'').split(',').map(function(s){return s.trim();}).filter(String);
      var selNames = d.sites.filter(function(s){return selected.indexOf(s.key)>=0;}).map(function(s){return s.name;});
      var label = selNames.length===0 ? t('เลือกหน่วยงาน...')
                : selNames.length<=2  ? selNames.join(', ')
                                      : selNames.length+' '+t('หน่วยงาน');
      var cls = selNames.length===0 ? 'msel-label placeholder' : 'msel-label';
      return '<div class="msel">'
        + '<button type="button" class="msel-trigger">'
        +   '<span class="'+cls+'">'+esc(label)+'</span><span class="msel-caret">▼</span>'
        + '</button>'
        + '<div class="msel-pop">'
        +   d.sites.map(function(s){
              var on = selected.indexOf(s.key) >= 0;
              return '<label class="msel-opt"><input type="checkbox" value="'+esc(s.key)+'"'+(on?' checked':'')+'><span>'+esc(s.name)+'</span></label>';
            }).join('')
        + '</div>'
        + '</div>';
    };
    var html='<p class="hint" style="margin:.2rem 0 .6rem">'+t('admin เข้าถึงทุกหน่วยงานโดยอัตโนมัติ · manager คลิกดรอปดาวน์เพื่อเลือกหลายหน่วยงาน')+'</p>'
      +'<table class="usersTable"><thead><tr><th style="width:240px">'+t('อีเมล')+'</th><th style="width:120px">'+t('บทบาท')+'</th><th>'+t('หน่วยงาน')+'</th><th style="width:200px;white-space:nowrap"></th></tr></thead><tbody>'
      +d.users.map(function(u){
        return '<tr data-email="'+esc(u.email)+'"><td>'+esc(u.email)+'</td>'
          +'<td><select data-f="role" class="uRole">'+roleOpts(u.role)+'</select></td>'
          +'<td class="uSites">'+mselField(u.site_key, u.role)+'</td>'
          +'<td style="white-space:nowrap"><button class="btn sec uSave">'+t('บันทึก')+'</button> <button class="btn sec uDel" style="color:#b3261e">'+t('ลบ')+'</button></td></tr>';
      }).join('')
      +'<tr class="row-newuser"><td><input id="nuEmail" placeholder="email@vcb-con.com" autocomplete="off"></td>'
        +'<td><select id="nuRole" class="uRole">'+roleOpts('manager')+'</select></td>'
        +'<td class="uSites" id="nuSitesCell">'+mselField('', 'manager')+'</td>'
        +'<td style="white-space:nowrap"><button class="btn" id="nuAdd">'+t('เพิ่ม')+'</button></td></tr>'
      +'</tbody></table>';
    $('uBody').innerHTML=html;
    function wireMsel(scope){
      Array.prototype.forEach.call(scope.querySelectorAll('.msel .msel-trigger'), function(trig){
        trig.onclick = function(e){
          e.stopPropagation();
          var msel = trig.closest('.msel');
          var willOpen = !msel.classList.contains('open');
          Array.prototype.forEach.call(document.querySelectorAll('.msel.open'), function(other){
            other.classList.remove('open');
          });
          if(willOpen){
            msel.classList.add('open');
            positionMselPop(msel);
          }
        };
      });
      Array.prototype.forEach.call(scope.querySelectorAll('.msel .msel-opt input'), function(cb){
        cb.onchange = function(){ updateMselLabel(cb.closest('.msel')); };
      });
    }
    function positionMselPop(msel){
      var trig = msel.querySelector('.msel-trigger');
      var pop  = msel.querySelector('.msel-pop');
      if(!trig || !pop) return;
      var r = trig.getBoundingClientRect();
      // match trigger width, but keep a sane minimum
      pop.style.width = Math.max(240, r.width) + 'px';
      pop.style.left  = r.left + 'px';
      // place below by default; if not enough room, flip above
      var spaceBelow = window.innerHeight - r.bottom;
      var popH = Math.min(window.innerHeight*0.6, pop.scrollHeight + 8);
      if(spaceBelow >= popH + 8 || r.top < popH + 8){
        pop.style.top = (r.bottom + 4) + 'px';
      } else {
        pop.style.top = (r.top - popH - 4) + 'px';
      }
    }
    function updateMselLabel(msel){
      var names = Array.prototype.map.call(msel.querySelectorAll('.msel-opt input:checked'),
        function(cb){ return cb.parentNode.querySelector('span').textContent; });
      var lbl = msel.querySelector('.msel-label');
      if(names.length===0){
        lbl.textContent=t('เลือกหน่วยงาน...'); lbl.classList.add('placeholder');
      } else {
        lbl.textContent = names.length<=2 ? names.join(', ') : names.length+' '+t('หน่วยงาน');
        lbl.classList.remove('placeholder');
      }
    }
    function collectMselSites(cell){
      var msel = cell.querySelector('.msel'); if(!msel) return '';
      return Array.prototype.map.call(msel.querySelectorAll('.msel-opt input:checked'),
        function(cb){ return cb.value; }).join(',');
    }
    wireMsel($('uBody'));
    // Re-render the sites cell when role changes (admin → readonly badge,
    // manager → multi-select dropdown). Preserve any selections.
    Array.prototype.forEach.call($('uBody').querySelectorAll('.uRole'), function(sel){
      sel.onchange=function(){
        var tr = sel.closest('tr');
        var cell = tr.querySelector('.uSites');
        var currentSel = collectMselSites(cell);
        cell.innerHTML = mselField(currentSel, sel.value);
        wireMsel(cell);
      };
    });
    Array.prototype.forEach.call($('uBody').querySelectorAll('.uSave'),function(b){
      b.onclick=function(){
        var tr=b.closest('tr');
        var role = tr.querySelector('[data-f="role"]').value;
        var sites = role==='admin' ? '' : collectMselSites(tr.querySelector('.uSites'));
        saveUser(tr.getAttribute('data-email'), role, sites, b);
      };
    });
    Array.prototype.forEach.call($('uBody').querySelectorAll('.uDel'),function(b){
      b.onclick=function(){
        var tr=b.closest('tr');
        var em=tr.getAttribute('data-email');
        uiConfirm({title:t('ลบสิทธิ์ผู้ใช้'), message:t('ลบสิทธิ์ของ')+' '+em+' ?', okText:t('ลบ'), danger:true}, function(){
        withBtnLoading(b, t('กำลังลบ…'), function(done){
          call('api_adminDeleteUser',[em],function(r){
            done();
            if(r&&r.ok){ flash(t('ลบแล้ว'),'ok'); loadUsers(); } else flash(t('ลบไม่สำเร็จ'),'error');
          });
        });
        });
      };
    });
    $('nuAdd').onclick=function(){
      var em=$('nuEmail').value.trim().toLowerCase();
      if(!em){ flash(t('กรอกอีเมล'),'error'); return; }
      var role=$('nuRole').value;
      var sites = role==='admin' ? '' : collectMselSites($('nuSitesCell'));
      saveUser(em,role,sites,$('nuAdd'));
    };
  });
}
// Global outside-click close for any open multi-select dropdowns. Because the
// popover is now position:fixed it lives outside the .msel container, so we
// also have to check whether the click is inside the floating .msel-pop.
document.addEventListener('mousedown', function(e){
  Array.prototype.forEach.call(document.querySelectorAll('.msel.open'), function(msel){
    if(msel.contains(e.target)) return;
    var pop = msel.querySelector('.msel-pop');
    if(pop && pop.contains(e.target)) return;
    msel.classList.remove('open');
  });
});
// Close any open multi-select on viewport changes (positions would drift otherwise).
window.addEventListener('resize', function(){
  Array.prototype.forEach.call(document.querySelectorAll('.msel.open'), function(m){ m.classList.remove('open'); });
});
window.addEventListener('scroll', function(){
  Array.prototype.forEach.call(document.querySelectorAll('.msel.open'), function(m){ m.classList.remove('open'); });
}, true);
function saveUser(email,role,site,btn){
  withBtnLoading(btn, t('กำลังบันทึก…'), function(done){
    call('api_adminSetUser',[email,role,site],function(r){
      done();
      if(r&&r.ok){ flash(t('บันทึกผู้ใช้แล้ว'),'ok'); loadUsers(); }
      else flash(t('ไม่สำเร็จ'),'error');
    });
  });
}

/* Reusable button-loading helper. Disables the button, swaps its label to a
   spinner+message, runs the work, and restores on completion. Pass the work
   as fn(done) and call done() when the API responds. */
function withBtnLoading(btn, loadingText, fn){
  if(!btn){ fn(function(){}); return; }
  var orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:.4rem"><span class="btn-spin"></span>'+esc(loadingText)+'</span>';
  fn(function(){
    btn.disabled = false;
    btn.innerHTML = orig;
  });
}

window.addEventListener('DOMContentLoaded',boot);
</script>
</body>
</html>
`;

/* ============================ CONFIG / SCHEMA ============================ */

var SHEETS = { CONFIG:'Config', SITES:'Sites', TEAMS:'Teams', EMP:'Employees', USERS:'Users', INDEX:'MasterIndex', AUDIT:'AuditLog', COST:'CostIndex', MIG:'Migrations' };
var LEGACY = { SUP:'SupportEntries', OP:'OperationEntries' };

var HEADERS = {
  Config:      ['key','value'],
  Sites:       ['key','name','company'],
  Teams:       ['site_key','name','desc'],
  Employees:   ['eid','site_key','emp_id','name','position','department','kind','division','email'],
  Users:       ['email','role','site_key','eid'],
  MasterIndex: ['id','code','name','desc','category','sites','mapping','fixed_cost','allowed_cost'],
  AuditLog:    ['ts','email','site','year','month','eid','emp_name','day','field','old_val','new_val'],
  CostIndex:   ['id','code','name','name_en'],
  Migrations:  ['eid','from_site','to_site','date','by','ts']
};
// every site gets its own daily-log sheet with this header
var LOG_HEADER = ['date','eid','emp_id','name','kind','work_detail','team','ot_hours','note','updated_by','updated_at'];

/* ===== VCB standard indexes (two-layer cell: Work Type + Location/Cost Type) =====
   Loaded into MasterIndex (work types) + CostIndex (cost types) by
   api_loadVcbIndexes(). A completed cell stores "<workCode> / <costCode>". */
var VCB_WORK_TYPES = [
  // [code, thaiName, englishName, group(category), detail, mapping, fixedCostCode, allowedCostCodes]
  //   allowedCostCodes = comma list of the Cost Types this work type may use (STEP 2
  //     is filtered to just these). It is the single source of truth for the picker:
  //       • 1 code   -> one-to-one, auto-assigned, STEP 2 skipped
  //       • 2+ codes -> one-to-many, STEP 2 shows only those codes
  //       • ''       -> falls back to the explicit mapping/fixedCostCode (Z has no cost)
  //   mapping/fixedCostCode are derived from allowedCostCodes by deriveWorkMapping_();
  //   the two legacy columns are kept only for the empty-list (Z/Standby) case.
  ['A-1','งานผูก-ตัด-ดัดเหล็ก','Rebar Works','A · งานก่อสร้างและติดตั้ง','ตัด ดัด ผูกเหล็กเส้นสำหรับงานโครงสร้างและงานหล่อ','one-to-many','','5,7,8,9,15,17,19'],
  ['A-2','งานเทคอนกรีต','Concrete Pouring','A · งานก่อสร้างและติดตั้ง','เทคอนกรีตทุกประเภทงาน','one-to-many','','5,7,8,9,15,17,19'],
  ['A-3','งานประกอบ / ถอดแบบหล่อ','Formwork Assembly & Stripping','A · งานก่อสร้างและติดตั้ง','ประกอบ รื้อ ถอดแบบหล่อคอนกรีตทุกประเภท','one-to-many','','5,7,8,9,15,17,19'],
  ['A-4','ปฏิบัติงานชุด Launching Gantry (LG)','Launching Gantry Crew Operation','A · งานก่อสร้างและติดตั้ง','ปฏิบัติงานประจำชุด LG ทุกขั้นตอน — HR ใช้รหัสนี้สำหรับทุกคนในทีม LG','one-to-many','','6'],
  ['A-5','งานรื้อถอน / ทุบทำลาย','Demolition Works','A · งานก่อสร้างและติดตั้ง','รื้อถอน ทุบทำลาย ตัดเหล็ก รื้อย้ายโครงสร้างเดิม','one-to-many','','1'],
  ['A-6','งานขุดดิน / ถมดิน','Excavation & Earthfill','A · งานก่อสร้างและติดตั้ง','ขุด ตัก ถมดิน สกัดหัวเสาเข็ม ปรับพื้นที่หน้างาน','one-to-many','','3'],
  ['A-7','งานบดอัด / ปูพื้นทาง','Compaction & Paving','A · งานก่อสร้างและติดตั้ง','บดอัดแน่น ปูรองพื้นทาง ลาดยาง เทคอนกรีตผิวจราจร','one-to-many','','4'],
  ['A-8','งานติดตั้งท่อ / ระบบระบายน้ำ','Pipe & Drainage System Installation','A · งานก่อสร้างและติดตั้ง','ติดตั้งท่อ บ่อพัก รางระบายน้ำ และระบบระบายน้ำ','one-to-many','','9'],
  ['A-9','งานติดตั้งป้าย / ตีเส้นจราจร','Traffic Sign & Road Marking Works','A · งานก่อสร้างและติดตั้ง','ติดตั้งป้ายจราจร ตีเส้น ทำเครื่องหมายบนผิวทาง','one-to-many','','11,12'],
  ['A-10','งานสำรวจ (กลางวัน)','Survey – Day Shift','A · งานก่อสร้างและติดตั้ง','วางแนว ให้ระดับ รัน GPS ตรวจสอบพิกัดหน้างาน กะกลางวัน','one-to-many','','1,2,3,4,5,6,7,8,9,10,11,12,15,16,17,19'],
  ['A-11','งานสำรวจ (กลางคืน)','Survey – Night Shift','A · งานก่อสร้างและติดตั้ง','วางแนว ให้ระดับ รัน GPS ตรวจสอบพิกัดหน้างาน กะกลางคืน','one-to-many','','1,2,3,4,5,6,7,8,9,10,11,12,15,16,17,19'],
  ['A-12','งานช่างเชื่อมหน้างาน (กลางวัน)','Site Welding – Day Shift','A · งานก่อสร้างและติดตั้ง','ตัด เจียร เชื่อมเหล็กหน้างาน ราง รางน้ำทิ้ง ซีลิโคน กะกลางวัน','one-to-many','','1,2,3,4,5,6,7,8,9,10,11,12,15,16,17,19'],
  ['A-13','งานช่างเชื่อมหน้างาน (กลางคืน)','Site Welding – Night Shift','A · งานก่อสร้างและติดตั้ง','ตัด เจียร เชื่อมเหล็กหน้างาน ราง รางน้ำทิ้ง ซีลิโคน กะกลางคืน','one-to-many','','1,2,3,4,5,6,7,8,9,10,11,12,15,16,17,19'],
  ['A-14','งานช่างไฟฟ้าหน้างาน','Site Electrical Works','A · งานก่อสร้างและติดตั้ง','ติดตั้งและดูแลระบบไฟฟ้า แสงสว่าง อุปกรณ์ไฟฟ้าในโครงการ','one-to-many','','1,2,3,4,5,6,7,8,9,10,11,12,15,16,17,19'],
  ['B-1','งานผลิต Segment (แท่นผลิต)','Segment Production – Casting Bed','B · งานหล่อและผลิต Segment','SC 1-5: เตรียมเหล็ก ตั้งแบบ Match-Cast Shear Keys เทคอนกรีต','one-to-one','7','7'],
  ['B-2','งานดึงลวดอัดแรง (Pre-Tensioning)','Pre-Tensioning – Strand Stressing','B · งานหล่อและผลิต Segment','SC 6: ดึงลวดอัดแรงเบื้องต้นหลังเทคอนกรีต ก่อนถอดแบบ','one-to-one','7','7'],
  ['B-3','งานถอดแบบ Segment','Segment Formwork Stripping','B · งานหล่อและผลิต Segment','SC 7: ถอดแบบหล่อ Segment หลังคอนกรีตแข็งตัวและดึงลวดเสร็จ','one-to-one','7','7'],
  ['B-4','งาน QC / LAB คอนกรีต','Concrete QC & Laboratory Testing','B · งานหล่อและผลิต Segment','SC 5: ตรวจสอบคุณภาพคอนกรีต ทดสอบตัวอย่างในห้องปฏิบัติการ','one-to-one','7','7'],
  ['B-5','งาน Gantry Crane (โรงงาน)','Gantry Crane – Factory','B · งานหล่อและผลิต Segment','SC 8-9: ยก จัดเก็บ และเคลื่อนย้าย Segment ภายในโรงงาน','one-to-one','7','7'],
  ['B-6','งาน Shuttle Lift (โรงงาน)','Shuttle Lift – Factory','B · งานหล่อและผลิต Segment','SC 8-9: ขับ Shuttle Lift 80/130 ตัน เคลื่อนย้าย Segment ในโรงงาน','one-to-one','7','7'],
  ['C-1','ขับรถขุด','Excavator Operation','C · งานเครื่องจักรและยานพาหนะ','ขับ-ควบคุมรถขุด','one-to-many','','18'],
  ['C-2','ขับรถตัก / แทร็คเตอร์','Wheel Loader / Tractor Operation','C · งานเครื่องจักรและยานพาหนะ','ขับรถตักหรือแทร็คเตอร์','one-to-many','','18'],
  ['C-3','ขับรถบดสั่นสะเทือน / เกรดเดอร์','Compactor / Grader Operation','C · งานเครื่องจักรและยานพาหนะ','ขับรถบดสั่นสะเทือนหรือเกรดเดอร์','one-to-many','','18'],
  ['C-4','ขับรถบรรทุก 10 ล้อ / Dump Truck','Dump Truck Operation','C · งานเครื่องจักรและยานพาหนะ','ขับรถบรรทุก 10 ล้อ','one-to-many','','18'],
  ['C-5','ขับรถเฮี๊ยบ / เครน','Boom Truck / Crane Operation','C · งานเครื่องจักรและยานพาหนะ','ขับรถเฮี๊ยบหรือเครน ยก-ขนย้ายอุปกรณ์และชิ้นงาน','one-to-many','','18'],
  ['C-6','ขับรถบรรทุกน้ำ','Water Truck Operation','C · งานเครื่องจักรและยานพาหนะ','ขับรถบรรทุกน้ำ','one-to-many','','18'],
  ['C-7','ขับรถเทรลเลอร์','Trailer Truck Operation','C · งานเครื่องจักรและยานพาหนะ','ขับเทรลเลอร์ ขนย้ายเครื่องจักรหนักและอุปกรณ์ขนาดใหญ่','one-to-many','','18'],
  ['C-8','ขับรถบริการ / รับ-ส่งพนักงาน','Service Vehicle Driver','C · งานเครื่องจักรและยานพาหนะ','ขับรถรับ-ส่งพนักงาน พัสดุ อะไหล่ จัดซื้อ','one-to-many','','18'],
  ['C-9','เติมน้ำมัน / ออยเลอร์เครื่องจักร','Fuel & Lubricant Service (Oiler)','C · งานเครื่องจักรและยานพาหนะ','เติมน้ำมันเชื้อเพลิงและสารหล่อลื่นให้รถและเครื่องจักร','one-to-many','','18'],
  ['D-1','ตรวจเช็ค / ซ่อมแซมเครื่องจักร','Equipment Inspection & Repair','D · งานซ่อมบำรุง','ตรวจเช็ค ซ่อมแซมเครื่องจักรและยานพาหนะ ตามคำแจ้งซ่อมและแผน PM','one-to-one','18','18'],
  ['D-2','ซ่อมบำรุงระบบไฟฟ้าเครื่องจักร','Equipment Electrical Repair','D · งานซ่อมบำรุง','ซ่อมระบบไฟฟ้า แบตเตอรี่ ไดชาร์จ สายไฟ อุปกรณ์ไฟฟ้าของเครื่องจักร','one-to-one','18','18'],
  ['D-3','งานเชื่อมซ่อม (โรงซ่อม)','Welding & Fabrication – Workshop','D · งานซ่อมบำรุง','เชื่อมซ่อม ดัดแปลง ประกอบชิ้นส่วนเครื่องจักรกลหนักในโรงซ่อม','one-to-one','18','18'],
  ['D-4','งานปะยาง / เปลี่ยนยาง','Tyre Repair & Replacement','D · งานซ่อมบำรุง','ปะยาง เปลี่ยนยางรถและเครื่องจักรทุกประเภท','one-to-one','18','18'],
  ['D-5','ซ่อมบำรุงแบบหล่อ Segment','Segment Formwork Repair','D · งานซ่อมบำรุง','SC 12: ซ่อมแซม บำรุงรักษาแบบหล่อ Segment ให้พร้อมใช้งาน','one-to-one','18','18'],
  ['D-6','งานติดตั้ง / รื้อแพล้นท์คอนกรีต','Concrete Plant Setup / Dismantling','D · งานซ่อมบำรุง','ติดตั้งหรือรื้อถอนแพล้นท์คอนกรีตในโครงการ','one-to-one','18','18'],
  ['E-1','งาน Safety (กลางวัน)','Site Safety – Day Shift','E · งานความปลอดภัยและสนับสนุน','เฝ้าดูแลความปลอดภัยหน้างาน เบี่ยงจราจร ติดตั้งป้าย กะกลางวัน','one-to-one','8','8'],
  ['E-2','งาน Safety (กลางคืน)','Site Safety – Night Shift','E · งานความปลอดภัยและสนับสนุน','เฝ้าดูแลความปลอดภัยหน้างาน เบี่ยงจราจร ตรวจสอบพื้นที่ กะกลางคืน','one-to-one','8','8'],
  ['E-3','งาน จป.วิชาชีพ / HSE','Professional Safety Officer (HSE)','E · งานความปลอดภัยและสนับสนุน','อบรมความปลอดภัย ตรวจสอบมาตรฐาน HSE จัดทำรายงานอุบัติเหตุ','one-to-one','8','8'],
  ['E-4','งานสำนักงาน DOH / ประสานงานราชการ','DOH Office / Government Liaison','E · งานความปลอดภัยและสนับสนุน','ติดตั้ง ซ่อมแซม สาธารณูปโภค DOH ติดต่อประสานงานราชการ','one-to-one','8','8'],
  ['E-5','งานธุรการ / สำนักงาน / จัดซื้อ','Administration / Office / Purchasing','E · งานความปลอดภัยและสนับสนุน','ธุรการ บุคคล บัญชี/การเงิน จัดซื้อจัดจ้าง IT แม่บ้าน และงานสำนักงานทั่วไป','one-to-one','8','8'],
  ['E-6','งานทรัพย์สินและควบคุมคลังพัสดุ','Asset Management & Inventory Control','E · งานความปลอดภัยและสนับสนุน','บริหารทรัพย์สิน ตรวจนับสต๊อก ควบคุมการรับ-จ่ายพัสดุและอุปกรณ์ก่อสร้าง','one-to-one','8','8'],
  ['Z-1','Standby','Standby','Z · ไม่ปฏิบัติงาน','พนักงานพร้อมปฏิบัติงานแต่ยังไม่ได้รับมอบหมายงานในช่วงเวลานั้น','one-to-one',''],
  ['Z-2','ลา','Leave','Z · ไม่ปฏิบัติงาน','ลาป่วย / ลากิจ / ลาพักผ่อน — ลาทุกประเภท ยกเว้นลาออก','one-to-one',''],
  ['Z-3','ลาออก','Resignation','Z · ไม่ปฏิบัติงาน','พนักงานลาออกจากงาน','one-to-one','']
];
var VCB_COST_TYPES = [
  // [code, thaiName, englishName]
  ['1','งานรื้อย้ายโครงสร้างเดิม','Demolition & Removal of Existing Structures'],
  ['2','งานดิน','Earthworks'],
  ['3','งานรองพื้นทางและงานพื้นทาง','Sub-base & Base Course Works'],
  ['4','งานผิวทาง','Pavement Surface Works'],
  ['5','งานโครงสร้าง','Structural Works'],
  ['6','งานติดตั้ง Segment','Segment Installation'],
  ['7','งานหล่อ Segment','Segment Casting'],
  ['8','งานเบ็ดเตล็ด','Miscellaneous Works'],
  ['9','งานระบายน้ำ','Drainage Works'],
  ['10','งานไฟฟ้า','Electrical Works'],
  ['11','งานป้ายจราจร','Traffic Sign Works'],
  ['12','งานเครื่องหมายจราจรบนผิวทาง','Road Marking Works'],
  ['13','การจัดการป้องกันฯ ด้านอุทกวิทยาและคุณภาพน้ำ','Hydrology & Water Quality Management'],
  ['14','งานการจัดการจราจรระหว่างการก่อสร้าง','Traffic Management During Construction'],
  ['15','งานก่อสร้างสิ่งอำนวยความสะดวกให้ผู้ว่าจ้าง','Employer Facility Construction'],
  ['16','งานภูมิสถาปัตยกรรม','Landscape Architecture'],
  ['17','งานอาคาร','Building Works'],
  ['18','งาน Operate เครื่องจักร-เครื่องมือ-ยานพาหนะ','Equipment & Vehicle Operation'],
  ['19','งานเตรียมการก่อสร้าง (ในส่วนบริษัทฯ)','Pre-Construction Preparation & Admin'],
  ['20','งานซ่อมแซมบำรุงรักษา เครื่องจักร-เครื่องมือ-ยานพาหนะ','Equipment & Vehicle Maintenance']
];
var VCB_INDEX_VERSION = '5';   // bump to force a one-time re-seed of both indexes (v5: per-work-type allowed_cost list — STEP 2 now filtered to the matrix in HR_Work_Type_Index_v26)
/* One-time migration: split the old single "Z" (Standby) code into Z-1 (Standby)
   and Z-2 (ลา). Non-destructive — renames the Z row in MasterIndex to Z-1, adds a
   Z-2 row, and rewrites every existing bare "Z" cell in the per-site month tabs to
   "Z-1" so no historical entry is orphaned. Idempotent (safe to run twice). Run via
   the temp doGet endpoint, then remove it. */
function migrateZSplit_(){
  var ss = ss_(), report = { renamedZ:false, addedZ2:false, cellTabs:0, cellsChanged:0 };
  var CAT = 'Z · ไม่ปฏิบัติงาน';
  // 1) MasterIndex: Z -> Z-1, ensure Z-2 exists. Columns (1-based):
  //    1 id · 2 code · 3 name · 4 desc · 5 category · 6 sites · 7 mapping · 8 fixed_cost
  var mi = ss.getSheetByName(SHEETS.INDEX);
  if(mi){
    var data = mi.getDataRange().getValues();
    var zRow = -1, hasZ1 = false, hasZ2 = false, maxId = 0;
    for(var r = 1; r < data.length; r++){
      var code = String(data[r][1]||'').trim();
      if(code === 'Z')   zRow = r;
      if(code === 'Z-1') hasZ1 = true;
      if(code === 'Z-2') hasZ2 = true;
      var idn = Number(data[r][0]) || 0; if(idn > maxId) maxId = idn;
    }
    if(zRow >= 0 && !hasZ1){
      var rn = zRow + 1;
      mi.getRange(rn,2).setValue('Z-1');
      mi.getRange(rn,3).setValue('Standby');
      mi.getRange(rn,4).setValue('Standby · พนักงานพร้อมปฏิบัติงานแต่ยังไม่ได้รับมอบหมายงานในช่วงเวลานั้น');
      mi.getRange(rn,5).setValue(CAT);
      mi.getRange(rn,7).setValue('one-to-one');
      mi.getRange(rn,8).setValue('');
      report.renamedZ = true; hasZ1 = true;
    }
    if(!hasZ2){
      mi.appendRow([maxId+1, 'Z-2', 'ลา', 'Leave · ลาป่วย / ลากิจ / ลาออก', CAT, '', 'one-to-one', '']);
      report.addedZ2 = true;
    }
  }
  // 2) Rewrite bare "Z" -> "Z-1" in every per-site month tab (name contains ' · ').
  //    matchEntireCell + matchCase so only exact-"Z" data cells change (not Z-1, etc.).
  ss.getSheets().forEach(function(sh){
    if(sh.getName().indexOf(' · ') < 0) return;   // skip reference tabs
    var n = sh.createTextFinder('Z').matchCase(true).matchEntireCell(true).replaceAllWith('Z-1');
    report.cellTabs++; report.cellsChanged += n;
  });
  return report;
}
/* Auto-load the VCB indexes once (stamped in Config). Runs on bootstrap so the
   new Work/Cost indexes appear without anyone clicking the admin button. */
function ensureVcbIndexes_(){
  // PERMANENTLY DISABLED. This auto-(re)seed cleared and rewrote the whole index
  // on the boot path; when it stalled it hung the entire app. The index data
  // already exists in the sheets, so nothing needs to run on load. To (re)load
  // the standard set, call api_loadVcbIndexes() manually from the Apps Script
  // editor. (See memory: never-heavy-work-on-load-path.)
  return;
}
/* Admin: (re)load the VCB standard indexes. REPLACES MasterIndex with the 44
   work types and (re)fills CostIndex with the 20 cost types. Destructive on
   those two reference tabs only — daily log data is untouched. */
function api_loadVcbIndexes(){
  rcReset_(); var u=resolveUser_(currentEmail_());
  if(u.role!=='admin') return { ok:false, error:'FORBIDDEN' };
  var n = loadVcbIndexes_();
  // stamp the version so the auto-seed won't re-run/overwrite later
  var cfg=sh_(SHEETS.CONFIG), rows=readObjects_(cfg).rows, found=false;
  for(var i=0;i<rows.length;i++){ if(rows[i].key==='VCB_INDEX_VERSION'){ cfg.getRange(rows[i]._row,2).setValue(VCB_INDEX_VERSION); found=true; break; } }
  if(!found) cfg.appendRow(['VCB_INDEX_VERSION', VCB_INDEX_VERSION]);
  return { ok:true, work:n.work, cost:n.cost };
}
/* Derive the picker behaviour for a VCB_WORK_TYPES row from its allowed-cost list
   (8th element, a comma string of cost codes). This is the single source of truth:
     • exactly 1 allowed cost  → one-to-one, auto-assign it (STEP 2 skipped)
     • 2+ allowed costs        → one-to-many, STEP 2 filtered to just those
     • none listed             → fall back to the row's explicit mapping/fixed
                                  (used only by Z/Standby, which has no cost)
   Returns { allowed:'5,7,8', mapping:'one-to-many', fixed:'' }. */
function deriveWorkMapping_(w){
  var allowed = String(w[7]||'').split(',').map(function(s){return s.trim();}).filter(Boolean);
  if(allowed.length===1) return { allowed:allowed.join(','), mapping:'one-to-one',  fixed:allowed[0] };
  if(allowed.length>=2)  return { allowed:allowed.join(','), mapping:'one-to-many', fixed:'' };
  return { allowed:'', mapping:String(w[5]||'one-to-one'), fixed:String(w[6]||'') };
}
function loadVcbIndexes_(){
  var ss=ss_();
  // Work types → MasterIndex (id, code, name, desc, category, sites, mapping, fixed_cost)
  var mi=ss.getSheetByName(SHEETS.INDEX) || ss.insertSheet(SHEETS.INDEX);
  mi.clear();
  var miRows=[HEADERS.MasterIndex];
  VCB_WORK_TYPES.forEach(function(w,i){
    var desc=(w[2]?(w[2]+' · '):'')+(w[4]||'');      // "<English> · <Thai detail>" (searchable)
    var d=deriveWorkMapping_(w);                      // {allowed, mapping, fixed} from the allowed-cost list
    miRows.push([i+1, w[0], w[1], desc, w[3], '', d.mapping, d.fixed, d.allowed]);
  });
  mi.getRange(1,1,miRows.length,HEADERS.MasterIndex.length).setValues(miRows);
  mi.setFrozenRows(1);
  mi.getRange(1,1,1,HEADERS.MasterIndex.length).setFontWeight('bold');
  // Cost types → CostIndex (id, code, name, name_en)
  var ci=ss.getSheetByName(SHEETS.COST) || ss.insertSheet(SHEETS.COST);
  ci.clear();
  var ciRows=[HEADERS.CostIndex];
  VCB_COST_TYPES.forEach(function(c,i){ ciRows.push([i+1, c[0], c[1], c[2]]); });
  ci.getRange(1,1,ciRows.length,HEADERS.CostIndex.length).setValues(ciRows);
  ci.setFrozenRows(1);
  ci.getRange(1,1,1,HEADERS.CostIndex.length).setFontWeight('bold');
  setConfigIfEmpty_('JOB_CODES_VERSION','1');     // stop auto job-code backfill (codes are A-1 style now)
  return { work:VCB_WORK_TYPES.length, cost:VCB_COST_TYPES.length };
}
/* Non-destructive backfill of the allowed_cost column onto an already-seeded
   MasterIndex. Unlike loadVcbIndexes_ (which clears + rewrites the whole tab and
   would wipe any admin-added custom rows), this only:
     • adds the 'allowed_cost' header column if the sheet predates it, and
     • for each row whose code is one of the standard 44, writes the derived
       allowed_cost + mapping + fixed_cost (from VCB_WORK_TYPES / deriveWorkMapping_).
   Custom rows (codes not in VCB_WORK_TYPES) are left untouched. Idempotent.
   Run once after deploying the allowed_cost change. */
function migrateAllowedCost_(){
  var sh = sh_(SHEETS.INDEX);
  if(!sh) return { ok:false, error:'NO_MASTERINDEX' };
  var vals = sh.getDataRange().getValues();
  var headers = vals[0] || [];
  var cCode = headers.indexOf('code'), cMap = headers.indexOf('mapping'),
      cFix = headers.indexOf('fixed_cost'), cAllow = headers.indexOf('allowed_cost');
  if(cCode < 0 || cMap < 0 || cFix < 0) return { ok:false, error:'BAD_HEADER', headers:headers };
  var addedHeader = false;
  if(cAllow < 0){                                   // sheet was seeded before allowed_cost existed
    cAllow = headers.length;
    sh.getRange(1, cAllow+1).setValue('allowed_cost').setFontWeight('bold');
    addedHeader = true;
  }
  var byCode = {};
  VCB_WORK_TYPES.forEach(function(w){ byCode[String(w[0])] = deriveWorkMapping_(w); });
  var updated = 0, unmatched = [];
  for(var r = 1; r < vals.length; r++){
    var code = String(vals[r][cCode]||'').trim();
    if(!code) continue;
    var d = byCode[code];
    if(!d){ unmatched.push(code); continue; }       // custom row → leave as-is
    sh.getRange(r+1, cAllow+1).setValue(d.allowed);
    sh.getRange(r+1, cMap+1).setValue(d.mapping);
    sh.getRange(r+1, cFix+1).setValue(d.fixed);
    updated++;
  }
  return { ok:true, addedHeader:addedHeader, updated:updated, unmatched:unmatched };
}
/* Location/Cost Type list for the 2nd picker step. Shape mirrors the work-type
   picker items: {name, desc, code, category}. */
function api_costList(){
  rcReset_(); requireEntry_();
  return costItems_();
}
function costItems_(){
  return rows_(SHEETS.COST).map(function(r){
    return { code:String(r.code||''), name:String(r.name||''), desc:String(r.name_en||''), category:'หมวดงาน' };
  }).sort(function(a,b){ return cmpCode_(a.code, b.code); });
}
/* ----- Cost Type admin (manage the 2nd-layer index from ดัชนีงาน) ----- */
function api_costAdminList(){
  rcReset_(); requireEntry_();
  return rows_(SHEETS.COST).map(function(r){
    return { id:r.id, code:String(r.code||''), name:String(r.name||''), name_en:String(r.name_en||'') };
  }).sort(function(a,b){ return cmpCode_(a.code, b.code); });
}
function api_costUpsert(row){
  rcReset_(); var u=resolveUser_(currentEmail_());
  if(u.role!=='admin') return { ok:false, error:'FORBIDDEN' };
  var sh=sh_(SHEETS.COST) || ss_().insertSheet(SHEETS.COST);
  if(sh.getLastRow()===0){ sh.appendRow(HEADERS.CostIndex); sh.setFrozenRows(1); }
  var rows=readObjects_(sh).rows, existing=null;
  if(row && row.id) rows.forEach(function(r){ if(String(r.id)===String(row.id)) existing=r; });
  if(existing){
    sh.getRange(existing._row,1,1,4).setValues([[existing.id, String(row.code||existing.code||''), row.name||'', row.name_en||'']]);
  } else {
    if(!row || !String(row.name||'').trim()) return { ok:false, error:'NAME_REQUIRED' };
    var maxId=0; rows.forEach(function(r){ var n=Number(r.id)||0; if(n>maxId) maxId=n; });
    sh.appendRow([maxId+1, String(row.code||(maxId+1)), row.name.trim(), row.name_en||'']);
  }
  return { ok:true };
}
function api_costDelete(id){
  rcReset_(); var u=resolveUser_(currentEmail_());
  if(u.role!=='admin') return { ok:false, error:'FORBIDDEN' };
  var sh=sh_(SHEETS.COST); if(!sh) return { ok:true };
  readObjects_(sh).rows.forEach(function(r){ if(String(r.id)===String(id)) sh.deleteRow(r._row); });
  return { ok:true };
}
/* Natural compare for codes like A-1 < A-2 < A-10 (letter prefix, then numeric)
   and plain numbers 1 < 2 < 10 < 20. */
function cmpCode_(a, b){
  a=String(a||''); b=String(b||'');
  var ma=a.match(/^(\D*)(\d*)/), mb=b.match(/^(\D*)(\d*)/);
  var pa=ma[1]||'', pb=mb[1]||'';
  if(pa!==pb) return pa < pb ? -1 : 1;
  var na=ma[2]?parseInt(ma[2],10):0, nb=mb[2]?parseInt(mb[2],10):0;
  if(na!==nb) return na-nb;
  return a < b ? -1 : (a > b ? 1 : 0);
}

/* === FULL_ROSTER (embedded — generated from the 5 source workbooks) ===
   Roster is now authoritative IN this script: ensureSync_() reads it on every
   bootstrap and ADDS any missing employees / sites / teams to the Sheet, while
   preserving the existing eid numbering for already-present rows. */
var FULL_ROSTER_VERSION = "2026-05-23b";
var FULL_ROSTER = {"sites":[{"key":"bangtoei","name":"โครงการบางเตย-บ้านพร้าว","company":"บริษัท  วิจิตรภัณฑ์ก่อสร้าง  จำกัด","source_file":"รายงานประจำเดือนเมษายน 1-30 เม.ย. 69 โครงการบาง.xlsx","teams":[{"name":"งานบุคคล - ธุรการ - บัญชี","desc":"ดูแลข้อมูลพนักงานและจัดทำรายละเอียดการทำงานของพนักงาน ใบลา, OT รวมถึงเบี้ยเลี้ยง, ทำข้อมูลบันทึกการใช้จ่ายเงินสดย่อยพร้อมกับลงในระบบ ERP, สรุปค่าไฟฟ้าและค่าประปาพนักงานประจำเดือน, จัดทำเอกสารขออนุมัติต่างๆ รวมถึงงานธุรการต่างๆ ที่ได้รับมอบหมาย,สรุปค่าใช้จ่ายประมาณการในโครงการฯประจำเดือนให้ ผจก.,จัดทำเอกสารสิ้นเดือนเบิกค่าใช้จ่ายต่างๆ ของหน่วยงานได้แก่ ค่าไฟฟ้า, ค่าน้ำประปา, ใบเสร็จ, ใบกำกับภาษี ส่งเข้าสำนักงานใหญ่ รวมถึงการจ่ายและซื้อของใช้ภายในสำนักงานหน่วยงาน ,ติดต่อประสานงานกรมทางหลวง"},{"name":"งานพัสดุ","desc":"ตรวจเช็คดู PR (ใบขอซื้อ สั่งอะไหล่ในการซ่อมบำรุงของเครื่องจักรหนัก - เบา รวมถึงน้ำมันกับสารหล่อลื่นต่างๆ, ทำการตามใบสั่งซื้อและตามอะไหล่จาก ฝ่ายจัดซื้อ/ศูนย์ซ่อมสาย5, ทำการรับเข้าเอกสาร PO Receipt เข้าสู่ระบบ ERP เช่น เอกสาร Invoice (ใบกำกัาภ���ษี), รวมถึงจัดหาซื้ออะไหล่บริเวณใกล้ๆ หน่วยงานฯ,ทำการดูและตรวจเช็คระบบ GPS , ทำรายงานสิ้นเดือนเพื่อสรุปข้อมูลส่งเข้าสำนักงานใหญ่ ได้แก่ รายงานน้ำมัน,วัสดุ หิน,ทรายฯลฯ รายงานการเครื่องจักร, รายงาน GPS, สรุปคิดเงินผรม.ต่างๆ,รับเอกสารวางค่ารักษาความปลอดภัย,รายงานอุบัติ,สรุปค่าใช้จ่ายให้ผจก.โครงการฯ ,รายงานทรัพย์สิน เครื่องมือ-เครื่องใช้"},{"name":"โฟร์แมน","desc":"ดูแลควบคุมงานหน้างาน,เขียนรายงนเครื่องจักรประจำวัน,"},{"name":"SAFETY","desc":"ประกอบม่านบังตา/เชื่อม-ตัดเหล็ก/งานทาสี/ขน-ย้ายแบร์ริเออร์/ติดตั้งป้ายบอกทาง/ออกตรวจสอบป้ายหน้างาน/งานเบี่ยงจราจร"},{"name":"สำรวจ","desc":"วางแนวลงทราย,วางแนวสำนักงาน-ห้องพัก,รันหมุดConTrol GPS,เช็คระดับหาหมุดพิกัดในพื้นที่ก่อสร้าง"},{"name":"เครื่องจักรฯ-รถเกรดเดอร์-รถขุด-รถเทลเลอร์-รถเฮี๊ยบ-รถบดสั่นสะเทือน-รถบรรทุกน้ำ-รถบรรทุก10ล้อ","desc":"งานปรับพื้นที่/งานก่อสร้างสำนักงานและที่พักทั้งโครงการฯ"},{"name":"ช่างไฟฟ้า","desc":"ติดตั้งระบบไฟฟ้าในโครงการฯและหน้างาน"},{"name":"พขร.บริการ","desc":"ขับรถบริการพัสดุ-จัดซื้อ/ขับรถบริการรับ-ส่งพนักงาน/ช่วยงานหน้างาน/เซฟตี้/งานก่อสร้างสำนักงาน-บ้านพัก,บริการเติม��้ำมันรถและเครื่องจักรฯ"},{"name":"ช่างเชื่อมประกอบแบบ","desc":"งานประกอบแบบGuide wall นำแบบ Portal มาตัด เจียร์ เชื่อม นำมาประกอบแบบตามรูปแบบ ขนาดตามแบบที่กำหนด"},{"name":"สำนักงานกรมทางหลวง","desc":"ติดตั้ง-ซ่อมแซมเครื่องมือเครื่องใช้/ติดตั้งระบบท่อบำบัดน้ำทิ้ง/ประปาสำนักงาน-ที่พักทั้งโครงการฯ"}],"employees":[{"emp_id":"5914384","name":"นางสาวอรสา ปาสองห้อง","position":"บุคคลหน่วยงาน","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"5210555","name":"นางสาวสุภาวดี ณ นคร","position":"หัวหน้าพัสดุ","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6815963","name":"นางสาววันดี สิทธิศร","position":"แม่บ้านสำนักงาน/ซัก-รีด","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6515264","name":"นายนพรัตน์ วงค์ศรีทา","position":"วิศวกรสนาม","department":"วิศวกรงานสนาม","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6815954","name":"นายอัศวเทพ พองพรหม","position":"วิศวกรสำนักงาน","department":"วิศวกรงานสนาม","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6815955","name":"นายวีระชัย พันธ์มุม","position":"วิศวกรโครงสร้าง","department":"วิศวกรงานสนาม","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"3000256","name":"นายดวง มาเจริญวงศ์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"4605333","name":"นายสัมฤทธิ์ สุธา","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5010110","name":"นายบุญธรรม ร่วมรส","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5010158","name":"นายหวัน มอนลี","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5010165","name":"นายวิบูลย์ศักดิ์ ธิมา","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5311072","name":"นางสาวสมใจ บุราชัย","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5411437","name":"นายบุญสงค์ เสาชัย","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5511730","name":"นายสมเกียรติ หนูเทศ","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5611762","name":"นายวัชราวุฒิ ปาสองห้อง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5611794","name":"นายไพโรจน์ สร้อยปาน","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5611830","name":"นายสมชื่อ เมาะแก่","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5612034","name":"นายชีวรัก เมาะแก่","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5612092","name":"นายประจักษ์ ภวภูตานนท์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5612188","name":"นายสมบัติ ชอบลำ","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5813844","name":"นายประยูร ภานิกรณ์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5914405","name":"นายสงวน วารินทร์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6014509","name":"นายอภิโชค ตาแสนแก้ว","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6014512","name":"นายเสน่ห์ กระตุดเงิน","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6014597","name":"นายสุพันธ์ เหล่าจูม","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6315049","name":"นายสำเริง วงษ์โท","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6315082","name":"นางประกอบแก้ว บุตรสืบสาย","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6315107","name":"นางรัตนาภรณ์ ทุมวรรณ","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6415146","name":"นายทองอิน กองจันดี","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6415172","name":"นายสถาพร เขื่อนทอง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515424","name":"นายวรากรณ์ พัฒสิทธิ์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515425","name":"นางสาวขนิษฐา ร่วมรส","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6715719","name":"นายสาโรจน์ ละคำ","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6815966","name":"นางสาวขวัญจิตร อุกา","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6916043","name":"นางสาวหนึ่งฤทัย ประทับเคน","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6916044","name":"นา��สาวกัลยา ตะโกนา","position":"","department":"Operation","kind":"operation","division":""}]},{"key":"bangwua","name":"โครงการบางวัว","company":"บริษัท  วิจิตรภัณฑ์ก่อสร้าง  จำกัด","source_file":"รายงานประจำเดือนพฤษภาคม1-10-69 บางวัว.xlsx","teams":[{"name":"โฟร์แมน","desc":"ควบคุมงานถมดิน/สร้างแค้มป์ที่หน่วยงานบางวัว"},{"name":"ควบคุมงานซ่อมบำรุงเครื่องจักรและยานพาหนะ หัวหน้าโรงซ่อม (ช่างฟิต)","desc":"ควบคุมงานซ่อมและทางด้านเทคนิคในส่วนงานซ่อมบำรุงและงานปรับสภาพเครื่องจักรกับยานพาหนะรวมถึง2. งานตรวจเช็คและทำการเขียนใบสั่งซื้ออะไหล่เครื่องมือต่างๆ แบ่งมอบหมายงานให้ทีมงาน ช่างยนต์/ช่าง���ฟ/ช่างปะยาง ประสานงาน ช่วยตรวจซ่อมรถ, และซ่อมเครื่องจักร สั่งอะไหล่เครื่องจักร/ซ่อมปั๊มคลีตส์บนระบบลมรถเทรลเลอร์ ซ่อมไฟท่ายรถดัมพ์ ซ่อมระบบไฟชุดควบคุมไฟสัญญาณรถเกรด ซ่อมระบบลมดัมเร่งไฟฟ้ารถเครน ปรับตั้งเบรกเปลี่ยนสายแบตเตอร์รี่รถเฮี๊ยบ ประกอบการ์ดคอนโทรลรถเครน 20 ตัน ซ่อมระบบแอร์ซ่อมเบรกรถดัมพ์ เปลี่ยนยางรถปิกอัพ ช่วยงานประกอบแบบ ประกอบชุดกรองโซล่ากรองไฮดรอลิก ชุดกรองอากาศรถบดเดินตาม ซ่อมเครื่องสูบน้ำ ประกอบท่อดูดท่อส่งน้ำเครื่องสูบน้ำมันหน้างาน/Standby"},{"name":"ช่างปะยาง/เครื่องมือแ��ะยานพาหนะ","desc":"ตัดเหล็กเชื่อมประกอบแบบบ่อพัก Box Culvert งานเชื่อมประกอบแบบ/Standby"},{"name":"งานซ่อมบำรุงเครื่องจักร, เครื่องมือและยานพาหนะ งานช่างเชื่อม","desc":"ตัดเหล็กเชื่อมประกอบแบบบ่อพัก Box Culvert งานเชื่อมประกอบแบบ/Standby"},{"name":"ออยเลอร์","desc":"เติมรถน้ำ 92-7888 เติม10ล้อ 99-4915 99-4914 50-1959 เติมเทรลเลอร์ 52-8566 เติมรถขุดJCB 1ตจ-8209 เติม10ล้อ 501959 เติมขุดJCB เติมเฮี๊ยบ 52-8565 เติม10ล้อ 93-3521 เติมเฮี๊ยบ52-8565 เติมกะบะ 3ฒฆ-4580 1ฒส-9206 เติมรถเฮี๊ยบ 97-1738 เติมรถดั๊ม 50-2374เติมรถ JCB เติมรถขุด 1ตจ-8209 เติมรถบด ถข-2845 เติมรถออยเลอร์ 50-1958 เติมเครื่องกดคอนกรีต เติมรถนั่ง4ประตู 8กฌ-6413 เติมรถน้ำ 92-7888 93-3521 เติม10ล้อ 99-4914 50-1959 เติมขุด 1ตจ-8209 เติมรถเครน 87-9475 เติมรถฟอร์จูเนอร์ ศย-2817 รถกะบะ 2ฒศ-2660 รถ10ล้อ 99-4915 50-1951 เติมกะบะ 1ฒส-9206 เติมเครื่องปั่นไฟ 1552-6D2-007 เติมกะบะ3ฒฆ-4580 เติมรถดัมพ์ 99-4914 เติมเทรลเลอร์ 52-8566 เติมรถขุด 1ตจ-8209 เติมเครื่องสูบน้ำ เติ��เฮี๊ยบ 52-8566 เติมรถขุด JCB เติมJCB เติมเครื่งปั่นไฟ 1551-9-6D2-007"},{"name":"เซฟตี้","desc":"งานเก็บอุปกรณ์เซฟตี้ งานรื้อถอน งานเบี่ยงจราจรหน้างานงานวางท่อระบายน้ำหน้างาน"},{"name":"รถตัก","desc":"ขับรถตักปรับพื้นที่ภายในแค้มป์/Standby เคลียร์พื้นที่แพล้นท์"},{"name":"เทรลเลอร์","desc":"ขับเทรลเลอร์ ขนย้ายอุปกรณ์ต่างๆ และยกย้ายชิ้นงาน ขนย้ายเครื่องจักร"},{"name":"รถบรรทุกน้ำ","desc":"ขับรถเติมน้ำเข้าแท้งค์น้ำในแค้มป์พนักงาน และผรม."},{"name":"งานรื้อติดตั้งแพล้นท์คอนกรีต","desc":"งานติดตั้งแพล้นท์"},{"name":"LAB/พนักงานทั่วไป","desc":"งานผูกเหล็ก ผูกเหล็กบ่อพัก ��านตัดดัดเหล็ก /งานแพล้นท์บ่อพัก"},{"name":"Survey","desc":"ให้ระดับงานหน้างานบางวัว"},{"name":"รถเฮี๊ยบ/เครน/","desc":"ขนย้ายอุปกรณ์ต่างๆและยกย้ายชิ้นงาน"},{"name":"รถขุด","desc":"งานขุดดินตักดินหน้างาน"},{"name":"รถบรรทุก10ล้อ","desc":"งานบรรทุกดินและวัสดุ"}],"employees":[{"emp_id":"4705482","name":"นางสาวชลรัช อ่อนเกตุพล","position":"ประชาสัมพันธ์โครงการ","department":"Office","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"4907967","name":"นางสาวฐิตา ดีเลิศ","position":"บุคคลหน่วยงานฯ","department":"Office","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"5612127","name":"นายสมบัติ สุรินวงศ์","position":"พขร.บริการทีปรึกษาฯ","department":"Office","kind":"support","division":"ฝ่���ยสนับสนุน"},{"emp_id":"5511446","name":"นางภาวิณี พันธ์นาดี","position":"แม่บ้านซัก-รีด/สำนักงาน","department":"Office","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"5311003","name":"นางอารีย์ โตทุ้ย","position":"แม่บ้านซัก-รีด/สำนักงาน","department":"Office","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"4908021","name":"น.ส.มาลี มั่นคง","position":"หัวหน้าพัสดุ","department":"พัสดุ","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"4909313","name":"นางวรลักษณ์ บุปผาชาติ","position":"พัสดุ","department":"พัสดุ","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"5511469","name":"นายสมบูรณ์ ปิ่นทะเล","position":"พัสดุ","department":"พัสดุ","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"5914178","name":"น.ส.วีระนุช สวิสุพร��ณ์","position":"พัสดุ","department":"พัสดุ","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6014430","name":"นายนราวิชญ์ พันธ์นาดี","position":"พัสดุ","department":"พัสดุ","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6014431","name":"น.ส.วันวิสาข์ ดำน้อย","position":"พัสดุ","department":"พัสดุ","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"4204220","name":"นายณัฐพล กอกุลจันทร์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6014540","name":"นายวิศรุต บุปผาชาติ","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6014552","name":"นายพิทักษ์ ชุ่มเย็น","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6615591","name":"นางสาววชราพร ภูแก้ว","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6615590","name":"นายจรงค์กรณ์ วงศ์สวัสดิ์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5010130","name":"นายธราพร วงศ์สวัสดิ์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5814143","name":"นายประมุก พินทอง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515343","name":"นายอนุชา แก้วมณี","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5009872","name":"นายไพบูลย์ ประเสริฐแก้ว","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"4909153","name":"นายชัชชัย พิทักษ์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5411278","name":"นายสุริยา จงใจ","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"4705701","name":"นายสมพงษ์ สุวรีย์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5310958","name":"นายพะยอง จุนสำโรง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"4908032","name":"นายสมจิตร ภูแก้ว","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5613170","name":"นายกิตติ อุตตาทูล","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6315078","name":"นายชนะพล ขำดี","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6916054","name":"นายสุชาติ หาญสุด","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5311015","name":"นายสงวนศักดิ์ พิมพ์หาญ","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6315058","name":"นายสันติ มายา","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6114670","name":"น.ส.อภิรมย์ ปะกาโส","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5009759","name":"นายศักดิ์ดา ภารสาร","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515393","name":"นายนาวิน วิสัยดี","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515382","name":"นายวรวุฒิ นิ่มนวล","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5813859","name":"นางสำเร็จ ผุยมา","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5914179","name":"นายอุไรวรรณ แพงสาย","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515235","name":"นางนงค์คาร ภูนางาม","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515315","name":"นางสาวสุนิตา สวัสดิรักษ์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515297","name":"นายสมาน จักยานรัมย์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6602016","name":"นางซิน มาตัน","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6602017","name":"น.ส.เอ เมี๊ยท อู","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6916055","name":"นายพยับ สุวรณวงษ์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5511497","name":"น.ส.ทัดดาว เฟื่องฟู","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515441","name":"น.ส.เอื้อง มาเกิด","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5611845","name":"นายชม แก่นจันทร์หอม","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5210535","name":"นายสมเดช หาญสุด","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5713495","name":"นายยุทธศักดิ์ เฟื่องฟู","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6315035","name":"นายสถาพร บานแย้ม","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5010164","name":"นายบุญเลิศ หิ่งห้อยทอง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5713494","name":"นายสินธรรม สิงห์โสภา","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5010166","name":"นายสมชาย เจริญสุข","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5110494","name":"นางวัชรี ภูแก้ว","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5813831","name":"นางพิมพ์พา สีขาว","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5511539","name":"นางกมลวรรณ ลานอก","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"561208","name":"นางจำลอง เจร��ญสุข","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6602017","name":"นางซิน มา เนียว","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5010072","name":"นายวิฑูรย์ ตันสิน","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515368","name":"นายแสงอรุณ ถาวรวัฒนะ","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5311002","name":"นางวิทูล วิสัยดี","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5813858","name":"น.ส.รัชนก ตอรบรัมย์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6415188","name":"น.ส.อุไรพร วะหิม","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6315006","name":"น.ส.รุ่งนภา เทศสวัสดิ์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515431","name":"น.ส.ชัญญานุช ยิ้มพิรัตน์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515432","name":"น.ส.จิตย์ใจ ศรีบุญเรือง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6715768","name":"นายภูผา แนวประเสริฐ","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5010167","name":"นาย บุญถิน สนั่นเอื้อ","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5611805","name":"นาย ฤทธิ์ชัย พลมาตย์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6415171","name":"นายอ็อด บรรดาสิทธิ์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"4908040","name":"นายวีระศํกดิ์ บุปผาชาติ","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6315009","name":"นายวริทธิ์ธร ห้วยขันทึก","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6315115","name":"นายเทพฤทธิ์ กำแพงเพชร","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515348","name":"นายนฤเบศร์ ชาวนา","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515344","name":"นายอมร ชาติทำ","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6315061","name":"นายประนอม ใจชื้น","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5511708","name":"นายบุญลืม เทศสวัสดิ์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6315021","name":"นายณรงค์ ภูนางาม","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5210587","name":"นายมานะ เพชรล้วน","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5210637","name":"นายจีระศักดิ์ ชาวนา","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"50110081","name":"นายณรงค์เดช ล้นเหลือ","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6014521","name":"นายสามารถ บุญมี","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"3000245","name":"นายไพรัช สุกรินทร์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5611834","name":"นาย ชาคริต รักษ์เกษม","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5713462","name":"นายประไณย เชิดชูนวน","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"4605329","name":"นายเนื่อง ดำน้อย","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6602001","name":"นายเอ มิน","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6602007","name":"นายซอ เมี๊ยท ตัน","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6602008","name":"นายอ่อง ซันวิน","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6602012","name":"นายจอ มิน ค่าย","position":"","department":"Operation","kind":"operation","division":""}]},{"key":"phutthamonthon","name":"โครงการพุทธมณฑล","company":"บริษัท  วิจิตรภัณฑ์ก่อสร้าง  จำกัด","source_file":"รายงานประจำเดือนเมษายน 1-30- 69 โครงการพุทธมลฑ.xlsx","teams":[{"name":"LG","desc":"ติดตั้ง Segment"},{"name":"Survey (LG)","desc":"ให้แบบให้ระดับกับทีมLG"},{"name":"ทำถนน","desc":"ตัดเกรด-บกอัด ถนนลาดยาง"},{"name":"งานโครงสร้างข้างล่าง","desc":"ดูความเรียบร้อยงานผรม. ด้านล่าง"},{"name":"งานโครงสร้างข้างบนสะพาน","desc":"Barrier/Parapet บนสะพาน"},{"name":"Survey 1 ���ลางวัน","desc":"ให้แนวให้ระดับกับผู้รับเหมา CHEC"},{"name":"Survey 2 กลางคืน","desc":"ให้แนวให้ระดับU girder"},{"name":"Survey 3 กลางคืน","desc":"ให้แนวให้ระดับด้านบนสะพาน"},{"name":"Safety","desc":"งานขนย้ายทรัพย์สิน แบบเหล็ก ฐานราก เสา คานขวาง และอุปกรณ์ต่างๆ เพื่อเตรียมปรับพื้นที่ งานเก็บ คัดแยกทรัพย์สินในหน่วยงาน เพื่อเตรียมขนย้าย , งานทาสีแบริเออร์และโครงม่านบังตา งานซ่อมโครงม่านเหล็ก-งานเฝ้ารักษาความปลอดภัย"},{"name":"Safety 1 กลางวัน","desc":"ดุแลความปลอดภัยบริเวณหน้างานกะกลางวัน"},{"name":"Safety 2 กลางคืน","desc":"โบรถเครื่องจักรหนักออกจากแคมป์งานไปหน้างาน ไล��ปิดฝาท่อบ่อพักน้ำทิ้งเกาะกลาง-ไล่ปิดปูนตามบ่อพัก เก็บม่านบังตาเข้ามาเก็บในพื้นที่แคมป์ ดูแลความปลอดภัย สกัดแต่งExpansion Joint เข้าแบบExpansion Joint"},{"name":"Safety 3 กลางคืน","desc":"เก็บโครงม่านบังตาและแบริเออร์มาเก็บพื้นที่แคมป์ ดูแลความปลอดภัย ประจำจุดเบี่ยง ล้างถนน ปิดเบี่ยงจราจรและยกเลิกจุดเบี่ยงจราจร"},{"name":"ช่างไฟฟ้าเซฟตี้","desc":"ดูแลเรื่องแสงสว่างทั้งโครงการ"},{"name":"ช่วยเก็บงาน","desc":"สกัดแต่งExpansion Joint"},{"name":"ทั่วไป","desc":"เบี่ยงจราจรหน้าแคมป์ โบกรถเข้า-ออก กวาดทำความสะอาดเศษดินตามพื้นที่จราจรบริเวณทางเข้า-ออก ขนย้าย���ัสดุและอุปกรณ์ก่อสร้างต่างๆ ช่วยจัดเตรียมพื้นที่บริเวณหน้างาน ตามคำสั้งจากวิศวกรหรือโฟร์แมน สูบน้ำเวลาน้ำท่วมในพื้นที่หน้างาน"},{"name":"ขุด","desc":"งานขุดดินหน้างาน ขุดGuide Wall งานสกัดหัวเสาเข็ม และGuide Wall สกัด Soil Cement เพื่อก่อสร้างรางน้ำและแบริเออร์ Footing ปรับพื้นที่ก่อสร้างต่างๆ งานตักดินถมในแคมป์ งานปรับพื้นที่ ขุด ตัก ดินทั่วไป"},{"name":"สิบล้อ","desc":"งานขับสิบล้อวิ่งดินเข็มเจาะ วิ่งดิน Footing และงานขนย้ายทั่วไป ขนย้ายวัสดุดินงาน Bearing Unit / Transition ขนย้ายแผ่น Precast Fin"},{"name":"ขนส่งคอนกรีต","desc":"ขนส่งคอนกรีต บนพื้นสะพาน งานก่อส���้าง Parapet / Meandien Barrier"},{"name":"เฮี๊ยบ","desc":"ขนย้ายอุปกรณ์ต่างๆและยกย้ายชิ้นงานให้ชุดLG"},{"name":"เทรลเลอร์","desc":"ขนย้ายอุปกรณ์ต่างๆและยกย้ายชิ้นงานให้ผู้รับเหมาด้านล่างสะพานกลางคืน"},{"name":"บรรทุกน้ำ","desc":"เติมน้ำด้านบนสะพาน/เติมน้ำชุดลวดBBV/ทำความสะอาดถนนก่อนเปิด"},{"name":"แทร็คเตอร์","desc":"ปรับพื้นที่กองสต๊อก"},{"name":"เครน60ตัน/เครน25ตัน","desc":"ขนย้ายอุปกรณ์ต่างๆและยกย้ายชิ้นงานให้ชุดLG"},{"name":"ช่างเชื่อมกลางวัน","desc":"ตัด-ดัดเหล็ก เส้น ให้ผู้รับเหมา หล่อแผ่นFin/parapet/Barrier/Pile cap ยิงซีลิโคลนร่องแนวBerrier ใช้น้ำยาปาดล้างทำความสะอาด เชื่อมเหล็กกล่องรางร่องน้ำทิ้ง"},{"name":"ช่างเชื่อมกลางคืน","desc":"ตัด-ดัดเหล็ก เส้น ให้ผู้รับเหมา หล่อแผ่นFin/parapet/Barrier/Pile cap ยิงซีลิโคลนร่องแนวBerrier ใช้น้ำยาปาดล้างทำความสะอาด เชื่อมเหล็กกล่องรางร่องน้ำทิ้ง"},{"name":"ช่างเชื่อมกลางคืน (บ.กรุงธน)","desc":"ชักแผ่นพื้นครอบหัวเสา I ลง คลายน็อต ดึงแบบ / เก็บเหล็กกล่องรองแบบแผ่น/รื้อแบบให้กรุงธน"},{"name":"พขร.บริการซ่อมบำรุง(กลางวัน)","desc":"ขับรถบริการพาช่างซ่อมไปซ่อมเครื่องจักรหน้างาน ,ขับรถบริการไปส่ง-รับ อะไหล่ สาย5 /Standby"},{"name":"ช่างปะยาง(กลางวัน)","desc":"เปลี่ยนยาง ปะยาง เครื่องจักรทุกประเ��ท ช่วยงานซ่อมเครื่องจักร ปะยางรถหลังรถเทรลเลอร์รั่ว เปลี่ยนยางหน้าดอกละเอียดใหม่2ชุด 1000-20 ประกอบใส่ล้อนำ+ลูกสูบเร่งแทรค ซ่อมปะยางหน้ารถไถนาฟอร์ด ปะยางหน้าLรั่ว เปลี่ยนยางหางใหม่4 เส้น 1000-20"},{"name":"ออยเลอร์","desc":"เติมกะบะ 1 กท-1326 3ฒถ-6740 เติมเฮี๊ยบ 52-8565 เติม10ล้อ 50-0263 เติมรถออยเลอร์ 50-1958 เติมรถขุด 1ต.ค6168 ตฉ-4784 1ตค-9754 เติมเครน50-7779 เติมเครื่องปั่นไฟ 1492-6D2-006 1532-6D1-002 เติมรถขุด 9C-4784 98-5868 เติมกะบะ 3ฒค-7531 3ฒถ-6738 เติม10ล้อ 50-0263 เติมกะบะ 1ฒร-2158 เติมเฮี๊ยบ 52-8565 เติม10ล้อ 97-3972 เติมขุด ตฉ-4788 รถเครน 52-5755 เติมเครน 99-1032 เติมกะบะ ญพ-1079 เติมเครื่องปั่นไฟ 200KVA 1533-6D1-007 1492-6D2-003รถ��ระเช้า บ.เร้นท์ No.2604 เติมรถปูน 53-4372 53-4374 เติมกะบะ 2ฒศ-2663 เติมแทรคเตอร์ 1ตช 945 เติมรถขุด 1ตจ 8209 เติมรถบด ถข 2845 เติมเครื่องกำเนิดไฟฟ้า 1492-6D2-001 เติมกะบะ 2กจ-7509 2ฒศ-2660 เติมรถขุด 1ตจ-8209 เติมแทรคเตอร์ 1ตช 945 เติมเครื่องกำเนิดไฟฟ้า 1492-6D2-001เติมรถน้ำ92-7914 เติมเฮี๊ยบ 97-1738 เติมเครื่องกำเนิดไฟฟ้า 1492-6D2-001เติมรถปูน 53-4374 เติมกะบะ 1นข-5003 2ฒธ-9225 เติมกะบะ2ขศ 7510 1ฒร-2161 เติมเครน 53-0235 52-5895 เติม10ล้อ 50-0263 เติมฟอร์จูเนอร์ ญฒ-8243 3ฒถ-6734 เติมกะบะ1นง-4973 เติม 52-9212"}],"employees":[{"emp_id":"4900440","name":"นายสุนทร มัคสิงห์","position":"หัวหน้าสำนักงาน","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6515333","name":"นา��สาวสิริลักษณ์ วงศ์สวัสดิ์","position":"บุคคลหน่วยงานฯ","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"5010024","name":"นางสาวกาญจนวรรณ เพชรสมบูรณ์","position":"ธุรการ","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"5110279","name":"นางสาวปิยนันท์ พิลึกนา","position":"บัญชีหน่วยงานฯ","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6315087","name":"นายธนวัฒน์ พันธ์นาดี","position":"พขร.บริการสำนักงาน","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"5914325","name":"นางสายสุนีย์ ถิ่นไทรขึง","position":"แม่บ้านซัก-รีด","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"5713810","name":"นางสายลม นึกชัยภูมิ","position":"แม่บ้านซัก-รีด","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"5813871","name":"นางพิมพ์วิไล ป้อมพงษ์","position":"แม่บ้านซัก-รีด/สำนักงาน","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"5613367","name":"นางสาวอังคณา มาเจริญวงศ์","position":"หัวหน้าพัสดุ","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6515305","name":"นายไพศาล ทวีพูน","position":"พนักงานพัสดุ","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"5310763","name":"นางสาววันเพ็ญ ศรีวิลัย","position":"พัสดุ","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"4909171","name":"นายสวัสดิ์ อยู่ในวงศ์","position":"จัดซื้อ/แค้มป์บอส","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6214337","name":"นางสาวนวลละออง ปัญญาธิ","position":"วิศวกรสำนักงาน","department":"วิศวกรสำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6515334","name":"นางสาวอัจฉรา บัวเพ็ชร","position":"วิศวกรงานแบบก่อสร้าง","department":"วิศวกรสำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"5010001","name":"นาย กิตติพงค์ แจ่มวัฒนาไทย","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6415165","name":"นาย มนัส ย้อยดวงชัย","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6315033","name":"นาย ณัฐภัทร ยงรัตนา","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5813865","name":"นาย ณฐภพ ไกรเทพ","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6315050","name":"นาย ภาณุวัฒน์ จู้เถี้ยง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6415182","name":"นาย วรินทร สงฆ์แป้น","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"2900230","name":"นาย ภิญญา ถิ่นไทรขึง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"4605392","name":"��าย สะมะแอ ยีลีมอ","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5914373","name":"นาย วิษณุ มาเจริญวงศ์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"4909177","name":"นายสว่าง แจ่มใส","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5310804","name":"นายทองปลิว ตองดำ","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5010135","name":"นาย วีระพันธ์ เหมทานนท์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5010137","name":"นายเข็มทอง สุขบำรุง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5914357","name":"นายลอม หงษ์ทอง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5914329","name":"นางบัวชุม ลายสุขัง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5914359","name":"นางสุนิศา หงษ์ทอง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515284","name":"นายภาคภูมิ แปลงดี","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6715788","name":"นายอภิรักษ์ ปานสาลี","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6715789","name":"นายภานุวัฒน์ เผือกพันธ์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6715790","name":"นายเทพพิทักษ์ โพธิ์นอก","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6715820","name":"นางสาวอภิญญา หงษ์ทอง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515234","name":"นางสาวอนุชรา กอแก้ว","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515249","name":"นางจีรวัจร์ เหล่าจูม","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6114700","name":"นางบังอร กระตุดเงิน","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6114701","name":"นางอำพร กุลชร","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5810238","name":"นาย วายุ สุวรีย์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6114678","name":"นาย ธนวัฒน์ เอี่ยมสอาด","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515232","name":"นางสาว อินชุอร สุขบำรุง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515233","name":"นางสาว กชพร ป้องพิมพ์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515396","name":"นาย อนุรักษ์ วงค์ชัย","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515397","name":"นาง��าว สุพรรณษา บุญมาเวียง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515420","name":"นาย วุฒิชัย ก้อนคำ","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6715673","name":"นาย อนุกุล วะหิม","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6715674","name":"นางสาว อริสา จิบทอง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6715786","name":"นาย ธวัชชัย วะหิม","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6715787","name":"นาย ชินราช แต้มมี","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5311074","name":"นางสมุทร กระแสราช","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5914326","name":"นางเก่ง พวงไธสง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515322","name":"นาง พรรณระพี กลิ่นสมุทร","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6315003","name":"นาย ธนชล ผานอก","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5010207","name":"นาย สง่า พวงไธสง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5713733","name":"นาย ธวัชชัย อยู่ในวงศ์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"4705570","name":"นาย สุชาติ ก้อนคำ","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5511698","name":"นาย นิมิต ปานสาลี","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"3501553","name":"นาย สุรัตน์ เย็นใจ","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6715683","name":"นาย นิกร ถิ่นไทรขึง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"4909389","name":"นาย สมพงษ์ หลักทรัพย์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515287","name":"นาย นพกัน เด่นดวง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6014448","name":"นาย วรายุ สีระกุล","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5612081","name":"นาย พิภัทร เดชทะศร","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515274","name":"นาย สุริยา กองเงิน","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515275","name":"นาย ขรรค์ชัย คำมูล","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5311086","name":"นาย สมบุญ กลิ่นสมุทร","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5110368","name":"นาย บุญสม เอี่ยมสอาด","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515229","name":"นาย พุทธิพงศ์ ยุทธกลาง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"4909683","name":"นายพาส นิลธโชติ","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5713527","name":"นายธงชัย โยแก้ว","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5010211","name":"นายมาก คงกระพันธ์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515311","name":"นายพงศกร อุททาวงศ์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515312","name":"นางสาวนิลนุชย์ เชื้อคำหด","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6014562","name":"นางสาวปรียาภรณ์ เย็นอนงค์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6315016","name":"นางส��วลำไพ ศรีแก้วน้ำใส","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5010203","name":"นาย ไพรัตน์ จันทร์ลอย","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5010205","name":"นาย ไพโรจน์ ทวีพูน","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5009850","name":"นาย สมศักดิ์ ขาวช่วง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5010107","name":"นาย สมชาย แสวงงาม","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5411337","name":"นาย ธีระพล ลายสุขัง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5511573","name":"นาย ธวัชชัย มาสอน","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6315026","name":"นาย โชคชัย จิตย์กล้า","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515291","name":"นาย พงศกร ขาวช่วง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5612175","name":"นาย เที่ยง อินทร์เสนา","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5713476","name":"นาย ชูชาติ โพธิ์นอก","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6014636","name":"นาย มานพ วรติยะ","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6114746","name":"นาย สุรศักดิ์ พุ่มมั่น","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6415145","name":"นาย ดิลก บำรุงแคว้น","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6415176","name":"นาย สุภณ ทิพพิชัย","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6415177","name":"นาย สุเมียน จะริบรัมย์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6415183","name":"นาย สมเกียรติ ทิศกลาง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6415195","name":"นาย วราห์ จูมวงศ์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6415218","name":"นาย เจริญ คำมีบุญ","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515230","name":"นาย พรชัย ประมูลศรี","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515293","name":"นาย วิพากษ์ บำรุงแคว้น","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6515294","name":"นาย ทัญญารัตน์ แสงพลอย","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6815876","name":"นาย อำพร เหล่ามา","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6815877","name":"นาย อภิชาต�� เหลากูด","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6815880","name":"นางสาว วิมล พลยศ","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6815881","name":"นาย คำพู ยางขัน","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"3601824","name":"นาย ประพาส แก้วประสงค์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5612189","name":"นาย ณัฐพล ดอกคำ","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6114641","name":"นาย สมจิตร บุตรสืบสาย","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6415174","name":"นาย สุนทร ศรีธุลี","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6602004","name":"นายน ฮลา มิว ลวิน","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6602013","name":"นาย ��อ มิน","position":"","department":"Operation","kind":"operation","division":""}]},{"key":"sai5","name":"ศูนย์ซ่อมฯ สาย 5","company":"บริษัท  วิจิตรภัณฑ์ก่อสร้าง  จำกัด","source_file":"รายงานประจำเดือนเมษายน  1-30-69 หน่วยงาน ศูนย์ซ.xlsx","teams":[{"name":"ควบคุมงานซ่อมบำรุงเครื่องจักรและยานพาหนะ","desc":"ควบคุมทางด้านเทคนิคในส่วนงานซ่อมบำรุงและงานปรับสภาพเครื่องจักรกับยานพาหนะรวมถึงเครื่องมือต่างๆ พร้อมกับตวรจเช็ครายการอะไหล่ที่ใช้ในการซ่อมบำรุง รวมถึงระยะเวลาในการเปลี่ยนถ่ายของเหลวของเครื่องจักร ทำการจัดทีมช่างเทคนิคพร้อมกับออกไปซ่อมบำรุงเครื่องจักรให้กับทุกหน่วยงาน ที่ทำเรื่องแจ้งซ่อมมายังหน่วยงานศูนย์ซ่อมเครื่องจักรกล รวมถึงงานประกอบเครื่องจักรให้บริษัท ชวนา เอ็นจิเนียร์รื่ง จำกัด (โรงหล่อ) และงานที่ได้รับมอบหมายจากผู้จัดการโครงการ"},{"name":"งานพัสดุ","desc":"ตรวจเช็คดู PR (ใบขอซื้อ ทุกหน่วยงานเกี่ยวกับการสั่งอะไหล่ในการซ่อมบำรุงของเครื่องจักรหนัก - เบา รวมถึงน้ำมันกับสารหล่อลื่นต่างๆ, ขอใบเสนอราคารายการอะไหล่จาก Supplier เพื่อยื่นให้จัดซื้อได้ทำการพิจารณาออกใบสั่งซื้อ, ทำการตามใบสั่งซื้อและตามอะไหล่จาก Supplier , ทำการเพิ่ม (Add) และนำข้อมูลรหัสวัสดุต่างๆ เข้าสู��ระบบ ERP เช่น รายการะอะไหล่ของเครื่องจักรต่างๆ และรายการชิ้นงานก่อสร้างทุกประเภท (ในกรณีที่ไม่มีข้อมูลในระบบ ERP), ทำการรับเข้าเอกสาร PO Receipt เข้าสู่ระบบ ERP เช่น เอกสาร Invoice (ใบกำกัาภาษี), รวมถึงจัดหาซื้ออะไหล่บริเวณใกล้ๆ ศูนย์ซ่อมเครื่องจักรกล (ในกรณีที่จะต้องหาซื้อเพื่อการซ่อมชิ้นงานให้แล้วเสร็จ), ทำการดูและตรวจเช็คระบบ GPS , ทำการประสานงานเกี่ยวกับของที่จะส่งไปใช้ในโครงการเขื่อนพลังน้ำหลวงพระบาง (สปป.ลาว) , ทำรายงานสิ้นเดือนเพื่อสรุปข้อมูลส่งเข้าสำนักงานใหญ่ ได้แก่ รายงานน้ำมัน, รายงานการซ่อมเคร���่องเเล้วเสร็จ, รายงาน GPS, และทำเอกสารรายงานน้ำมันดีเซลประจำวันของศูนย์ซ่อมฯ"},{"name":"งานซ่อมบำรุงเครื่องจักร, เครื่องมือและยานพาหนะ","desc":"ทำการซ่อมบำรุงเครื่องจักร ยานพาหนะ รวมถึงเครื่องมือต่างๆ ทำการตรวจเช็คพร้อมประเมินสภาพก่อน-หลังการซ่อมบำรุง, ทำการจัดหายานพาหนะและเตรียมเครื่องไม้เครื่องมือในการซ่อมเพื่อที่จะนำไปใช้ซ่อมที่หน่วยงานอื่นๆ ตามที่ทางโฟร์แมนโรงซ่อมสั่งการ รวมถึงงานประกอบเครื่องจักรให้บริษัท ชวนา เอ็นจิเนียร์รื่ง จำกัด (โรงหล่อ) และงานที่ได้รับมอบหมายจากหัวหน้างานในแต���ละวัน"},{"name":"งานซ่อมบำรุงเครื่องจักร และงานไฟฟ้า","desc":"ดูแลซ่อมแซมบำรุงรักษาเครื่องจักร, อุปกรณ์ไฟฟ้า, เครื่องมือช่างต่างๆ ที่เกี่ยวข้องกับระบบไฟและระบบไฟส่องสว่าง ได้แก่ ปั๊มลม, แอร์, ตู้เชื่อม พร้อมทั้งซ่อมแซมระบบไฟฟ้าของเครื่องจักรของหน่วยงานอื่นๆ ที่ได้แจ้งเข้ามาที่ศูนย์ซ่อมเครื่องจักรกล รวมถึงดูแลรักษาและซ่อมแซมระบบไฟฟ้ารถยนต์, ระบบส่องสว่าง, แบตเตอรี่ ที่ระบบมีการแจ้งเตือนไฟโชว์หน้าปัดของเครื่องจักรกล, งานเกี่ยวกับการติดตั้งระบบไฟฟ้าในส่วนของบริษัท ชวนา เอ็นจิเนียร์ริ่ง จำก���ด (โรงหล่อ) และงานที่ได้รับมอบหมายต่างๆ จากหัวหน้างานในแต่ละวัน"},{"name":"งานทรัพย์สิน","desc":"ดูแลควบคุมในด้านการ รับเข้า - ส่งออกเครื่องจักร ที่ส่งมาจัดเก็บแล้วส่งไปใช้งานตามหน่วยงานต่างๆ, จัดการให้ดำเนินการประเมินสภาพเครื่องจักร, ยานพาหนะ, เครื่องมือ และอุปกรณ์งานก่อสร้าง ทั้งก่อนส่งและรับคืน, ทำการตรวจเช็คจำนวนของเครื่องมือและอุปกรณ์งานก่อนสร้าง เพื่อรวบรวมจำนวนเมื่อมีการเปิดโครงการใหม่ก่อนส่งไปใช้งาน , ดูแลและจัดทำข้อมูลด้านงาน PQ เครื่องจักรและอุปกรณ์งานก่อสร้างเพื่อส่งต่อข้อมูลให���กับทางสำนักงานใหญ่ เพื่อส่งเข้ากรมบัญชีกลาง, ดูแลด้านการส่งทรัพย์สิน และวัสดุสิ้นเปลือง เพื่อไปใช้งานที่โครงการเขื่อนหลวงพระบาง (สปป.ลาว) ได้แก่ จัดเก็บข้อมูลปริมาณ และน้ำหนักเพื่อรวบรวมทำข้อมูล, ตรวจเช็คอุปกรณ์เครื่องมือที่เป็นทรัพย์สินเพื่อดำเนินการขอให้ออก Code ในระบบ ERP, จัดทำรวบรวมข้อมูล ด้าน S/N E/N เพื่อส่งต่อข้อมูลทำเอกสารด้านส่งออก ติดต่อประสานงานหน้าที่งาน, ติดตาม, แก้ไขข้อมูลด้านการส่งออกร่วมกับ สนญ. และบริษัทขนส่ง"},{"name":"งานบุคคล - ธุรการ - บัญชี","desc":"ดูแลข้อมูลพนักงานและจัดทำรายละเอียดการทำงานของพนักงาน ใบลา, OT รวมถึงเบี้ยเลี้ยง, ทำข้อมูลบันทึกการใช้จ่ายเงินสดย่อยพร้อมกับลงในระบบ ERP, จัดทำข้อมูลค่าเช่าเครื่องจักรของแต่ละหน่วงงาน, สรุปค่าไฟฟ้าและค่าประปาพนักงานประจำเดือน, จำทำเอกสารขออนุมัติต่างๆ เกี่ยวกับเครื่องจักร รวมถึงงานธุรการต่างๆ ที่ได้รับมอบหมาย, จัดทำรวบรวมข้อมูล PR,PO และใบกำกับภาษี รวมถึงน้ำหนักในส่วนของงานส่งออกให้โครงการหลวงพระบาง (สปป.ลาว), จัดทำเอกสารสิ้นเดือนเบิกค่าใช้จ่ายต่างๆ ของหน่วยงานได้แก่ ค่าไฟฟ้า, ค่าน้ำประปา, ค่าจ้างพนักงานรักษาความปลอดภัย และเอกสารบิล, ใบเสร็จ, ใบกำกับภาษี ส่งเข้าสำนักงานใหญ่ รวมถึงการจ่ายและซื้อของใช้ภายในสำนักงานศูนย์ซ่อมเครื่องจักรกล"},{"name":"งานซ่อมบำรุงเครื่องจักร, เครื่องมือและยานพาหนะ งานช่างไฟฟ้า","desc":"ทำการซ่อมบำรุงเครื่องจักร ยานพาหนะและระบบไฟฟ้าของเครื่องจักร รวมถึงเครื่องมือต่างๆ ตรวจสอบและดูแลระบบไฟฟ้า งานซ่อมรถ ตรวจเช็คระบบไฟในเครื่องจักร ตรวจสอบ: แบตเตอรี่, ไดร์สตาร์ท, ไดร์ชาร์จ, สายไฟ ซ่อมแซมและเปลี่ยนอะไหล่, ถอดรื้อ, ซ่อมเปลี่ยนอะไหล่ที่ชำรุด งาน Service เครื่องจักรที่ต้องซ่อมเร่งด่วน และซ่อมระบบไฟฟ้าของเครื่องจักรในหน่วยงานฯ"},{"name":"งานซ่อมบำรุงเครื่องจักรในส่วนงานเชื่อม","desc":"ทำการประสานงานเกี่ยวกับงานเชื่อมจากโฟร์แมนโรงซ่อม ในส่วนการเชื่อมประกอบชิ้นส่วนหรือดัดแปลงชิ้นส่วนเครื่องจักรกลเฉพาะกับเครื่องจักรกลหนักที่เสียหายและเสื่อมสภาพจากการใช้งาน ให้กลับมาสมบูรณ์พร้อมใช้งานตามเดิม รวมถึงงานเชื่อมโครงสร้างต่างๆที่ได้รับมอบหมาย พร้อมกับจัดทีมช่างเชื่อมเข้าไปทำการเชื่อมและติดตั้งขาเซอร์เวย์ทาวเวอร์ ในส่วนของบริษัท ชวนา เอ็นจิเนียร์ริ่ง จำกัด (โรงหล่อ) และงานที่���ด้รับมอบหมายเพิ่มเติมในแต่ละวัน"},{"name":"ซ่อมเครื่องจักรหน่วยงานพุทธมณฑล ตอน 4","desc":"ทำการซ่อมบำรุงเครื่องจักรชุดที่ 1 สำหรับนำไปใช้งานที่โครงการพุทธมณฑล ตอน 4"},{"name":"ซ่อมเครื่องจักรหน่วยงานบางวัว ตอน 6","desc":"ทำการซ่อมบำรุงเครื่องจักรชุดที่ 2 สำหรับนำไปใช้งานที่โครงการบางโฉลง - บางวัว ตอน 6"}],"employees":[{"emp_id":"4807807","name":"นายวรวิทย์ จันทร์เพชร","position":"หัวหน้าพัสดุ","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"5914244","name":"นายอำนาจ เอี่ยมอินทร์","position":"หัวหน้าทรัพย์สิน","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6314994","name":"นางสาวปรียานุช มณีวงษ์","position":"เจ้าหน้าที่บุคคล-ธุรการ","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"3903150","name":"นายอุทิศ ป้านสุวรรณ์","position":"ผู้จัดการศูนย์ซ่อมฯ","department":"วิศวกร","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"4705483","name":"นายวิเชษ ทัดศรี","position":"หัวหน้าโรงซ่อม","department":"Maintenance","kind":"support","division":"ฝ่าย���นับสนุน"},{"emp_id":"5411355","name":"นายวิชัย บุญเทพ","position":"ผู้ช่วยช่างซ่อมปรับ","department":"Maintenance","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"5914282","name":"นาย อภิเชษฐ์ ชนินทร์ธนะภักดิ์","position":"ผู้ช่วยช่างไฟฟ้า","department":"Maintenance","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"5210651","name":"นายกิตติ บุตรสืบสาย","position":"ช่างฟิต","department":"Maintenance","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"5210743","name":"นาย ประทีป มัคสิงห์","position":"ช่างไฟฟ้า","department":"Maintenance","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"3100353","name":"นาย พรศักดิ์ ขวดทอง","position":"หัวหน้าช่างเชื่อม","department":"Maintenance","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"4705483","name":"นาย วิเชษ ทัดศรี","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"4807807","name":"นาย วรวิทย์ จันทร์เพชร","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5411355","name":"นาย วิชัย บุญเทพ","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5914244","name":"นาย อำนาจ เอี่ยมอินทร์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6314994","name":"นางสาว ปรียานุช มณีวงษ์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"5210651","name":"นาย กิตติ บุตรสืบสาย","position":"","department":"Operation","kind":"operation","division":""}]},{"key":"suphanburi","name":"โรงงานสุพรรณบุรี","company":"บริษัท  ชวนา  เอ็นจิเนียร์ริ่ง  จำกัด","source_file":"รายงานประจำเดือน เมษายน 1-30-69 โรงงานสุพรรณบุ.xlsx","teams":[{"name":"Opertion","desc":""},{"name":"งานโฟร์แมน","desc":"1.งานหล่อ Segment เน้นที่ขั้นตอนตั้งแต่เตรียมแบบจนถึงเทคอนกรีต"},{"name":"แท่นผลิต","desc":"1.หัวหน้าแท่นผลิต"},{"name":"Gantry Crane","desc":"1. ตรวจสอบสภาพ Gantry Crane ทุกเช้าก่อนใช้งาน"},{"name":"Shuttle Lift","desc":"1.พขร.Shuttle Lift 130ตัน/80ตัน"},{"name":"งานQC งานคอนกรีต","desc":"1.พนักงาน QC งานคอนกรีต"},{"name":"งานขับรถบรรทุก","desc":"ขับรถบรรทุกคอนกรีต เทคอนกรีต ผลิต Segment"},{"name":"Maintenance","desc":""},{"name":"ควบคุมงานซ่อมบำรุงเครื่องจักรและยานพาหนะ","desc":"ควบคุมทางด้านเทคนิคในส่วนงานซ่อมบำรุงและงานปรับสภาพเครื่องจักรกับยานพาหนะรวมถึงเครื่องมือต่างๆ พร้อมกับตวรจเช็ครายการอะไหล่ที่ใช้ในการซ่อมบำรุง รวมถึงระยะเวลาในการเปลี่ยนถ่ายของเหลวของเครื่องจักร ทำการจัดทีมช่างเทคนิคพร้อมกับออกไปซ่อมบำรุงเครื่องจักรให้กับทุกหน่วยงาน ที่ทำเรื่องแจ้งซ่อมมายังหน่วยงานศูนย์ซ่อมเครื่องจักรกล รวมถึงงานประกอบเครื่องจักรให้บริษัท ชวนา เอ็นจิเนียร์รื่ง จำกัด (โรงหล่อ) และงานที่ได้รับมอบหมายจากผู้จัดการโครงการ"},{"name":"หัวหน้าโรงซ่อม","desc":"1.แบ่งมอบหมายงานให้ทีมงาน ช่างยนต์/ช่างไฟ/ช่างเชื่อม"},{"name":"งานซ่อมบำรุงเครื่องจักร, เครื่องมือและยานพาหนะ","desc":"ทำกา���ซ่อมบำรุงเครื่องจักร ยานพาหนะ รวมถึงเครื่องมือต่างๆ ทำการตรวจเช็คพร้อมประเมินสภาพก่อน-หลังการซ่อมบำรุง, ทำการจัดหายานพาหนะและเตรียมเครื่องไม้เครื่องมือในการซ่อมเพื่อที่จะนำไปใช้ซ่อมที่หน่วยงานอื่นๆ ตามที่ทางโฟร์แมนโรงซ่อมสั่งการ รวมถึงงานประกอบเครื่องจักรให้บริษัท ชวนา เอ็นจิเนียร์รื่ง จำกัด (โรงหล่อ) และงานที่ได้รับมอบหมายจากหัวหน้างานในแต่ละวัน"},{"name":"งานช่างเครื่องยนต์","desc":"1. งานตรวจเช็ครถและเครื่องจักร"},{"name":"งานช่างเชื่อม","desc":"1.งานเชื่อม / ตัด / เจียร (ในโมลและอุปกรณ์ค้ำยัน)"},{"name":"งานช่างไฟฟ้า","desc":"1. งานไฟฟ้า ภายในบริษัท CVE"},{"name":"วิศวกร/วิศวกรสำนักงาน","desc":""},{"name":"งานวิศวกรสนาม","desc":"ตรวจสอบและเตรียมแบบ/วัสดุ"},{"name":"งานวิศวกรสำนักงาน","desc":"ถอดปริมาณงานทั้งหมด ทำ Barcut List ประสานงานผู้รับเหมา"},{"name":"สำนักงาน/ฝ่ายสนับสนุน","desc":""},{"name":"งานพัสดุ","desc":"1. งานบันทึกข้อมูลและรายงานในระบบ ERP"},{"name":"งานทรัพย์สิน","desc":"1. งานทรัพย์สินเครื่องมือ / เครื่องใช้"},{"name":"งานบุคคล","desc":"1. การสรรหาและคัดเลือกบุคลากร"},{"name":"งานธุรการสำนักงาน วิศวะ/เลขา","desc":"1.การออกเอกสาร"},{"name":"เจ้าหน้าที่สำนักงาน (แม่บ้าน)","desc":"ทำความ���ะอาดภายในอาคารสำนักงาน : กวาดพื้น ถูพื้น ปัดฝุ่น โต๊ะทำงาน เก้าอี้ ชั้นวางของ ทิ้งขยะ /เช็ดกระจก ประตู หน้าต่าง ให้สะอาดเรียบร้อย/ ดูแลความสะอาดบริเวณพื้นที่ส่วนกลาง เช่น ห้องประชุม, ห้องรับรอง"},{"name":"พนักงานขับรถบริการ","desc":"ตรวจสอบความพร้อมของรถก่อนออกเดินทาง : ตรวจเช็กสภาพรถ เช่น น้ำมันเครื่อง, ยางรถ, ระบบเบรก, ไฟส่องสว่าง, น้ำหล่อเย็น/ลงบันทึกในแบบฟอร์มตรวจเช็กรถประจำวัน"},{"name":"บัญชี/การเงิน","desc":"1. งานบันทึกเงินสดย่อย / ตั้งเบิก"},{"name":"เจ้าหน้าที่ความปลอดภัยในการทำงาน จป.วิชาชีพ","desc":"1. อบรมความป���อดภัยให้กับพนักงานใหม่ก่อนเริ่มงาน"},{"name":"พนักงานคอมพิวเตอร์ (IT)","desc":"1.งานด้านระบบคอมพิวเตอร์และเครือข่าย"}],"employees":[{"emp_id":"6500037","name":"นส.กุลศยา เรืองขจร","position":"หน.บุคคล","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6800088","name":"นายเสนาะ คำหอมกุล","position":"พขร.บริการ","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6500034","name":"นส.ปรีดา แปลงยศ","position":"แม่บ้านสำนักงาน","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6500031","name":"นส.กาญจนา ไชยชาญ","position":"ธุรการสนง/วิศวะ","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6600045","name":"นส.พ��ชรี โหสุวรรณ","position":"จป.วิชาชีพ","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6600066","name":"นางนาถฎิญา พรมทัน","position":"บัญชี/การเงิน","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6600050","name":"นายกฤษฎางค์กูล แก้วเขียว","position":"จนท.ไอที","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6500008","name":"นส.จุฑามาศ คำเสมอ","position":"หน.ทรัพย์สิน&พัสดุ","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6500033","name":"นส.สุกัญญา แฝงฤทธิ์","position":"พนักงานทรัพย์สิน","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6600068","name":"นส.สุธาริณี บุญเรือง","position":"พนักงานพัสดุ","department":"สำนักงาน","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6700073","name":"นายณัฐศิษฐ์ เรืองกาทิพย์","position":"วิศวกรสำนักงาน","department":"วิศวกร","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6700083","name":"นายวรพจน์ สุขสมวงษ์","position":"วิศวกรสนาม","department":"วิศวกร","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6600049","name":"นายธงชัย อินทอง","position":"หัวหน้าโรงซ่อม","department":"Maintenance","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6600052","name":"นายพรเทพ เจริญรักษ์","position":"ช่างไฟฟ้า","department":"Maintenance","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6600069","name":"นายพิทักษ์ จันโทวาท","position":"ช่างเชื่อม","department":"Maintenance","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6800085","name":"นายธาณี เฉื่อยฉ่ำ","position":"ช่างยนต์","department":"Maintenance","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6900100","name":"นายเฉลิมพล ม่วงแก้ว","position":"ช่างไฟฟ้า","department":"Maintenance","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6900101","name":"นายอดิศักดิ์ สำเนียงหวาน","position":"ช่างเชื่อม","department":"Maintenance","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6900106","name":"นายพัชรพล หนูอ้น","position":"ช่างยนต์","department":"Maintenance","kind":"support","division":"ฝ่ายสนับสนุน"},{"emp_id":"6500004","name":"นายพิชัย สำราญสุข","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6600054","name":"นายพิเชษฐ์ เพลินพร้อม","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6700074","name":"นายศตวรรษ ใจเย็น","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6800087","name":"นายกฤษฎา บัวคลี่","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6900102","name":"นายบุณยกร ใจกำแหง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6900103","name":"นายอาทิตย์ รัตนสุวรรณชัย","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6900104","name":"นายอนุสรณ์ ผิวชะอุ่ม","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6500021","name":"นายนัทฐานันท์ เสนะวงศ์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6600064","name":"นายสถาพร พงษ์สวัสดิ์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6700080","name":"นายศุภกิจ ศรีสุข","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6700081","name":"นายธนญชัย ทองสุก","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6900096","name":"นายสุณิศ มงคลวงศ์","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6500023","name":"นายวิเศษ เสาชัย","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6800095","name":"นายนราชัย ติดยง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6900097","name":"นายวรากร รัตนสุวรรณชัย","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6700084","name":"นายดำรงศักดิ์ จันทวี","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6500020","name":"นายณัฐวุฒิ ไชยชาญ","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6600059","name":"นายศักรินทร์ ชาวน���ดอน","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6600070","name":"นายชินวัฒน์ ใจมั่น","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6800092","name":"นายธีรยุทธ มีจั่นเพชร","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6700078","name":"นายนพรัตน์ สุขเกษม","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6500019","name":"นายธนาวุฒิ สีโสภา","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6800090","name":"นายนพดล ทองดอนเสียง","position":"","department":"Operation","kind":"operation","division":""},{"emp_id":"6900099","name":"นส.นันทนา พรมวาศรี","position":"","department":"Operation","kind":"operation","division":""}]}]};

/* Seed (roster + migrated history) lives in a Drive JSON so this file stays
   small enough to paste. Read ONCE by SETUP only — the running web app never
   touches Drive, so day-to-day use has no Drive-permission dependency. */
var SEED_FILE_ID = "1Ns_uqJ7XE6OQ_7Ohxw6MsJOEp24t3VqM";
var SEED_CACHE_ = null;
function loadSeed_(){
  if (SEED_CACHE_) return SEED_CACHE_;
  var file;
  try { file = DriveApp.getFileById(SEED_FILE_ID); }
  catch (err){ throw new Error("อ่านไฟล์ข้อมูลตั้งต้น (hr_seed.json) ไม่ได้ — ตรวจ SEED_FILE_ID หรือสิทธิ์ Drive ของผู้รัน SETUP. ("+(err&&err.message?err.message:err)+")"); }
  SEED_CACHE_ = JSON.parse(file.getBlob().getDataAsString("UTF-8"));
  return SEED_CACHE_;
}
function SEED_DATA(){ return { sites: loadSeed_().sites }; }
function SEED_ENTRIES(){ var s=loadSeed_(); return { support:s.support||[], operation:s.operation||[] }; }

/* ============================ SPREADSHEET ACCESS ============================ */
// The database is ALWAYS opened by id. getActiveSpreadsheet() returns null in a
// published web app, so we must not depend on it — open DB_ID explicitly so the
// web app and the editor's SETUP always act on the exact same spreadsheet.
// The web app is deployed "Execute as: Me", so opening DB_ID always succeeds
// regardless of whether the visiting user has direct access to the Sheet.
var DB_ID = "1MYHU0ictzuOYPTWHolWKjB2zNND7gKUakbXhim_5ZIQ";
var SS_CACHE_ = null;
function ss_(){
  if (SS_CACHE_) return SS_CACHE_;
  try { SS_CACHE_ = SpreadsheetApp.openById(DB_ID); }
  catch(e){ SS_CACHE_ = SpreadsheetApp.getActiveSpreadsheet(); }   // fallback only
  if (!SS_CACHE_) throw new Error('เปิดฐานข้อมูลไม่ได้ (DB_ID=' + DB_ID + ') — ตรวจสิทธิ์/รหัสไฟล์');
  return SS_CACHE_;
}
function sh_(name){ return ss_().getSheetByName(name); }

function readObjects_(sheet){
  var values = sheet.getDataRange().getValues();
  var headers = values.shift() || [];
  var rows = values.map(function(v,i){ var o={_row:i+2}; headers.forEach(function(h,c){ o[h]=v[c]; }); return o; });
  return { headers:headers, rows:rows };
}
// request-scoped cache: read each sheet at most once per execution
var RC_ = {};
function rcReset_(){ RC_={}; }
function rows_(name){
  if(!RC_.hasOwnProperty(name)){ var sh=sh_(name); RC_[name]= sh ? readObjects_(sh).rows : []; }
  return RC_[name];
}
function getConfig_(key){
  var rows = readObjects_(sh_(SHEETS.CONFIG)).rows;
  for(var i=0;i<rows.length;i++) if(rows[i].key===key) return String(rows[i].value||'');
  return '';
}
function setConfigIfEmpty_(key,val){
  var sheet=sh_(SHEETS.CONFIG), rows=readObjects_(sheet).rows;
  for(var i=0;i<rows.length;i++) if(rows[i].key===key) return;
  sheet.appendRow([key,val]);
}

/* ============================ SETUP / SEED ============================ */
function SETUP(){
  var ss = ss_();
  Object.keys(HEADERS).forEach(function(name){
    var sh = ss.getSheetByName(name); if(!sh) sh = ss.insertSheet(name);
    if(sh.getLastRow()===0){
      sh.appendRow(HEADERS[name]); sh.setFrozenRows(1);
      sh.getRange(1,1,1,HEADERS[name].length).setFontWeight('bold');
    }
  });
  seedReferenceData_();   // Sites / Teams / Employees roster
  ensureLogSheets_();     // one daily-log sheet per site
  migrateOrSeedLogs_();   // load existing history into empty log sheets

  var def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length>1) ss.deleteSheet(def);

  setConfigIfEmpty_('ADMIN_EMAILS', Session.getActiveUser().getEmail() || '');
  setConfigIfEmpty_('ALLOWED_DOMAIN', '');
  try { ss.toast('ติดตั้งเสร็จแล้ว','HR Work Log',8); } catch(e){ Logger.log('SETUP done'); }
}

function siteSheetMap_(){
  var m={}; rows_(SHEETS.SITES).forEach(function(s){ m[s.key]=String(s.name); }); return m;
}
function ensureLogSheets_(){
  var ss=ss_(), map=siteSheetMap_();
  Object.keys(map).forEach(function(key){
    var name=map[key], sh=ss.getSheetByName(name); if(!sh) sh=ss.insertSheet(name);
    if(sh.getLastRow()===0){
      sh.appendRow(LOG_HEADER); sh.setFrozenRows(1);
      sh.getRange(1,1,1,LOG_HEADER.length).setFontWeight('bold').setBackground('#1d4e89').setFontColor('#ffffff');
      sh.getRange('A:A').setNumberFormat('@');
      sh.setColumnWidth(1,95); sh.setColumnWidth(4,170); sh.setColumnWidth(6,320); sh.setColumnWidth(7,230); sh.setColumnWidth(9,160);
    }
  });
}
function logSheet_(siteKey){
  var name=siteSheetMap_()[siteKey]; if(!name) return null;
  var sh=sh_(name); if(!sh){ ensureLogSheets_(); sh=sh_(name); } return sh;
}
function logRowsForSite_(siteKey){
  var name=siteSheetMap_()[siteKey]; if(!name) return [];
  if(!sh_(name)) ensureLogSheets_(); return rows_(name);
}

/* ========== WIDE-FORMAT MONTHLY TABS (Push A: code paths, not yet wired) ==========
   Goal: replace one-long-tab-per-site with one-wide-tab-per-site-per-month so
   the sheet reads like the source xlsx (rows = employees, columns = days 1–31)
   and each tab stays well under 2K rows.

   Tab name: "{siteName} · {BE_year}-{MM}"  e.g.  "โครงการบางวัว · 2569-05"
   Columns (67 total):
     A: eid
     B: emp_id
     C: name
     D: kind          (operation | support)
     E: department
     F..BO: 31 days × 2 columns each
       day-N column pair: { N_v, N_n }
         N_v  = team (op)  OR  work_detail (sup)   header: "Day N"
         N_n  = note                               header: "Note N"

   OT was previously a third per-day column ('ot') but was removed in @71 —
   the app no longer records OT for any role. A one-time migration stripped
   OT from every existing wide tab; the migration code has since been deleted
   (it had served its purpose and was adding boot-time overhead).
   ============================================================================ */
var WIDE_DAY_FIELDS = ['v','n'];        // per-day columns in order
function wideTabName_(siteKey, year, month){
  var name = siteSheetMap_()[siteKey]; if(!name) return null;
  var be = year + 543, mm = ('0'+month).slice(-2);
  return name + ' · ' + be + '-' + mm;
}
function parseWideTabName_(tabName){
  // returns {siteName, year (Gregorian), month} or null
  var parts = String(tabName).split(' · ');
  if(parts.length !== 2) return null;
  var ym = parts[1].split('-');
  if(ym.length !== 2) return null;
  var beY = Number(ym[0]), m = Number(ym[1]);
  if(!beY || !m || m<1 || m>12) return null;
  return { siteName: parts[0], year: beY - 543, month: m };
}
// Human-readable header for each per-day field. Used both when creating a
// fresh wide tab and during the OT-strip migration when we rewrite headers.
function wideFieldHeader_(day, field){
  return field === 'v' ? ('AM ' + day) : ('Note ' + day);
}
// --- PM (afternoon) block ---------------------------------------------------
// AM/PM split is implemented WITHOUT a column migration: the existing per-day
// value column ('v') stays as the AM (morning) value, and a brand-new PM block
// is APPENDED after the entire AM/note block. Appending at the end means no
// existing column shifts and no historical data is reinterpreted — old tabs
// just gain empty PM columns the first time they're touched.
var PM_BASE = 5 + 31 * WIDE_DAY_FIELDS.length;   // last col of the AM/note block (=67)
function pmColIndex_(day){ return PM_BASE + day; } // 1-indexed PM column for day N
function pmHeader_(day){ return 'PM ' + day; }
function wideHeaders_(){
  var hdr = ['eid','emp_id','name','kind','department'];
  for(var d = 1; d <= 31; d++){
    for(var f = 0; f < WIDE_DAY_FIELDS.length; f++){
      hdr.push(wideFieldHeader_(d, WIDE_DAY_FIELDS[f]));
    }
  }
  for(var d2 = 1; d2 <= 31; d2++) hdr.push(pmHeader_(d2));   // appended PM block
  return hdr;
}
function wideColIndex_(day, field){
  // 1-indexed sheet column for the day-N field
  return 5 + (day - 1) * WIDE_DAY_FIELDS.length + WIDE_DAY_FIELDS.indexOf(field) + 1;
}
// Backfill the PM header/columns on a tab created before the AM/PM split.
// Non-destructive: only appends columns at the end and writes their header.
// Idempotent (skips once the PM header is already present).
function ensurePmColumns_(sh){
  var need = pmColIndex_(31);
  if(sh.getMaxColumns() < need) sh.insertColumnsAfter(sh.getMaxColumns(), need - sh.getMaxColumns());
  if(String(sh.getRange(1, pmColIndex_(1)).getValue() || '') === pmHeader_(1)) return;  // already done
  var labels = [];
  for(var d = 1; d <= 31; d++) labels.push(pmHeader_(d));
  sh.getRange(1, pmColIndex_(1), 1, 31).setValues([labels])
    .setFontWeight('bold').setBackground('#7a3e1d').setFontColor('#ffffff').setHorizontalAlignment('center');
  for(var d2 = 1; d2 <= 31; d2++) sh.setColumnWidth(pmColIndex_(d2), 140);
}
function ensureWideTab_(siteKey, year, month){
  var ss = ss_();
  var name = wideTabName_(siteKey, year, month); if(!name) return null;
  var sh = ss.getSheetByName(name);
  if(sh){ ensurePmColumns_(sh); return sh; }   // backfill PM block on existing tabs
  sh = ss.insertSheet(name);
  var hdr = wideHeaders_();
  sh.appendRow(hdr); sh.setFrozenRows(1); sh.setFrozenColumns(3);
  sh.getRange(1,1,1,5 + 31*WIDE_DAY_FIELDS.length).setFontWeight('bold').setBackground('#1d4e89').setFontColor('#ffffff').setHorizontalAlignment('center');
  sh.getRange(1, pmColIndex_(1), 1, 31).setFontWeight('bold').setBackground('#7a3e1d').setFontColor('#ffffff').setHorizontalAlignment('center');
  sh.setColumnWidth(1, 55);   // eid
  sh.setColumnWidth(2, 80);   // emp_id
  sh.setColumnWidth(3, 200);  // name
  sh.setColumnWidth(4, 90);   // kind
  sh.setColumnWidth(5, 130);  // department
  // narrow each day's columns to keep it scannable
  for(var d = 1; d <= 31; d++){
    sh.setColumnWidth(wideColIndex_(d,'v'), 140);  // AM
    sh.setColumnWidth(wideColIndex_(d,'n'), 100);  // note
    sh.setColumnWidth(pmColIndex_(d), 140);        // PM
  }
  return sh;
}

/* Push A read helper — converts wide-tab rows into the same {entries, employees}
   shape api_siteMonth currently produces. Push B will wire this in. */
function readWideMonth_(siteKey, year, month){
  var sh = ss_().getSheetByName(wideTabName_(siteKey, year, month));
  if(!sh) return { employees:[], entries:{} };
  var values = sh.getDataRange().getValues();
  if(values.length < 2) return { employees:[], entries:{} };
  var employees = [], entries = {};
  for(var r = 1; r < values.length; r++){
    var row = values[r];
    var eid = String(row[0]||'').trim(); if(!eid) continue;
    employees.push({
      eid: eid, emp_id: String(row[1]||''), name: String(row[2]||''),
      kind: String(row[3]||'support'), department: String(row[4]||''), position: ''
    });
    var byDate = {};
    for(var d = 1; d <= 31; d++){
      var v   = row[wideColIndex_(d,'v') - 1];
      var nt  = row[wideColIndex_(d,'n') - 1];
      var pmCol = pmColIndex_(d);
      var pm  = (pmCol-1 < row.length) ? row[pmCol - 1] : '';   // PM block absent on pre-split tabs
      var hasAny = (v!==''&&v!=null) || (nt!==''&&nt!=null) || (pm!==''&&pm!=null);
      if(!hasAny) continue;
      var dateStr = year + '-' + ('0'+month).slice(-2) + '-' + ('0'+d).slice(-2);
      byDate[dateStr] = (String(row[3])==='operation')
        ? { team:String(v||''), pm:String(pm||''), note: String(nt||'') }
        : { detail: String(v||''), pm:String(pm||''), note: String(nt||'') };
    }
    if(Object.keys(byDate).length) entries[eid] = byDate;
  }
  return { employees: employees, entries: entries };
}

/* Push A write helper — applies a batch of cell changes to the matching wide
   tab. Items shape matches api_saveCells's `items`. Push B will wire this in. */
/* Append-only audit trail. Each row records one changed cell:
   ts, email, site, year, month, eid, emp_name, day, field, old_val, new_val.
   Lazily creates the AuditLog tab so it works on already-deployed sheets that
   predate this feature (no SETUP re-run needed). Best-effort: a logging failure
   must never break a save, so the whole thing is wrapped in try/catch. */
function appendAudit_(rows){
  if(!rows || !rows.length) return;
  try{
    var ss = ss_();
    var sh = ss.getSheetByName(SHEETS.AUDIT);
    if(!sh){
      sh = ss.insertSheet(SHEETS.AUDIT);
      sh.appendRow(HEADERS.AuditLog); sh.setFrozenRows(1);
      sh.getRange(1,1,1,HEADERS.AuditLog.length).setFontWeight('bold')
        .setBackground('#1d4e89').setFontColor('#ffffff');
    }
    sh.getRange(sh.getLastRow()+1, 1, rows.length, HEADERS.AuditLog.length).setValues(rows);
  } catch(e){ /* never let auditing break a write */ }
}

function writeWideCells_(siteKey, items){
  if(!items || !items.length) return { saved: 0 };
  var auditTs = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  var auditWho = currentEmail_() || '(unknown)';
  var audits = [];
  // Group items by (year, month) so we touch each tab once
  var byMonth = {};
  items.forEach(function(it){
    var d = String(it.date); if(d.length < 7) return;
    var y = Number(d.slice(0,4)), m = Number(d.slice(5,7));
    var k = y + '|' + m;
    (byMonth[k] = byMonth[k] || []).push(it);
  });
  var empMap = {}; rows_(SHEETS.EMP).forEach(function(e){ if(e.site_key === siteKey) empMap[String(e.eid)] = e; });
  var saved = 0;
  Object.keys(byMonth).forEach(function(k){
    var parts = k.split('|'), y = Number(parts[0]), m = Number(parts[1]);
    var sh = ensureWideTab_(siteKey, y, m); if(!sh) return;
    // Build emp-id → row-index map from current sheet contents
    var values = sh.getDataRange().getValues();
    var rowOf = {};
    for(var r = 1; r < values.length; r++){
      var rid = String(values[r][0]||'').trim();
      if(rid) rowOf[rid] = r + 1;   // 1-indexed sheet row
    }
    byMonth[k].forEach(function(it){
      var e = empMap[String(it.eid)]; if(!e) return;
      var rowNum = rowOf[String(it.eid)];
      if(!rowNum){
        // Append a new row for this employee
        sh.appendRow([e.eid, e.emp_id||'', e.name||'', e.kind||'support', e.department||'']);
        rowNum = sh.getLastRow();
        rowOf[String(it.eid)] = rowNum;
      }
      var dayN = Number(String(it.date).slice(8,10));
      if(!dayN || dayN < 1 || dayN > 31) return;
      var f = it.fields || {};
      var op = (it.kind || e.kind) === 'operation';
      // Only write columns the client actually sent — otherwise an OT-only
      // edit would wipe the note, etc. The 'in' check distinguishes "field
      // explicitly cleared" (value='') from "field not in this update".
      if('team' in f || 'detail' in f){
        var v = op ? (f.team || '') : (f.detail || '');
        var vCol = wideColIndex_(dayN,'v');
        var oldV = (values[rowNum-1] && values[rowNum-1][vCol-1] != null) ? String(values[rowNum-1][vCol-1]) : '';
        if(oldV !== String(v)){
          sh.getRange(rowNum, vCol).setValue(v);
          audits.push([auditTs, auditWho, siteKey, y, m, it.eid, e.name||'', dayN, 'AM', oldV, v]);
        }
      }
      if('pm' in f){
        var pmv = f.pm || '';
        var pCol = pmColIndex_(dayN);
        var oldP = (values[rowNum-1] && values[rowNum-1][pCol-1] != null) ? String(values[rowNum-1][pCol-1]) : '';
        if(oldP !== String(pmv)){
          sh.getRange(rowNum, pCol).setValue(pmv);
          audits.push([auditTs, auditWho, siteKey, y, m, it.eid, e.name||'', dayN, 'PM', oldP, pmv]);
        }
      }
      if('note' in f){
        var nVal = f.note || '';
        var nCol = wideColIndex_(dayN,'n');
        var oldN = (values[rowNum-1] && values[rowNum-1][nCol-1] != null) ? String(values[rowNum-1][nCol-1]) : '';
        if(oldN !== String(nVal)){
          sh.getRange(rowNum, nCol).setValue(nVal);
          audits.push([auditTs, auditWho, siteKey, y, m, it.eid, e.name||'', dayN, 'note', oldN, nVal]);
        }
      }
      saved++;
    });
  });
  appendAudit_(audits);
  return { saved: saved };
}

/* One-time migration: walks every existing long-format site tab, groups rows
   by (year, month, eid), creates the matching wide-format tab, and writes the
   rows in. Old tabs are renamed to "_legacy_<siteName>" rather than deleted
   so we can roll back if anything looks wrong. Safe to re-run (idempotent on
   wide tabs that already have the row — it overwrites). */
function migrateToWideFormat_(){
  var ss = ss_();
  var siteMap = siteSheetMap_();   // siteKey -> siteName
  var report = { sites: [] };
  Object.keys(siteMap).forEach(function(siteKey){
    var oldName = siteMap[siteKey];
    var oldSh = ss.getSheetByName(oldName);
    if(!oldSh) return;
    var rows = readObjects_(oldSh).rows;
    if(!rows.length){ report.sites.push({site:siteKey, rows:0, tabs:0}); return; }
    var empMap = {}; rows_(SHEETS.EMP).forEach(function(e){ if(e.site_key===siteKey) empMap[String(e.eid)] = e; });
    // bucket rows by (y, m)
    var buckets = {};
    rows.forEach(function(r){
      var d = String(r.date); if(d.length < 7) return;
      var y = Number(d.slice(0,4)), m = Number(d.slice(5,7));
      var key = y + '|' + m;
      (buckets[key] = buckets[key] || []).push(r);
    });
    var tabsMade = 0;
    Object.keys(buckets).forEach(function(key){
      var p = key.split('|'), y = Number(p[0]), m = Number(p[1]);
      var sh = ensureWideTab_(siteKey, y, m); if(!sh) return;
      // For this tab, rebuild rows-by-employee map from existing content
      var existingValues = sh.getDataRange().getValues();
      var rowOf = {};
      for(var ri = 1; ri < existingValues.length; ri++){
        var rid = String(existingValues[ri][0]||'').trim();
        if(rid) rowOf[rid] = ri + 1;
      }
      buckets[key].forEach(function(r){
        var e = empMap[String(r.eid)];
        if(!e){
          // Employee might exist but not in this site's roster — still write what we have
          e = { eid: r.eid, emp_id: r.emp_id||'', name: r.name||'', kind: r.kind||'support', department:'' };
        }
        var rowNum = rowOf[String(r.eid)];
        if(!rowNum){
          sh.appendRow([e.eid, e.emp_id||'', e.name||'', e.kind||r.kind||'support', e.department||'']);
          rowNum = sh.getLastRow();
          rowOf[String(r.eid)] = rowNum;
        }
        var dayN = Number(String(r.date).slice(8,10));
        if(!dayN || dayN < 1 || dayN > 31) return;
        var op = String(r.kind) === 'operation';
        var v  = op ? (r.team || '') : (r.work_detail || '');
        var n  = (r.note || '');
        sh.getRange(rowNum, wideColIndex_(dayN,'v')).setValue(v);
        sh.getRange(rowNum, wideColIndex_(dayN,'n')).setValue(n);
      });
      tabsMade++;
    });
    // Push A: DO NOT rename the old tab — the live app still reads/writes
    // from it. The rename to _legacy_<siteName> happens in Push B, AFTER we
    // flip the api functions to use the wide tabs. Wide tabs are added
    // alongside as a read-only verification copy.
    report.sites.push({site:siteKey, rows: rows.length, tabs: tabsMade});
  });
  Logger.log('migrateToWideFormat_ report: ' + JSON.stringify(report));
  return report;
}

/* Admin-callable wrapper so it can be triggered without opening the editor. */
function api_migrateToWideFormat(){
  rcReset_(); var u = resolveUser_(currentEmail_());
  if(u.role !== 'admin') return { ok:false, error:'FORBIDDEN' };
  try {
    var rep = migrateToWideFormat_();
    return { ok:true, report: rep };
  } catch(e){
    return { ok:false, error: String(e && e.message || e) };
  }
}

/* EMERGENCY RECOVERY: undo the rename from buggy @44 Push A.
   For each site:
     1. If a "_legacy_<siteName>" tab exists, that's where the data went.
     2. If a same-name empty tab was created by ensureLogSheets_, delete it.
     3. Rename the legacy tab back to its original name.
   Idempotent — safe to re-run. */
function revertWideFormatRename_(){
  var ss = ss_();
  var siteMap = siteSheetMap_();
  var report = { restored: [], skipped: [] };
  Object.keys(siteMap).forEach(function(siteKey){
    var origName = siteMap[siteKey];
    var legacyName = '_legacy_' + origName;
    var legacySh = ss.getSheetByName(legacyName);
    if(!legacySh){ report.skipped.push({site:siteKey, why:'no _legacy_ tab'}); return; }
    // If an empty tab with the original name was auto-created, delete it
    var emptySh = ss.getSheetByName(origName);
    if(emptySh){
      var values = emptySh.getDataRange().getValues();
      var nonHeaderRows = values.length - 1;
      // Only delete if it's empty (just the LOG_HEADER row) or has no data rows
      if(nonHeaderRows <= 0 || (values.length===1 && values[0].length === LOG_HEADER.length)){
        try { ss.deleteSheet(emptySh); } catch(e){}
      } else {
        report.skipped.push({site:siteKey, why:'same-name tab has data, not deleting'});
        return;
      }
    }
    try { legacySh.setName(origName); report.restored.push(siteKey); }
    catch(e){ report.skipped.push({site:siteKey, why:'rename failed: '+(e&&e.message||e)}); }
  });
  Logger.log('revertWideFormatRename_ report: ' + JSON.stringify(report));
  return report;
}
function api_revertWideFormatRename(){
  rcReset_(); var u = resolveUser_(currentEmail_());
  if(u.role !== 'admin') return { ok:false, error:'FORBIDDEN' };
  try { return { ok:true, report: revertWideFormatRename_() }; }
  catch(e){ return { ok:false, error: String(e && e.message || e) }; }
}

/* Now that the live app uses wide tabs exclusively (Push B), the original
   long-format tabs are dead weight. This renames them to "_archive_<name>"
   so they remain available as historical reference but stop cluttering the
   active tab strip. Idempotent. */
function archiveLongFormatTabs_(){
  var ss = ss_();
  var siteMap = siteSheetMap_();
  var report = { archived: [], skipped: [] };
  Object.keys(siteMap).forEach(function(siteKey){
    var origName = siteMap[siteKey];
    var origSh = ss.getSheetByName(origName);
    if(!origSh){ report.skipped.push({site:siteKey, why:'no original tab'}); return; }
    // Sanity check: at least one wide tab must exist for this site, else
    // archiving would orphan the data
    var hasWide = false;
    ss.getSheets().forEach(function(s){
      if(s.getName().indexOf(origName + ' · ') === 0) hasWide = true;
    });
    if(!hasWide){ report.skipped.push({site:siteKey, why:'no wide tabs exist yet, refusing to archive'}); return; }
    var archiveName = '_archive_' + origName;
    try { origSh.setName(archiveName); report.archived.push(siteKey); }
    catch(e){ report.skipped.push({site:siteKey, why:'rename failed: ' + (e&&e.message||e)}); }
  });
  Logger.log('archiveLongFormatTabs_ report: ' + JSON.stringify(report));
  return report;
}
function api_archiveLongFormatTabs(){
  rcReset_(); var u = resolveUser_(currentEmail_());
  if(u.role !== 'admin') return { ok:false, error:'FORBIDDEN' };
  try { return { ok:true, report: archiveLongFormatTabs_() }; }
  catch(e){ return { ok:false, error: String(e && e.message || e) }; }
}

function migrateOrSeedLogs_(){
  var ss=ss_();
  var now=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm');
  var empMap={}; readObjects_(sh_(SHEETS.EMP)).rows.forEach(function(e){ empMap[String(e.eid)]=e; });
  function isoDate_(d){ if(d instanceof Date) return Utilities.formatDate(d,Session.getScriptTimeZone(),'yyyy-MM-dd'); return String(d||'').slice(0,10); }
  function rowFor(e,date,kind,detail,team,ot,note,by,at){
    return [isoDate_(date),e.eid,e.emp_id||'',e.name||'',kind,detail||'',team||'',ot||'',note||'',by||'',at||'']; }
  var buckets={}; function push(sk,row){ (buckets[sk]=buckets[sk]||[]).push(row); }

  var oldSup=ss.getSheetByName(LEGACY.SUP), oldOp=ss.getSheetByName(LEGACY.OP);
  var supRows=oldSup?readObjects_(oldSup).rows:[], opRows=oldOp?readObjects_(oldOp).rows:[];
  if(supRows.length||opRows.length){
    supRows.forEach(function(r){ var e=empMap[String(r.eid)]; if(!e)return; push(e.site_key,rowFor(e,r.date,'support',r.work_detail,'','',r.note,r.updated_by||'seed',r.updated_at||now)); });
    opRows.forEach(function(r){ var e=empMap[String(r.eid)]; if(!e)return; push(e.site_key,rowFor(e,r.date,'operation','',r.team,r.ot_hours,r.note,r.updated_by||'seed',r.updated_at||now)); });
  } else {
    var seed=SEED_ENTRIES();
    seed.support.forEach(function(r){ var e=empMap[String(r[0])]; if(!e)return; push(e.site_key,rowFor(e,r[1],'support',r[2],'','',r[3],'seed',now)); });
    seed.operation.forEach(function(r){ var e=empMap[String(r[0])]; if(!e)return; push(e.site_key,rowFor(e,r[1],'operation','',r[2],r[3],'','seed',now)); });
  }
  Object.keys(buckets).forEach(function(sk){
    var sh=logSheet_(sk); if(!sh||sh.getLastRow()>1) return;   // only fill empty sheets
    var rows=buckets[sk].sort(function(a,b){ return String(a[0]).localeCompare(String(b[0])); });
    if(rows.length) sh.getRange(2,1,rows.length,LOG_HEADER.length).setValues(rows);
  });
}

function seedReferenceData_(){
  var data=SEED_DATA(), ss=ss_();
  var siteSh=ss.getSheetByName(SHEETS.SITES), teamSh=ss.getSheetByName(SHEETS.TEAMS), empSh=ss.getSheetByName(SHEETS.EMP);
  var haveSites={}; readObjects_(siteSh).rows.forEach(function(r){ haveSites[r.key]=true; });
  var haveEmp={};   readObjects_(empSh).rows.forEach(function(r){ haveEmp[String(r.eid)]=true; });
  var haveTeam={};  readObjects_(teamSh).rows.forEach(function(r){ haveTeam[r.site_key+'|'+r.name]=true; });
  var sRows=[],tRows=[],eRows=[];
  data.sites.forEach(function(s){
    if(!haveSites[s.key]) sRows.push([s.key,s.name,s.company||'']);
    s.teams.forEach(function(t){ if(!haveTeam[s.key+'|'+t.name]) tRows.push([s.key,t.name,t.desc||'']); });
    s.employees.forEach(function(e){ if(!haveEmp[String(e.eid)]) eRows.push([e.eid,s.key,e.emp_id||'',e.name,e.position||'',e.department||'',e.kind||'support',e.division||'','']); });
  });
  if(sRows.length) siteSh.getRange(siteSh.getLastRow()+1,1,sRows.length,3).setValues(sRows);
  if(tRows.length) teamSh.getRange(teamSh.getLastRow()+1,1,tRows.length,3).setValues(tRows);
  if(eRows.length) empSh.getRange(empSh.getLastRow()+1,1,eRows.length,9).setValues(eRows);
}

/* Sync FULL_ROSTER (embedded) into Sites / Teams / Employees. Idempotent:
   - matches existing rows by (emp_id, name) → keeps their eid, never overwrites
   - assigns new eids (max+1) to genuinely new employees
   - only ADDS rows; never modifies/deletes existing ones (so the original seed
     stays intact and any HR edits to Employees are preserved)
   Skips entirely if Config.ROSTER_VERSION == FULL_ROSTER_VERSION (cheap noop). */
function ensureSync_(){
  if(!FULL_ROSTER || !FULL_ROSTER.sites) return;
  if(getConfig_('ROSTER_VERSION') === FULL_ROSTER_VERSION) return;
  var ss=ss_();
  var siteSh=ss.getSheetByName(SHEETS.SITES), teamSh=ss.getSheetByName(SHEETS.TEAMS), empSh=ss.getSheetByName(SHEETS.EMP);
  if(!siteSh||!teamSh||!empSh) return;
  var existingSites=readObjects_(siteSh).rows;
  var existingTeams=readObjects_(teamSh).rows;
  var existingEmps =readObjects_(empSh).rows;
  var haveSite={}; existingSites.forEach(function(r){ haveSite[r.key]=true; });
  var haveTeam={}; existingTeams.forEach(function(r){ haveTeam[r.site_key+'|'+r.name]=true; });
  // employee lookup by (emp_id, name) for stable matching across seeds
  var empKey=function(emp_id,name){ return String(emp_id||'').trim()+'|'+String(name||'').trim().replace(/\s+/g,' '); };
  var haveEmp={}; var maxEid=0;
  existingEmps.forEach(function(r){
    haveEmp[empKey(r.emp_id, r.name)] = r;
    var n=Number(r.eid)||0; if(n>maxEid) maxEid=n;
  });
  var sRows=[], tRows=[], eRows=[];
  FULL_ROSTER.sites.forEach(function(s){
    if(!haveSite[s.key]) sRows.push([s.key, s.name, s.company||'']);
    (s.teams||[]).forEach(function(t){ if(!haveTeam[s.key+'|'+t.name]) tRows.push([s.key, t.name, t.desc||'']); });
    (s.employees||[]).forEach(function(e){
      var k=empKey(e.emp_id, e.name);
      if(haveEmp[k]) return;     // already in sheet → keep its existing eid
      maxEid++;
      eRows.push([maxEid, s.key, e.emp_id||'', e.name, e.position||'', e.department||'', e.kind||'support', e.division||'', '']);
      haveEmp[k]={eid:maxEid};   // dedupe within the same run
    });
  });
  if(sRows.length) siteSh.getRange(siteSh.getLastRow()+1,1,sRows.length,3).setValues(sRows);
  if(tRows.length) teamSh.getRange(teamSh.getLastRow()+1,1,tRows.length,3).setValues(tRows);
  if(eRows.length) empSh.getRange(empSh.getLastRow()+1,1,eRows.length,9).setValues(eRows);
  // mark version so subsequent bootstraps skip
  var cfgSh=sh_(SHEETS.CONFIG);
  var found=false; readObjects_(cfgSh).rows.forEach(function(r){ if(r.key==='ROSTER_VERSION'){ cfgSh.getRange(r._row,2).setValue(FULL_ROSTER_VERSION); found=true; } });
  if(!found) cfgSh.appendRow(['ROSTER_VERSION', FULL_ROSTER_VERSION]);
  setConfigIfEmpty_('LOCK_DAYS', '3');
  ensureMasterIndex_();
}

/* Master Work Index — a single editable master list of all work types/teams
   used across every site, so admins can clean up wording and operators pick
   from a controlled vocabulary instead of free-typing the same thing 5 ways.
   Seeded once from every site's Index tab (already in FULL_ROSTER[*].teams). */
function ensureMasterIndex_(){
  var ss=ss_();
  var sh = ss.getSheetByName(SHEETS.INDEX);
  if(!sh){
    sh = ss.insertSheet(SHEETS.INDEX);
    sh.appendRow(HEADERS.MasterIndex); sh.setFrozenRows(1);
    sh.getRange(1,1,1,HEADERS.MasterIndex.length).setFontWeight('bold').setBackground('#1d4e89').setFontColor('#ffffff');
    sh.setColumnWidth(1,55); sh.setColumnWidth(2,90); sh.setColumnWidth(3,280); sh.setColumnWidth(4,340); sh.setColumnWidth(5,140); sh.setColumnWidth(6,220);
  }
  // Always backfill missing job codes — cheap, idempotent, and catches rows
  // that were inserted before the codification rule existed.
  ensureJobCodes_();
  if(getConfig_('MASTER_INDEX_VERSION') === FULL_ROSTER_VERSION) return;
  if(typeof FULL_ROSTER === 'undefined' || !FULL_ROSTER.sites) return;
  var existing = readObjects_(sh).rows;
  var have={}, maxId=0;
  existing.forEach(function(r){ have[String(r.name||'').trim().toLowerCase()]=r; var n=Number(r.id)||0; if(n>maxId) maxId=n; });
  var perName={};   // name -> { desc, sites:[siteName, ...] }
  FULL_ROSTER.sites.forEach(function(s){
    (s.teams||[]).forEach(function(t){
      var name=String(t.name||'').trim(); if(!name) return;
      var bucket = perName[name] || { desc:'', sites:[] };
      if(!bucket.desc && t.desc) bucket.desc = t.desc;
      if(bucket.sites.indexOf(s.name) < 0) bucket.sites.push(s.name);
      perName[name]=bucket;
    });
  });
  var rowsToAdd=[];
  Object.keys(perName).forEach(function(name){
    var k = name.toLowerCase();
    if(have[k]) return;
    maxId++;
    rowsToAdd.push([maxId, '', name, perName[name].desc||'', '', perName[name].sites.join(', ')]);
  });
  if(rowsToAdd.length){
    rowsToAdd.sort(function(a,b){ return String(a[2]).localeCompare(String(b[2]),'th'); });
    sh.getRange(sh.getLastRow()+1,1,rowsToAdd.length,6).setValues(rowsToAdd);
    ensureJobCodes_();   // codify the newly-appended rows
  }
  var cfgSh=sh_(SHEETS.CONFIG);
  var found=false; readObjects_(cfgSh).rows.forEach(function(r){
    if(r.key==='MASTER_INDEX_VERSION'){ cfgSh.getRange(r._row,2).setValue(FULL_ROSTER_VERSION); found=true; }
  });
  if(!found) cfgSh.appendRow(['MASTER_INDEX_VERSION', FULL_ROSTER_VERSION]);
}

function api_masterList(){
  rcReset_(); requireEntry_();
  return rows_(SHEETS.INDEX).map(function(r){
    return { id:r.id, code:r.code, name:r.name, desc:r.desc, category:r.category, sites:r.sites,
             mapping:String(r.mapping||'one-to-many'), fixed_cost:String(r.fixed_cost||''),
             allowed_cost:String(r.allowed_cost||'') };
  }).sort(function(a,b){
    var ca=String(a.category||'~'), cb=String(b.category||'~');
    if(ca!==cb) return ca.localeCompare(cb,'th');
    return cmpCode_(a.code, b.code);
  });
}
/* Pads a numeric id into a 3-digit job code (1 → "001", 42 → "042", 123 → "123"). */
function jobCodeOf_(id){
  var n = Number(id) || 0;
  return n < 1000 ? ('00'+n).slice(-3) : String(n);
}
/* Backfill empty `code` cells in MasterIndex with the row's id zero-padded.
   Safe to call any time; never overwrites a non-empty code (admins can still
   type a custom code like "LG-001" in the edit modal and it'll be preserved). */
function ensureJobCodes_(){
  // Gated: after the first successful backfill we stamp Config.JOB_CODES_VERSION
  // so subsequent bootstraps skip the MasterIndex read entirely. New rows from
  // api_masterUpsert assign codes inline, so the sheet stays codified without
  // this re-running every page load (was ~200-400ms per bootstrap).
  if(getConfig_('JOB_CODES_VERSION') === '1') return;
  var sh = sh_(SHEETS.INDEX); if(!sh) return;
  var rows = readObjects_(sh).rows;
  rows.forEach(function(r){
    var current = String(r.code||'').trim();
    if(current) return;
    var auto = jobCodeOf_(r.id);
    if(auto) sh.getRange(r._row, 2).setValue(auto);
  });
  setConfigIfEmpty_('JOB_CODES_VERSION', '1');
}
function api_masterUpsert(row){
  rcReset_(); var u=resolveUser_(currentEmail_());
  if(u.role!=='admin') return { ok:false, error:'FORBIDDEN' };
  var sh=sh_(SHEETS.INDEX); var rows=readObjects_(sh).rows;
  var existing=null;
  if(row && row.id) rows.forEach(function(r){ if(String(r.id)===String(row.id)) existing=r; });
  if(existing){
    var code = String(row.code||'').trim() || String(existing.code||'').trim() || jobCodeOf_(existing.id);
    sh.getRange(existing._row,1,1,6).setValues([[existing.id, code, row.name||'', row.desc||'', row.category||'', existing.sites||'']]);
  } else {
    if(!row || !String(row.name||'').trim()) return { ok:false, error:'NAME_REQUIRED' };
    var maxId=0; rows.forEach(function(r){ var n=Number(r.id)||0; if(n>maxId) maxId=n; });
    var newId = maxId + 1;
    var newCode = String(row.code||'').trim() || jobCodeOf_(newId);
    sh.appendRow([newId, newCode, row.name.trim(), row.desc||'', row.category||'', '']);
  }
  return { ok:true };
}
function api_masterDelete(id){
  rcReset_(); var u=resolveUser_(currentEmail_());
  if(u.role!=='admin') return { ok:false, error:'FORBIDDEN' };
  var sh=sh_(SHEETS.INDEX);
  readObjects_(sh).rows.forEach(function(r){ if(String(r.id)===String(id)) sh.deleteRow(r._row); });
  return { ok:true };
}

/* Bulk-import work types into the MasterIndex from pasted rows (e.g. copied from
   Excel). Each non-empty line = one work type; columns are tab- OR comma-
   separated in the order: name, desc, category, code(optional). An optional
   header row (name/ชื่อ/code/รหัส…) is auto-detected and used to map columns.
   Rows are upserted: matched by code (if given) else by name (case-insensitive)
   — existing rows are updated, new rows are appended with an auto Job Code.
   Returns {added, updated, skipped}. This is the SAME table the operation
   picker reads from, so imported items appear in the picker on the next entry
   load (loadGrid refetches the vocab each time). */
function api_masterImport(text){
  rcReset_(); var u=resolveUser_(currentEmail_());
  if(u.role!=='admin') return { ok:false, error:'FORBIDDEN' };
  var raw = String(text||'').replace(/\r/g,'');
  var lines = raw.split('\n').filter(function(l){ return String(l).trim()!==''; });
  if(!lines.length) return { ok:true, added:0, updated:0, skipped:0 };
  if(lines.length > 3000) return { ok:false, error:'TOO_MANY (max 3000 rows)' };
  var parse = function(line){
    var parts = line.indexOf('\t')>=0 ? line.split('\t') : line.split(',');
    return parts.map(function(p){ return String(p).trim(); });
  };
  // Header detection + column mapping (default order: name, desc, category, code)
  var first = parse(lines[0]).map(function(s){ return s.toLowerCase(); });
  var looksHeader = first.some(function(h){ return /(^|\b)(name|ชื่อ|code|รหัส|desc|คำอธิบาย|cat|หมวด)/.test(h); });
  var idx = { name:0, desc:1, category:2, code:3 };
  if(looksHeader){
    idx = { name:-1, desc:-1, category:-1, code:-1 };
    first.forEach(function(h,i){
      if(idx.code<0 && /code|รหัส/.test(h)) idx.code=i;
      else if(idx.name<0 && /name|ชื่อ/.test(h)) idx.name=i;
      else if(idx.desc<0 && /desc|คำอธิบาย|รายละเอียด/.test(h)) idx.desc=i;
      else if(idx.category<0 && /cat|หมวด/.test(h)) idx.category=i;
    });
    if(idx.name<0) idx.name=0;
  }
  var dataLines = looksHeader ? lines.slice(1) : lines;
  var skipped = 0;
  // Parse → items, then dedupe within the paste (last occurrence wins).
  var items = [];
  dataLines.forEach(function(line){
    var p = parse(line);
    var name = (idx.name>=0 ? p[idx.name] : '') || '';
    name = String(name).trim();
    if(!name){ skipped++; return; }
    if(name === 'งานตัวอย่าง') return;   // template's greyed example row — never import it
    items.push({
      name: name,
      desc: idx.desc>=0 ? (p[idx.desc]||'') : '',
      category: idx.category>=0 ? (p[idx.category]||'') : '',
      code: idx.code>=0 ? String(p[idx.code]||'').trim() : ''
    });
  });
  var seen = {}, deduped = [];
  for(var i=items.length-1; i>=0; i--){
    var it = items[i];
    var key = it.code ? ('c:'+it.code) : ('n:'+it.name.toLowerCase());
    if(seen[key]){ skipped++; continue; }
    seen[key] = true; deduped.unshift(it);
  }
  // Apply against the existing sheet.
  var sh = sh_(SHEETS.INDEX); var rows = readObjects_(sh).rows;
  var byCode = {}, byName = {}, maxId = 0;
  rows.forEach(function(r){
    var c = String(r.code||'').trim(); if(c) byCode[c] = r;
    byName[String(r.name||'').trim().toLowerCase()] = r;
    var n = Number(r.id)||0; if(n>maxId) maxId = n;
  });
  var added = 0, updated = 0, appends = [];
  deduped.forEach(function(it){
    var existing = (it.code && byCode[it.code]) ? byCode[it.code] : byName[it.name.toLowerCase()];
    if(existing && existing._row){
      var newCode = it.code || String(existing.code||'').trim() || jobCodeOf_(existing.id);
      sh.getRange(existing._row,1,1,6).setValues([[existing.id, newCode, it.name, it.desc, it.category, existing.sites||'']]);
      updated++;
    } else {
      maxId++;
      appends.push([maxId, it.code || jobCodeOf_(maxId), it.name, it.desc, it.category, '']);
      added++;
    }
  });
  if(appends.length) sh.getRange(sh.getLastRow()+1,1,appends.length,6).setValues(appends);
  return { ok:true, added:added, updated:updated, skipped:skipped };
}

/* === HISTORY IMPORT (uses HISTORY_DATA from History.gs) ===
   Imports historical work-log entries scanned from the 53 monthly source
   workbooks. Run once per project: client iterates sites, calling
   api_importHistorySite for each, then api_finalizeHistory to mark done. */
function ensureHistorySites_(){
  if (typeof HISTORY_DATA === 'undefined' || !HISTORY_DATA.sites) return;
  var ss=ss_();
  var siteSh=ss.getSheetByName(SHEETS.SITES), empSh=ss.getSheetByName(SHEETS.EMP);
  var have={}; readObjects_(siteSh).rows.forEach(function(r){ have[r.key]=true; });
  var newSites=[];
  HISTORY_DATA.sites.forEach(function(s){ if(!have[s.key]) newSites.push([s.key, s.name, s.company||'']); });
  if(newSites.length) siteSh.getRange(siteSh.getLastRow()+1,1,newSites.length,3).setValues(newSites);

  var empKey=function(emp_id,name){ return String(emp_id||'').trim()+'|'+String(name||'').trim().replace(/\s+/g,' '); };
  var haveEmp={}; var maxEid=0;
  readObjects_(empSh).rows.forEach(function(r){
    haveEmp[empKey(r.emp_id, r.name)]=r;
    var n=Number(r.eid)||0; if(n>maxEid) maxEid=n;
  });
  var rows=[];
  HISTORY_DATA.sites.forEach(function(s){
    (s.employees||[]).forEach(function(e){
      var k=empKey(e.emp_id, e.name);
      if(haveEmp[k]) return;
      maxEid++;
      rows.push([maxEid, s.key, e.emp_id||'', e.name, e.position||'', e.department||'', e.kind||'support', e.division||'', '']);
      haveEmp[k]={eid:maxEid};
    });
  });
  if(rows.length) empSh.getRange(empSh.getLastRow()+1,1,rows.length,9).setValues(rows);
  ensureLogSheets_();   // make sure any new sites have a log tab
}

function api_historyStatus(){
  rcReset_(); var u=resolveUser_(currentEmail_());
  if(u.role!=='admin') return { ok:false, error:'FORBIDDEN' };
  if (typeof HISTORY_DATA === 'undefined') return { ok:true, done:true, sites:[] };
  var done = (getConfig_('HISTORY_VERSION') === HISTORY_VERSION);
  var bySite={};
  HISTORY_DATA.sup.forEach(function(r){ bySite[r[0]]=(bySite[r[0]]||0)+1; });
  HISTORY_DATA.op .forEach(function(r){ bySite[r[0]]=(bySite[r[0]]||0)+1; });
  var siteName={}; rows_(SHEETS.SITES).forEach(function(s){ siteName[s.key]=s.name; });
  HISTORY_DATA.sites.forEach(function(s){ if(!siteName[s.key]) siteName[s.key]=s.name; });
  return {
    ok:true, done:done, version:HISTORY_VERSION,
    sites: Object.keys(bySite).map(function(k){ return { key:k, name:siteName[k]||k, total:bySite[k] }; })
                  .sort(function(a,b){ return b.total - a.total; })
  };
}

function api_importHistorySite(siteKey){
  rcReset_(); var u=resolveUser_(currentEmail_());
  if(u.role!=='admin') return { ok:false, error:'FORBIDDEN' };
  ensureHistorySites_();
  rcReset_();
  var sheet=logSheet_(siteKey); if(!sheet) return { ok:false, error:'NO_LOG_SHEET' };
  var ek=function(emp_id,name){ return String(emp_id||'').trim()+'|'+String(name||'').trim().replace(/\s+/g,' '); };
  var empMap={};
  rows_(SHEETS.EMP).forEach(function(e){ if(e.site_key===siteKey) empMap[ek(e.emp_id,e.name)]=e; });
  // existing dedup set
  var have={};
  readObjects_(sheet).rows.forEach(function(r){ have[String(r.eid)+'|'+r.date+'|'+r.kind]=true; });
  var now=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm');
  var newRows=[], unmatched=0;
  HISTORY_DATA.sup.forEach(function(r){
    if(r[0]!==siteKey) return;
    var emp = empMap[ek(r[1], r[2])]; if(!emp){ unmatched++; return; }
    var key = String(emp.eid)+'|'+r[3]+'|support';
    if(have[key]) return;
    have[key]=true;
    newRows.push([r[3], emp.eid, emp.emp_id||'', emp.name||'', 'support',
                  r[4]||'', '', '', r[5]||'', 'seed', now]);
  });
  HISTORY_DATA.op.forEach(function(r){
    if(r[0]!==siteKey) return;
    var emp = empMap[ek(r[1], r[2])]; if(!emp){ unmatched++; return; }
    var key = String(emp.eid)+'|'+r[3]+'|operation';
    if(have[key]) return;
    have[key]=true;
    newRows.push([r[3], emp.eid, emp.emp_id||'', emp.name||'', 'operation',
                  '', r[4]||'', Number(r[5])||0, '', 'seed', now]);
  });
  if(newRows.length){
    var idx = sheet.getLastRow()+1;
    for(var i=0;i<newRows.length;i+=2000){
      var chunk=newRows.slice(i,i+2000);
      sheet.getRange(idx,1,chunk.length,chunk[0].length).setValues(chunk);
      idx += chunk.length;
    }
  }
  return { ok:true, imported:newRows.length, unmatched:unmatched };
}

function api_finalizeHistory(){
  rcReset_(); var u=resolveUser_(currentEmail_());
  if(u.role!=='admin') return { ok:false, error:'FORBIDDEN' };
  var cfgSh=sh_(SHEETS.CONFIG);
  var found=false; readObjects_(cfgSh).rows.forEach(function(r){
    if(r.key==='HISTORY_VERSION'){ cfgSh.getRange(r._row,2).setValue(HISTORY_VERSION); found=true; }
  });
  if(!found) cfgSh.appendRow(['HISTORY_VERSION', HISTORY_VERSION]);
  return { ok:true };
}

/* ============================ AUTH (read-only) ============================ */
function currentEmail_(){ return (Session.getActiveUser().getEmail()||'').toLowerCase(); }

/* Resolve the caller WITHOUT writing to the Sheet (so users without edit
   access never make bootstrap hang). admin ← Config ADMIN_EMAILS;
   manager ← a row in Users; otherwise role 'none'. */
function resolveUser_(email){
  // OPEN ACCESS: every signed-in Google account gets full admin access to the
  // entire app — all tabs (dashboard/entry/index/users), all sites, full edit.
  // The whole web app still requires a Google login (manifest access=ANYONE);
  // there is no per-part locking. To restore role-based access later, bring back
  // the ADMIN_EMAILS / Users-sheet lookups and a viewer fallback here.
  return { email: email || '(guest)', role:'admin', site_key:'' };
}
function scopedSiteKeys_(u){
  var sites=rows_(SHEETS.SITES);
  if(u.role==='admin') return sites.map(function(s){return s.key;});
  if(u.role==='viewer') return sites.map(function(s){return s.key;});  // dashboard-only, read-only
  // ⚠ DEMO MODE: anonymous demo guest (manager role + empty email) gets all sites
  if(u.role==='manager' && (!u.email || u.email==='(demo guest)')) return sites.map(function(s){return s.key;});
  if(u.site_key){
    // managers may have one or many sites — comma-separated string
    return String(u.site_key).split(',').map(function(s){return s.trim();}).filter(String);
  }
  return [];
}
/* Gate for any endpoint that creates or modifies log/index data. Viewers and
   unknown roles are FORBIDDEN. */
function requireEntry_(){
  var u=resolveUser_(currentEmail_());
  if(u.role!=='admin'&&u.role!=='manager') throw new Error('FORBIDDEN');
  return u;
}
/* Gate for read-only data the dashboard needs (viewers allowed). */
function requireView_(){
  var u=resolveUser_(currentEmail_());
  if(u.role==='none') throw new Error('FORBIDDEN');
  return u;
}
function empByEid_(eid){ var f=null; rows_(SHEETS.EMP).forEach(function(e){ if(String(e.eid)===String(eid)) f=e; }); return f; }
function siteName_(key){ var n=key; rows_(SHEETS.SITES).forEach(function(s){ if(s.key===key) n=s.name; }); return n; }

/* ----- ONE-TIME demo data seeder (run from editor or `clasp run`) -----------
   Fills realistic composite codes into EMPTY "AM N" cells for recent weekdays
   of June 2569, so the Overview/dashboard show data. Non-destructive: never
   overwrites a cell that already has a value. NOT on the boot path. ----------*/
function rnd_(s){ var x=Math.sin(s)*10000; return x-Math.floor(x); }
function seedDemoData(siteMatch, year, month, overwrite){
  siteMatch = siteMatch || 'บางเตย'; year = year || 2026; month = month || 6;
  var site=null;
  rows_(SHEETS.SITES).forEach(function(s){ if((s.key===siteMatch || String(s.name||'').indexOf(siteMatch)>=0) && !site) site=s; });
  if(!site) return 'NO SITE '+siteMatch;
  var sh=ensureWideTab_(site.key, year, month);
  if(!sh) return 'NO TAB for '+site.key;
  // Work code → {mapping, fixed cost}. one-to-one types use their fixed cost;
  // one-to-many pick a random cost. Mirrors the real two-step picker.
  var workMeta={}, workCodes=[];
  rows_(SHEETS.INDEX).forEach(function(r){ var c=String(r.code||'').trim(); if(!c) return;
    workMeta[c]={ mapping:String(r.mapping||'one-to-many'), fixed:String(r.fixed_cost||'') }; workCodes.push(c); });
  var costs=rows_(SHEETS.COST).map(function(r){return String(r.code||'').trim();}).filter(String);
  if(!workCodes.length || !costs.length) return 'NO CODES';
  var roster=rows_(SHEETS.EMP).filter(function(e){ return e.site_key===site.key; });
  if(!roster.length) return 'NO ROSTER for '+site.key;

  var width=wideHeaders_().length;   // full wide width incl. the PM (2nd-task) block
  var values=sh.getDataRange().getValues();
  for(var pr=0; pr<values.length; pr++){ while(values[pr].length < width) values[pr].push(''); }
  var rowIdx={}; for(var r=1;r<values.length;r++){ var id=String(values[r][0]||'').trim(); if(id) rowIdx[id]=r; }
  // append a row (in-memory) for any rostered employee not yet in the tab
  roster.forEach(function(e){
    if(rowIdx[String(e.eid)]==null){
      var row=[]; for(var k=0;k<width;k++) row.push('');
      row[0]=e.eid; row[1]=e.emp_id||''; row[2]=e.name||''; row[3]=e.kind||'support'; row[4]=e.department||'';
      values.push(row); rowIdx[String(e.eid)]=values.length-1;
    }
  });
  // fill days = all weekdays of the month up to today (no weekends, no future)
  var today=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd');
  var dim=new Date(year, month, 0).getDate();
  var fillDays=[];
  for(var d=1; d<=dim; d++){
    var dow=new Date(year, month-1, d).getDay();      // 0 Sun … 6 Sat
    if(dow===0 || dow===6) continue;
    var ds=year+'-'+('0'+month).slice(-2)+'-'+('0'+d).slice(-2);
    if(ds>today) continue;
    fillDays.push(d);
  }
  var writes=0;
  roster.forEach(function(e){
    var ri=rowIdx[String(e.eid)]; if(ri==null) return;
    // ONE task per day only: wipe the entire 2nd-task (PM) block for this row.
    if(overwrite){ for(var pd=1; pd<=31; pd++){ values[ri][pmColIndex_(pd)-1]=''; } }
    fillDays.forEach(function(d){
      var col=wideColIndex_(d,'v'), seed=(ri+1)*100+d;
      var chosen = rnd_(seed) <= 0.82;                 // ~82% of weekdays worked
      if(!chosen){ if(overwrite) values[ri][col-1]=''; return; }   // gaps -> empty
      if(!overwrite && String(values[ri][col-1]||'').trim()) return;
      var wc=workCodes[Math.floor(rnd_(seed+0.11)*workCodes.length)];
      var meta=workMeta[wc]||{mapping:'one-to-many',fixed:''};
      var composite = (meta.mapping==='one-to-one')
        ? (meta.fixed ? (wc+' / '+meta.fixed) : wc)
        : (wc+' / '+costs[Math.floor(rnd_(seed+0.22)*costs.length)]);
      values[ri][col-1]=composite; writes++;
    });
  });
  if(values.length > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), values.length - sh.getMaxRows());
  sh.getRange(1,1,values.length,width).setValues(values);   // ONE batched write
  return site.key+': '+writes+' cells, '+roster.length+' emp';
}
// Seed the same month across every site (one batched write each).
function seedDemoAllSites(year, month, overwrite){
  year=year||2026; month=month||6;
  return rows_(SHEETS.SITES).map(function(s){ try { return seedDemoData(s.key, year, month, overwrite); } catch(e){ return s.key+': ERR '+(e&&e.message||e); } }).join(' | ');
}

/* ============================ WEB APP ENTRY ============================ */
function doGet(){
  return HtmlService.createHtmlOutput(PAGE_HTML_)
    .setTitle('VCB HR Daily Operations Log')
    .addMetaTag('viewport','width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function api_bootstrap(){
  try { rcReset_(); return _api_bootstrap_(); }
  catch(e){ return { ok:false, error:'SERVER: '+(e&&e.message?e.message:e) }; }
}
function _api_bootstrap_(){
  if(!sh_(SHEETS.EMP)||!sh_(SHEETS.SITES)||!sh_(SHEETS.CONFIG)) return { ok:false, error:'NO_SETUP' };
  // For access=ANYONE + executeAs=USER_DEPLOYING, Apps Script hides external
  // (non-domain) users' emails from the script for privacy. We treat such
  // users as anonymous viewers — they get the dashboard read-only, no role
  // lookup. Domain users still get their normal email/role resolution.
  var _email = '';
  try { _email = currentEmail_() || ''; } catch(e){}
  var _anon = !_email;
  var _cache = (function(){ try { return CacheService.getUserCache(); } catch(e){ return null; } })();
  var _cacheKey = _anon ? 'boot|anon' : ('boot|' + _email);
  if(_cache){
    try { var hit = _cache.get(_cacheKey); if(hit) return JSON.parse(hit); }
    catch(e){}
  }
  ensureSync_();          // auto-add any missing sites/teams/employees from FULL_ROSTER
  ensureMasterIndex_();   // create + seed the Master Work Index if needed
  ensureVcbIndexes_();    // one-time: load the VCB 44 Work Types + 20 Cost Types
  rcReset_();             // reread sheets after possible writes
  // OPEN ACCESS: every signed-in user (even those whose email Apps Script hides)
  // gets full admin access to the whole app. Login is still required via the
  // manifest (access=ANYONE); there is no per-part locking.
  var u = _anon
    ? { email:'(guest)', role:'admin', site_key:'' }
    : resolveUser_(_email);
  var keys = _anon
    ? rows_(SHEETS.SITES).map(function(s){ return s.key; })   // demo: all sites
    : scopedSiteKeys_(u);
  var sites=rows_(SHEETS.SITES).filter(function(s){ return keys.indexOf(s.key)>=0; })
    .map(function(s){ return { key:s.key, name:s.name }; });
  var result = { ok:true, email:_email, role:u.role,
    isAdmin: u.role==='admin',
    canEntry: u.role==='admin' || u.role==='manager',
    sites: sites };
  if(_cache){ try { _cache.put(_cacheKey, JSON.stringify(result), 300); } catch(e){} }
  return result;
}

function api_employees(siteKey,kind){
  rcReset_(); var u=requireEntry_();
  if(scopedSiteKeys_(u).indexOf(siteKey)<0) return [];
  return rows_(SHEETS.EMP)
    .filter(function(e){ return e.site_key===siteKey && (kind==='operation'? e.kind==='operation' : e.kind!=='operation'); })
    .map(function(e){ return { eid:e.eid, name:e.name, emp_id:e.emp_id, department:e.department, position:e.position }; })
    .sort(function(a,b){ return String(a.name).localeCompare(String(b.name),'th'); });
}

/* === Wide month grid: ALL employees of a site × all days of month === */
/* Per-cell map of back-dated edits for a month, from the AuditLog. A cell is
   flagged when an ALREADY-GRAYED-OUT (locked) cell was edited AFTER it locked —
   i.e. the admin used the "แก้ไขย้อนหลัง" override. This counts BOTH corrections
   of an existing value AND filling a previously-blank locked cell. Edits made
   while the cell was still within the 3-day window are NOT flagged. Keyed
   "eid|YYYY-MM-DD" → latest { date, by }. Best-effort: failure yields {}. */
function readMonthRetroEdits_(siteKey, year, month, lockDays, today){
  var out = {}, tz = Session.getScriptTimeZone();
  try{
    var sh = ss_().getSheetByName(SHEETS.AUDIT); if(!sh) return out;
    var last = sh.getLastRow(); if(last < 2) return out;
    var vals = sh.getRange(2, 1, last-1, HEADERS.AuditLog.length).getValues();
    var mm = ('0'+month).slice(-2);
    // A cell is "grayed/locked now" iff its date is strictly before this cutoff.
    var cutMs = new Date(today+'T00:00:00').getTime() - lockDays*86400000;
    for(var i=0;i<vals.length;i++){
      var r = vals[i];   // 0 ts,1 email,2 site,3 year,4 month,5 eid,6 name,7 day,8 field,9 old,10 new
      if(String(r[2])!==String(siteKey)) continue;
      if(Number(r[3])!==Number(year) || Number(r[4])!==Number(month)) continue;
      var dayN = Number(r[7]); if(!dayN) continue;
      // ts comes back from Sheets as a Date object (coerced), NOT the stored string,
      // so derive the edit date robustly from either form.
      var raw = r[0], editMs, editDate;
      if(raw instanceof Date){ editMs = raw.getTime(); editDate = Utilities.formatDate(raw, tz, 'yyyy-MM-dd'); }
      else { editDate = String(raw||'').slice(0,10); editMs = new Date(editDate+'T00:00:00').getTime(); }
      if(!editDate || isNaN(editMs)) continue;
      var cellDate = year+'-'+mm+'-'+('0'+dayN).slice(-2);
      var cellMs = new Date(cellDate+'T00:00:00').getTime();
      // (1) cell must be grayed/locked NOW (past the 3-day window), AND
      // (2) the change must have happened AFTER it locked (the back-date override).
      if(cellMs >= cutMs) continue;
      var diffDays = Math.round((new Date(editDate+'T00:00:00').getTime() - cellMs) / 86400000);
      if(diffDays <= lockDays) continue;
      var key = String(r[5])+'|'+cellDate, prev = out[key];
      if(!prev || editMs > prev.ms){ out[key] = { ms:editMs, date:editDate, by:String(r[1]||'') }; }
    }
  }catch(e){}
  return out;
}
/* One-time: split Z-2 ลา into Z-2 (ลาป่วย/ลากิจ) + new Z-3 ลาออก. Index-only,
   additive — no cell rewrite (existing Z-2 entries stay as generic leave). */
function migrateZ3_(){
  var ss=ss_(), report={updatedZ2:false, addedZ3:false};
  var mi=ss.getSheetByName(SHEETS.INDEX); if(!mi) return report;
  var data=mi.getDataRange().getValues();
  var z2Row=-1, hasZ3=false, maxId=0;
  for(var r=1;r<data.length;r++){
    var code=String(data[r][1]||'').trim();
    if(code==='Z-2') z2Row=r;
    if(code==='Z-3') hasZ3=true;
    var idn=Number(data[r][0])||0; if(idn>maxId) maxId=idn;
  }
  if(z2Row>=0){
    mi.getRange(z2Row+1,3).setValue('ลา');
    mi.getRange(z2Row+1,4).setValue('Leave · ลาป่วย / ลากิจ');
    report.updatedZ2=true;
  }
  if(!hasZ3){
    mi.appendRow([maxId+1,'Z-3','ลาออก','Resignation · พนักงานลาออกจากงาน','Z · ไม่ปฏิบัติงาน','','one-to-one','']);
    report.addedZ3=true;
  }
  return report;
}
function api_siteMonth(siteKey, year, month){
  rcReset_(); var u=requireEntry_();
  if(scopedSiteKeys_(u).indexOf(siteKey)<0) return { ok:false, error:'FORBIDDEN' };
  try { ensureVcbIndexes_(); } catch(e){}   // one-time seed — must never break the grid load
  rcReset_();
  // Migration-aware roster. An employee is shown at this site for any day on which
  // they BELONG to it (empSiteOn_). That includes people who later moved away (their
  // early days here) and people who moved in mid-month (their later days). Each
  // carries `away` (days they're elsewhere → greyed) + movedIn/Out markers.
  var migsByEid = readMigrations_();
  var monthDays = daysInMonth_(year, month);
  var firstD = monthDays[0].date, lastD = monthDays[monthDays.length-1].date;
  var siteNm = siteSheetMap_();
  var emps = [];
  rows_(SHEETS.EMP).forEach(function(e){
    var migs = migsByEid[e.eid] || [];
    if(!migs.length && e.site_key !== siteKey) return;   // fast path: never here
    var away = [], anyHere = false;
    monthDays.forEach(function(day){
      if(empSiteOn_(e.site_key, migs, day.date) === siteKey) anyHere = true;
      else away.push(day.date);
    });
    if(!anyHere) return;   // not at this site on any day this month
    var movedIn='', movedInFrom='', movedOut='', movedOutTo='';
    migs.forEach(function(mg){
      if(mg.date < firstD || mg.date > lastD) return;
      if(mg.to === siteKey){ movedIn = mg.date; movedInFrom = siteNm[mg.from] || mg.from || ''; }
      if(mg.from === siteKey){ movedOut = mg.date; movedOutTo = siteNm[mg.to] || mg.to || ''; }
    });
    emps.push({ eid:e.eid, name:e.name, emp_id:e.emp_id, department:e.department,
      position:e.position, kind:e.kind||'support',
      away:away, movedIn:movedIn, movedInFrom:movedInFrom, movedOut:movedOut, movedOutTo:movedOutTo });
  });
  emps.sort(function(a,b){
    if(a.kind!==b.kind) return a.kind==='operation' ? -1 : 1;
    return String(a.name).localeCompare(String(b.name),'th');
  });
  // entries: read directly from the per-month wide tab. readWideMonth_
  // returns {employees, entries} — we use its entries; the employees list
  // already comes from the master roster above so newly-added employees
  // show up immediately even if they have no data in the wide tab yet.
  var entries = readWideMonth_(siteKey, year, month).entries;
  // Operation dropdown source: the consolidated MasterIndex (controlled vocab).
  // Shared across all sites — the client renders a custom searchable picker
  // anchored to the cell so admins can scan/filter quickly without scrolling
  // through a tall native combobox.
  var teams = rows_(SHEETS.INDEX).map(function(t){
    return { name:t.name, desc:t.desc, code:t.code, category:t.category, sites:String(t.sites||''),
             mapping:String(t.mapping||'one-to-many'), fixed_cost:String(t.fixed_cost||''),
             allowed_cost:String(t.allowed_cost||'') };
  }).sort(function(a,b){
    var ca=String(a.category||'~'), cb=String(b.category||'~');
    if(ca!==cb) return ca.localeCompare(cb,'th');
    return cmpCode_(a.code, b.code);   // within a group: A-1, A-2, … A-10 (by code)
  });
  var today=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd');
  var lockDays=Number(getConfig_('LOCK_DAYS')||3);
  return { ok:true, days:monthDays, employees:emps, entries:entries,
           teams:teams, costs:costItems_(), today:today, lockDays:lockDays,
           edits:readMonthRetroEdits_(siteKey, year, month, lockDays, today) };
}

/* batched autosave from the grid — each item = {eid, kind, date, fields:{...}}.
   Cells whose date is older than (today - LOCK_DAYS) are read-only and silently
   skipped here for non-admins (the client already greys them out). */
function api_saveCells(siteKey, items){
  try { return _api_saveCells_(siteKey, items); }
  catch(e){ return { ok:false, error:'SERVER: '+(e&&e.message?e.message:e) }; }
}
function _api_saveCells_(siteKey, items){
  rcReset_(); var u=requireEntry_();
  if(scopedSiteKeys_(u).indexOf(siteKey)<0) return { ok:false, error:'FORBIDDEN' };
  if(!items || !items.length) return { ok:true, saved:0 };
  var isAdmin = u.role==='admin';
  var lockDays = Number(getConfig_('LOCK_DAYS')||3);
  var today=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd');
  var cutoff = (function(){
    var d=new Date(today+'T00:00:00'); d.setDate(d.getDate()-lockDays);
    return Utilities.formatDate(d,Session.getScriptTimeZone(),'yyyy-MM-dd');
  })();
  // Can't fill more than one day ahead (no pre-filling the future) — enforced for
  // EVERYONE so the month can't be filled before it happens.
  var ahead = (function(){
    var d=new Date(today+'T00:00:00'); d.setDate(d.getDate()+1);
    return Utilities.formatDate(d,Session.getScriptTimeZone(),'yyyy-MM-dd');
  })();
  // 3-day back-lock (non-admins) + 1-day-ahead cap (all): drop out-of-window items
  var locked = 0;
  var allowed = items.filter(function(it){
    if(String(it.date) > ahead){ locked++; return false; }                 // future cap (all)
    if(!isAdmin && String(it.date) < cutoff){ locked++; return false; }     // back-lock (non-admin)
    return true;
  });
  var lock=LockService.getScriptLock(); lock.waitLock(20000);
  try{
    var result = writeWideCells_(siteKey, allowed);
    // Invalidate the per-user dashboard cache for the affected months so the
    // dashboard reflects the new entries immediately.
    try {
      var cache = CacheService.getUserCache();
      var months = {};
      allowed.forEach(function(it){
        var d=String(it.date); if(d.length<7) return;
        months[Number(d.slice(0,4))+'|'+Number(d.slice(5,7))] = true;
      });
      Object.keys(months).forEach(function(k){
        var p=k.split('|');
        cache.remove('admSum9|' + currentEmail_() + '|' + p[0] + '|' + p[1]);
      });
    } catch(e){}
    return { ok:true, saved: result.saved, locked: locked };
  } finally { lock.releaseLock(); }
}

/* HR adds an ad-hoc employee from the grid's "+ เพิ่มพนักงาน" button */
/* ===================== Employee site migrations ===================== */
function ensureMigSheet_(){
  var ss=ss_(), sh=ss.getSheetByName(SHEETS.MIG);
  if(!sh){
    sh=ss.insertSheet(SHEETS.MIG);
    sh.appendRow(HEADERS.Migrations); sh.setFrozenRows(1);
    sh.getRange(1,1,1,HEADERS.Migrations.length).setFontWeight('bold').setBackground('#1d4e89').setFontColor('#ffffff');
  }
  return sh;
}
// { eid: [ {from,to,date} ... ] } sorted ascending by date
function readMigrations_(){
  var out={};
  try{
    var sh=ss_().getSheetByName(SHEETS.MIG); if(!sh) return out;
    var last=sh.getLastRow(); if(last<2) return out;
    var vals=sh.getRange(2,1,last-1,HEADERS.Migrations.length).getValues(), tz=Session.getScriptTimeZone();
    vals.forEach(function(r){
      var eid=String(r[0]||'').trim(); if(!eid) return;
      // date may come back as a Date object (Sheets coercion) or a string
      var raw=r[3], date = (raw instanceof Date) ? Utilities.formatDate(raw, tz, 'yyyy-MM-dd') : String(raw||'').slice(0,10);
      if(date.length<10) return;
      (out[eid]=out[eid]||[]).push({from:String(r[1]||''), to:String(r[2]||''), date:date});
    });
    Object.keys(out).forEach(function(k){ out[k].sort(function(a,b){ return a.date<b.date?-1:(a.date>b.date?1:0); }); });
  }catch(e){}
  return out;
}
// The site an employee belongs to ON a given day, given their CURRENT site_key
// and their date-sorted migration list. By construction this is single-valued, so
// an employee can never be at two sites on the same day.
function empSiteOn_(currentSite, migs, dateISO){
  migs = migs || [];
  if(!migs.length) return currentSite;
  var site = migs[0].from || currentSite;      // origin, before the first move
  for(var i=0;i<migs.length;i++){ if(migs[i].date <= dateISO) site = migs[i].to; else break; }
  return site;
}
function isISODate_(s){
  s=String(s||''); if(s.length!==10 || s.charAt(4)!=='-' || s.charAt(7)!=='-') return false;
  var y=Number(s.slice(0,4)), m=Number(s.slice(5,7)), d=Number(s.slice(8,10));
  return y>2000 && m>=1 && m<=12 && d>=1 && d<=31;
}
function setEmpSite_(eid, site){
  var sh=sh_(SHEETS.EMP);
  readObjects_(sh).rows.forEach(function(r){ if(String(r.eid)===String(eid)) sh.getRange(r._row, 2).setValue(site); });   // col 2 = site_key
}
// highest sheet row of a migration for this eid (= the most recent move, since
// moves are appended in chronological order)
function lastMigRow_(eid){
  var sh=ss_().getSheetByName(SHEETS.MIG); if(!sh) return 0;
  var last=sh.getLastRow(); if(last<2) return 0;
  var vals=sh.getRange(2,1,last-1,1).getValues();
  for(var i=vals.length-1;i>=0;i--){ if(String(vals[i][0])===String(eid)) return i+2; }
  return 0;
}
/* Move an employee to another site effective `dateISO`. History at the old site
   stays put; from `dateISO` on, the employee belongs to the new site (and to no
   other on any given day). A move dated the SAME day as the most recent move is a
   CORRECTION of that move — moving back to where they came from UNDOES it, and a
   different destination REPLACES it — so you can move someone back the same day
   without stacking confusing entries. */
function api_migrateEmployee(eid, toSite, dateISO){
  rcReset_(); var u=requireEntry_();
  eid=String(eid||''); toSite=String(toSite||''); dateISO=String(dateISO||'').slice(0,10);
  if(!eid || !toSite || !isISODate_(dateISO)) return {ok:false, error:'MISSING'};
  var emp=empByEid_(eid); if(!emp) return {ok:false, error:'NO_EMP'};
  var fromSite=String(emp.site_key||'');
  if(!siteSheetMap_()[toSite]) return {ok:false, error:'NO_SITE'};
  var scoped=scopedSiteKeys_(u);
  if(scoped.indexOf(toSite)<0 || scoped.indexOf(fromSite)<0) return {ok:false, error:'FORBIDDEN'};
  if(toSite===fromSite) return {ok:false, error:'SAME_SITE'};
  var migs=readMigrations_()[eid]||[];
  var lastMig=migs.length ? migs[migs.length-1] : null;
  if(lastMig && dateISO < lastMig.date) return {ok:false, error:'DATE_TOO_EARLY'};
  var mig=ensureMigSheet_();
  // SAME-DAY correction of the most recent move
  if(lastMig && dateISO === lastMig.date){
    var rn=lastMigRow_(eid);
    if(toSite === lastMig.from){               // back to origin → the move never happened
      if(rn) mig.deleteRow(rn);
      setEmpSite_(eid, lastMig.from);
      return {ok:true, eid:eid, from:lastMig.from, to:lastMig.from, date:dateISO, reverted:true};
    }
    if(rn) mig.getRange(rn, 3).setValue(toSite);   // col 3 = to_site (keep original from_site)
    setEmpSite_(eid, toSite);
    return {ok:true, eid:eid, from:lastMig.from, to:toSite, date:dateISO, replaced:true};
  }
  // normal forward move
  mig.appendRow([eid, fromSite, toSite, dateISO, currentEmail_()||'(unknown)',
    Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm:ss')]);
  setEmpSite_(eid, toSite);
  return {ok:true, eid:eid, from:fromSite, to:toSite, date:dateISO};
}
/* Employee removal is intentionally NOT exposed — too risky on a public, all-admin
   app (an accidental click could wipe a person). Deleting a roster row, if ever
   truly needed, must be done by hand in the Employees sheet. */
function api_addEmployee(data){
  rcReset_(); var u=requireEntry_();
  data = data || {};
  if(!data.site_key || !data.name) return { ok:false, error:'MISSING' };
  if(scopedSiteKeys_(u).indexOf(data.site_key)<0) return { ok:false, error:'FORBIDDEN' };
  var sheet=sh_(SHEETS.EMP);
  var maxEid=0;
  readObjects_(sheet).rows.forEach(function(r){ var n=Number(r.eid)||0; if(n>maxEid) maxEid=n; });
  var newEid=maxEid+1;
  var kind=data.kind==='operation'?'operation':'support';
  sheet.appendRow([newEid, data.site_key, data.emp_id||'', data.name, data.position||'',
                   data.department||(kind==='operation'?'Operation':'สำนักงาน'),
                   kind, kind==='support'?'ฝ่ายสนับสนุน':'', '']);
  return { ok:true, eid:newEid };
}

function daysInMonth_(y,m){
  // วันหยุด = SUNDAY ONLY. Saturday is a normal working day (staff may work it
  // without OT), so it is NOT a weekend here and counts toward expected workdays.
  var out=[], d=new Date(y,m-1,1);
  while(d.getMonth()===m-1){
    out.push({ date:Utilities.formatDate(d,Session.getScriptTimeZone(),'yyyy-MM-dd'),
               dow:(d.getDay()+6)%7, weekend:d.getDay()===0 });
    d=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1);
  }
  return out;
}

function readMonthForEmp_(e,year,month){
  var prefix=year+'-'+('0'+month).slice(-2)+'-';
  var op=e.kind==='operation', entries={};
  logRowsForSite_(e.site_key).forEach(function(r){
    if(String(r.eid)===String(e.eid) && String(r.date).indexOf(prefix)===0){
      entries[r.date]= op ? {team:r.team,note:r.note} : {detail:r.work_detail,note:r.note};
    }
  });
  var teams=[];
  if(op) teams=rows_(SHEETS.TEAMS).filter(function(t){return t.site_key===e.site_key;}).map(function(t){return {name:t.name,desc:t.desc};});
  return { ok:true, kind:e.kind, eid:e.eid,
    emp:{ name:e.name, emp_id:e.emp_id, site_name:siteName_(e.site_key), department:e.department, position:e.position },
    days:daysInMonth_(year,month), entries:entries, teams:teams };
}

function writeMonthForEmp_(e,year,month,payload,byLabel){
  var lock=LockService.getScriptLock(); lock.waitLock(20000);
  try{
    var sheet=logSheet_(e.site_key); if(!sheet) return { ok:false, error:'NO_LOG_SHEET' };
    var op=e.kind==='operation', index={};
    readObjects_(sheet).rows.forEach(function(r){ if(String(r.eid)===String(e.eid)) index[r.date]=r._row; });
    var now=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm');
    var appends=[], deletes=[];
    Object.keys(payload).forEach(function(date){
      var v=payload[date]||{};
      var hasContent= op
        ? (String(v.team||'').trim()!=='' || Number(v.ot||0)>0 || String(v.note||'').trim()!=='')
        : (String(v.detail||'').trim()!=='' || String(v.note||'').trim()!=='');
      var row=[date,e.eid,e.emp_id||'',e.name||'',e.kind,
        op?'':(v.detail||'').trim(), op?(v.team||'').trim():'', op?(Number(v.ot||0)||0):'',
        (v.note||'').trim(), byLabel, now];
      if(!hasContent){ if(index[date]) deletes.push(index[date]); }
      else if(index[date]) sheet.getRange(index[date],1,1,row.length).setValues([row]);
      else appends.push(row);
    });
    if(appends.length) sheet.getRange(sheet.getLastRow()+1,1,appends.length,appends[0].length).setValues(appends);
    deletes.sort(function(a,b){return b-a;}).forEach(function(r){ sheet.deleteRow(r); });
    return { ok:true };
  } finally { lock.releaseLock(); }
}

/* admin/manager record on behalf of any worker in their scope */
function api_getMonthFor(eid,year,month){
  rcReset_(); var u=requireEntry_(); var e=empByEid_(eid);
  if(!e) return { ok:false, error:'NOT_FOUND' };
  if(scopedSiteKeys_(u).indexOf(e.site_key)<0) return { ok:false, error:'FORBIDDEN' };
  return readMonthForEmp_(e,year,month);
}
function api_saveMonthFor(eid,year,month,payload){
  rcReset_(); var u=requireEntry_(); var e=empByEid_(eid);
  if(!e) return { ok:false, error:'NOT_FOUND' };
  if(scopedSiteKeys_(u).indexOf(e.site_key)<0) return { ok:false, error:'FORBIDDEN' };
  return writeMonthForEmp_(e,year,month,payload,currentEmail_());
}

/* ============================ DASHBOARD ============================ */
function api_adminSummary(year,month){
  rcReset_(); var u=requireView_(); var keys=scopedSiteKeys_(u);
  // 60-second per-user cache. Same user reloading the dashboard for the same
  // (year, month) within a minute gets the cached payload instantly instead
  // of triggering another O(sites × all-log-rows) scan. After 60s or after a
  // server-side write, the cache misses and we re-compute.
  var _cache = (function(){ try { return CacheService.getUserCache(); } catch(e){ return null; } })();
  var _cacheKey = 'admSum9|' + u.email + '|' + year + '|' + month;
  if(_cache){
    try { var hit = _cache.get(_cacheKey); if(hit) return JSON.parse(hit); }
    catch(e){}
  }
  var emps=rows_(SHEETS.EMP);
  var days = daysInMonth_(year,month);   // [{date, dow, weekend}]
  var today=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd');
  // Normalized MasterIndex name set used to filter the งานหลัก chart down to
  // real work types. Anything NOT in MasterIndex (วันหยุด, วันแรงงาน, ลาป่วย,
  // etc.) is skipped from the activity tally — still counted in the overall
  // Fill Rate, just not in the per-activity breakdown. We normalize by
  // lowercasing AND collapsing all whitespace runs to a single space so
  // "Survey 1" matches "Survey  1" and "survey 1".
  function _norm(s){ return String(s||'').toLowerCase().replace(/\s+/g,' ').trim(); }
  var indexNames = {};
  var codeName = {};   // composite cells store CODES — map work code -> work-type name
  rows_(SHEETS.INDEX).forEach(function(t){
    var n = _norm(t.name);
    if(n) indexNames[n] = true;
    var c = _norm(t.code);
    if(c) codeName[c] = t.name;
  });
  var costName = {};   // cost code -> cost-code name (2nd half of the composite)
  rows_(SHEETS.COST).forEach(function(c){ var k=_norm(c.code); if(k) costName[k]=c.name; });
  // Resolve a slot value ("A-1 / 5" composite, or a legacy plain name) to its
  // work-type name, or '' if it isn't a real work type (holiday/leave/unknown).
  function workTypeOf_(slotVal){
    var s = String(slotVal||'').trim(); if(!s) return '';
    var wc = _norm(s.split('/')[0]);       // work-code part of the composite
    if(codeName[wc]) return codeName[wc];
    if(indexNames[_norm(s)]) return s;     // legacy: value already a name
    return '';
  }
  // Resolve the Work Category half of "A-1 / 5" → its name, or '' (e.g. Standby "Z").
  function costCodeOf_(slotVal){
    var s = String(slotVal||''); var i = s.indexOf('/'); if(i < 0) return '';
    var cc = _norm(s.slice(i+1)); return costName[cc] || '';
  }
  // Top 5 of a {name: manday-weight} map + an "อื่นๆ" tail, with % of the matched total.
  // FULL sorted list (desc by mandays) with each item's manday weight + % of the
  // dimension total. The client shows the top 5 and an expand button reveals the rest.
  function topN_(countMap){
    var sorted = Object.keys(countMap).map(function(n){ return { name:n, count:countMap[n] }; })
      .sort(function(a,b){ return b.count - a.count; });
    var total = 0; sorted.forEach(function(a){ total += a.count; });
    return sorted.map(function(a){
      return { name:a.name, count:Math.round(a.count*10)/10, pct: total>0 ? Math.round(a.count/total*100) : 0 };
    });
  }
  var rows=rows_(SHEETS.SITES).filter(function(s){return keys.indexOf(s.key)>=0;}).map(function(s){
    var se=emps.filter(function(e){return e.site_key===s.key;});
    var nSup=se.filter(function(e){return e.kind!=='operation';}).length;
    var nOp =se.filter(function(e){return e.kind==='operation';}).length;
    var n_emp = nSup + nOp;
    var startSup={}, startOp={}, entries=0;
    var perDay={}; days.forEach(function(d){ perDay[d.date]={}; });
    var actCount = {};   // for กิจกรรม (top activities) view
    var costCount = {};  // for หมวดงาน (top cost codes) view — same manday weights
    // Read the per-month wide tab once per site (instead of scanning all rows
    // of the long-format tab). Each wide tab is ~50–100 rows max so this is
    // dramatically cheaper for large sites with months of history.
    var widePack = readWideMonth_(s.key, year, month);
    // Build a quick eid → kind lookup from the master roster
    var kindOf = {}; se.forEach(function(e){ kindOf[String(e.eid)] = e.kind || 'support'; });
    Object.keys(widePack.entries).forEach(function(eid){
      var byDate = widePack.entries[eid];
      var kind = kindOf[eid] || (widePack.employees.find(function(x){ return String(x.eid)===String(eid); }) || {}).kind || 'support';
      Object.keys(byDate).forEach(function(date){
        var v = byDate[date];
        entries++;
        if(kind === 'operation') startOp[eid] = true;
        else                     startSup[eid] = true;
        if(perDay[date]) perDay[date][eid] = true;
        // Manday weighting: a day is worth 1 manday, split across the tasks
        // logged that day — งานหลัก (primary) + งานเสริม (secondary/pm). Two tasks
        // → 0.5 each (1.0 total); one task → 1.0. So top-activities sums REAL
        // mandays and a 2-task day is never mistaken for 2 mandays. Only values
        // resolving to a real MasterIndex work type count (holidays/leaves skip).
        var primary   = (kind === 'operation') ? v.team : v.detail;
        var secondary = v.pm;
        var slots = [];
        if(String(primary||'').trim())   slots.push(primary);
        if(String(secondary||'').trim()) slots.push(secondary);
        var w = slots.length ? (1 / slots.length) : 0;
        slots.forEach(function(sv){
          var nm = workTypeOf_(sv);
          if(nm) actCount[nm] = (actCount[nm] || 0) + w;
          var cn = costCodeOf_(sv);
          if(cn) costCount[cn] = (costCount[cn] || 0) + w;
        });
      });
    });
    var daysFilled = days.map(function(d){
      return { date:d.date, weekend:d.weekend, filled:Object.keys(perDay[d.date]||{}).length, total:n_emp };
    });
    // Top 5 by manday weight (+ "อื่นๆ" tail), for both dimensions. Percentages
    // are out of each dimension's matched total so the bars sum to ~100%.
    var topActivities = topN_(actCount);
    var topCostCodes  = topN_(costCount);
    // Fill completeness = entries / (employees × WORKDAYS already passed).
    // Weekends are rest days (พัก), so they're excluded from "expected" — otherwise
    // the rate is understated (looks low even when every workday is filled).
    var workdaysPassed = 0;
    days.forEach(function(d){ if(d.date <= today && !d.weekend) workdaysPassed++; });
    var fillTotal = n_emp * workdaysPassed;
    var fillRate = fillTotal > 0 ? Math.min(100, Math.round(entries / fillTotal * 100)) : 0;
    return { site_key:s.key, site_name:s.name, company:s.company, n_emp:n_emp,
      n_support:nSup, n_operation:nOp,
      support_started:Object.keys(startSup).length, operation_started:Object.keys(startOp).length,
      entries:entries,
      fillRate: fillRate, fillRateDenom: fillTotal,
      daysFilled:daysFilled,
      topActivities: topActivities, topCostCodes: topCostCodes };
  });
  // Show ALL sites the user has access to, including those with zero entries
  // this month. Empty cards still display the ring at 0% so the dashboard
  // doesn't look bland and the user knows where to start recording.
  // sort by largest first so big sites show on top
  rows.sort(function(a,b){ return b.n_emp - a.n_emp; });
  var result = { rows:rows, today:today, days:days, lockDays:Number(getConfig_('LOCK_DAYS')||3) };
  if(_cache){ try { _cache.put(_cacheKey, JSON.stringify(result), 60); } catch(e){} }
  return result;
}

/* ============================ USERS (admin) ============================ */
function api_adminListUsers(){
  rcReset_(); var u=resolveUser_(currentEmail_());
  if(u.role!=='admin') throw new Error('FORBIDDEN');
  var sites=rows_(SHEETS.SITES);
  return {
    sites: sites.map(function(s){ return { key:s.key, name:s.name }; }),
    users: rows_(SHEETS.USERS).map(function(r){ return { email:r.email, role:r.role, site_key:r.site_key }; })
  };
}
function api_adminSetUser(email,role,siteKey){
  rcReset_(); var u=resolveUser_(currentEmail_());
  if(u.role!=='admin') throw new Error('FORBIDDEN');
  email=String(email||'').trim().toLowerCase();
  if(!email) return { ok:false };
  // siteKey is a comma-separated list of site keys for managers (multi-site
  // delegation). Admins ignore it — they always have all sites via resolveUser_.
  var normalizedSites = String(siteKey||'').split(',')
    .map(function(s){return s.trim();}).filter(String).join(',');
  var sheet=sh_(SHEETS.USERS), rec=null;
  readObjects_(sheet).rows.forEach(function(r){ if(String(r.email).toLowerCase()===email) rec=r; });
  if(rec){ sheet.getRange(rec._row,2).setValue(role); sheet.getRange(rec._row,3).setValue(normalizedSites); }
  else sheet.appendRow([email, role||'manager', normalizedSites, '']);
  return { ok:true };
}
function api_adminDeleteUser(email){
  rcReset_(); var u=resolveUser_(currentEmail_());
  if(u.role!=='admin') throw new Error('FORBIDDEN');
  email=String(email||'').trim().toLowerCase();
  if(!email) return { ok:false };
  var sheet=sh_(SHEETS.USERS);
  var rows=readObjects_(sheet).rows;
  // Iterate from bottom up so deleting doesn't shift indexes we still need
  for(var i=rows.length-1; i>=0; i--){
    if(String(rows[i].email).toLowerCase()===email) sheet.deleteRow(rows[i]._row);
  }
  return { ok:true };
}

/* ============================ AUDIT LOG (admin) ============================ */
/* Returns the most recent `limit` audit rows, newest first. Reads only the tail
   of the AuditLog tab (one getRange) so it stays fast as the log grows. */
function api_auditLog(limit){
  rcReset_(); var u=resolveUser_(currentEmail_());
  if(u.role!=='admin') throw new Error('FORBIDDEN');
  var n = Math.max(1, Math.min(2000, Number(limit)||1000));
  var sh = sh_(SHEETS.AUDIT);
  if(!sh) return { ok:true, rows:[] };       // tab not created yet (no edits since @96)
  var last = sh.getLastRow();
  if(last < 2) return { ok:true, rows:[] };  // header only
  var take = Math.min(n, last - 1);
  var startRow = last - take + 1;            // tail = the newest `take` data rows
  var vals = sh.getRange(startRow, 1, take, HEADERS.AuditLog.length).getValues();
  var tz = Session.getScriptTimeZone();
  var fmtTs = function(x){
    // Sheets coerces our 'yyyy-MM-dd HH:mm:ss' string into a Date cell on write;
    // normalize back to a clean string so the UI never shows a raw Date.toString.
    if(x instanceof Date) return Utilities.formatDate(x, tz, 'yyyy-MM-dd HH:mm:ss');
    return String(x);
  };
  var rows = vals.map(function(r){
    return { ts:fmtTs(r[0]), email:String(r[1]), site:String(r[2]),
             year:r[3], month:r[4], eid:r[5], emp_name:String(r[6]),
             day:r[7], field:String(r[8]), old_val:String(r[9]), new_val:String(r[10]) };
  });
  rows.reverse();                            // newest first for display
  return { ok:true, rows:rows, total:last-1 };
}

/* Lock-window editor (Settings page). Reads/writes Config!LOCK_DAYS, the
   number of days back non-admins can still edit cells. Clamped to [0, 30]. */
function api_adminGetLockDays(){
  rcReset_(); var u=resolveUser_(currentEmail_());
  if(u.role!=='admin') throw new Error('FORBIDDEN');
  return { ok:true, lockDays: Number(getConfig_('LOCK_DAYS')||3) };
}
function api_adminSetLockDays(days){
  rcReset_(); var u=resolveUser_(currentEmail_());
  if(u.role!=='admin') throw new Error('FORBIDDEN');
  var n = Math.max(0, Math.min(30, Number(days)||0));
  var sheet=sh_(SHEETS.CONFIG), rows=readObjects_(sheet).rows, found=false;
  for(var i=0;i<rows.length;i++) if(rows[i].key==='LOCK_DAYS'){
    sheet.getRange(rows[i]._row, 2).setValue(String(n)); found=true; break;
  }
  if(!found) sheet.appendRow(['LOCK_DAYS', String(n)]);
  return { ok:true, lockDays:n };
}

/* Export any source sheet as an xlsx file preserving formatting (column widths,
   freeze, header colors). Approach: copy the source sheet into a throwaway
   spreadsheet, optionally run a transform on the COPY (e.g. drop columns),
   ask the Drive export endpoint for an .xlsx blob, then trash the temp file.
   Returns base64 so the client can trigger a download. Requires `drive` +
   `script.external_request` OAuth scopes (already in appsscript.json). */
function exportSheetAsXlsx_(sourceSheet, sheetDisplayName, fileLabel, transformCopy){
  if(!sourceSheet) return { ok:false, error:'NO_SHEET' };
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var tempSs = SpreadsheetApp.create('HR Export · ' + fileLabel + ' · ' + stamp);
  var tempId = tempSs.getId();
  try {
    var copy = sourceSheet.copyTo(tempSs).setName(sheetDisplayName);
    var def = tempSs.getSheetByName('Sheet1');
    if(def && tempSs.getSheets().length > 1) tempSs.deleteSheet(def);
    if(transformCopy){ transformCopy(copy); }
    SpreadsheetApp.flush();
    var response = UrlFetchApp.fetch(
      'https://docs.google.com/spreadsheets/d/' + tempId + '/export?format=xlsx',
      { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true }
    );
    if(response.getResponseCode() !== 200){
      return { ok:false, error:'EXPORT_HTTP_'+response.getResponseCode() };
    }
    return { ok:true,
      filename: 'HR ' + fileLabel + ' - ' + stamp + '.xlsx',
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      data: Utilities.base64Encode(response.getBlob().getBytes()) };
  } finally {
    try { DriveApp.getFileById(tempId).setTrashed(true); } catch(e){}
  }
}
function api_exportSiteXlsx(siteKey, year, month){
  rcReset_(); var u=requireEntry_();
  if(scopedSiteKeys_(u).indexOf(siteKey)<0) return { ok:false, error:'FORBIDDEN' };
  var siteName = siteSheetMap_()[siteKey];
  if(!siteName) return { ok:false, error:'NO_SITE' };
  // Default to the current month if year/month not provided (back-compat).
  if(!year || !month){
    var now = new Date();
    year = year || now.getFullYear();
    month = month || (now.getMonth()+1);
  }
  var tabName = wideTabName_(siteKey, year, month);
  var sh = ss_().getSheetByName(tabName);
  // For months with zero entries the wide tab doesn't exist yet. Rather than
  // failing with NO_DATA_FOR_MONTH, materialize an empty template so HR can
  // still hand a "starting point" workbook to whoever asks. The new tab gets
  // the standard header row + one row per scoped employee, with all day cells
  // blank. This costs a write on the DB sheet but only the first time anyone
  // exports that month, so it's a one-time amortized cost.
  if(!sh) sh = createEmptyMonthTab_(siteKey, year, month);
  if(!sh) return { ok:false, error:'NO_DATA_FOR_MONTH' };
  var be = year + 543, mm = ('0'+month).slice(-2);
  var label = siteName + ' ' + be + '-' + mm;
  // Clean export layout: ONE column per day. The raw wide tab interleaves a
  // mostly-empty "Note N" column per day and parks the 2nd-task (งานเสริม) block
  // at the far right ("PM N"). Instead we emit eid/emp_id/name/kind/department +
  // one "Day N" column per calendar day, each cell showing the composite code(s)
  // — งานหลัก, plus งานเสริม after a "+" when a 2nd task exists. No note columns.
  var wm = readWideMonth_(siteKey, year, month);
  var nDays = new Date(year, month, 0).getDate();   // 28..31 for this month
  var header = ['eid','emp_id','name','kind','department'];
  for(var dh = 1; dh <= nDays; dh++) header.push('Day ' + dh);
  var grid = wm.employees.map(function(e){
    var by = wm.entries[e.eid] || {};
    var rowArr = [e.eid, e.emp_id, e.name, e.kind, e.department];
    for(var d = 1; d <= nDays; d++){
      var ds = year + '-' + mm + '-' + ('0'+d).slice(-2);
      var c = by[ds], txt = '';
      if(c){
        var p = String((e.kind === 'operation' ? c.team : c.detail) || '').trim();
        var s = String(c.pm || '').trim();
        txt = (p && s) ? (p + '  +  ' + s) : (p || s);
      }
      rowArr.push(txt);
    }
    return rowArr;
  });
  var nCols = header.length, nRows = grid.length + 1;
  return exportSheetAsXlsx_(sh, label, 'Work Log - ' + label, function(copy){
    copy.clear();
    if(copy.getMaxColumns() > nCols) copy.deleteColumns(nCols + 1, copy.getMaxColumns() - nCols);
    if(copy.getMaxRows()    > nRows) copy.deleteRows(nRows + 1, copy.getMaxRows() - nRows);
    copy.getRange(1, 1, nRows, nCols).setValues([header].concat(grid));
    copy.setFrozenRows(1); copy.setFrozenColumns(5);
    copy.getRange(1, 1, 1, nCols).setFontWeight('bold')
      .setBackground('#1d4e89').setFontColor('#ffffff').setHorizontalAlignment('center');
    copy.setColumnWidth(3, 200);                       // name
    for(var cw = 6; cw <= nCols; cw++) copy.setColumnWidth(cw, 110);  // day columns
  });
}
/* Build an empty wide-format tab for a site/year/month and seed it with the
   site's employee roster. Used by export-on-empty-month so the user gets a
   useful Excel template even when no entries have been recorded yet. */
function createEmptyMonthTab_(siteKey, year, month){
  var sh = ensureWideTab_(siteKey, year, month);
  if(!sh) return null;
  // Already populated by a prior call? (defensive — ensureWideTab_ won't
  // duplicate, but in case future code touches it.)
  if(sh.getLastRow() > 1) return sh;
  var emps = rows_(SHEETS.EMP).filter(function(e){ return String(e.site_key)===String(siteKey); });
  if(!emps.length) return sh;
  var rowsOut = emps.map(function(e){
    var row = [ e.eid||'', e.emp_id||'', e.name||'', e.kind||'', e.department||'' ];
    // 31 days × WIDE_DAY_FIELDS.length (AM + note) + 31 PM columns — all blank
    for(var i=0; i<31*WIDE_DAY_FIELDS.length + 31; i++) row.push('');
    return row;
  });
  sh.getRange(2, 1, rowsOut.length, rowsOut[0].length).setValues(rowsOut);
  return sh;
}
function api_exportMasterIndexXlsx(){
  rcReset_(); var u=resolveUser_(currentEmail_());
  if(u.role!=='admin') return { ok:false, error:'FORBIDDEN' };
  return exportSheetAsXlsx_(sh_(SHEETS.INDEX), 'MasterIndex', 'Master Work Index');
}
function api_exportCostIndexXlsx(){
  rcReset_(); var u=resolveUser_(currentEmail_());
  if(u.role!=='admin') return { ok:false, error:'FORBIDDEN' };
  return exportSheetAsXlsx_(sh_(SHEETS.COST), 'CostIndex', 'Work Category Index');
}
/* A ready-to-fill Excel template for the bulk import (so users don't guess the
   columns). kind: 'activity' (default) | 'cost'. Headers match what the importer
   detects; one example row shows the expected content. */
function api_importTemplateXlsx(kind){
  rcReset_(); var u=resolveUser_(currentEmail_());
  if(u.role!=='admin') return { ok:false, error:'FORBIDDEN' };
  var isCost = (kind==='cost');
  var header  = isCost ? ['รหัส (Code)','ชื่อ-ไทย (Name)','ชื่อ-อังกฤษ (English)']
                       : ['ชื่อ (Name)','คำอธิบาย (Description)','หมวดหมู่ (Category)','รหัส (Code)'];
  var example = isCost ? [['21','งานตัวอย่าง','Example Work']]
                       : [['งานตัวอย่าง','รายละเอียดงานตัวอย่าง','A · งานก่อสร้างและติดตั้ง','A-99']];
  var label = isCost ? 'Work Category Import Template' : 'Activity Import Template';
  var data = [header].concat(example);
  var nCols = header.length, nRows = data.length;
  return exportSheetAsXlsx_(sh_(SHEETS.CONFIG), isCost?'CostTemplate':'ActivityTemplate', label, function(copy){
    copy.clear();
    if(copy.getMaxColumns() > nCols) copy.deleteColumns(nCols+1, copy.getMaxColumns()-nCols);
    if(copy.getMaxRows()    > nRows) copy.deleteRows(nRows+1, copy.getMaxRows()-nRows);
    copy.getRange(1,1,nRows,nCols).setValues(data);
    copy.getRange(1,1,1,nCols).setFontWeight('bold').setBackground('#1d4e89').setFontColor('#ffffff').setHorizontalAlignment('center');
    copy.getRange(2,1,1,nCols).setFontColor('#9aa5b4').setFontStyle('italic');   // example row, greyed
    copy.setFrozenRows(1);
    for(var c=1;c<=nCols;c++) copy.setColumnWidth(c, 220);
  });
}
/* Convert an uploaded .xlsx (raw bytes) into a 2-D array of cell strings.
   Apps Script can't read .xlsx directly, so we POST it to the Drive REST upload
   endpoint asking Drive to convert it to a Google Sheet, read the values, then
   trash the temp file. Uses the deployer's OAuth token (drive scope). Dates are
   formatted back to yyyy-MM-dd to dodge the Sheets date-coercion gotcha. */
function xlsxBytesToRows_(bytes){
  var boundary = '----vcbimp' + (new Date().getTime());
  var meta = JSON.stringify({ name:'__vcb_import_tmp', mimeType:'application/vnd.google-apps.spreadsheet' });
  var pre = '--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta + '\r\n'
          + '--'+boundary+'\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n';
  var post = '\r\n--'+boundary+'--';
  var payload = Utilities.newBlob(pre).getBytes().concat(bytes).concat(Utilities.newBlob(post).getBytes());
  var res = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method:'post', contentType:'multipart/related; boundary='+boundary,
    payload: payload, headers:{ Authorization:'Bearer '+ScriptApp.getOAuthToken() }, muteHttpExceptions:true
  });
  if(res.getResponseCode() !== 200) throw new Error('Drive upload ' + res.getResponseCode() + ': ' + String(res.getContentText()).slice(0,150));
  var id = JSON.parse(res.getContentText()).id;
  try{
    var sh = SpreadsheetApp.openById(id).getSheets()[0];
    var vals = sh.getDataRange().getValues();
    var tz = Session.getScriptTimeZone();
    return vals.map(function(r){ return r.map(function(c){
      if(c instanceof Date) return Utilities.formatDate(c, tz, 'yyyy-MM-dd');
      return (c==null) ? '' : String(c);
    }); });
  } finally {
    try{ DriveApp.getFileById(id).setTrashed(true); }catch(e){}
  }
}

/* File-based bulk import: the user downloads the template, fills it, and uploads
   the filled .xlsx (or .csv) — no copy/paste. We parse the file into rows and
   hand them to the existing text importers (tab-joined preserves columns). */
function api_importIndexFile(kind, base64, mime){
  rcReset_(); var u=resolveUser_(currentEmail_());
  if(u.role!=='admin') return { ok:false, error:'FORBIDDEN' };
  if(!base64) return { ok:false, error:'ไม่พบไฟล์' };
  var rows;
  try{
    var bytes = Utilities.base64Decode(base64);
    var isCsv = (mime && String(mime).toLowerCase().indexOf('csv')>=0);
    if(isCsv){
      var text = Utilities.newBlob(bytes).getDataAsString('UTF-8').replace(/^﻿/,'');
      rows = text.replace(/\r/g,'').split('\n').map(function(l){ return l.indexOf('\t')>=0 ? l.split('\t') : l.split(','); });
    } else {
      rows = xlsxBytesToRows_(bytes);
    }
  } catch(err){ return { ok:false, error:'อ่านไฟล์ไม่สำเร็จ — ' + String(err && err.message || err).slice(0,150) }; }
  if(!rows || !rows.length) return { ok:false, error:'ไฟล์ว่างเปล่า' };
  var text = rows.map(function(r){ return r.join('\t'); }).join('\n');
  return (kind==='cost') ? api_costImport(text) : api_masterImport(text);
}

/* Bulk import for the Work Category (CostIndex) tab. Columns: code, name(TH),
   name_en. Header auto-detected; upsert by code-or-name; blank code auto-numbers. */
function api_costImport(text){
  rcReset_(); var u=resolveUser_(currentEmail_());
  if(u.role!=='admin') return { ok:false, error:'FORBIDDEN' };
  var raw=String(text||'').replace(/\r/g,'');
  var lines=raw.split('\n').filter(function(l){ return String(l).trim()!==''; });
  if(!lines.length) return { ok:true, added:0, updated:0, skipped:0 };
  if(lines.length>2000) return { ok:false, error:'TOO_MANY (max 2000 rows)' };
  var parse=function(line){ var parts=line.indexOf('\t')>=0?line.split('\t'):line.split(','); return parts.map(function(p){ return String(p).trim(); }); };
  var first=parse(lines[0]).map(function(s){ return s.toLowerCase(); });
  var looksHeader=first.some(function(h){ return /(^|\b)(code|รหัส|name|ชื่อ|หมวด|english|eng|category)/.test(h); });
  var idx={ code:0, name:1, name_en:2 };
  if(looksHeader){
    idx={ code:-1, name:-1, name_en:-1 };
    first.forEach(function(h,i){
      if(idx.code<0 && /code|รหัส/.test(h)) idx.code=i;
      else if(idx.name_en<0 && /english|eng|category/.test(h)) idx.name_en=i;
      else if(idx.name<0 && /name|ชื่อ|หมวด/.test(h)) idx.name=i;
    });
    if(idx.name<0) idx.name=1;
  }
  var dataLines=looksHeader?lines.slice(1):lines;
  var skipped=0, items=[];
  dataLines.forEach(function(line){
    var p=parse(line);
    var name=String((idx.name>=0?p[idx.name]:'')||'').trim();
    if(!name){ skipped++; return; }
    if(name === 'งานตัวอย่าง') return;   // template's greyed example row — never import it
    items.push({ code: idx.code>=0?String(p[idx.code]||'').trim():'', name:name, name_en: idx.name_en>=0?(p[idx.name_en]||''):'' });
  });
  var seen={}, deduped=[];
  for(var i=items.length-1;i>=0;i--){ var it=items[i]; var key=it.code?('c:'+it.code):('n:'+it.name.toLowerCase()); if(seen[key]){ skipped++; continue; } seen[key]=true; deduped.unshift(it); }
  var sh=sh_(SHEETS.COST), rows=readObjects_(sh).rows;
  var byCode={}, byName={}, maxId=0, maxCode=0;
  rows.forEach(function(r){ var c=String(r.code||'').trim(); if(c){ byCode[c]=r; var cn=Number(c); if(!isNaN(cn)&&cn>maxCode) maxCode=cn; } byName[String(r.name||'').trim().toLowerCase()]=r; var n=Number(r.id)||0; if(n>maxId) maxId=n; });
  var added=0, updated=0, appends=[];
  deduped.forEach(function(it){
    var existing=(it.code&&byCode[it.code])?byCode[it.code]:byName[it.name.toLowerCase()];
    if(existing&&existing._row){
      sh.getRange(existing._row,1,1,4).setValues([[existing.id, it.code||String(existing.code||'').trim(), it.name, it.name_en]]);
      updated++;
    } else {
      maxId++; var code=it.code; if(!code){ maxCode++; code=String(maxCode); }
      appends.push([maxId, code, it.name, it.name_en]); added++;
    }
  });
  if(appends.length) sh.getRange(sh.getLastRow()+1,1,appends.length,4).setValues(appends);
  return { ok:true, added:added, updated:updated, skipped:skipped };
}

/* Manday rollup report for finance / ERP. For a month, across all scoped sites,
   totals mandays by Work Category (the ERP-mapped หมวดงาน code) and by Activity,
   with the same 50/50 manday weighting as the dashboard. Returns a 2-sheet xlsx. */
function api_exportMandayReport(year, month){
  rcReset_(); var u=requireView_(); var keys=scopedSiteKeys_(u);
  if(!year || !month){ var now=new Date(); year=year||now.getFullYear(); month=month||(now.getMonth()+1); }
  var codeName={}, costName={};   // lowercased code -> {code, name}
  rows_(SHEETS.INDEX).forEach(function(t){ var c=String(t.code||'').trim(); if(c) codeName[c.toLowerCase()]={code:c, name:String(t.name||'')}; });
  rows_(SHEETS.COST).forEach(function(c){ var k=String(c.code||'').trim(); if(k) costName[k.toLowerCase()]={code:k, name:String(c.name||'')}; });
  var emps=rows_(SHEETS.EMP);
  var sites=rows_(SHEETS.SITES).filter(function(s){ return keys.indexOf(s.key)>=0; });
  var be=year+543, ym=be+'-'+('0'+month).slice(-2);
  var catRows=[['เดือน','หน่วยงาน','รหัสหมวดงาน','หมวดงาน','วันทำงาน']];
  var actRows=[['เดือน','หน่วยงาน','รหัสกิจกรรม','กิจกรรม','วันทำงาน']];
  sites.forEach(function(s){
    var kindOf={}; emps.forEach(function(e){ if(e.site_key===s.key) kindOf[String(e.eid)]=e.kind||'support'; });
    var pack=readWideMonth_(s.key, year, month);
    var costAgg={}, actAgg={};
    Object.keys(pack.entries).forEach(function(eid){
      var kind=kindOf[eid]||'support', byDate=pack.entries[eid];
      Object.keys(byDate).forEach(function(date){
        var v=byDate[date], primary=(kind==='operation')?v.team:v.detail, secondary=v.pm;
        var slots=[]; if(String(primary||'').trim()) slots.push(primary); if(String(secondary||'').trim()) slots.push(secondary);
        var w=slots.length?(1/slots.length):0;
        slots.forEach(function(sv){
          var wc=String(sv).split('/')[0].trim().toLowerCase();
          if(codeName[wc]){ var a=codeName[wc]; (actAgg[a.code]=actAgg[a.code]||{code:a.code,name:a.name,md:0}).md+=w; }
          var i=String(sv).indexOf('/');
          if(i>=0){ var cc=String(sv).slice(i+1).trim().toLowerCase(); if(costName[cc]){ var c=costName[cc]; (costAgg[c.code]=costAgg[c.code]||{code:c.code,name:c.name,md:0}).md+=w; } }
        });
      });
    });
    Object.keys(costAgg).map(function(k){return costAgg[k];}).sort(function(a,b){return cmpCode_(a.code,b.code);})
      .forEach(function(r){ catRows.push([ym, s.name, r.code, r.name, Math.round(r.md*10)/10]); });
    Object.keys(actAgg).map(function(k){return actAgg[k];}).sort(function(a,b){return cmpCode_(a.code,b.code);})
      .forEach(function(r){ actRows.push([ym, s.name, r.code, r.name, Math.round(r.md*10)/10]); });
  });
  var stamp=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd');
  var tempSs=SpreadsheetApp.create('HR Manday Report '+ym+' '+stamp), tempId=tempSs.getId();
  try{
    var write=function(sh, rows){
      sh.getRange(1,1,rows.length,5).setValues(rows);
      sh.getRange(1,1,1,5).setFontWeight('bold').setBackground('#1d4e89').setFontColor('#ffffff');
      sh.setFrozenRows(1); sh.getRange(2,5,Math.max(1,rows.length-1),1).setNumberFormat('0.0');
      try{ sh.autoResizeColumns(1,5); }catch(e){}
    };
    write(tempSs.getSheets()[0].setName('หมวดงาน Work Category'), catRows);
    write(tempSs.insertSheet('กิจกรรม Activity'), actRows);
    SpreadsheetApp.flush();
    var resp=UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/'+tempId+'/export?format=xlsx',
      { headers:{ Authorization:'Bearer '+ScriptApp.getOAuthToken() }, muteHttpExceptions:true });
    if(resp.getResponseCode()!==200) return { ok:false, error:'EXPORT_HTTP_'+resp.getResponseCode() };
    return { ok:true, filename:'HR Manday Report '+ym+' - '+stamp+'.xlsx',
      mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      data:Utilities.base64Encode(resp.getBlob().getBytes()) };
  } finally { try{ DriveApp.getFileById(tempId).setTrashed(true); }catch(e){} }
}
