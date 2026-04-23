import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        heading: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      colors: {
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
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
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
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 12px -4px hsl(160 84% 44% / 0.2)" },
          "50%": { boxShadow: "0 0 20px -4px hsl(160 84% 44% / 0.35)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.4s ease-out forwards",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
      typography: {
        DEFAULT: {
          css: {
            color: "hsl(var(--foreground))",
            maxWidth: "none",
            hr: {
              borderColor: "hsl(var(--border))",
              marginTop: "1.5em",
              marginBottom: "1.5em",
            },
            "h1, h2, h3, h4": {
              color: "hsl(var(--foreground))",
              fontWeight: "700",
              letterSpacing: "-0.025em",
            },
            h2: {
              marginTop: "1.5em",
              marginBottom: "0.5em",
              color: "#10b981", // emerald-500
            },
            code: {
              color: "#34d399", // emerald-400
              backgroundColor: "rgba(16, 185, 129, 0.1)",
              paddingLeft: "0.25rem",
              paddingRight: "0.25rem",
              paddingTop: "0.125rem",
              paddingBottom: "0.125rem",
              borderRadius: "0.25rem",
              fontWeight: "400",
            },
            "code::before": { content: 'none' },
            "code::after": { content: 'none' },
            blockquote: {
              borderLeftColor: "#10b981",
              backgroundColor: "rgba(16, 185, 129, 0.05)",
              padding: "0.5rem 1rem",
              fontStyle: "italic",
              color: "hsl(var(--muted-foreground))",
            },
            ul: {
              listStyleType: "none",
              paddingLeft: "0",
            },
            "ul > li": {
              position: "relative",
              paddingLeft: "1.5rem",
            },
            "ul > li::before": {
              content: '""',
              width: "0.375rem",
              height: "0.375rem",
              borderRadius: "50%",
              backgroundColor: "#10b981",
              position: "absolute",
              left: "0.25rem",
              top: "0.625rem",
            },
          },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
