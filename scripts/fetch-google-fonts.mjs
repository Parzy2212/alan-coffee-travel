// Downloads the woff2 files Google Fonts serves for the families/weights/subsets the app uses,
// writes app/fonts.css with the same @font-face rules pointing at /fonts/..., fetches each OFL.txt,
// and prints one row per file for the table in docs/claude-tooling.md ("Fonts").
// Run from the repo root: node scripts/fetch-google-fonts.mjs .
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.argv[2]
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const FAMILIES = [
  { name: 'Playfair Display', dir: 'playfairdisplay', q: 'Playfair+Display:wght@400;700;800', subsets: ['latin'] },
  { name: 'Inter',            dir: 'inter',           q: 'Inter:wght@100..900',               subsets: ['latin'] },
  { name: 'Sarabun',          dir: 'sarabun',         q: 'Sarabun:wght@400;600;700;800',      subsets: ['thai', 'latin'] },
  { name: 'Noto Sans Lao',    dir: 'notosanslao',     q: 'Noto+Sans+Lao:wght@400;700',        subsets: ['lao'] },
  { name: 'IBM Plex Sans Thai', dir: 'ibmplexsansthai', q: 'IBM+Plex+Sans+Thai:wght@400;500;600', subsets: ['thai', 'latin'] },
]

const css = ['/* Self-hosted copies of Google Fonts (see docs/claude-tooling.md, "Fonts"). Generated, do not hand-edit. */']
const log = []
for (const f of FAMILIES) {
  const res = await fetch(`https://fonts.googleapis.com/css2?family=${f.q}&display=swap`, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${f.name}: css ${res.status}`)
  const text = await res.text()
  const blocks = [...text.matchAll(/\/\* ([a-z-]+) \*\/\s*@font-face \{([^}]*)\}/g)]
  const dir = join(ROOT, 'public', 'fonts', f.dir)
  mkdirSync(dir, { recursive: true })
  const faces = blocks
    .filter(([, subset]) => f.subsets.includes(subset))
    .map(([, subset, body]) => ({
      subset,
      url: body.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)[1],
      weight: body.match(/font-weight: ([^;]+);/)[1].trim(),
      range: body.match(/unicode-range: ([^;]+);/)[1].trim(),
    }))
  const done = new Map()
  for (const { subset, url, weight, range } of faces) {
    const version = url.match(/\/s\/[^/]+\/(v\d+)\//)?.[1] ?? '?'
    let file = done.get(url)
    if (!file) {
      // a variable font: one file serves several weights (Google lists it once per weight)
      const weights = faces.filter(x => x.url === url).map(x => x.weight)
      const variable = weights.length > 1 || /\s/.test(weight)
      file = `${f.dir}-${subset}-${variable ? 'variable' : weight}.woff2`
      const r = await fetch(url, { headers: { 'User-Agent': UA } })
      if (!r.ok) throw new Error(`${url}: ${r.status}`)
      writeFileSync(join(dir, file), Buffer.from(await r.arrayBuffer()))
      done.set(url, file)
      log.push(`| ${f.name} | ${subset} | ${weights.join(', ')} | ${version} | ${url} |`)
    }
    css.push(`/* ${f.name} ${subset} ${weight} (${version}) */\n@font-face {\n  font-family: '${f.name}';\n  font-style: normal;\n  font-weight: ${weight};\n  font-display: swap;\n  src: url(/fonts/${f.dir}/${file}) format('woff2');\n  unicode-range: ${range};\n}`)
  }
  const lic = await fetch(`https://raw.githubusercontent.com/google/fonts/main/ofl/${f.dir}/OFL.txt`)
  if (!lic.ok) throw new Error(`${f.name}: OFL ${lic.status}`)
  writeFileSync(join(dir, 'OFL.txt'), await lic.text())
}
writeFileSync(join(ROOT, 'app', 'fonts.css'), css.join('\n') + '\n')
console.log(log.join('\n'))
