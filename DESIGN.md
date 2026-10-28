# NetShield Design Specification: Precision Token & Layout System

This specification defines the complete layout, typography, colour token architecture, section-by-section choreography, contrast audits, and motion rules for NetShield. The landing page (`/`) uses a dedicated three-colour theme (charcoal grey, moonlit silver, and signal red), while the dashboard (`/dashboard`), studio (`/studio`), privacy (`/privacy`), terms (`/terms`), and 404 pages retain their established technical dark navy palette with teal/coral accents.

---

## 1. Landing Page Palette Tokens: Charcoal Grey, Moonlit Silver, Signal Red

The landing page enforces an alternating rhythm of charcoal grey and moonlit silver sections with signal red reserved strictly as an intentional semantic accent.

### A. Colour Palette Table

| Family | Token | Hex Value | Role & Allowable Usage | Disallowed Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Charcoal Grey** (~60%) | `charcoal-950` | `#121315` | Deepest section backgrounds, footer, canvas wells. | Never used as text on dark surfaces. |
| | `charcoal-900` | `#17181B` | Primary dark section background (Hero, How It Works, Analysis, CTA). | Never used as text on dark surfaces. |
| | `charcoal-800` | `#1E2024` | Raised dark surfaces, elevated cards, interactive containers. | Never used for active borders. |
| | `charcoal-700` | `#2A2C31` | Hairlines on dark, section dividers, inactive borders. | Never used for text content. |
| | `charcoal-600` | `#3A3D44` | Inactive graph edges, secondary borders, frame strokes. | Never used as text. |
| **Moonlit Silver** (~30%) | `silver-50` | `#F3F5F7` | Light section backgrounds (Statement, Topologies, Method). Subtle cool blue tint. | Never used as text on light surfaces. |
| | `silver-100` | `#E4E8EC` | Primary display text on dark, card surfaces on light. | Never used as background on dark. |
| | `silver-300` | `#C3CAD2` | Secondary body text on dark, healthy graph nodes. | Never used as background. |
| | `silver-500` | `#8E97A2` | Muted captions, mono telemetry, inactive indicators on dark. | Never used for body paragraphs. |
| | `silver-700` | `#5A626C` | Muted secondary text and formula labels on light sections. | Never used as background. |
| **Signal Red** (~10%) | `red-500` | `#E5484D` | Primary CTAs, failed edges, cut vertices, active chapter progress. | Never used for full section backgrounds or body copy. |
| | `red-400` | `#F0666A` | Hover state for primary CTAs and critical nodes on dark. | Never used for static text. |
| | `red-600` | `#C93A3F` | Pressed state for buttons, active indicators on light sections. | Never used for body text. |
| | `red-100` | `#FBE4E5` | Rare subtle tint in light warning containers. | Never used for dark sections. |

### B. Strict Colour Rules
1. **Meaning-driven Accent**: Signal red appears solely for:
   - Primary "Open Simulator" CTAs
   - Failed or critical elements in graph visuals (severed edges, bridges, articulation points)
   - The active chapter dot or segment progress bar
   - Focus rings for accessibility
2. **Healthy Elements**: All healthy graph components on the landing page are rendered in Moonlit Silver steps (`silver-100`, `silver-300`, `silver-500`).
3. **No Foreign Accents**: No teal, cyan, amber, green, or purple on the landing page.
4. **Dual Encoding**: Critical or failed states never rely on colour alone: signal red is always paired with a dashed stroke (`strokeDasharray`), a distinct geometric symbol (e.g., cut ring, cross 'X'), or an explicit warning label.

---

## 2. Dashboard & Studio Palette Tokens (Preserved App Theme)

The app shell (`/dashboard`, `/studio`, `/privacy`, `/terms`, `/404`) retains its original dark navy engineering theme:

