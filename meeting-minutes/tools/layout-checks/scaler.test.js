// Extract fitScaleToPane from the real file and exercise it against fake DOM
// nodes, so the arithmetic and the clear-on-widen path are actually executed
// rather than eyeballed.
const fs = require('fs');
const src = fs.readFileSync('ORIGINAL CODE/JavaScript.html', 'utf8');

const start = src.indexOf('  function fitScaleToPane(frame) {');
const end = src.indexOf('  function applyMobileScale(frame) {');
if (start < 0 || end < 0) { console.error('could not locate fitScaleToPane'); process.exit(1); }
const body = src.slice(start, end);

const DOC_VIRTUAL_W = 860;
const sandbox = { DOC_VIRTUAL_W, window: { getComputedStyle: el => el.__cs } };
// usesContinuousDoc() is the phone test; false here exercises the paginated
// path, which is the only one fitScaleToPane is used on.
const fn = new Function('DOC_VIRTUAL_W', 'window', 'usesContinuousDoc',
  body + '\nreturn fitScaleToPane;')(
  sandbox.DOC_VIRTUAL_W, sandbox.window, () => false);

function makeFrame(paneWidth, padX, heightPx) {
  const wrap = {
    clientWidth: paneWidth,
    __cs: { paddingLeft: (padX / 2) + 'px', paddingRight: (padX / 2) + 'px' },
  };
  const paper = { parentNode: wrap, style: {} };
  return { style: { height: heightPx + 'px' }, offsetHeight: heightPx, parentNode: paper, __paper: paper };
}

let pass = true;
function t(label, cond, detail) {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (detail ? '  — ' + detail : ''));
  pass = pass && cond;
}

console.log('--- narrow pane scales down ---');
{
  const f = makeFrame(542, 24, 3000);           // iPad Pro reading pane
  fn(f);
  const expect = (542 - 24) / DOC_VIRTUAL_W;
  t('transform applied', /^scale\(/.test(f.style.transform || ''), f.style.transform);
  t('frame pinned to virtual width', f.style.width === DOC_VIRTUAL_W + 'px', f.style.width);
  t('height untouched (Paged.js owns it)', f.style.height === '3000px', f.style.height);
  t('paper width = scaled width',
    Math.abs(parseFloat(f.__paper.style.width) - DOC_VIRTUAL_W * expect) < 0.5, f.__paper.style.width);
  t('paper height = scaled height',
    Math.abs(parseFloat(f.__paper.style.height) - 3000 * expect) < 0.5, f.__paper.style.height);
}

console.log('\n--- wide pane clears the transform ---');
{
  const f = makeFrame(1200, 44, 3000);
  f.style.transform = 'scale(0.6)';             // pretend it was scaled before
  f.style.width = '860px';
  f.__paper.style.width = '516px';
  f.__paper.style.height = '1800px';
  fn(f);
  t('transform cleared', f.style.transform === '', JSON.stringify(f.style.transform));
  t('frame width cleared', f.style.width === '', JSON.stringify(f.style.width));
  t('paper width cleared', f.__paper.style.width === '', JSON.stringify(f.__paper.style.width));
  t('paper height cleared', f.__paper.style.height === '', JSON.stringify(f.__paper.style.height));
  // On the paginated path a height left over from the phone scaler must be
  // dropped: crossing the 500px boundary mid-session re-toggles .is-mobile,
  // and Paged.js will not re-measure a frame whose onload has already fired.
  t('stranded height cleared', f.style.height === '', JSON.stringify(f.style.height));
}

console.log('\n--- narrow pane never touches the height (Paged.js owns it) ---');
{
  const f = makeFrame(542, 24, 3000);
  fn(f);
  t('height preserved while scaling', f.style.height === '3000px', f.style.height);
}

console.log('\n--- exactly at the threshold: no scaling ---');
{
  const f = makeFrame(DOC_VIRTUAL_W + 24, 24, 1000);
  fn(f);
  t('no transform at exactly 860 available', f.style.transform === '', JSON.stringify(f.style.transform));
}

console.log('\n--- degenerate input is survivable ---');
{
  const f = makeFrame(0, 0, 0);                 // pane not laid out yet
  fn(f);
  t('zero-width pane leaves it unscaled', f.style.transform === '', JSON.stringify(f.style.transform));
  const orphan = { style: {}, parentNode: null };
  let threw = false;
  try { fn(orphan); } catch (e) { threw = true; }
  t('detached frame does not throw', !threw);
}

console.log('\n' + (pass ? 'ALL SCALING TESTS PASS' : 'SOME SCALING TESTS FAILED'));
process.exit(pass ? 0 : 1);
