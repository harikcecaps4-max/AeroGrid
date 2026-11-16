---
name: Polished Silver Aero
colors:
  surface: '#101419'
  surface-dim: '#101419'
  surface-bright: '#36393f'
  surface-container-lowest: '#0a0e13'
  surface-container-low: '#181c21'
  surface-container: '#1c2025'
  surface-container-high: '#262a30'
  surface-container-highest: '#31353b'
  on-surface: '#e0e2ea'
  on-surface-variant: '#c5c6cb'
  inverse-surface: '#e0e2ea'
  inverse-on-surface: '#2d3136'
  outline: '#8e9195'
  outline-variant: '#44474a'
  surface-tint: '#c1c7cf'
  primary: '#ffffff'
  on-primary: '#2b3137'
  primary-container: '#dde3eb'
  on-primary-container: '#5f656c'
  inverse-primary: '#595f66'
  secondary: '#7bd0ff'
  on-secondary: '#00354a'
  secondary-container: '#00a6e0'
  on-secondary-container: '#00374d'
  tertiary: '#ffffff'
  on-tertiary: '#5b1b00'
  tertiary-container: '#ffdbce'
  on-tertiary-container: '#b23d00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dde3eb'
  primary-fixed-dim: '#c1c7cf'
  on-primary-fixed: '#161c22'
  on-primary-fixed-variant: '#41474e'
  secondary-fixed: '#c4e7ff'
  secondary-fixed-dim: '#7bd0ff'
  on-secondary-fixed: '#001e2c'
  on-secondary-fixed-variant: '#004c69'
  tertiary-fixed: '#ffdbce'
  tertiary-fixed-dim: '#ffb59a'
  on-tertiary-fixed: '#380d00'
  on-tertiary-fixed-variant: '#802a00'
  background: '#101419'
  on-background: '#e0e2ea'
  surface-variant: '#31353b'
typography:
  display:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 56px
    letterSpacing: -0.03em
  display-mobile:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '500'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 26px
    letterSpacing: 0em
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.06em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.08em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 0.75rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system expresses ultra-precision aerospace instrumentation fused with high-luxury liquid chrome and polished silver craftsmanship. Moving away from raw utilitarian titanium, the aesthetic evokes the specular gleam of precision-milled aluminum intake lips, mirror-finish silver turbine assemblies, and high-altitude flight deck command consoles illuminated by neon indicator lights under night operations.

The target audience comprises flight operations executives, aerospace systems engineers, private aviation mission specialists, and elite defense telemetry operators. The visual tone must feel authoritative, pristine, frictionless, and exactingly machined.

The interface merges modern dark minimalism with high-end skeuomorphic specular metallic treatment. It avoids heavy unrefined skeuomorphism in favor of hyper-crisp, 1px chrome hairline boundaries, directional specular top-rim lighting, and deep obsidian-to-platinum backdrops punctuated by surgical avionics indicators.

## Colors

The foundation is built on deep obsidian and deep platinum space-blacks, preventing pure pitch black to allow liquid chrome light interactions:
- **Base Canvas (`neutral_color_hex`)**: `#0b0f14` (Deep obsidian void).
- **Surface Elevation 1**: `#12161f` (Dark platinum metal sheen).
- **Surface Elevation 2**: `#181f2a` (Elevated console module surface).
- **Primary Metal (`primary_color_hex`)**: `#e2e8f0` (Polished liquid silver), running through linear gradients with `#94a3b8` (Brushed steel) and `#cbd5e1` (Raw silver bullion).
- **Avionics Secondary (`secondary_color_hex`)**: `#38bdf8` (Electric avionics blue) used for active telemetry, target locks, nominal state indicators, and hyper-focused navigational links.
- **Avionics Tertiary (`tertiary_color_hex`)**: `#ff6b2b` (Radiant aviation orange) reserved for caution advisories, supersonic/afterburner states, critical vector alerts, and priority action states.
- **Specular Highlight**: Linear gradient along the top edge from `rgba(255, 255, 255, 0.7)` through `rgba(180, 195, 210, 0.2)` fading to transparent.
- **Secondary Steel Text**: `#94a3b8` for structural labels, secondary telemetry, and inactive switch plates.

## Typography

The typographic hierarchy strikes a balance between aeronautical flight instrumentation and modernist luxury editorial.

1. **Headlines (`Space Grotesk`)**: Rendered in crisp, icy silver-white (`#ffffff` and `#f1f5f9`). Kerning is slightly condensed to reflect technical flight display ergonomics without sacrificing legibility.
2. **Body Text (`Geist`)**: Neutral, ultra-sharp grotesque designed for legibility at density. Primary copy sits at `#e2e8f0`, while contextual descriptions and support details rest in cool metallic steel (`#94a3b8`).
3. **Data & Telemetry (`JetBrains Mono`)**: Applied to all system statuses, coordinates, callsigns, timestamps, and metric readouts. Labels are rendered uppercase with generous tracking to emulate etched flight chassis numbering.

## Layout & Spacing

Layouts adhere to a rigid, high-density 12-column grid engine inspired by aircraft head-up displays (HUD) and command multi-function displays (MFDs).

- **Desktop (1200px+)**: 12-column layout, 24px (`1.5rem`) gutters, 32px (`2rem`) screen margins. Side utility bays, primary vector grids, and modular telemetry pods snap edge-to-edge with micro-gap separators.
- **Tablet (768px - 1199px)**: 8-column layout, 16px (`1rem`) gutters, 24px (`1.5rem`) margins. Ancillary side consoles collapse into dismissible drawer sheets.
- **Mobile (< 768px)**: 4-column layout, 12px (`0.75rem`) gutters, 16px (`1rem`) outer margin. Telemetry stacks vertically; dense flight data strips convert into horizontal kinetic swipe rails.

