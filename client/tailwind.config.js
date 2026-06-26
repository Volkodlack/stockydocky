/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
      },
      colors: {
        // Palette principale — violet du logo SAS Carles (#523996 / #2F1484)
        brand: {
          50: '#f6f4fb',
          100: '#ede8f6',
          200: '#dacfec',
          300: '#bfaede',
          400: '#9f86cc',
          500: '#7e60b6',
          600: '#523996',
          700: '#43307a',
          800: '#372861',
          900: '#2c2050',
          950: '#1d1438',
        },
        // Accent — magenta du logo SAS Carles (#F01067)
        accent: {
          50: '#fff1f6',
          100: '#ffe3ed',
          200: '#ffc7d9',
          300: '#ff9bb8',
          400: '#fa5f8c',
          500: '#f0166b',
          600: '#d40c5b',
          700: '#b00a4b',
          800: '#8c0a3d',
          900: '#6f0a31',
          950: '#44041d',
        },
        // Gris neutres (slate) pour les surfaces
        surface: {
          0: '#ffffff',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 6px -1px rgb(0 0 0 / 0.06)',
        soft: '0 4px 24px -8px rgb(15 23 42 / 0.12)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.25s ease-out',
        'scale-in': 'scale-in 0.18s ease-out',
      },
    },
  },
  plugins: [],
};
