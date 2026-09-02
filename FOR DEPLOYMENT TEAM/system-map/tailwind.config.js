import vcbPreset from '../shared/tailwind.preset.js';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [vcbPreset],
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
    // Shared components ship their own classes; without this line Tailwind
    // purges every utility that only appears in shared/src.
    '../shared/src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      // The map is a dark diagram surface with its own ink/line ramp, kept out
      // of the shared preset because no other module renders a swimlane canvas.
      // These are the exact hex values styles.css already used, not new colours.
      colors: {
        // Each resolves a CSS variable so the whole ramp can be swapped for
        // light mode in one place (index.css). The dark values below are the
        // originals; before this the hexes were baked in here and the theme
        // toggle changed nothing on this module - it was dark either way.
        map: {
          bg: 'var(--map-bg)',         // page behind the canvas
          panel: 'var(--map-panel)',   // sidebar
          head: 'var(--map-head)',     // header / table head / info cards
          rail: 'var(--map-rail)',     // default control border
          rail2: 'var(--map-rail2)',   // hover border
          sunk: 'var(--map-sunk)',     // inputs
          card: 'var(--map-card)',     // route/crumb/support cards
          card2: 'var(--map-card2)',   // stage cards
          doc: 'var(--map-doc)',       // doc nodes
          manual: 'var(--map-manual)', // manual node fill
          detail: 'var(--map-detail)', // focus detail pane
          hair: 'var(--map-hair)',     // hairline borders
          hair2: 'var(--map-hair2)',   // sidebar left border
          ink: 'var(--map-ink)',       // body text
        },
        // The slate ramp the components already use, redirected through
        // variables so it inverts with the theme. 26 places said
        // text-slate-200/300 for "bright text on the dark canvas" and
        // text-slate-600 for "muted" - literal hexes that would have been
        // near-white on white and near-black on black. Rewriting every call
        // site would have been the same change spelled 26 times.
        slate: {
          100: 'var(--sl-100)',
          200: 'var(--sl-200)',
          300: 'var(--sl-300)',
          400: 'var(--sl-400)',
          500: 'var(--sl-500)',
          600: 'var(--sl-600)',
          700: 'var(--sl-700)',
          800: 'var(--sl-800)',
          900: 'var(--sl-900)',
        },
        // Diagram semantics. `flow` is the direct/trigger blue, `alt` the
        // indirect/deferred amber, `ai` the AI-opportunity violet.
        flow: '#38bdf8',
        alt: '#fbbf24',
        loop: '#c9a14a',
        ai: { DEFAULT: '#a78bfa', soft: '#c4b5fd', pale: '#ddd6fe' },
        // Department colours — the map's whole legend keys off these.
        dept: {
          eng: '#00695C',
          pm: '#F57C00',
          proc: '#C2185B',
          fin: '#6A1B9A',
          acc: '#0e7490',
          asset: '#455A64',
          hr: '#283593',
          site: '#E65100',
        },
      },
      // The map's own text ramp — smaller than the shared preset's, because a
      // swimlane box has to fit a label, a subtitle and a module code in 108px.
      fontSize: {
        micro: ['7.5px', { lineHeight: '1.2' }],
        '2xs': ['8.5px', { lineHeight: '1.35' }],
        '3xs': ['9px', { lineHeight: '1.3' }],
        tiny: ['9.5px', { lineHeight: '1.3' }],
        '4xs': ['10px', { lineHeight: '1.35' }],
        mini: ['10.5px', { lineHeight: '1.45' }],
        nano: ['11px', { lineHeight: '1.4' }],
        cap: ['11.5px', { lineHeight: '1.4' }],
        base2: ['12px', { lineHeight: '1.4' }],
        note: ['12.5px', { lineHeight: '1.6' }],
        body2: ['13px', { lineHeight: '1.4' }],
      },
      spacing: {
        // The fixed geometry the SVG router measures against.
        sidebar: '440px',
        node: '175px',
        nodeh: '108px',
        lane: '90px',
        fnode: '158px',
      },
      backgroundImage: {
        'map-brand': 'linear-gradient(118deg,#1c3a67 0%,#274f7d 52%,#2f76b7 100%)',
      },
      boxShadow: {
        brand: 'inset 0 1px 0 rgba(255,255,255,.06),0 4px 18px rgba(20,38,72,.26)',
        node: '0 2px 8px rgba(0,0,0,.3)',
        sidebar: '-8px 0 32px rgba(0,0,0,.55)',
        legend: '0 6px 22px rgba(0,0,0,.45)',
        stage: '0 10px 26px rgba(0,0,0,.35)',
        ai: '0 0 0 2px #a78bfa,0 0 16px rgba(167,139,250,.5)',
      },
      transitionTimingFunction: {
        sidebar: 'cubic-bezier(.4,0,.2,1)',
      },
    },
  },
}
