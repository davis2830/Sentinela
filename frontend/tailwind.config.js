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
        // Background colors from mockup
        'bg-dark': '#090D11',
        'bg-main': '#090D11',
        'bg-card': '#111720',
        'bg-card-hover': '#17202C',
        'border-base': '#1E293B',
        'border-accent': '#263345',
        
        // Text colors
        'text-main': '#F8FAFC',
        'text-muted': '#94A3B8',
        'text-dim': '#64748B',
        
        // Accent colors
        'accent-green': '#10b981',
        'accent-green-glow': '#34d399',
        'accent-purple': '#8B5CF6',
        'accent-blue': '#3B82F6',
        'accent-red': '#EF4444',
        'accent-yellow': '#F59E0B',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}