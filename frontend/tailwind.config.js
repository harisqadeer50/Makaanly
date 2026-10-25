/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 50: '#eef2f8', 100: '#d9e2f0', 200: '#b3c5e0', 300: '#86a0c8', 400: '#5a79ab', 500: '#3d5c90', 600: '#2d4673', 700: '#223657', 800: '#182742', 900: '#0f1b30' },
        sage: { 50: '#f0f6f2', 100: '#dbeae0', 200: '#b9d5c3', 300: '#8fb9a0', 400: '#679c7f', 500: '#4a7f61', 600: '#3b674f', 700: '#2f5240' },
        stone: { 50: '#f7f8f9', 100: '#eff1f3', 200: '#e1e5e9', 300: '#cbd1d8', 500: '#626b78', 700: '#3a414a' },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '14px' },
      boxShadow: { card: '0 1px 2px rgba(15,27,48,.06), 0 6px 18px -8px rgba(15,27,48,.14)' },
    },
  },
  plugins: [],
};
