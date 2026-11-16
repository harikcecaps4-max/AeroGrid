# AeroGrid Design System — Tactile Precision / Modern Cartographic (Light Mode)

CSS custom properties live in [tokens.css](file:///Users/maverick/AeroGrid/client/src/styles/tokens.css) and align with the light-mode specification in `design/stitch/stitch_aerogrid_regional_fleet_planner/aerogrid/DESIGN.md`.

## Color Palette

| Role | Token | Hex | Notes |
| --- | --- | --- | --- |
| Substrate Canvas | `--surface-canvas` | `#F6F3EA` | Warm paper cream floor (Elevation 0) |
| Bright Chart Paper | `--surface-bright` | `#FCF9F0` | Header strips, telemetry boxes, spec grids |
| Card / Surface Container | `--surface-card` | `#FFFFFF` | Analytical cards, sidebar, top command bar |
| Container Base | `--surface-container` | `#F1EEE5` | Hairline dividers, hover surfaces |
| Container High / Highest | `--surface-container-high` / `--surface-container-highest` | `#EBE8DF` / `#E5E2DA` | Segmented toggle well & active chip hover |
| Paper Border Line | `--border-paper` / `--border-paper-strong` | `#DDD6C8` / `#C8BFB0` | 1px card rules and reinforced overlays |
| Deep Ink Navy | `--text-ink` | `#14213D` | Primary headings, body emphasis, primary values |
| Muted Slate | `--text-slate` | `#5B6475` | Secondary descriptors and sub-labels |
| AA Muted Telemetry Label | `--text-muted-aa` | `#525B6C` | Micro monospace uppercase headers (WCAG AA compliant) |
| Chart Blue | `--chart-blue` / `--chart-blue-strong` | `#2F6FBA` / `#0056A0` | Active nav, corridors, telemetry links, primary outline |
| Aviation Orange | `--aviation-orange` / `--aviation-orange-bright` | `#C04600` / `#E8590C` | Primary route simulation CTA (`#C04600` for AA white text) |

### Operational Verdicts

| Verdict | Foreground | Background | Border |
| --- | --- | --- | --- |
| **Viable / Pass** | `--verdict-viable-text` (`#15803D`) | `--verdict-viable-pill` (`#DCFCE7`) | `--verdict-viable-border` (`#86EFAC`) |
| **Conditional / Amber** | `--verdict-conditional-text` (`#9A3412`) | `--verdict-conditional-pill` (`#FFF7ED`) | `--verdict-conditional-border` (`#FDBA74`) |
| **Not Viable / Reject** | `--verdict-nonviable-text` (`#B91C1C`) | `--verdict-nonviable-pill` (`#FEF2F2`) | `--verdict-nonviable-border` (`#FCA5A5`) |

## Typography

| Role | Font Family | CSS Variable | Scale |
| --- | --- | --- | --- |
| Architectural Titles & Big KPIs | `Space Grotesk` | `--font-display` | `40px` (`--type-display-lg`), `28px` (`--type-headline-lg`), `20px` (`--type-headline-md`) |
| UI Controls & Assessment Copy | `Inter` | `--font-ui` | `16px` (`--type-body-lg`), `14px` (`--type-body-md`), `12px` (`--type-body-sm`) |
| Telemetry, ICAO/Coordinates, Matrices | `JetBrains Mono` | `--font-mono` | `14px` (`--type-mono-lg`), `12px` (`--type-mono-md`), `10px` (`--type-mono-sm`) |

Tabular numerals (`font-variant-numeric: tabular-nums`) are applied to all metrics, ICAO/WGS-84 coordinates, runway lengths, and telemetry readouts.

## Spacing, Grid & Elevation

- **Structural rhythm:** 4px baseline (`--space-xxs: 2px`, `--space-xs: 4px`, `--space-sm: 8px`, `--space-md: 12px`, `--space-lg: 16px`, `--space-xl: 24px`, `--space-2xl: 36px`).
- **Workspace grid:** 12-column Overview split (`7` columns Aeronautical Radar MFD + Elevation Cross-Section / `5` columns Priority Airfield Audits), collapsing to a single column below `1024px`.
- **Shape radii:** `--radius-sm` (`6px`) for badges/tags, `--radius-md` (`10px`) for controls/inner panels, `--radius-lg` (`12px`) for cards, `--radius-xl` (`16px`) for the mission dispatch console.
- **Elevation:**
  - Level 0: `#F6F3EA` canvas substrate
  - Level 1 (`--shadow-elev-1`): `#FFFFFF` cards with `1px solid #DDD6C8` border
  - Level 2 (`--shadow-elev-2`): floating radar HUD overlays & sticky top bar

## WCAG 2.1 AA Contrast Verification

Computed luminance contrast ratios across Overview light-mode pairs (AA threshold: `>= 4.5:1` normal text, `>= 3.0:1` large display):

| Foreground on Background | Ratio | Status |
| --- | --- | --- |
| `#14213D` on `#FFFFFF` (Primary text on card) | `15.97:1` | AAA |
| `#14213D` on `#F6F3EA` (Primary text on canvas) | `14.40:1` | AAA |
| `#5B6475` on `#FFFFFF` (Secondary slate on card) | `5.96:1` | AA |
| `#5B6475` on `#F6F3EA` (Secondary slate on canvas) | `5.37:1` | AA |
| `#525B6C` on `#FCF9F0` (Mono header on bright paper) | `6.49:1` | AA |
| `#0056A0` on `#ECF1FF` (Active Chart Blue pill) | `6.55:1` | AA |
| `#2F6FBA` on `#FFFFFF` (Interactive blue links/icons) | `5.12:1` | AA |
| `#FFFFFF` on `#C04600` (Aviation Orange primary CTA) | `5.10:1` | AA |
| `#15803D` on `#DCFCE7` (`VIABLE` / `PASS` badge) | `4.57:1` | AA |
| `#9A3412` on `#FFF7ED` (`CONDITIONAL` / `AMBER` badge) | `6.88:1` | AA |
| `#B91C1C` on `#FEF2F2` (`NOT VIABLE` / `REJECT` badge) | `5.91:1` | AA |
