/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Brand palette derived from the proposal document (navy headers)
        brand: {
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
