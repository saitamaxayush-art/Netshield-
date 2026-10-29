# NetShield Landing Design System

Scope: the landing route `/` only. Everything here lives under `frontend/src/landing/` and is
scoped to the `.ns-landing` root element, so `/dashboard`, `/studio`, `/privacy`, `/terms`
and the 404 page keep their existing navy theme and shared `Navbar`, `Footer` and `Container`.

Principle: the page is the product. Every graph, number and chart on the landing page is
computed at runtime by `frontend/src/lib/graphAlgorithms.ts` (the same module the demo adapter
and dashboard use) on graphs from `frontend/src/lib/seededGraphGenerator.ts`. Example graphs
carry an "Example" label. Nothing is hard coded.

---

## 1. Colour tokens

Defined once in `frontend/src/landing/landing.css` on `.ns-landing`.

| Family | Token | Hex | Role |
| :-- | :-- | :-- | :-- |
| Charcoal (about 60%) | `--c-950` | `#121315` | Footer, canvas wells |
| | `--c-900` | `#17181B` | Dark section background |
| | `--c-800` | `#1E2024` | Raised panels on dark |
| | `--c-700` | `#2A2C31` | Hairlines on dark, body text on silver |
| | `--c-600` | `#3A3D44` | Strong hairlines, inactive tracks |
| Silver (about 30%) | `--s-50` | `#F3F5F7` | Light section background, display text on dark |
| | `--s-100` | `#E4E8EC` | Body text on dark, cards on silver |
| | `--s-300` | `#C3CAD2` | Secondary text on dark, hairlines on silver |
| | `--s-500` | `#8E97A2` | Captions on dark, healthy edges on dark |
| | `--s-700` | `#5A626C` | Captions on silver, healthy edges on silver |
| Signal red (about 10%) | `--r-400` | `#F0666A` | Red text on dark, CTA hover |
| | `--r-500` | `#E5484D` | Primary CTA, failed and critical marks, progress, focus ring |
| | `--r-600` | `#C93A3F` | Red text on silver |

Rules

1. Red is only used for: the primary CTA, failed or critical graph elements (failed nodes and
   edges, bridges, articulation points), the active progress marker, focus rings, and at most one
   emphasised word per major heading.
2. Healthy graph elements are silver. Components are distinguished by silver steps plus a
   `C1`, `C2` text badge, never by hue.
3. Failed state is always double encoded: red plus a dashed stroke (edges) or a cross mark
   (nodes), plus a text label in readouts. Bridges carry a small diamond glyph, articulation
   points a ring, both explained in a legend.
4. No teal, cyan, amber, green, purple, neon, glow or decorative gradients. Allowed gradients:
   edge fade masks (BigWordList, HorizontalTrack) and the hero charcoal vignette.
5. The primary CTA label is charcoal 950 on red 500 (white on red 500 is 3.91:1 and fails AA).

## 2. Typography

| Role | Family (self hosted, `font-display: swap`) | Fallback (metric matched) |
| :-- | :-- | :-- |
| Display | Cormorant Garamond 500, 500 italic, 600 (`NS Display`) | Georgia with `size-adjust: 88%`, ascent and descent overrides |
| Body and UI | Inter variable 100 to 900 (`NS Sans`) | Arial with `size-adjust: 107%` |
| Numbers | JetBrains Mono 400, 500 (`NS Mono`), `tabular-nums` | Menlo / Courier New with `size-adjust: 100%` |

Fonts are vendored in `frontend/public/landing-fonts/` (SIL OFL 1.1, licence included). An inline
script in `index.html` preloads them during HTML parse, on `/` only. Fallback overrides were
measured, not guessed, by `frontend/scripts/font-metrics.mjs` (Chrome canvas metrics of the real
fonts against the local fallback):

| Family | Fallback | size-adjust | ascent-override | descent-override |
| :-- | :-- | --: | --: | --: |
| NS Display | Georgia | 93.5% | 98.4% | 31% |
| NS Sans | Arial | 107.3% | 90.4% | 22.4% |
| NS Mono | Menlo (Courier New) | 99.7% | 102.3% | 30.1% |

A first guess (86% for the display face) let "HOW NETWORKS" wrap differently before and after the
swap and produced a 0.29 CLS; the measured values brought load CLS to 0. Display lines are uppercase with an italic
accent word (`ScriptCaps`). Sizes are fluid:

