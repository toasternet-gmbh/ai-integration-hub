---
name: Control Ledger
colors:
  surface: '#f8f9fb'
  surface-dim: '#d9dadc'
  surface-bright: '#f8f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f6'
  surface-container: '#edeef0'
  surface-container-high: '#e7e8ea'
  surface-container-highest: '#e1e2e4'
  on-surface: '#191c1e'
  on-surface-variant: '#454653'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f3'
  outline: '#767684'
  outline-variant: '#c6c5d5'
  surface-tint: '#4554bc'
  primary: '#12238f'
  on-primary: '#ffffff'
  primary-container: '#2f3ea6'
  on-primary-container: '#abb4ff'
  inverse-primary: '#bcc2ff'
  secondary: '#006d43'
  on-secondary: '#ffffff'
  secondary-container: '#93f7bd'
  on-secondary-container: '#007348'
  tertiary: '#4b2d00'
  on-tertiary: '#ffffff'
  tertiary-container: '#6a4100'
  on-tertiary-container: '#f7aa46'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dfe0ff'
  primary-fixed-dim: '#bcc2ff'
  on-primary-fixed: '#000c61'
  on-primary-fixed-variant: '#2b3ba3'
  secondary-fixed: '#93f7bd'
  secondary-fixed-dim: '#77daa3'
  on-secondary-fixed: '#002111'
  on-secondary-fixed-variant: '#005232'
  tertiary-fixed: '#ffddb9'
  tertiary-fixed-dim: '#ffb962'
  on-tertiary-fixed: '#2b1700'
  on-tertiary-fixed-variant: '#663e00'
  background: '#f8f9fb'
  on-background: '#191c1e'
  surface-variant: '#e1e2e4'
typography:
  headline-lg:
    fontFamily: Archivo
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Archivo
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Archivo
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  mono-data:
    fontFamily: IBM Plex Mono
    fontSize: 13px
    fontWeight: '450'
    lineHeight: '1.4'
  label-caps:
    fontFamily: Archivo
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.08em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin-page: 32px
  component-gap: 12px
  row-height-density: 40px
---

## Brand & Style

This design system is engineered as a professional-grade technical instrument for high-stakes AI orchestration. Moving away from generic SaaS "softness," it adopts a **Control Ledger** aesthetic—a synthesis of high-density engineering tools and modern data-rich environments. 

The visual language is rooted in **Modern Minimalism** with a technical, structural bias. It prioritizes information density, legibility, and state clarity over decorative elements. The atmosphere is quiet, precise, and authoritative, evoking the feeling of a mission-critical terminal. A faint dot-grid texture (opacity 0.03) provides a subtle substrate for all surfaces, reinforcing the "blueprint" or "ledger" feel.

## Colors

The palette is strictly cool-toned to maintain a clinical, professional focus. The **Ground** is a blue-grey that prevents eye fatigue during long monitoring sessions, while the **Ink** provides maximum contrast with a slight blue bias.

- **Primary Accent:** A flat, deep indigo used for primary actions and key structural highlights. No gradients are permitted.
- **Semantic Status:** These colors are never used as large background fills. They are reserved for status indicators (pills, dots, and text labels) to ensure color-blind accessibility and rapid scanning.
- **Dividers:** 1px hairlines using the Ink color at 12% opacity (Light) or 20% opacity (Dark).

## Typography

The typographic system utilizes a dual-sans approach paired with a technical monospace.

- **Archivo** provides a rigid, geometric structure for headers and metadata labels.
- **IBM Plex Sans** handles long-form content and UI labels with high legibility.
- **IBM Plex Mono** is mandatory for all numerical data, IDs, and code-based parameters. 
- **Localization Note:** Line heights are set generously (1.5–1.6 for body) to accommodate the increased character count and vertical requirements of German text strings. Avoid fixed-width containers for text to allow for "expansion" without truncation.

## Layout & Spacing

The layout follows a **Fixed-Column Grid** for administrative panels and a **Fluid Content Area** for data tables. 

- **Grid:** 12-column system with 24px gutters.
- **Density:** Elements are spaced closely to maximize "at-a-glance" information. However, horizontal padding within buttons and inputs must be increased by 30% relative to standard SaaS designs to ensure German words (e.g., *Schnittstellenkonfiguration*) do not feel cramped.
- **Navigation:** A 64px width Navigation Rail on the left houses primary icons, expanding to 240px only upon user interaction.
- **Breakpoints:** 
  - Mobile: < 600px (Single column, 16px margins)
  - Tablet: 600px–1024px (8 columns, 24px margins)
  - Desktop: 1024px+ (12 columns, 32px margins)

## Elevation & Depth

In keeping with the "Control Ledger" theme, there are **no box-shadows** in this design system. Depth is created through:

1.  **Tonal Layering:** Surfaces are differentiated by slight shifts in hex value or the application of 1px borders.
2.  **Hairline Dividers:** 1px solid lines create the primary structural separations.
3.  **Inset States:** For pressed buttons or active input fields, a subtle 1px inset border or a shift in the background fill color is used.
4.  **Z-Index Focus:** Modals or overlays do not cast shadows; instead, they use a high-contrast 1px border and a semi-opaque dimming of the background ground color.

## Shapes

The shape language is "Soft-Technical." Elements use a consistent **4px to 6px corner radius**. This is sharp enough to feel architectural and efficient, but slightly softened to avoid the harshness of a purely Brutalist aesthetic.

- **Buttons/Inputs:** 4px radius.
- **Cards/Containers:** 6px radius.
- **Status Pills:** Fully rounded (pill-shaped) to distinguish them from interactive buttons.
- **Icons:** 1.5pt stroke weight, square ends, no rounded caps.

## Components

### Buttons
- **Primary:** Solid Indigo background (#2F3EA6), White text, 4px radius.
- **Secondary:** Transparent background, 1px Indigo border.
- **Tertiary/Ghost:** No border, Indigo text, highlighted on hover with a 5% opacity Indigo fill.

### Status Pills
- Compact height (24px).
- Light grey background with a 1px border of the semantic color at 30% opacity.
- **The Dot:** A 6px solid circle of the semantic color (Green/Amber/Red) precedes the label text.

### Data Tables
- Header row uses `label-caps` typography with a 1px bottom border.
- Body rows use `mono-data` for all numeric values.
- No alternating row colors; use 1px horizontal hairlines only.

### Input Fields
- 1px border (#14181F at 20% opacity).
- Square corners (4px).
- Labels are always top-aligned using `label-caps`.
- Validation errors use the Error/Deny color for both text and a 2px bottom-border accent.

### Navigation Rail
- Fixed 64px width.
- Icons are centered. Active state is indicated by a 3px vertical Indigo line on the far left edge of the rail.