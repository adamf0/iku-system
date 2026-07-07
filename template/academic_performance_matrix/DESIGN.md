---
name: Academic Performance Matrix
colors:
  surface: '#f9f9ff'
  surface-dim: '#d7dae4'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3fe'
  surface-container: '#ebedf8'
  surface-container-high: '#e5e8f2'
  surface-container-highest: '#e0e2ec'
  on-surface: '#181c23'
  on-surface-variant: '#404754'
  inverse-surface: '#2d3038'
  inverse-on-surface: '#eef0fb'
  outline: '#717785'
  outline-variant: '#c0c6d6'
  surface-tint: '#005db5'
  primary: '#005bb1'
  on-primary: '#ffffff'
  primary-container: '#0073dd'
  on-primary-container: '#fefcff'
  inverse-primary: '#a8c8ff'
  secondary: '#535f71'
  on-secondary: '#ffffff'
  secondary-container: '#d7e3f9'
  on-secondary-container: '#596577'
  tertiary: '#595c5f'
  on-tertiary: '#ffffff'
  tertiary-container: '#727578'
  on-tertiary-container: '#fbfcff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#a8c8ff'
  on-primary-fixed: '#001b3d'
  on-primary-fixed-variant: '#00468a'
  secondary-fixed: '#d7e3f9'
  secondary-fixed-dim: '#bbc7dc'
  on-secondary-fixed: '#101c2c'
  on-secondary-fixed-variant: '#3c4859'
  tertiary-fixed: '#e0e3e6'
  tertiary-fixed-dim: '#c4c7ca'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#44474a'
  background: '#f9f9ff'
  on-background: '#181c23'
  surface-variant: '#e0e2ec'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-upper:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  status-label:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 12px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-margin: 1rem
  stack-gap: 1rem
  inline-gap: 0.75rem
  card-padding: 1.25rem
  section-margin: 2rem
---

## Brand & Style

The design system is engineered for the high-stakes environment of university performance monitoring (IKU). It prioritizes **clarity, institutional authority, and rapid data synthesis**. The aesthetic follows a **Corporate Modern** style with subtle **Glassmorphism** accents to maintain a fresh, lightweight feel on mobile devices.

The target audience consists of university administrators and stakeholders who require immediate visibility into Key Performance Indicators. The emotional response is one of **confidence and precision**. By utilizing heavy whitespace and a structured information hierarchy, the system reduces cognitive load during critical reporting periods.

- **Primary Motif:** Soft-edged data containers against a multi-tonal light background.
- **Visual Weight:** Light and airy, with depth conveyed through soft ambient shadows rather than heavy lines.
- **Tone:** Professional, objective, and performance-oriented.

## Colors

The color palette is rooted in a professional "University Blue" that signals trust and institutional heritage.

- **Primary Blue:** Used for primary actions, active navigation states, and the "In Progress" status.
- **Secondary (Deep Navy):** Reserved for high-contrast typography and essential brand elements.
- **Neutrals:** A range of cool grays provides soft scaffolding for data grids without competing with status indicators.
- **Status Indicators:** 
  - **Success (Green):** Signals completed KPIs or met targets.
  - **Progress (Blue):** Indicates active data collection or ongoing cycles.
  - **Attention (Red):** Highlights missed deadlines or urgent performance gaps.

Color is used functionally—vibrant hues are reserved for data visualization and status, while the UI chrome remains neutral.

## Typography

This design system utilizes **Hanken Grotesk** for its technical yet approachable character, ensuring high legibility on mobile screens. **Inter** is used for functional labels and status tags to provide a slight stylistic distinction for meta-data.

- **High Contrast:** Use Secondary Navy (#1D2939) for headlines against light backgrounds to ensure AAA accessibility.
- **Numerical Data:** Use `display-lg` for KPI percentages and scores to make them the focal point of dashboard cards.
- **Hierarchy:** Maintain clear vertical rhythm by using `label-upper` for section headers and `body-md` for supporting descriptions.

## Layout & Spacing

The system follows a **Fluid Mobile-First** model. Content is organized in a single-column stack on mobile devices, expanding to a multi-column grid on tablets.

- **Grid:** 4-column mobile grid with 16px (1rem) side margins.
- **Rhythm:** An 8px base unit drives all spacing decisions. 
- **Safe Zones:** Ensure all interactive elements (buttons, list items) maintain a minimum height of 48px for touch targets.
- **Density:** The layout is "airy." Avoid crowding data; use `section-margin` to separate distinct KPI categories (e.g., Student Metrics vs. Faculty Metrics).

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Ambient Shadows**.

- **Surface Level 0:** Background Main (#F9FAFB).
- **Surface Level 1:** Pure White (#FFFFFF) cards with a very soft, diffused shadow (0px 4px 20px rgba(0, 0, 0, 0.05)).
- **Surface Level 2:** Active modals or dropdowns with a more pronounced shadow and a 1px neutral-200 border.
- **Glassmorphism:** Use a backdrop blur (12px) on top navigation bars to allow the brand colors from charts to subtly bleed through as the user scrolls, maintaining a sense of place.

## Shapes

The shape language is defined by **Soft Geometric** forms. This balances the rigid nature of institutional data with a modern, user-friendly mobile experience.

- **Base Corner Radius:** 0.5rem (8px) for standard input fields and buttons.
- **Card Radius:** 1rem (16px) for main content containers and dashboard widgets.
- **Full Round:** Used exclusively for status chips (pill-shaped) and progress bars to contrast against the structured squareness of the grid.

## Components

### Buttons
- **Primary:** Solid Primary Blue with white text. High-contrast, 0.5rem radius.
- **Secondary:** White background with Primary Blue border and text.
- **Tertiary:** Ghost style; text-only with a subtle gray hover/tap state.

### Cards (KPI Widgets)
- White background, 1rem radius, soft ambient shadow.
- Must include a `label-upper` category title and a high-contrast `display-lg` metric.
- Bottom-aligned status indicator or trend sparkline.

### Status Chips
- Pill-shaped with a background opacity of 10% of the status color and 100% opacity for the text and leading icon.
- Example: "Met Target" uses Success Green.

### Input Fields
- Labeled above the field. 1px solid gray-200 border. 
- Active state: 1px solid Primary Blue with a subtle blue outer glow.

### Lists
- Clean, borderless rows separated by 1px Neutral-100 lines.
- Each row includes a chevron-right icon to indicate drill-down capability for specific KPI details.