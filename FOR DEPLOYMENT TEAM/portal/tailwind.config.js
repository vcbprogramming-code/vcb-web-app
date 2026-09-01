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
      // Portal-only chrome. The sidebar navy and the globe's orbit rings are
      // not in the shared preset because no other module has them.
      colors: {
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
      },
      backgroundImage: {
        'portal-page': 'linear-gradient(180deg, #F7F8FC 0%, #EEF1F8 100%)',
        'portal-page-dark': 'linear-gradient(180deg, #061029 0%, #02050D 100%)',
        'portal-sidebar': 'linear-gradient(180deg, #101C56, #0A1440)',
        'portal-sidebar-dark': 'linear-gradient(180deg, #0A0F22, #05070F)',
        'portal-logo': 'linear-gradient(135deg, #3A5BFF, #5B7CFF)',
        'portal-logo-dark': 'linear-gradient(135deg, #4FD1FF, #7EE8FF)',
      },
      keyframes: {
        // The globe assembly. These are real 3D transforms on a perspective
        // parent, which no utility class can express.
        orbit1: {
          from: { transform: 'rotateX(72deg) rotateZ(0deg)' },
          to: { transform: 'rotateX(72deg) rotateZ(360deg)' },
        },
        orbit2: {
          from: { transform: 'rotateX(65deg) rotateZ(0deg)' },
          to: { transform: 'rotateX(65deg) rotateZ(360deg)' },
        },
        'scan-spin': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'pulse-out': {
          '0%': { transform: 'scale(0.8)', opacity: '0.5' },
          '70%': { opacity: '0' },
          '100%': { transform: 'scale(1.75)', opacity: '0' },
        },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        orbit1: 'orbit1 16s linear infinite',
        orbit2: 'orbit2 32s linear infinite reverse',
        'scan-spin': 'scan-spin 7s linear infinite',
        'pulse-out': 'pulse-out 3.4s ease-out infinite',
        'rise-in': 'rise-in .5s cubic-bezier(.22,.61,.36,1) both',
      },
      transitionTimingFunction: {
        rise: 'cubic-bezier(.22,.61,.36,1)',
      },
    },
  },
}
