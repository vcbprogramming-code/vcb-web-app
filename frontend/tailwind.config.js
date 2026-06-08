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
      },
      fontFamily: {
        sans: ['"Noto Sans Thai"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
