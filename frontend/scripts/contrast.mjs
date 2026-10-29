// Computes WCAG 2.x contrast ratios for every landing text/background pair.
const hex = (h) => h.replace('#', '').match(/../g).map((x) => parseInt(x, 16) / 255)
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const lum = (h) => { const [r, g, b] = hex(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }

export const PAIRS = [
  // [background, foreground, usage, kind] kind: text | large | ui
  ['#17181B', '#F3F5F7', 'Charcoal 900 / Silver 50: display headings on dark', 'text'],
  ['#17181B', '#E4E8EC', 'Charcoal 900 / Silver 100: body on dark', 'text'],
  ['#17181B', '#C3CAD2', 'Charcoal 900 / Silver 300: secondary body on dark', 'text'],
  ['#17181B', '#8E97A2', 'Charcoal 900 / Silver 500: captions, mono labels on dark', 'text'],
  ['#17181B', '#F0666A', 'Charcoal 900 / Red 400: emphasised word, red labels on dark', 'text'],
  ['#17181B', '#E5484D', 'Charcoal 900 / Red 500: failed marks, focus ring on dark', 'ui'],
  ['#1E2024', '#E4E8EC', 'Charcoal 800 / Silver 100: panel text', 'text'],
  ['#1E2024', '#8E97A2', 'Charcoal 800 / Silver 500: panel captions', 'text'],
  ['#1E2024', '#F0666A', 'Charcoal 800 / Red 400: panel critical values', 'text'],
  ['#121315', '#E4E8EC', 'Charcoal 950 / Silver 100: footer links', 'text'],
  ['#121315', '#8E97A2', 'Charcoal 950 / Silver 500: footer meta', 'text'],
  ['#121315', '#C3CAD2', 'Charcoal 950 / Silver 300: canvas labels', 'text'],
  ['#F3F5F7', '#17181B', 'Silver 50 / Charcoal 900: headings on silver', 'text'],
  ['#F3F5F7', '#2A2C31', 'Silver 50 / Charcoal 700: body on silver', 'text'],
  ['#F3F5F7', '#5A626C', 'Silver 50 / Silver 700: captions on silver', 'text'],
  ['#F3F5F7', '#C93A3F', 'Silver 50 / Red 600: emphasised word, red labels on silver', 'text'],
  ['#F3F5F7', '#E5484D', 'Silver 50 / Red 500: failed marks on silver', 'ui'],
  ['#E4E8EC', '#17181B', 'Silver 100 / Charcoal 900: cards on silver', 'text'],
  ['#E4E8EC', '#5A626C', 'Silver 100 / Silver 700: card captions', 'text'],
  ['#F3F5F7', '#858789', 'Silver 50 / Charcoal 900 at 50%: inactive topology words (large)', 'large'],
  ['#E5484D', '#121315', 'Red 500 / Charcoal 950: primary CTA label', 'text'],
  ['#F0666A', '#121315', 'Red 400 / Charcoal 950: primary CTA hover label', 'text'],
  ['#E5484D', '#FFFFFF', 'Red 500 / White: rejected CTA option', 'text'],
  ['#17181B', '#3A3D44', 'Charcoal 900 / Charcoal 600: hairline (non-text)', 'deco'],
  ['#17181B', '#5A626C', 'Charcoal 900 / Silver 700: rejected edge on dark (edges use Silver 500)', 'ui'],
  ['#F3F5F7', '#8E97A2', 'Silver 50 / Silver 500: rejected edge on silver (edges use Silver 700)', 'ui'],
]

const need = { text: 4.5, large: 3, ui: 3, deco: 0 }
if (process.argv[1] && process.argv[1].endsWith('contrast.mjs')) {
  let fail = 0
  for (const [bg, fg, use, kind] of PAIRS) {
    const r = ratio(bg, fg)
    const ok = r >= need[kind]
    if (!ok && !use.includes('rejected')) fail++
    console.log(`| ${use} | \`${bg}\` | \`${fg}\` | ${r.toFixed(2)}:1 | ${kind} | ${ok ? 'Pass' : 'Fail'} |`)
  }
  console.log(`\nfailures (excluding rejected): ${fail}`)
}
