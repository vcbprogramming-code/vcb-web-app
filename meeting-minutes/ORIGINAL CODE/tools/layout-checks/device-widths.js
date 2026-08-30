// Check the reading pane ends up wide enough at each real device width, and
// that the resulting scale keeps the document legible.
const DOC_VIRTUAL_W = 860;
const SHEET_PX = 794; // 210mm at 96dpi

// Mirrors the media queries in Stylesheet.html.
function panes(w) {
  if (w <= 900) return { side: 188, list: 0 };   // list overlays, takes no width
  if (w <= 1040) return { side: 214, list: 268 };
  if (w <= 1200) return { side: 258, list: 320 };
  return { side: 294, list: 360 };
}
function framePad(w) { return w <= 1040 ? 12 : 22; }

const devices = [
  ['iPad Air portrait', 820],
  ['iPad 10.2 portrait', 810],
  ['iPad Pro 11 portrait', 834],
  ['iPad mini portrait', 744],
  ['iPad Pro screenshot', 1024],
  ['iPad Air landscape', 1180],
  ['iPad Pro 12.9 landscape', 1366],
  ['Small laptop', 1280],
  ['Desktop', 1600],
];

console.log('device                     width  cols        pane   scale  sheet px  verdict');
console.log('-'.repeat(80));
let worst = 1;
for (const [name, w] of devices) {
  const p = panes(w);
  const pane = w - p.side - p.list;
  const avail = pane - framePad(w) * 2;
  const scale = Math.min(1, avail / DOC_VIRTUAL_W);
  const eff = Math.round(SHEET_PX * scale);
  worst = Math.min(worst, scale);
  const verdict = scale >= 0.999 ? 'native'
    : scale >= 0.70 ? 'comfortable'
    : scale >= 0.55 ? 'readable'
    : 'TOO SMALL';
  console.log(
    name.padEnd(26), String(w).padStart(5),
    `${p.side}+${p.list}`.padEnd(11),
    String(pane).padStart(5),
    scale.toFixed(2).padStart(6),
    String(eff).padStart(8),
    '  ' + verdict
  );
}
console.log('-'.repeat(80));
console.log(worst >= 0.55 ? 'PASS — every device stays readable.' : 'FAIL — some device is too small.');
