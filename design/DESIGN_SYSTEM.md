---
name: Cryptographic Forensics & Claims Engine
colors:
  surface: '#0e1321'
  surface-dim: '#0e1321'
  surface-bright: '#343948'
  surface-container-lowest: '#090e1c'
  surface-container-low: '#161b2a'
  surface-container: '#1a1f2e'
  surface-container-high: '#252a39'
  surface-container-highest: '#303444'
  on-surface: '#dee2f6'
  on-surface-variant: '#bcc9cd'
  inverse-surface: '#dee2f6'
  inverse-on-surface: '#2b303f'
  outline: '#869397'
  outline-variant: '#3d494c'
  surface-tint: '#4cd7f6'
  primary: '#4cd7f6'
  on-primary: '#003640'
  primary-container: '#06b6d4'
  on-primary-container: '#00424f'
  inverse-primary: '#00687a'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#e79400'
  on-tertiary-container: '#563400'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#acedff'
  primary-fixed-dim: '#4cd7f6'
  on-primary-fixed: '#001f26'
  on-primary-fixed-variant: '#004e5c'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#0e1321'
  on-background: '#dee2f6'
  surface-variant: '#303444'
  surface-base: '#0A0F1D'
  surface-card: '#11192E'
  surface-overlay: '#18223C'
  surface-muted: '#0D1424'
  border-subtle: '#1E293B'
  border-strong: '#334155'
  status-verified: '#10B981'
  status-ai: '#06B6D4'
  status-review: '#F59E0B'
  status-tamper: '#EF4444'
  text-primary: '#F8FAFC'
  text-secondary: '#94A3B8'
  text-muted: '#64748B'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 1.75rem
    fontWeight: '600'
    lineHeight: 2.25rem
    letterSpacing: -0.025em
  headline-md:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '600'
    lineHeight: 1.5rem
    letterSpacing: -0.015em
  body-lg:
    fontFamily: Inter
    fontSize: 0.9375rem
    fontWeight: '400'
    lineHeight: 1.5rem
  body-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.375rem
  body-sm:
    fontFamily: Inter
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: 1.25rem
  mono-md:
    fontFamily: JetBrains Mono
    fontSize: 0.8125rem
    fontWeight: '500'
    lineHeight: 1.25rem
  mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1rem
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 0.6875rem
    fontWeight: '600'
    lineHeight: 0.875rem
    letterSpacing: 0.06em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style
This design system defines an authoritative, high-density desktop operations hub designed for claim adjusters, risk analysts, and regulatory forensic auditors. The visual language blends mission-critical fintech discipline with verifiable Web3 transparency. 

The aesthetic is precision-engineered minimalism layered over deep slate tones. High-density data matrices, split-pane forensic comparative viewports, and live ledger stream telemetries prioritize cognitive speed and rapid fraud pattern identification over decorative ornament. Clean architectural borders, subtle tonal containment, and electric status indicators convey an uncompromising posture: institutional trust, computational integrity, and zero-latency auditability.

## Colors
The color hierarchy is built around a light-absorbent obsidian canvas (`#0A0F1D`) paired with modular elevated slate surfaces (`#11192E`), strictly framed by disciplined structural outlines (`#1E293B`).

Functional chromatic accents denote cryptographic certainty:
- **Primary AI Engine (`#06B6D4`)**: Reserved for machine inference output, document OCR confidence scores, perceptual image hash telemetry, and automated recommendation vectors.
- **Secondary Verified Immutable (`#10B981`)**: Strict designation for Merkle tree consensus confirmations, valid block seals, untouched ledger receipts, and algorithmic approvals.
- **Tertiary Human Review (`#F59E0B`)**: Used exclusively for escalated claims requiring manual human override, policy discrepancy thresholds, or pending dual-signature authorizations.
- **Tamper Alert (`#EF4444`)**: Critical status cue signaling broken hash integrity, detected document cloning/forgery, duplicate claim collisions, and chain-of-custody violations.

Background canvases avoid pure black to maintain deep legibility and eliminate halation against intense accent colors.

## Typography
The typography utilizes a bifurcated pairing designed for data analysis:

