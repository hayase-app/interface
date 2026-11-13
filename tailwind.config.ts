import { fontFamily } from 'tailwindcss/defaultTheme'
import plugin from 'tailwindcss/plugin'

import type { Config } from 'tailwindcss'

const config: Config = {
  plugins: [
    plugin((api) => {
      api.addVariant('starting', '@starting-style')
      api.addVariant('select', ['&:hover', '&:focus-visible', '&:active'])
      api.addVariant('group-select', [':merge(.group):hover &', ':merge(.group):focus-visible &', ':merge(.group):active &'])
      api.addVariant('fullscreen', ['&:fullscreen', '&.custom-fullscreen'])
      api.addVariant('group-fullscreen', [':merge(.group):fullscreen &', ':merge(.group).custom-fullscreen &'])
      api.matchVariant(
        'group-fullscreen',
        (value, { modifier }) => [
          ':merge(.group):fullscreen &',
          `:merge(.group\\/${modifier}):fullscreen &`,
          ':merge(.group).custom-fullscreen &',
          `:merge(.group\\/${modifier}).custom-fullscreen &`
        ],
        { values: { DEFAULT: undefined } }
      )
      api.matchVariant(
        'group-select',
        (value, { modifier }) => [
          ':merge(.group):hover &',
          `:merge(.group\\/${modifier}):hover &`,
          ':merge(.group):focus-visible &',
          `:merge(.group\\/${modifier}):focus-visible &`,
          ':merge(.group):active &',
          `:merge(.group\\/${modifier}):active &`
        ],
        { values: { DEFAULT: undefined } }
      )
      api.addVariant('mobile', '@media (pointer: none), (pointer: coarse)')
      api.addVariant('desktop', '@media not ((pointer: none) or (pointer: coarse))')
      api.matchUtilities(
        {
          'view-transition': (value) => ({
            'view-transition-name': value
          })
        },
        {
          values: { DEFAULT: 'auto' },
          type: 'any'
        }
      )
      api.matchUtilities(
        {
          'backdrop-fade': (value) => ({
            '-webkit-backdrop-filter': `blur(${value})`,
            'backdrop-filter': `blur(${value})`,
            '-webkit-mask-image': 'linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%), linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
            '-webkit-mask-composite': 'source-in',
            'mask-image': 'linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%), linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
            'mask-composite': 'intersect'
          })
        },
        { values: { none: '0', sm: '4px', md: '8px', lg: '12px', xl: '24px', '2xl': '40px', '3xl': '64px' } }
      )
    })
  ],
  darkMode: ['class'],
  content: ['./src/**/*.{html,js,svelte,ts}'],
  safelist: ['dark-mode'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
        xs: '480px'
      }
    },
    extend: {
      colors: {
        custom: {
          DEFAULT: 'hsl(from var(--custom) h s l / <alpha-value>)',
          50: 'hsl(from var(--custom) h s 95% / <alpha-value>)',
          100: 'hsl(from var(--custom) h s 90% / <alpha-value>)',
          200: 'hsl(from var(--custom) h s 80% / <alpha-value>)',
          300: 'hsl(from var(--custom) h s 70% / <alpha-value>)',
          400: 'hsl(from var(--custom) h s 60% / <alpha-value>)',
          500: 'hsl(from var(--custom) h s l / <alpha-value>)',
          600: 'hsl(from var(--custom) h s 40% / <alpha-value>)',
          700: 'hsl(from var(--custom) h s 30% / <alpha-value>)',
          800: 'hsl(from var(--custom) h s 20% / <alpha-value>)',
          900: 'hsl(from var(--custom) h s 10% / <alpha-value>)',
          950: 'hsl(from var(--custom) h s 5% / <alpha-value>)'
        },
        theme: 'hsl(346.6deg 79.12% 51.18% / <alpha-value>)',
        border: 'hsl(from var(--border) h s l / <alpha-value>)',
        input: 'hsl(from var(--input) h s l / <alpha-value>)',
        ring: 'hsl(from var(--ring) h s l / <alpha-value>)',
        background: 'hsl(from var(--background) h s l / <alpha-value>)',
        foreground: 'hsl(from var(--foreground) h s l / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(from var(--primary) h s l / <alpha-value>)',
          foreground: 'hsl(from var(--primary-foreground) h s l / <alpha-value>)'
        },
        secondary: {
          DEFAULT: 'hsl(from var(--secondary) h s l / <alpha-value>)',
          foreground: 'hsl(from var(--secondary-foreground) h s l / <alpha-value>)'
        },
        destructive: {
          DEFAULT: 'hsl(from var(--destructive) h s l / <alpha-value>)',
          foreground: 'hsl(from var(--destructive-foreground) h s l / <alpha-value>)'
        },
        muted: {
          DEFAULT: 'hsl(from var(--muted) h s l / <alpha-value>)',
          foreground: 'hsl(from var(--muted-foreground) h s l / <alpha-value>)'
        },
        accent: {
          DEFAULT: 'hsl(from var(--accent) h s l / <alpha-value>)',
          foreground: 'hsl(from var(--accent-foreground) h s l / <alpha-value>)'
        },
        popover: {
          DEFAULT: 'hsl(from var(--popover) h s l / <alpha-value>)',
          foreground: 'hsl(from var(--popover-foreground) h s l / <alpha-value>)'
        },
        card: {
          DEFAULT: 'hsl(from var(--card) h s l / <alpha-value>)',
          foreground: 'hsl(from var(--card-foreground) h s l / <alpha-value>)'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      transitionTimingFunction: {
        'back-out': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'back-in-out': 'cubic-bezier(0.68, -0.6, 0.32, 1.6)'
      },
      fontFamily: {
        sans: [...fontFamily.sans]
      },
      screens: {
        '4xs': '280px',
        '3xs': '320px',
        '2xs': '360px',
        '2xl': '1400px',
        xs: '480px'
      }
    }
  }
}

export default config