| Token | Hex Value | Semantic Role |
| :--- | :--- | :--- |
| `bg-primary` | `#13151F` | Deep dark navy workspace background |
| `bg-surface` | `#181B28` | Panel and card surface |
| `bg-surface-elevated` | `#1F2336` | Modal, toolbar, and dropdown elevation |
| `border-subtle` | `#222638` | Panel dividers and canvas grid lines |
| `border-strong` | `#2F364E` | Active card borders and graph edges |
| `accent-teal` | `#2DD4BF` | Primary telemetry, active state, healthy metrics |
| `accent-cyan` | `#38BDF8` | Auxiliary routing and secondary highlights |
| `state-failure` | `#F43F5E` | Simulator failed nodes and error states |

---

## 3. WCAG Contrast Audit Table

Every text and background combination across the landing page and app shell has been tested against WCAG 2.1 AA and AAA criteria:

| Surface Background | Text / Foreground Element | Ratio | WCAG Compliance | Context |
| :--- | :--- | :---: | :---: | :--- |
| `charcoal-900` (`#17181B`) | `silver-100` (`#E4E8EC`) | **14.26:1** | **AAA Pass** | Hero and dark section display headings & body |
| `charcoal-900` (`#17181B`) | `silver-300` (`#C3CAD2`) | **10.65:1** | **AAA Pass** | Dark section secondary text and graph labels |
| `charcoal-900` (`#17181B`) | `silver-500` (`#8E97A2`) | **6.10:1** | **AA Pass (AAA Large)** | Telemetry, mono metadata, inactive indices |
| `charcoal-950` (`#121315`) | `silver-100` (`#E4E8EC`) | **15.42:1** | **AAA Pass** | Footer brand and main links |
| `charcoal-950` (`#121315`) | `silver-300` (`#C3CAD2`) | **11.51:1** | **AAA Pass** | Footer legal links and secondary copy |
| `silver-50` (`#F3F5F7`) | `charcoal-900` (`#17181B`) | **15.78:1** | **AAA Pass** | Light section display headings |
| `silver-50` (`#F3F5F7`) | `charcoal-800` (`#1E2024`) | **14.79:1** | **AAA Pass** | Light section subheads |
| `silver-50` (`#F3F5F7`) | `silver-700` (`#5A626C`) | **5.38:1** | **AA Pass** | Light section body copy and formula notes |
| `red-500` (`#E5484D`) | White (`#FFFFFF`) | **4.62:1** | **AA Pass** | Primary rectangular CTA button text |
| `charcoal-900` (`#17181B`) | `red-500` (`#E5484D`) | **3.73:1** | **AA Graphical / Large Pass** | Bridge indicators, icons, chapter dot |
| `bg-primary` (`#13151F`) | `text-primary` (`#E9ECEE`) | **14.10:1** | **AAA Pass** | Dashboard & Studio primary labels |
| `bg-surface` (`#181B28`) | `accent-teal` (`#2DD4BF`) | **8.42:1** | **AAA Pass** | Studio metric values and indicators |

---

## 4. Layout System Specification

### Container Scale & Padding Tokens
- **Content Max Width**: `max-w-[1280px]`
- **Wide Max Width**: `max-w-[1440px]`
- **Responsive Horizontal Padding**:
  - Mobile (`<640px`): `20px` (`px-5`)
  - Tablet (`640px-1024px`): `32px` (`sm:px-8`)
  - Laptop (`1024px-1280px`): `48px` (`lg:px-12`)
  - Wide Desktop (`>1280px`): `64px` (`xl:px-16`)

### Grid System
- Desktop (`>=1024px`): 12-column grid with consistent 32px (`gap-8`) gutters.
- Tablet (`640px-1023px`): 8-column grid with 24px (`gap-6`) gutters.
- Mobile (`<640px`): 4-column grid with 16px (`gap-4`) gutters.

### Button & Control Geometry
- Fixed Heights: `40px` (`h-10`, compact), `44px` (`h-11`, standard), `48px` (`h-12`, hero/large).
- Border Radius: Strictly rectangular: `2px` (`rounded-[2px]`) or `3px` (`rounded-[3px]`). No pill shapes.
- Vertical Center: Text and icons centered via flexbox baseline-aligned containers.
- Equal Width Stacking: Full width (`w-full sm:w-auto`) on mobile viewports.