Consistent multiples of 4px govern internal component padding (`space-xs` to `space-xl`), ensuring structural alignment between gauges, chrome borders, and split views.

## Elevation & Depth

Visual hierarchy uses physical precision-milled layering rather than fuzzy, unfocused drop shadows:

1. **Liquid Chrome Specular Rims**: Every card, modal, and panel features a directional top-rim bevel via a 1px border gradient: `linear-gradient(180deg, rgba(255, 255, 255, 0.7) 0%, rgba(180, 195, 210, 0.2) 30%, rgba(255, 255, 255, 0.05) 100%)`. The bottom and side borders remain crisp at `1px solid rgba(148, 163, 184, 0.18)`.
2. **Surface Stacking**:
   - Level 0 (Base Void): `#0b0f14`.
   - Level 1 (Panels & Rails): `#12161f` with a subtle linear background grade: `linear-gradient(145deg, #161c27 0%, #0f131a 100%)`.
   - Level 2 (Floating Pods & Popovers): `#181f2a` with an inset specular border `inset 0 1px 0 rgba(255, 255, 255, 0.4)`.
3. **Neon Glow Indicators**: In place of heavy ambient drop shadows, illuminated states rely on tight 4px to 12px glows colored to the function:
   - Avionics Blue: `0 0 14px rgba(56, 189, 248, 0.45)`.
   - Aviation Orange: `0 0 14px rgba(255, 107, 43, 0.45)`.
   - Specular Reflection Glow: `0 8px 32px rgba(0, 0, 0, 0.7)`.

## Shapes

The design system enforces a precision-machined "Soft" radius profile (`roundedness: 1`), keeping corner radiuses tight and intentional like CNC-milled avionics casing:

- **Base Components (Inputs, Buttons, Badges)**: 4px (`0.25rem`).
- **Cards & Data Modules (`rounded-lg`)**: 8px (`0.5rem`).
- **Overlays, Drawers & Dialog Modals (`rounded-xl`)**: 12px (`0.75rem`).

Circular elements are reserved exclusively for status diodes, radar scopes, radial coordinate dials, and tactical state indicators. Extreme pill radii are strictly avoided to retain an angular, professional aeronautical edge.

## Components

### Buttons
- **Liquid Chrome (Primary)**: Background is a brushed silver gradient `linear-gradient(180deg, #f1f5f9 0%, #cbd5e1 50%, #94a3b8 100%)`. Text is deep obsidian `#0b0f14` with a medium font-weight. Includes an ultra-sharp top highlight `inset 0 1px 0 rgba(255, 255, 255, 0.9)`.
- **Avionics Active (Secondary)**: Background is `rgba(56, 189, 248, 0.12)`, 1px border in `#38bdf8`, text in `#38bdf8`, with an outer glow `0 0 10px rgba(56, 189, 248, 0.3)`.
- **Alert / Action (Tertiary)**: Background is `rgba(255, 107, 43, 0.15)`, border in `#ff6b2b`, text in `#ff6b2b`, with glowing indicator pulse.
- **Ghost Chrome (Tertiary)**: Background transparent, 1px border `rgba(226, 232, 240, 0.25)`, text in `#e2e8f0`. Hover transitions the border to polished silver (`#e2e8f0`) with subtle backdrop brightness.

### Badges & Chips
- **Machined Aluminum Badge**: Gradient fill from `#e2e8f0` down to `#94a3b8` with `#0b0f14` label typography.
- **Frosted Silver Badge**: Translucent background `rgba(226, 232, 240, 0.08)`, 1px liquid chrome border, text `#f8fafc`.
- **Status Indicator Badges**: Feature a glowing 6px circular neon diode (Electric Blue for Nominal, Radiant Orange for Warning, Emerald for Armed).

### Input Fields
- **Container**: Fill `#0e121a` with 1px liquid chrome metallic border (`rgba(148, 163, 184, 0.25)`).
- **Top Specular**: 1px subtle top rim line `rgba(255, 255, 255, 0.15)`.
- **Text**: Icy silver-white `#ffffff` with placeholder in metallic steel `#64748b`.
- **Focus State**: Border shifts to `#38bdf8` with an avionics halo ring `0 0 0 1px #38bdf8, 0 0 12px rgba(56, 189, 248, 0.35)`.

### Cards & Telemetry Modules
- **Container**: Surface base `#12161f` encased in the signature 1px specular highlight top-rim: `linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.7) 40%, rgba(180, 195, 210, 0.3) 70%, rgba(255, 255, 255, 0) 100%)`.
- **Header**: Monospaced `#94a3b8` label with a micro status diode and optional numeric telemetry indexing.

### Lists & Data Grids
- **Rows**: Alternating rows use transparent and `rgba(18, 22, 31, 0.6)`.
- **Dividers**: 1px horizontal metallic hairline `rgba(148, 163, 184, 0.12)`.
- **Hover**: Backlight illumination with `linear-gradient(90deg, rgba(56, 189, 248, 0.08) 0%, transparent 100%)` and an avionics blue 2px left border marker.

### Checkboxes & Switches
- **Checkboxes**: 16px square with 2px border radius. Inactive: `#12161f` fill with `#94a3b8` border. Active: Solid polished silver `#e2e8f0` with `#0b0f14` checkmark.
- **Toggle Switches**: Machined aluminum bezel track with deep inset shadow. Thumb switch is liquid chrome with a directional specular sheen, shifting to glow `#38bdf8` when engaged.