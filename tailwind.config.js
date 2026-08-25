/** AI Integration Hub design tokens — derived from the brand logo (slate-navy → electric blue
 *  gradient mark with a mint accent). Semantic role names follow the original Material 3 scheme
 *  so every screen built against those roles picks up the new brand without a rename. */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand blue (primary) — matches the logo's bright gradient stop / "HUB" wordmark.
        primary: "#0A5CD1",
        "on-primary": "#ffffff",
        "primary-container": "#dceaff",
        "on-primary-container": "#0a4aa8",
        "primary-fixed": "#bfe0ff",
        "primary-fixed-dim": "#0aa2fe",
        "on-primary-fixed": "#072b66",
        "on-primary-fixed-variant": "#0a4aa8",
        "inverse-primary": "#6fb2ff",
        "surface-tint": "#0a5cd1",

        // Mint (secondary) — the logo's accent dot; used for success / positive states.
        secondary: "#00a98a",
        "on-secondary": "#ffffff",
        "secondary-container": "#d3fbf1",
        "on-secondary-container": "#00695c",
        "secondary-fixed": "#9ff3e0",
        "secondary-fixed-dim": "#00bfa0",
        "on-secondary-fixed": "#00332b",
        "on-secondary-fixed-variant": "#00695c",

        // Amber (tertiary) — reserved for warning / pending states.
        tertiary: "#b45309",
        "on-tertiary": "#ffffff",
        "tertiary-container": "#fdecc8",
        "on-tertiary-container": "#92620a",
        "tertiary-fixed": "#ffe1a8",
        "tertiary-fixed-dim": "#f2a93c",
        "on-tertiary-fixed": "#402400",
        "on-tertiary-fixed-variant": "#7a4e00",

        error: "#b3261e",
        "on-error": "#ffffff",
        "error-container": "#ffdad4",
        "on-error-container": "#7d0f0a",

        // Ink-tinted neutrals (replace flat grays with the logo's slate-navy undertone).
        background: "#f7f9fc",
        "on-background": "#0d1420",
        surface: "#ffffff",
        "on-surface": "#0d1420",
        "on-surface-variant": "#4b5568",
        "surface-variant": "#eef1f6",
        "surface-dim": "#e3e7ef",
        "surface-bright": "#ffffff",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f7f9fc",
        "surface-container": "#f0f3f8",
        "surface-container-high": "#e7ebf2",
        "surface-container-highest": "#dee3ec",
        outline: "#8891a3",
        "outline-variant": "#dce1ea",
        "inverse-surface": "#101827",
        "inverse-on-surface": "#eaf0fb",

        // Additive brand accents (not part of the M3 role set) for hero/marketing surfaces.
        "brand-mint": "#00e6be",
        "brand-glow": "#4fc3fe",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #37415a 0%, #0a5cd1 55%, #0aa2fe 100%)",
        "brand-radial-glow": "radial-gradient(circle, rgba(10,162,254,0.35) 0%, rgba(10,162,254,0) 70%)",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(13,20,32,0.04), 0 1px 3px rgba(13,20,32,0.06)",
        card: "0 2px 8px rgba(13,20,32,0.06), 0 1px 2px rgba(13,20,32,0.04)",
        elevated: "0 20px 40px -12px rgba(10,50,120,0.22), 0 4px 12px -4px rgba(13,20,32,0.08)",
        glow: "0 0 60px rgba(10,162,254,0.35)",
      },
      borderRadius: { DEFAULT: "0.125rem", lg: "0.25rem", xl: "0.5rem", full: "0.75rem" },
      spacing: { "row-height-density": "40px", gutter: "24px", "margin-page": "32px", unit: "4px", "component-gap": "12px" },
      fontFamily: {
        "mono-data": ["IBM Plex Mono", "monospace"],
        "headline-lg": ["Archivo", "sans-serif"],
        "headline-sm": ["Archivo", "sans-serif"],
        "headline-md": ["Archivo", "sans-serif"],
        "body-md": ["IBM Plex Sans", "sans-serif"],
        "body-lg": ["IBM Plex Sans", "sans-serif"],
        "label-caps": ["Archivo", "sans-serif"],
      },
      fontSize: {
        "mono-data": ["13px", { lineHeight: "1.4", fontWeight: "450" }],
        "headline-lg": ["32px", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-sm": ["18px", { lineHeight: "1.4", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "600" }],
        "body-md": ["14px", { lineHeight: "1.5", fontWeight: "400" }],
        "body-lg": ["16px", { lineHeight: "1.6", fontWeight: "400" }],
        "label-caps": ["12.5px", { lineHeight: "1.4", letterSpacing: "0.06em", fontWeight: "700" }],
      },
    },
  },
  plugins: [],
};
