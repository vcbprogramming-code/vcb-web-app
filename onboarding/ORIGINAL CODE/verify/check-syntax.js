/*
 * Minimal syntax check for the Apps Script HTML files.
 *
 * There is no build step and no test framework for this project (see
 * ../docs/DEPLOYMENT.md). This script extracts the contents of every
 * <script>...</script> block from each .html file under src/ and runs it
 * through `new Function(...)`, which throws a SyntaxError if the JS inside
 * is malformed, WITHOUT executing it (so it's safe to run against files
 * that call google.script.run, touch localStorage, etc.).
 *
 * It catches typos/mismatched braces before you clasp push — it does NOT
 * catch logic bugs, so still test the golden path in a real browser after
 * deploying.
 *
 * Known false positive: Index.html's first two <script> blocks (window.
 * INITIAL_PAGE and window.CHECKLIST_OVERRIDES) intentionally contain Apps
 * Script templating (`<?!= ... ?>`), which is not valid JS until the
 * server evaluates it on render — ignore a SyntaxError on either.
 *
 * Usage:
 *   node verify/check-syntax.js
 */
var fs = require('fs');
var path = require('path');

var SRC_DIR = path.join(__dirname, '..', 'src');
var files = fs.readdirSync(SRC_DIR).filter(function (f) { return f.endsWith('.html'); });

var hadError = false;

files.forEach(function (file) {
  var fullPath = path.join(SRC_DIR, file);
  var src = fs.readFileSync(fullPath, 'utf8');
  var scripts = Array.from(src.matchAll(/<script>([\s\S]*?)<\/script>/g)).map(function (m) { return m[1]; });

  if (!scripts.length) {
    console.log(file, '- no <script> blocks, skipped');
    return;
  }

  scripts.forEach(function (code, i) {
    try {
      new Function(code);
      console.log(file, '- script', i, 'OK');
    } catch (e) {
      hadError = true;
      console.log(file, '- script', i, 'SYNTAX ERROR:', e.message);
    }
  });
});

if (hadError) {
  console.log('\nSyntax errors found — fix before pushing.');
  process.exit(1);
} else {
  console.log('\nAll script blocks parsed cleanly.');
}
