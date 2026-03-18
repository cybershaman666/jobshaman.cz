/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slate: {
          850: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        brand: {
          500: '#6366f1',
          600: '#4f46e5',
        },
        solarpunk: {
          gold: '#f1c40f',
          green: '#5eb486',
          sky: '#3498db',
          white: '#fdfcf0',
          'white-warm': '#faf9f0',
        },
        teal: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        }
      },
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'xs': '0.8125rem',
        'sm': '0.9375rem',
        'base': '1.0625rem',
        'lg': '1.1875rem',
        'xl': '1.3125rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem',
      },
      animation: {
        'solarpunk-pulse': 'solarpunk-pulse 2s ease-in-out infinite',
        'solarpunk-glow': 'solarpunk-glow 3s ease-in-out infinite',
        'solarpunk-path-flow': 'solarpunk-path-flow 2s ease-in-out infinite',
        'energy-flow': 'energy-flow 1.5s ease-in infinite',
        'solarpunk-shimmer': 'solarpunk-shimmer 3s infinite',
        'handshake-pulse': 'handshake-pulse 1s ease-out',
      },
      keyframes: {
        'solarpunk-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.1)' },
        },
        'solarpunk-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(94, 180, 134, 0.1)' },
          '50%': { boxShadow: '0 0 8px 2px rgba(94, 180, 134, 0.06)' },
        },
        'solarpunk-path-flow': {
          '0%': { strokeDasharray: '0 100' },
          '100%': { strokeDasharray: '100 0' },
        },
        'energy-flow': {
          '0%, 100%': { transform: 'translateX(-100%)', opacity: '0' },
          '50%': { opacity: '1' },
        },
        'solarpunk-shimmer': {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        'handshake-pulse': {
          '0%': { boxShadow: '0 0 0 0 rgba(94, 180, 134, 0.4)' },
          '70%': { boxShadow: '0 0 0 8px rgba(94, 180, 134, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(94, 180, 134, 0)' },
        },
      },
    }
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
