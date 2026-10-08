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
        // Shared CSS tokens apply to workspaces, navigation and portal dialogs.
        'bg-dark': 'rgb(var(--sentinel-bg-dark, 9 13 17) / <alpha-value>)',
        'bg-main': '#090D11',
        'bg-card': 'rgb(var(--sentinel-bg-card, 16 24 32) / <alpha-value>)',
        'bg-card-hover': 'rgb(var(--sentinel-bg-card-hover, 22 32 43) / <alpha-value>)',
        'border-base': 'rgb(var(--sentinel-border-base, 38 51 64) / <alpha-value>)',
        'border-accent': 'rgb(var(--sentinel-border-accent, 64 80 96) / <alpha-value>)',
        
        // Text colors
        'text-main': '#F8FAFC',
        'text-muted': 'rgb(var(--sentinel-text-muted, 148 163 184) / <alpha-value>)',
        'text-dim': 'rgb(var(--sentinel-text-dim, 100 116 139) / <alpha-value>)',
        
        // Accent colors
        'accent-green': 'rgb(var(--sentinel-accent-green, 16 185 129) / <alpha-value>)',
        'accent-green-glow': '#34d399',
        'accent-cyan': 'rgb(var(--sentinel-accent-cyan, 6 182 212) / <alpha-value>)',
        'accent-cyan-glow': '#22D3EE',
        'accent-purple': 'rgb(var(--sentinel-accent-purple, 139 92 246) / <alpha-value>)',
        'accent-blue': '#3B82F6',
        'accent-red': 'rgb(var(--sentinel-accent-red, 239 68 68) / <alpha-value>)',
        'accent-yellow': 'rgb(var(--sentinel-accent-yellow, 245 158 11) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
