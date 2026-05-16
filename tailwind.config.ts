import type { Config } from 'tailwindcss'

const config: Config = {
  content: [],
  theme: {
    extend: {
      colors: {
        background: 'var(--bg)',
        foreground: 'var(--text)',
        card: 'var(--card)',
        border: 'var(--border)',
        muted: 'var(--muted)',
        accent: 'var(--accent)',
      },
    },
  },
}

export default config