| Token | Value |
| :-- | :-- |
| `--fs-mega` | `clamp(3rem, 1.6rem + 6.4vw, 8.5rem)` |
| `--fs-h2` | `clamp(2.5rem, 1.6rem + 4vw, 6rem)` |
| `--fs-h3` | `clamp(1.5rem, 1.2rem + 1.2vw, 2.25rem)` |
| `--fs-lead` | `clamp(1.0625rem, 1rem + 0.35vw, 1.3125rem)` |
| `--fs-body` | `1rem` |
| `--fs-small` | `0.875rem` |
| `--fs-micro` | `0.75rem` (mono labels, uppercase, tracking 0.08em) |

Short landscape screens (`max-height: 520px` in landscape) size display type by height instead:
`--fs-mega: clamp(2.25rem, 1rem + 9svh, 4rem)`, `--fs-h2: clamp(2rem, 1rem + 7svh, 3.25rem)`.

Headings use `text-wrap: balance`, paragraphs `text-wrap: pretty` and `max-width: 66ch`.
No em dashes anywhere in copy.

## 3. Layout system

* `LContainer`: `max-width: 1392px` (1280px content plus padding), horizontal padding
  20px (under 768px), 32px (768px to 1023px), 56px (1024px and up), plus `env(safe-area-inset-*)`.
* `LGrid`: 4 columns under 768px, 8 columns from 768px, 12 columns from 1024px.
  Column gap 16px / 24px / 32px. Everything snaps to named column spans (table in section 6).
* Spacing scale (`--sp-1` to `--sp-16`): 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96, 128 px.
* Section spacing `--section-y`: 96px mobile, 128px tablet, 160px desktop.
* Header height 64px at every scroll position (it translates, it never resizes).
* Full viewport sections use `min-height: 100svh` with a `100vh` fallback. Canvases, frames and
  graphs reserve their box with `aspect-ratio`, so nothing shifts when they mount.

### Controls

| Control | Spec |
| :-- | :-- |
| Button heights | `sm` 40px, `md` 44px, `lg` 48px. Padding 0 20px (`sm` 0 16px). Radius 2px. Icon 16px, gap 8px. CTA pairs always share a size. |
| Icon buttons | 40px square minimum (44px on coarse pointers), tooltip on hover and focus, `aria-label`. |
| Icons | Lucide, 16 / 20 / 24px, stroke width 1.5 everywhere. |
| Focus ring | `outline: 2px solid var(--r-500); outline-offset: 3px`. |
| Hairlines | 1px solid, `--c-700` on dark, `--s-300` on silver. |

## 4. Motion tokens

| Token | Value | Use |
| :-- | :-- | :-- |
| `ease.reveal` | `cubic-bezier(0.16, 1, 0.3, 1)` | Line reveals, frame expansion, counters |
| `ease.wipe` | `cubic-bezier(0.76, 0, 0.24, 1)` | Panel wipes, menu, page swaps |
| `ease.scrub` | `none` (linear) | Scroll scrubbed progress |
| `dur.reveal` | 1.1s (range 0.9 to 1.3) | |
| `dur.wipe` | 1.4s (range 1.2 to 1.6), menu 0.9s | |
| `stagger.line` | 0.1s | |
| `dur.ui` | 180ms (range 150 to 250) | Hover, press, tooltip |
| `scrub` | 0.8 | Every scrubbed ScrollTrigger |
| Lenis `lerp` | 0.09 | |

Engine (`frontend/src/landing/motion/engine.ts`): one Lenis instance driven by `gsap.ticker`
(`autoRaf: false`, `lagSmoothing(0)`), `ScrollTrigger.update` on Lenis scroll, one shared
`scrollState` object (scroll, velocity, direction, progress) read by 3D, cursor, header, rotating
label and progress bar without React state. The hero renders with plain three.js from the same
ticker, so the page has a single `requestAnimationFrame` loop. (React Three Fiber was tried first:
it always constructs `THREE.Clock`, which logs a deprecation warning on three r183 and later, so
the scene is a small vanilla three.js module instead. Same techniques: merged `LineSegments`,
`InstancedMesh`, fog, DPR cap, disposal on unmount. The chunk also dropped from 915 kB to 535 kB.) Reveals are time tweens
started by ScrollTrigger; a fail safe completes any reveal that has been in view for 600ms.
ScrollTrigger refreshes once after `document.fonts.ready`, once after the hero canvas sizes,
and on debounced (200ms) width changes. Transforms are cleared (`clearProps`) at the end of
every reveal so nothing rests at a fractional offset. Motion for React is only used for the
menu overlay, tooltips and toasts.

Reduced motion: no Lenis, no pinning, no scrub, no horizontal travel, no cursor, no magnetic
pull, static hero frame. Every section renders stacked and fully visible.