1. **Inter** handles narrative contexts, structured UI commands, forensic claim notes, and high-level hierarchy. Its tight tracking and clean aperture balance readability with dense desktop packing.
2. **JetBrains Mono** governs the cryptographic and numerical layer: transaction IDs, SHA-256 block hashes, perceptual hash distances, Unix timestamps, policy math, and telemetry key-value outputs. Monospaced rendering ensures vertical column alignment during side-by-side claim comparisons.

Uppercase styling (`label-caps`) is enforced on metadata tags, table headers, and cryptographic status chips to anchor dense data grids.

## Layout & Spacing
The layout model employs a fluid, multi-pane desktop grid optimized for widescreen displays (1440px to 2560px). The workspace divides into three coordinated operational zones:
- **Navigation & Telemetry Bar (Left/Top)**: Fixed-width system states, stream status indicators, and ledger health metrics.
- **Master Claims Matrix (Center/Left Fluid)**: High-density, sortable claim queue with micro-status filters and fraud vector flags.
- **Forensic Inspection Viewport (Right Dock, 480px to 640px)**: Dedicated audit pane containing split-view image perceptual delta tooling, OCR extraction comparisons, AI decision rationale trees, and the immutable block verification trail.

A disciplined 4px base spacing unit enforces compact enterprise packing without clutter. Gutters maintain exact 16px separation between cards and inspection panes, allowing analysts to process complex forensic evidence rapidly.

## Elevation & Depth
Depth is produced through subtle tonal layering and structural border geometry rather than heavy drop shadows.

- **Base Layer (`#0A0F1D`)**: The underlying window frame, application canvas, and empty-state canvas.
- **Card Tier (`#11192E`)**: Data tables, telemetry modules, and inspection panels float here, framed by a 1px border (`#1E293B`).
- **Active / Overlay Tier (`#18223C`)**: Modal audit drawers, cryptographic proof tooltips, and flyout ledger details.
- **Glow Accents**: Cryptographic verification markers and tamper warnings feature a restricted 4px to 8px ambient bloom using their respective status token colors at 15% opacity, simulating optical console displays.

## Shapes
The system relies on compact, sharp radii (0.25rem / 4px base) across cards, data cells, inputs, and action buttons. Larger structural containers and modal drawers utilize 0.5rem (8px). 

Circular or pill radii are strictly prohibited for primary UI components, as soft curvature conflicts with the rigorous, technical forensic utility of the tool. Pills are permitted only on isolated status indicator chips to maximize their contrast against orthogonal data grids.

## Components

### Buttons & Quick Actions
- **Primary Verify Action**: Solid emerald (`#10B981`) or cyan (`#06B6D4`) background with dark slate text (`#0A0F1D`), font weight 600, height 32px (dense desktop), 4px border-radius.
- **Secondary / Audit Button**: Slate overlay background (`#18223C`) with 1px border (`#1E293B`), text in light slate (`#F8FAFC`).
- **Destructive / Tamper Override**: Deep red tint background (15% opacity `#EF4444`) with solid border (`#EF4444`) and alert text.

### Cryptographic Status Chips
- Height of 20px, uppercase `label-caps` typography in `JetBrains Mono`.
- Built with a 10% opacity background of the target state color, 1px matching border, and an integrated 6px circular dot indicating live consensus or validation status.

### Forensic Data Tables
- Header row height: 32px; data row height: 40px.
- Alternate row striping using `#0D1424` and `#11192E`.
- Hash and policy ID cells default to monospaced text with auto-copy triggers on hover and a one-click link to the on-chain explorer.

### Forensic Dual-Viewport (Image & Document Comparison)
- Side-by-side comparison frames separated by a 1px vertical divider (`#334155`).
- Left pane displays submitted raw evidence; right pane overlays computer vision bounding boxes, altered metadata warnings, and pHash similarity matches.
- Interactive slider with synchronized zoom to verify image manipulation.

### Immutable Audit Block Trail
- Vertical timeline component using a continuous 1px dotted trace (`#1E293B`).
- Each node represents a sealed state transition: `SUBMITTED`, `INSPECTED`, `DECIDED`, `COMMITTED`.
- Hovering a node displays the cryptographic signature, block height, epoch timestamp, and gas or verification receipt.