/**
 * Generates icon-192.png and icon-512.png from public/icon.svg
 * Requires: npm install -D sharp
 * Run:      node scripts/generate-icons.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = join(__dir, '..')
const svgPath = join(root, 'public', 'icon.svg')

let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error('sharp not found. Run: npm install -D sharp')
  process.exit(1)
}

const svg = readFileSync(svgPath)

for (const size of [192, 512]) {
  const out = join(root, 'public', `icon-${size}.png`)
  await sharp(svg).resize(size, size).png().toFile(out)
  console.log(`✓ public/icon-${size}.png`)
}