Panel wipe: each silver section carries its own background colour (correct without JS and for
contrast tools). Four edge strips in the neighbouring colour draw the inset card and animate with
`transform: scale` only, driven by two scrubbed CSS variables (`--wi` on enter, `--wo` on exit).
The strips sit inside the section padding and never behind text. A first version used one
clip-pathed background layer; axe could not resolve the background through it and reported false
contrast failures.

Scroll safety: masked viewports that contain focusable items (word drum, story track, graph
frame, hero, menu rows) use `overflow: clip`, not `hidden`. With `hidden`, focusing a travelling
tab scrolled the container itself and threw the drum rows out of their slots (found by the
Playwright suite).

## 5. Interactive canvas choice

The landing graph widgets use a custom lightweight SVG renderer (`GraphCanvas`) instead of
React Flow. Reasons: the widgets need per element animation (dash out, cross marks, BFS waves)
that is simpler in SVG; React Flow would add about 150 kB to the landing chunk and its pan and
zoom must be disabled anyway; and an SVG with roving `tabindex` gives precise keyboard and
screen reader control. Studio keeps React Flow.

## 6. Section table

Spans are written `desktop 12 / tablet 8 / mobile 4`. "Full" means the element spans the grid.

| # | Section | Background | Grid spans | Interaction | Animation | Scroll length | Mobile | Reduced motion |
| :-: | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| 1 | Header | transparent over hero, `--c-900` at 96% after 24px | flex on container | Links, chapter highlight, menu overlay with focus trap | Hide on scroll down, show on scroll up (transform only) | 64px fixed | Wordmark, red CTA, menu button | No hide animation, always visible |
| 2 | Hero | `--c-900`, 3D scene full bleed | Copy 1 to 8 / 1 to 7 / full; caption 10 to 12 / full / full; scene is the full section | Hover or tap a node: neighbours highlight, degree tooltip | Masked line reveal, camera drift, damped parallax, red edge failure every 6s with reroute pulse along the computed detour | 100svh | Copy full width, lighter scene (40 nodes, DPR 1.25) or SVG. WebGL loads when the browser is idle after first paint; the identical SVG frame paints first | Static SVG frame of the same seeded graph |
| 3 | Sandbox "Break a network." | `--s-50` panel wipe | Intro 1 to 5 / 1 to 8 / full; canvas 6 to 12 / full / full; definitions 1 to 5 | Preset switch, click or tap to fail, drag nodes, keyboard arrows plus Enter, Reset, aria-live readout | Panel wipe in and out, dash out and cross marks, rolling counters | Natural | Canvas full width (4:3), readout 2 by 2 | Instant state changes |
| 4 | How it works | `--c-900` | Heading full; visual 1 to 7 / full / full; steps 8 to 12 / full / full | Step list buttons, previous and next | Pinned; graph evolves through 3 states; step copy travels on a HorizontalTrack; red SegmentProgress | Pin length = 3 steps x 70% viewport | Stacked, not pinned, buttons drive state | Stacked, buttons drive state |
| 5 | Topologies | `--s-50` panel wipe | Words 1 to 6 / full / full; graph 7 to 12 / full / full; properties under graph | Tablist of huge words, arrow keys | BigWordList travel with edge fade and scale, graph crossfade with scale, RollingCounter, GraphFrame expansion | Natural | Words above graph | Instant swap |
| 6 | Reliability estimator | `--c-900` | Heading 1 to 7, lead 8 to 12 / full / full; controls 1 to 4 / full / full; charts 5 to 12 / full / full | Probability slider, trial count, Run, Cancel | Live trial counter, converging line draws as batches arrive | Natural | Controls above charts | Same, without line draw easing |
| 7 | Path explorer | `--s-50` panel wipe | Intro and controls 1 to 4 / full / full; canvas 5 to 12 / full / full | Pick source and target, BFS or DFS, play, pause, step, speed | BFS wave with layer numbers, path draw in, DFS numbered badges | Natural | Controls above canvas | Steps change instantly |
| 8 | Method | `--c-900` | Heading 1 to 5 / full / full; page 6 to 12 / full / full | Previous, next, page tabs | SegmentProgress, clip-path page wipe | Natural | Stacked | Instant page change |
| 9 | Final CTA | `--c-900` | Statement 1 to 10 / full / full; trace full bleed | Magnetic CTA | Masked statement, scroll scrubbed trace ending at the button | Natural (about 100svh) | Trace hidden under 768px, statement and CTA | Trace fully drawn |
| 10 | Footer | `--c-950` | Brand 1 to 6 / 1 to 4 / full; links 7 to 9, 10 to 12 / 5 to 6, 7 to 8 / 1 to 2, 3 to 4 | Links, back to top | None | Natural | 2 column links | Same |

