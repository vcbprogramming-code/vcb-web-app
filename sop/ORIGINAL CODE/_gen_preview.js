// Throwaway generator: builds flows-preview.html from the real index.html so
// the BD pilot can be eyeballed in a browser without deploying. Safe to delete.
const fs = require('fs');
// Paths are relative to ORIGINAL CODE/ — this tool sits beside apps-script/,
// deliberately outside it so clasp never sees it (.claspignore allowlists only
// the three deployed files).
const src = fs.readFileSync('apps-script/index.html', 'utf8');
const css = src.slice(src.indexOf('<style>') + 7, src.indexOf('</style>'));

function grab(s){
  const i = src.indexOf(s); let d = 0, j = i;
  for (; j < src.length; j++){ const c = src[j]; if (c === '{') d++; else if (c === '}'){ d--; if (d === 0){ j++; break; } } }
  return src.slice(i, j);
}
function grabArr(s){
  const i = src.indexOf(s); let d = 0, j = src.indexOf('[', i), k = j;
  for (; k < src.length; k++){ const c = src[k]; if (c === '[') d++; else if (c === ']'){ d--; if (d === 0){ k++; break; } } }
  return src.slice(i, k) + ';';
}

const fns = ['function diagramHtml(f)','function narrativeHtml(f)','function flowLegendHtml()','function layoutFlowEdges(f)','function flowById(id)']
  .map(grab).join('\n\n');
const flows = grabArr('var SOP_FLOWS =');

const page = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Process Flows — PREVIEW (BD pilot)</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${css}
  body{padding:18px 22px;background:var(--bg)}
  .pv-bar{display:flex;gap:10px;align-items:center;margin-bottom:10px;font-family:var(--sans)}
  .pv-bar button{padding:7px 14px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--ink);font-weight:600;cursor:pointer}
  .pv-note{font-family:var(--sans);color:var(--muted);font-size:.82rem;margin:0 0 16px}
  .detail{background:transparent}
</style></head>
<body>
  <div class="pv-bar">
    <strong style="font-family:var(--sans);color:var(--ink)">Process Flows — local preview (BD pilot)</strong>
    <button id="dk">Toggle dark</button>
  </div>
  <p class="pv-note">Standalone preview generated from index.html — NOT deployed (excluded by .claspignore). Same diagram code the app uses.</p>
  <div id="root" class="detail"></div>
<script>
function esc(s){return String(s).replace(/[&<>]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c];});}
var LANG={flowStepsLbl:"รายละเอียดขั้นตอน · Process",flowLegNormal:"ขั้นตอนปกติ",flowLegApprove:"ส่งอนุมัติ",flowLegYes:"อนุมัติ (Yes)",flowLegReject:"ตีกลับ (Reject)"};
function t(k){return LANG[k]||k;}
${flows}
${fns}
function render(){
  document.getElementById("root").innerHTML=SOP_FLOWS.map(function(f){
    return '<div class="d-wrap m-'+f.module+'" style="max-width:none;border:1px solid var(--line);border-radius:12px;margin-bottom:24px;background:var(--panel)">'+
      '<div class="d-head"><span class="flow-id-badge">'+esc(f.id)+'</span><div class="d-titles"><div class="d-th">'+esc(f.titleTH)+'</div><div class="d-en">'+esc(f.titleEN)+'</div></div><span class="d-badge">'+f.module+'</span></div>'+
      diagramHtml(f)+flowLegendHtml()+narrativeHtml(f)+'</div>';
  }).join("");
  requestAnimationFrame(function(){ SOP_FLOWS.forEach(layoutFlowEdges); });
}
function redraw(){ SOP_FLOWS.forEach(layoutFlowEdges); }
document.getElementById("dk").addEventListener("click",function(){document.documentElement.classList.toggle("dark");redraw();});
render();
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(redraw);
window.addEventListener("resize",redraw,{passive:true});
</script>
</body></html>`;

fs.writeFileSync('apps-script/flows-preview.html', page);
console.log('wrote flows-preview.html (' + page.length + ' bytes)');
