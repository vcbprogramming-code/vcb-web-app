// The same scoping/cascade audit as css-audit.js, aimed at the React mirror's
// stylesheet. The mirror renders no Paged.js iframe, so the document-scaler
// rules are absent by design — this checks only what the mirror does have: the
// responsive grid bands and the tablet-portrait list overlay.
//
// Run from the project root:  node tools/layout-checks/css-audit-react.js
const fs = require('fs');
const css = fs.readFileSync('meeting-minutes-react/src/styles.css', 'utf8');

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
const risky = [/(^|\s)\.list \{/, /(^|\s)\.body \{/, /(^|\s)\.detail \{/, /(^|\s)\.body\.list-open/];
risky.forEach((re, i) => {
  const lines = b900.split('\n').filter(l => re.test(l) && !/html:not\(\.is-mobile\)/.test(l));
  check('no unscoped pane selector #' + (i + 1), lines.length === 0, lines.join(' | ').slice(0, 90));
});
check('overlay scoped', /html:not\(\.is-mobile\) \.list \{/.test(b900));
check('open-state scoped', /html:not\(\.is-mobile\) \.body\.list-open \.list \{ transform: translateX\(0\); \}/.test(b900));
check('peek scoped', /html:not\(\.is-mobile\) \.list-peek \{/.test(b900));

console.log('\n--- scrim only where it can be dismissed ---');
// .timeline-only, NOT .timeline-mode. Opening a meeting from a timeline dot
// keeps activeProject === TIMELINE, so timeline-mode stays on the detail view;
// hiding the list by that class left the meeting with no way back to it.
check('scrim excludes timeline view', /\.body\.list-open:not\(\.timeline-only\) \.detail::before/.test(b900));
check('list hidden in timeline VIEW only', /html:not\(\.is-mobile\) \.body\.timeline-only \.list \{ display: none; \}/.test(b900));
check('peek hidden in timeline VIEW only', css.includes('html:not(.is-mobile) .body.timeline-only .list-peek { display: none; }'));
check('peek hidden while open', css.includes('html:not(.is-mobile) .body.list-open .list-peek { display: none; }'));

console.log('\n--- cascade: overrides must come AFTER the base rules ---');
// The overlay and the top-padding rules all outrank their bases on
// specificity, so source order is not what saves them — but assert they exist,
// since a missing rule and a losing rule look identical on screen.
const overlayList = css.indexOf('html:not(.is-mobile) .list {');
const dashPad = css.indexOf(':not(.timeline-only) .dash-wrap { padding-top');
const phPad = css.indexOf(':not(.timeline-only) .placeholder { padding-top');
check('.list overlay present and outranks base (0,2,1 vs 0,1,0)', overlayList > -1);
check('.dash-wrap top padding present', dashPad > -1);
check('.placeholder top padding present', phPad > -1);
// The toggle indent must lift when the toggle itself is hidden, or it leaves a
// 128px hole that wraps the detail-bar buttons onto a second row.
check('detail-bar indent lifts with the toggle',
  css.includes(':not(.list-open):not(.timeline-only) .detail-bar { padding-left: 128px; }'));

console.log('\n--- z-order ---');
const z = (re) => (css.match(re) || [])[1];
const zList = z(/html:not\(\.is-mobile\) \.list \{[\s\S]*?z-index: (\d+)/);
const zScrim = z(/\.body\.list-open:not\(\.timeline-only\) \.detail::before \{[\s\S]*?z-index: (\d+)/);
const zPeek = z(/html:not\(\.is-mobile\) \.list-peek \{[\s\S]*?z-index: (\d+)/);
check('list(' + zList + ') > scrim(' + zScrim + ') > peek(' + zPeek + ')',
  +zList > +zScrim && +zScrim > +zPeek);

// The CSS above is inert unless App.tsx actually emits these classes. Checking
// only the stylesheet would pass happily while the app rendered none of them.
console.log('\n--- App.tsx emits the classes the CSS keys off ---');
const app = fs.readFileSync('meeting-minutes-react/src/App.tsx', 'utf8');
check("emits ' list-open'", app.includes("' list-open'"));
check("emits ' timeline-only'", app.includes("' timeline-only'"));
check('timeline-only requires no open meeting',
  /activeProject === TIMELINE_PROJECT && !activeId \? ' timeline-only'/.test(app));
check('renders the .list-peek toggle', /className="list-peek"/.test(app));
check('dismisses on .detail click', /className="detail" onClick=/.test(app));

console.log('\n' + (all ? 'ALL CHECKS PASS' : 'SOME CHECKS FAILED'));
process.exit(all ? 0 : 1);