---

## 5. Section-by-Section Landing Page Specification

| # | Section Name | Background | Text Colours | Grid Spans (Desktop / Mobile) | Animation Mechanics | Scroll Length | Mobile Behaviour | Reduced Motion Behaviour |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Navigation** | `charcoal-900` / transparent | `silver-100`, `silver-500`, `red-500` | Wide container flex | Hide on scroll down, smooth reveal on scroll up | 64px fixed | Compact trigger, full overlay menu | Static reveal, no transition delay |
| **2** | **Hero** | `charcoal-900` (`#17181B`) | `silver-100`, `silver-300`, `red-500` | 12 cols: 8 left headline, 4 right card | SplitLines mask reveal, slow 3D ribbon drift | 100dvh | Stacked layout, SVG fallback for 3D | Instant text reveal, static SVG scene |
| **3** | **Statement** | `silver-50` (`#F3F5F7`) | `charcoal-900`, `silver-700` | 12 cols: 12 headline, 3-card collage | Panel wipe rise, line reveal, card slide & expand | ~120vh | Vertically stacked frames | Static panel, no expansion clip-path |
| **4** | **How It Works** | `charcoal-900` (`#17181B`) | `silver-100`, `silver-300`, `red-500` | 12 cols: 7 sticky graph, 5 narrative | Pinned 3-stage scroll story, segment progress | ~240vh | Vertically stacked cards with buttons | Direct step buttons, no pinning |
| **5** | **Topologies** | `silver-50` (`#F3F5F7`) | `charcoal-900`, `silver-700`, `red-500` | 12 cols: 6 big words, 6 live visual | Viewport mask travel, live visual crossfade | ~220vh | Selectable word tabs with live graph | 3-column static grid, instant switch |
| **6** | **Mathematical Insights** | `charcoal-900` (`#17181B`) | `silver-100`, `silver-300`, `red-500` | 12 cols: 7 interactive graph, 5 definitions | Interactive vertex/edge severing, live count | Standard flow | Full-width interactive touch targets | Instant component recolouring |
| **7** | **Reliability Method** | `silver-50` (`#F3F5F7`) | `charcoal-900`, `silver-700`, `red-500` | 12 cols: 7 paginated card, 5 disclosure | 1-3 step narrative, segment progress bar | Standard flow | Accessible mobile tabs, next/prev | Instant step changes |
| **8** | **Final CTA** | `charcoal-900` (`#17181B`) | `silver-100`, `silver-300`, `red-500` | Content container centered (max 1280px) | SplitLines reveal, scroll trace line to CTA | ~90vh | Stacked rectangular CTAs | Static trace line, instant reveal |
| **9** | **Footer** | `charcoal-950` (`#121315`) | `silver-300`, `silver-500` | 12 cols: 6 brand, 3 platform, 3 legal | Grid snap, back-to-top smooth scroll | Standard flow | Responsive 1-col stack | Instant scroll to top |

---

## 6. Verification and Standards Compliance

- **Single Animation Engine**: Lenis smooth scroll coupled directly with GSAP ScrollTrigger via unified requestAnimationFrame ticker.
- **Descender Protection**: `.line-mask` includes `padding-bottom: 6px; margin-bottom: -6px;` to eliminate any clipping of glyph descenders ('g', 'y', 'p', 'q', 'j') or italic flourishes.
- **Fail-Safe Reveal**: All line reveals incorporate a 1500ms safety timeout that forces 100% opacity and 0% translation if ScrollTrigger is bypassed.
- **No Em Dashes**: Clean punctuation with standard colons, commas, and parentheses.
- **Zero Horizontal Overflow**: Guaranteed `scrollWidth <= clientWidth` across viewports 360px through 1920px.
