import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        // Krój ustawiany per marka przez --font-heading (BrandContext).
        heading: ["var(--font-heading)", "Outfit", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "Inter Variable", "Inter", "system-ui", "sans-serif"],
      },
      // Brandbook rozdz. 02 — skala typograficzna. 13 px to podłoga:
      // text-xs = 13 px (Caption), text-sm = 14 px (Label, minimum dla UI).
      // Jedyny wyjątek 12 px to Overline — klasa .text-overline w index.css.
      fontSize: {
        xs: ["0.8125rem", { lineHeight: "1.45" }],
        sm: ["0.875rem", { lineHeight: "1.4" }],
        base: ["1rem", { lineHeight: "1.6" }],
        lg: ["1.125rem", { lineHeight: "1.55" }],
        xl: ["1.3125rem", { lineHeight: "1.3", letterSpacing: "-0.012em" }],
        "2xl": ["1.75rem", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        "3xl": ["2.25rem", { lineHeight: "1.1", letterSpacing: "-0.025em" }],
        "4xl": ["3rem", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
      },
      colors: {
        // Rampa brandbooka wystawiona jako klasy Tailwind, żeby nie było powodu
        // wpisywać wartości bezpośrednich (bg-brand-navy-deep, text-brand-yellow-ink…).
        brand: {
          navy: "hsl(var(--mt-navy-700))",
          "navy-deep": "hsl(var(--mt-navy-900))",
          "navy-soft": "hsl(var(--mt-navy-600))",
          yellow: "hsl(var(--mt-yellow-500))",
          "yellow-ink": "hsl(var(--mt-yellow-800))",
          "yellow-soft": "hsl(var(--mt-yellow-50))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          soft: "hsl(var(--destructive-soft))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        // Najjaśniejszy dopuszczalny kolor tekstu (Neutral 500, 5,94:1 na bieli).
        subtle: {
          DEFAULT: "hsl(var(--subtle-foreground))",
          foreground: "hsl(var(--subtle-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          soft: "hsl(var(--success-soft))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          soft: "hsl(var(--warning-soft))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      minHeight: {
        touch: "var(--mt-touch-min)",
        btn: "var(--mt-btn-h)",
        input: "var(--mt-input-h)",
      },
      minWidth: {
        touch: "var(--mt-touch-min)",
      },
      height: {
        btn: "var(--mt-btn-h)",
        input: "var(--mt-input-h)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-in-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-in-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "fade-in-up": "fade-in-up 0.4s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "slide-in-left": "slide-in-left 0.3s ease-out",
        "slide-in-up": "slide-in-up 0.3s ease-out",
        shimmer: "shimmer 2s infinite linear",
      },
      spacing: {
        header: "var(--header-height)",
        filter: "var(--filter-width)",
        touch: "var(--mt-touch-min)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
