// Shared Tailwind 3 preset for the VCB Connect SPAs.
//
//   // <module>/tailwind.config.js
//   import vcb from '@vcb/shared/tailwind.preset';
//   export default {
//     presets: [vcb],
//     content: ['./index.html', './src/**/*.{js,jsx}',
//               '../shared/src/**/*.{js,jsx}'],   // <- shared classes, or they get purged
//   };
//
// Colours are lifted from the CSS the modules already ship, not invented:
//
//   brand.900 #1F3864  hr-worklog .topbar gradient start; portal sidebar family
//   brand.500 #2E75B6  hr-worklog .topbar gradient end — the two most repeated
//                      hex values in the whole codebase (19 and 17 occurrences)
//   brand.700 #1D4E89  hr-worklog --blue: buttons, links, active tabs
//   brand.800 #163A66  --blue-d: button hover
//   brand.600 #2F6FB3  --blue-l: focus ring, --jc-ink
//   accent    #3A5BFF  portal --accent (light) — the dashboard redesign
//   accent.dark #4FD1FF portal --accent (dark), also onboarding
//   surface/ink/line   hr-worklog --bg/--card/--ink/--muted/--line and its
//                      body.dark counterparts
//   ok/warn/danger     --ok #1F9D55, --warn #C2410C, .flash.error #B3261E
//
// The two blue families are deliberate: brand.* is the operational chrome that
// every module already wears, accent.* is the portal's brighter dashboard blue.
// Both are kept so the portal need not repaint, and so a module can use accent
// for emphasis against brand chrome.

/** @type {import('tailwindcss').Config} */
export default {
  // The one theme selector across all seven apps. See shared/src/theme.jsx for
  // the four selectors this replaces.
  darkMode: 'class',

  theme: {
    extend: {
      colors: {
        // VCB blue. 500 and 900 are the topbar gradient; 700 is the workhorse.
        brand: {
          50: '#EEF4FB',
          100: '#E6EFFB',
          200: '#CDDDF2',
          300: '#9DC4F0',
          400: '#5B8FD0',
          500: '#2E75B6',
          600: '#2F6FB3',
          700: '#1D4E89',
          800: '#163A66',
          900: '#1F3864',
          950: '#0B1828',
          DEFAULT: '#1D4E89',
        },

        // Portal dashboard accent. `dark` is the cyan the portal and onboarding
        // switch to in dark mode, where #3A5BFF goes muddy on near-black.
        accent: {
          DEFAULT: '#3A5BFF',
          light: '#5B7CFF',
          dark: '#4FD1FF',
          glow: '#7EE8FF',
          violet: '#7C5CFF',
        },

        // Page and card surfaces. `dark` entries are hr-worklog's body.dark set.
        surface: {
          DEFAULT: '#EEF1F6',
          alt: '#F7F8FC',
          card: '#FFFFFF',
          sunken: '#EEF2F8',
          dark: '#0F141C',
          'dark-alt': '#0E131B',
          'dark-card': '#1A212D',
          'dark-sunken': '#101620',
        },

        ink: {
          DEFAULT: '#1F2933',
          muted: '#6B7785',
          subtle: '#41506A',
          invert: '#FFFFFF',
          dark: '#E6ECF3',
          'dark-muted': '#9AA6B6',
        },

        line: {
          DEFAULT: '#E1E6EE',
          strong: '#C3CAF2',
          dark: '#2A3344',
        },

        // Status. Deliberately not Tailwind's stock green/amber/red — these are
        // the values the existing flash messages and pills already use.
        ok: { DEFAULT: '#1F9D55', bg: '#E7F6EC', fg: '#13744A', dark: '#34D399' },
        warn: { DEFAULT: '#C2410C', bg: '#FDF0E3', fg: '#9A6700', dark: '#D6B27B' },
        danger: { DEFAULT: '#B3261E', bg: '#FDECEA', fg: '#B3261E', dark: '#F87171' },
        info: { DEFAULT: '#2F6FB3', bg: '#E7F0FB', fg: '#1D4E89', dark: '#9DC4F0' },

        // HR calendars mark weekends and holidays; both appear in several modules.
        weekend: { DEFAULT: '#FAF2EA', dark: '#26221B' },
        holiday: { DEFAULT: '#FEF2F2', fg: '#DC2626', dark: '#F87171' },
      },

      fontFamily: {
        // Sarabun first: it is what hr-worklog loads, what PDFKit embeds
        // server-side (TECH_STACK.md), and it covers Thai and Latin in one
        // face — so a mixed Thai/English line does not change weight mid-string.
        // Noto Sans Thai backs it up, then Leelawadee UI, the Thai UI font
        // shipped with Windows, so an office machine with no network still
        // renders Thai properly instead of falling to a tofu-prone default.
        sans: [
          'Sarabun',
          'Noto Sans Thai',
          'Leelawadee UI',
          'Inter',
          'Segoe UI',
          'Tahoma',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
        // The portal's display face, for headings that were designed with it.
        display: ['Inter', 'Sarabun', 'Noto Sans Thai', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },

      fontSize: {
        // Thai needs more leading than Latin at the same size: vowels sit above
        // and tone marks above those, so Tailwind's default line-heights clip
        // the stack. Every step here is looser than stock.
        xs: ['0.75rem', { lineHeight: '1.2rem' }],
        sm: ['0.8125rem', { lineHeight: '1.35rem' }],
        base: ['0.9375rem', { lineHeight: '1.6rem' }],
        lg: ['1.0625rem', { lineHeight: '1.75rem' }],
        xl: ['1.1875rem', { lineHeight: '1.9rem' }],
        '2xl': ['1.4rem', { lineHeight: '2.1rem' }],
        '3xl': ['1.75rem', { lineHeight: '2.4rem' }],
      },

      borderRadius: {
        // The modules settled on 8-9px controls and 12-14px cards.
        DEFAULT: '0.5rem',
        card: '0.875rem',
        control: '0.5625rem',
        pill: '999px',
      },

      boxShadow: {
        card: '0 1px 3px rgba(22,40,80,.06), 0 1px 2px rgba(22,40,80,.04)',
        'card-hover': '0 4px 10px rgba(23,27,46,.06), 0 16px 36px rgba(23,27,46,.1)',
        topbar: '0 2px 12px rgba(31,56,100,.25)',
        'card-dark': '0 1px 3px rgba(0,0,0,.45), 0 1px 2px rgba(0,0,0,.35)',
        focus: '0 0 0 3px rgba(47,111,179,.13)',
      },

      backgroundImage: {
        // The topbar every module shares.
        'brand-bar': 'linear-gradient(135deg, #1F3864 0%, #2E75B6 100%)',
        'brand-bar-dark': 'linear-gradient(90deg, #0B1828 0%, #12345A 55%, #205180 100%)',
      },

      keyframes: {
        spin: { to: { transform: 'rotate(360deg)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        spin: 'spin 1s linear infinite',
        'fade-in': 'fade-in .18s ease-out',
      },
    },
  },

  // No plugins: TECH_STACK.md rules out UI kits, and @tailwindcss/forms and
  // /typography would style components the modules hand-write themselves.
  plugins: [],
};
