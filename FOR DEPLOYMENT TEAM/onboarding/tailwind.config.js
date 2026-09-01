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
        // Onboarding-only chrome, lifted from the old index.css :root tokens.
        // The sidebar navy and the tree guide colour are not in the shared
        // preset because no other module draws an org chart.
        sidebar: {
          0: '#0A1440',
          1: '#101C56',
          dark0: '#05070F',
          dark1: '#0A0F22',
          text: '#C7CDF0',
          'text-dark': '#C9D6F0',
          dim: '#8992C4',
          'dim-dark': '#7686B3',
          active: '#1B2A72',
          'active-dark': '#16214A',
        },
        tree: {
          line: '#9AA3D1',
          'line-dark': 'rgba(147,172,206,.6)',
        },
      },
      backgroundImage: {
        'onb-sidebar': 'linear-gradient(180deg, #101C56, #0A1440)',
        'onb-sidebar-dark': 'linear-gradient(180deg, #0A0F22, #05070F)',
      },
      maxWidth: {
        page: '900px',
      },
    },
  },
}
