/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Sound It DJ Official Brand Palette
        brand: {
          primary: '#00101D',
          secondary: '#051626',
          tertiary: '#95CDFB',
          accent: '#FAE1AF',
          'accent-hover': '#FCEAC6',
          'accent-dim': 'rgba(250, 225, 175, 0.15)',
          sky: '#95CDFB',
          'sky-dim': 'rgba(149, 205, 251, 0.15)',
        },
        // Background Colors
        background: {
          primary: '#00101D',
          secondary: '#051626',
          tertiary: '#0a223a',
          card: '#0a223a',
          elevated: '#0f2c4a',
        },
        // Text Colors
        text: {
          primary: '#e8e8e8',
          secondary: '#8a9bb3',
          muted: '#4a5d7a',
          disabled: '#3a4d6a',
        },
        // Border Colors
        border: {
          DEFAULT: '#1a3a5c',
          light: '#244a73',
        },
        // Semantic Colors
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#0080FF',
        // Legacy Brand Color Aliases (Mapped to Official Champagne Gold & Sky Blue)
        'create-red': '#FAE1AF',
        'create-red-light': '#FCEAC6',
        'create-red-dark': '#E2C88F',
        'create-red-dim': 'rgba(250, 225, 175, 0.15)',
        'accent-secondary': '#95CDFB',
        'accent-orange': '#FAE1AF',
        'accent-primary': '#FAE1AF',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Consolas', 'monospace'],
      },
      spacing: {
        'sidebar': '16rem',
      },
      borderRadius: {
        'xl': '8px',
        '2xl': '12px',
      },
      boxShadow: {
        'card': '0 4px 20px rgba(0, 0, 0, 0.4)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