## 7. Contrast results (WCAG 2.x, measured by `frontend/scripts/contrast.mjs`)

AA requires 4.5:1 for text and 3:1 for UI graphics. Rows marked "ui" are graphics only.

| Pair | Background | Foreground | Ratio | Kind | Result |
| :-- | :-- | :-- | :-: | :-- | :-- |
| Display headings on dark | `#17181B` | `#F3F5F7` | 16.24:1 | text | Pass |
| Body on dark | `#17181B` | `#E4E8EC` | 14.42:1 | text | Pass |
| Secondary body on dark | `#17181B` | `#C3CAD2` | 10.74:1 | text | Pass |
| Captions and mono labels on dark | `#17181B` | `#8E97A2` | 6.00:1 | text | Pass |
| Emphasised word and red labels on dark | `#17181B` | `#F0666A` | 5.76:1 | text | Pass |
| Failed marks and focus ring on dark | `#17181B` | `#E5484D` | 4.54:1 | ui | Pass |
| Panel text | `#1E2024` | `#E4E8EC` | 13.25:1 | text | Pass |
| Panel captions | `#1E2024` | `#8E97A2` | 5.51:1 | text | Pass |
| Panel critical values | `#1E2024` | `#F0666A` | 5.29:1 | text | Pass |
| Footer links | `#121315` | `#E4E8EC` | 15.09:1 | text | Pass |
| Footer meta | `#121315` | `#8E97A2` | 6.28:1 | text | Pass |
| Canvas labels | `#121315` | `#C3CAD2` | 11.24:1 | text | Pass |
| Headings on silver | `#F3F5F7` | `#17181B` | 16.24:1 | text | Pass |
| Body on silver | `#F3F5F7` | `#2A2C31` | 12.78:1 | text | Pass |
| Captions on silver | `#F3F5F7` | `#5A626C` | 5.65:1 | text | Pass |
| Emphasised word and red labels on silver | `#F3F5F7` | `#C93A3F` | 4.62:1 | text | Pass |
| Failed marks on silver | `#F3F5F7` | `#E5484D` | 3.58:1 | ui | Pass |
| Cards on silver | `#E4E8EC` | `#17181B` | 14.42:1 | text | Pass |
| Card captions | `#E4E8EC` | `#5A626C` | 5.02:1 | text | Pass |
| Inactive topology words (charcoal at 50% opacity, large text) | `#F3F5F7` | `#858789` | 3.30:1 | large | Pass |
| Primary CTA label | `#E5484D` | `#121315` | 4.75:1 | text | Pass |
| Primary CTA hover label | `#F0666A` | `#121315` | 6.03:1 | text | Pass |
| Rejected: white CTA label | `#E5484D` | `#FFFFFF` | 3.91:1 | text | Fail, not used |
| Rejected: silver 700 edges on dark | `#17181B` | `#5A626C` | 2.87:1 | ui | Fail, edges on dark use silver 500 |
| Rejected: silver 500 edges on silver | `#F3F5F7` | `#8E97A2` | 2.71:1 | ui | Fail, edges on silver use silver 700 |

Resulting rules: on silver, captions use silver 700 and red text uses red 600; on dark, red text
uses red 400; silver 700 is never text on dark.

The same check runs in the browser (`e2e/static.spec.ts`, "rendered contrast"): every visible text
element's computed colour is compared with its section surface. It passes with no exceptions.
Lighthouse accessibility (axe) reports no contrast failures (score 100 desktop and mobile).

## 8. Measured results

All numbers measured on the production build (`vite preview`) in Google Chrome 156 on the
development Mac. Lighthouse 12.8.2, default throttling for mobile.

| Measurement | Result |
| :-- | :-- |
| Full page wheel scroll at 1440x900 (`scripts/perf.mjs`, 497 frames) | 60 fps average, p95 16.7 ms, p99 16.8 ms, 0 frames over 33 ms, 0 long tasks |
| ScrollTrigger refreshes during that scroll | 0 |
| DOM mutations during that scroll | 37, all from the three story step changes (no per frame React renders) |
| Lighthouse desktop | Performance 100, Accessibility 100, Best practices 100 (FCP 0.5 s, LCP 0.7 s, TBT 0 ms, CLS 0) |
| Lighthouse mobile | Performance 91, Accessibility 100, Best practices 100 (FCP 2.2 s, LCP 3.2 s, TBT 50 ms, CLS 0) |
| CLS during load and scroll (Playwright, 11 viewports) | Under 0.02 everywhere (assertion) |
| Estimator, 5000 trials | No main thread long task over 50 ms; rAF latency under 50 ms mid run (assertion) |
