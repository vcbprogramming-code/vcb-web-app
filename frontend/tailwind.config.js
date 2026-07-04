/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Brand palette — BTS Dashboard blue accent
        brand: {
          DEFAULT: '#2563EB', // blue-600 — primary accent
          light: '#3B82F6', // blue-500 — hover / gradient end
          tint: '#EFF6FF', // blue-50 — active-nav pill, soft fills
          border: '#BFDBFE', // blue-200 — focus rings / soft borders
        },
        // Former navy palette, preserved (not used by default)
        navy: {
          DEFAULT: '#1F3864',
          light: '#2E4F8F',
          tint: '#F2F6FB',
          border: '#BFCEDF',
        },
        // cyan/electric-blue accents for the futuristic portal + login
        cyber: {
          cyan: '#22D3EE',
          blue: '#3B82F6',
          deep: '#0A1226', // deep navy panel
          void: '#060B18', // near-black background
        },
      },
      fontFamily: {
        sans: ['"Noto Sans Thai"', 'system-ui', 'sans-serif'],
        // futuristic display fonts for the portal/login masthead
        display: ['Orbitron', '"Noto Sans Thai"', 'sans-serif'],
        tech: ['Rajdhani', '"Noto Sans Thai"', 'sans-serif'],
      },
      keyframes: {
        'orbit-spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
        'orbit-spin-rev': { from: { transform: 'rotate(360deg)' }, to: { transform: 'rotate(0deg)' } },
        'pulse-glow': {
          '0%,100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        'float-slow': {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      animation: {
        'orbit-spin': 'orbit-spin 26s linear infinite',
        'orbit-spin-rev': 'orbit-spin-rev 40s linear infinite',
        'pulse-glow': 'pulse-glow 3.5s ease-in-out infinite',
        'float-slow': 'float-slow 7s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
