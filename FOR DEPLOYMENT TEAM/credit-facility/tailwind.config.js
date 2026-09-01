/** @type {import('tailwindcss').Config} */
import vcb from '../shared/tailwind.preset.js';

export default {
  presets: [vcb],
  // ../shared must be listed too: the providers and any shared markup live
  // outside this package's src/, and Tailwind purges every class it cannot
  // see in `content`.
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
    '../shared/src/**/*.{js,jsx}',
  ],
};
