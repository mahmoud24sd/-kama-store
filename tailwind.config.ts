import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // هوية Kama Store: تيل عميق + كهرماني للأزرار
        brand: {
          50: '#effafb',
          100: '#d3f1f4',
          200: '#a9e2e8',
          300: '#74cdd7',
          400: '#3fb2c0',
          500: '#1f95a5',
          600: '#187789',
          700: '#17606f',
          800: '#154f5c',
          900: '#10333d',
          950: '#0a2229',
        },
        accent: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
      },
      fontFamily: {
        sans: ['var(--font-cairo)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
