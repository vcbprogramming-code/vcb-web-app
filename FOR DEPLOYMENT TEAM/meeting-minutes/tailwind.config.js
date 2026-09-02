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
      colors: {
        // The rendered-document palette. These are NOT the app chrome (that is
        // the shared preset's brand/ink/line): they are the ink of the A4
        // meeting page itself, which is printed and must stay the exact GitHub-
        // primer-derived values the exported PDFs have always used. Renaming
        // them to brand.* would silently reflow every archived export.
        doc: {
          head: '#0b3d62',   // letterhead + h1/h2 in the rendered minutes
          sub: '#24486b',    // letterdate + h3/h4
          ink: '#1f2328',
          muted: '#57606a',
          faint: '#8b949e',
          line: '#d8dee4',
          soft: '#eaeef2',
          link: '#1f6feb',
        },
        // Meeting-source and status pills. Each pair is a background + its own
        // legible foreground; they sit side by side on one card row, so they
        // are kept distinguishable rather than folded into the shared ok/warn.
        pill: {
          fathom: '#fdeef0',
          'fathom-ink': '#cf222e',
          overview: '#eef6ff',
          'overview-ink': '#1f6feb',
          manual: '#eafbf0',
          'manual-ink': '#1a7f37',
          pin: '#fff4d6',
          'pin-ink': '#9a6700',
          hidden: '#ffe9e9',
          'hidden-ink': '#cf222e',
        },
      },
      gridTemplateColumns: {
        // The three-pane shell: projects | meeting list | document.
        shell: '294px 360px 1fr',
        'shell-md': '258px 320px 1fr',
        'shell-sm': '214px 268px 1fr',
        // Timeline collapses the middle column to nothing rather than
        // unmounting it, so the document pane does not reflow on toggle.
        // One per breakpoint, matching .body.timeline-mode in the original -
        // only the widest existed, and none of them was ever applied, so the
        // empty list column kept its full 360px on the timeline.
        'shell-timeline': '294px 0 1fr',
        'shell-timeline-md': '258px 0 1fr',
        'shell-timeline-sm': '214px 0 1fr',
        // One horizontal timeline lane: fixed label gutter + the date track.
        lane: '200px 1fr',
      },
      maxWidth: {
        // A4 at 96dpi minus the printed side margins — the on-screen page
        // preview must be exactly as wide as the sheet it previews.
        paper: '860px',
      },
    },
  },
}
