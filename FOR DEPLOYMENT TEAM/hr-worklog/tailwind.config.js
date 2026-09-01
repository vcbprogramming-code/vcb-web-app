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
        // The work-log grid's own status palette. These are not in the shared
        // preset because no other module paints a coverage calendar: each hue
        // means one specific state of a day, and they must stay distinguishable
        // side by side in a 31-column strip.
        cov: {
          ok: '#1F9D55',        // filled and locked
          miss: '#E0533A',      // past, still empty
          edit: '#E8B500',      // inside the edit window
          'edit-ink': '#5A4500',
          future: '#EEF2F8',
          'future-ink': '#9AA5B4',
          rest: '#FDF0D4',      // weekend
          'rest-ink': '#6B5232',
        },
      },
      gridTemplateColumns: {
        // The requests hub: form beside the ticket list.
        requests: 'minmax(280px, 380px) 1fr',
      },
    },
  },
}
