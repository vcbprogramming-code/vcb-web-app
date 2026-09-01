// The shared preset carries the palette, the Sarabun-first font stack, the
// looser Thai line-heights and darkMode:'class'. Everything module-specific
// lives in `extend` below.
//
// `content` must reach ../shared/src as well: the shared providers render their
// own markup, and classes that only appear there would otherwise be purged.
//
// require() rather than an import: package.json is "type":"module", but
// Tailwind loads this file through its own CJS-capable loader, and the preset
// path is a relative file outside node_modules. createRequire keeps that
// working under ESM.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const vcbPreset = require('../shared/tailwind.preset.js');

/** @type {import('tailwindcss').Config} */
export default {
  presets: [vcbPreset.default ?? vcbPreset],
  content: ['./index.html', './src/**/*.{js,jsx}', '../shared/src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Per-module accent colours, ported verbatim from the .m-XX rules in the
        // old styles.css. Reached through the --mc custom property (see
        // index.css) wherever a card must take its module's colour at runtime,
        // and directly as `text-mod-PO` where the module is known at author time.
        mod: {
          PO: '#2563eb', IC: '#0891b2', AP: '#9333ea', FA: '#c2410c',
          PM: '#0d9488', OF: '#ca8a04', GL: '#dc2626', AR: '#db2777',
          BD: '#4f46e5', SE: '#475569', FIN: '#059669', RP: '#0b3d62',
        },
      },
      gridTemplateColumns: {
        // sidebar · list · detail — the three-pane desktop layout.
        panes: '324px 380px 1fr',
        'panes-reports': '324px 1fr',
      },
    },
  },
};
