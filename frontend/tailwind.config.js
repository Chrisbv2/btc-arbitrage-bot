/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface:  '#0f172a',
        panel:    '#1e293b',
        card:     '#162032',
        border:   '#1e3a5f',
        dim:      '#334155',
        accent:   '#f7931a',
        profit:   '#10b981',
        loss:     '#f43f5e',
        muted:    '#64748b',
        subtle:   '#94a3b8',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        flash:        'flash 0.4s ease-out',
      },
      keyframes: {
        flash: {
          '0%':   { opacity: '0.25' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
