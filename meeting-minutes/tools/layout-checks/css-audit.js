// Audit the real stylesheet's layout rules: confirm the grid, list-overlay and
// peek-button rules exist, are scoped away from phones, and win the cascade
// against the base rules they are meant to override.
const fs = require('fs');
const css = fs.readFileSync('ORIGINAL CODE/Stylesheet.html', 'utf8');

function ok(label, cond, detail) {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (detail ? '  — ' + detail : ''));
  return cond;
}
let all = true;
const check = (...a) => { all = all && ok(...a); };

// Concatenate EVERY @media block at this breakpoint — the rules for one
// breakpoint are deliberately split across more than one block.
function mediaBlock(bp) {
  const open = '@media (max-width: ' + bp + ') {';
  let out = '', from = 0, i;
  while ((i = css.indexOf(open, from)) >= 0) {
    let depth = 0, j = css.indexOf('{', i);
    for (; j < css.length; j++) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') { depth--; if (!depth) break; }
    }
    out += css.slice(i, j + 1) + String.fromCharCode(10);
    from = j + 1;
  }
  return out;
}

console.log('--- responsive grid bands ---');
check('base grid 294+360', /\.body \{ display: grid; grid-template-columns: 294px 360px 1fr;/.test(css));
check('1200 band', /258px 320px 1fr/.test(mediaBlock('1200px')));
check('1040 band', /214px 268px 1fr/.test(mediaBlock('1040px')));
check('900 band two columns', /grid-template-columns: 188px 1fr/.test(mediaBlock('900px')));

console.log('\n--- timeline grid restated in every band ---');
for (const bp of ['1200px', '1040px', '900px']) {
  check('timeline restated at ' + bp, /\.body\.timeline-mode \{ grid-template-columns/.test(mediaBlock(bp)));
}
const baseTL = css.indexOf('.body.timeline-mode { grid-template-columns: 294px 0 1fr; }');
check('base timeline precedes overrides', baseTL > -1 && baseTL < css.indexOf('@media (max-width: 1200px)'));

console.log('\n--- CRITICAL: portrait overlay must not touch phones ---');
const b900 = mediaBlock('900px');
// Every selector that lays out a pane must be phone-scoped, or the phone's
// own .mobile-pane-* switching breaks (it never overrides position/transform).
const risky = [/(^|\s)\.list \{/, /(^|\s)\.body \{/, /(^|\s)\.detail \{/, /(^|\s)\.body\.list-open/];
risky.forEach((re, i) => {
  const lines = b900.split('\n').filter(l => re.test(l) && !/html:not\(\.is-mobile\)/.test(l));
  check('no unscoped pane selector #' + (i + 1), lines.length === 0, lines.join(' | ').slice(0, 90));
});
check('overlay scoped', /html:not\(\.is-mobile\) \.list \{/.test(b900));
check('open-state scoped', /html:not\(\.is-mobile\) \.body\.list-open \.list \{ transform: translateX\(0\); \}/.test(b900));
check('peek scoped', /html:not\(\.is-mobile\) \.list-peek \{/.test(b900));
check('detail-bar pad scoped', /html:not\(\.is-mobile\) [^\n]*\.detail-bar \{ padding-left/.test(b900));

console.log('\n--- scrim only where it can be dismissed ---');
// .timeline-only, NOT .timeline-mode. Opening a meeting from a timeline dot
// leaves S.activeProject on TIMELINE, so timeline-mode stays set on the detail
// view; hiding the list by that class left the meeting with no way back to it.
check('scrim excludes timeline view', /\.body\.list-open:not\(\.timeline-only\) \.detail::before/.test(b900));
check('list hidden in timeline VIEW only', /\.body\.timeline-only \.list \{ display: none; \}/.test(b900));
check('peek hidden in timeline VIEW only', css.includes('html:not(.is-mobile) .body.timeline-only .list-peek { display: none; }'));
// The toggle indent must lift when the toggle is hidden, or it leaves a 128px
// hole that wraps the detail-bar buttons onto a second row.
check('detail-bar indent lifts with the toggle',
  css.includes(':not(.list-open):not(.timeline-only) .detail-bar { padding-left: 128px; }'));
check('peek hidden while open', css.includes('html:not(.is-mobile) .body.list-open .list-peek { display: none; }'));

console.log('\n--- cascade: tablet overrides must come AFTER the base clamps ---');
const basePaper = css.indexOf('.paper { max-width: 860px;');
const baseFooter = css.indexOf('.attach-footer { max-width: 860px;');
const overridePaper = css.indexOf('.paper { max-width: none; }');
const overrideFooter = css.indexOf('.attach-footer { max-width: none; }');
check('.paper override after base', overridePaper > basePaper, basePaper + ' -> ' + overridePaper);
check('.attach-footer override after base', overrideFooter > baseFooter, baseFooter + ' -> ' + overrideFooter);
// The overlay background must beat the later `.list { background: var(--bg) }`.
const baseListBg = css.indexOf('.list { background: var(--bg);');
const overlayHasBg = /html:not\(\.is-mobile\) \.list \{[\s\S]*?background: var\(--panel\)/.test(b900);
check('overlay background wins by specificity', overlayHasBg,
  'overlay is (0,2,1) vs base (0,1,0) at index ' + baseListBg);

console.log('\n--- z-order ---');
const z = (re) => (css.match(re) || [])[1];
const zList = z(/html:not\(\.is-mobile\) \.list \{[\s\S]*?z-index: (\d+)/);
const zScrim = z(/\.body\.list-open:not\(\.timeline-only\) \.detail::before \{[\s\S]*?z-index: (\d+)/);
const zPeek = z(/html:not\(\.is-mobile\) \.list-peek \{[\s\S]*?z-index: (\d+)/);
check('list(' + zList + ') > scrim(' + zScrim + ') > peek(' + zPeek + ')',
  +zList > +zScrim && +zScrim > +zPeek);

// The CSS above is inert unless the client actually toggles these classes.
// Checking only the stylesheet would pass happily while the app set none of
// them — and .timeline-only in particular is new, so nothing else guards it.
console.log('\n--- JavaScript.html toggles the classes the CSS keys off ---');
const js = fs.readFileSync('ORIGINAL CODE/JavaScript.html', 'utf8');
check('adds timeline-only only when no meeting is open',
  /classList\.toggle\('timeline-only', !S\.activeId\)/.test(js));
check('clears both timeline classes',
  js.includes("classList.remove('timeline-mode', 'timeline-only')"));
check('toggles list-open',
  js.includes("classList.add('list-open')") && js.includes("classList.remove('list-open')"));

console.log('\n' + (all ? 'ALL CHECKS PASS' : 'SOME CHECKS FAILED'));
process.exit(all ? 0 : 1);
