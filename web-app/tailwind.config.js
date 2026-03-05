/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './frontend/src/**/*.{ts,tsx}',
    './public/index.html',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0f7b6c',
          strong: '#0a5f53',
          light: '#d1f5f0',
        },
        highlight: '#f08a24',
      },
      fontFamily: {
        sans: ['Space Grotesk', 'Avenir Next', 'Segoe UI', 'sans-serif'],
        heading: ['Manrope', 'Avenir Next', 'Segoe UI', 'sans-serif'],
      },
      keyframes: {
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'rise-in': 'rise-in 380ms ease both',
        'rise-in-fast': 'rise-in 220ms ease both',
      },
    },
  },
  plugins: [],
};
