/**
 * Regenerate PWA icons from the taco logo.
 * Requires: npm i -D sharp   (dev only, not a runtime dependency)
 * Run:      node scripts/generate-icons.mjs
 */
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'icons')

function tacoSvg(size, { pad = 0, bg = '#F2F4EE', maskable = false } = {}) {
  const inset = maskable ? size * 0.2 : pad
  const box = size - inset * 2
  const scale = box / 40
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${bg}"/>
  <g transform="translate(${inset} ${inset}) scale(${scale})">
    <path d="M4 17a16 16 0 0 0 32 0z" fill="#EBA21C"/>
    <path d="M4 17c2-4 4-4 5.3 0s3.4 4 5.3 0 3.4-4 5.4 0 3.4 4 5.3 0 3.4-4 5.4 0 3.3 4 5.3 0" fill="none" stroke="#2E5E47" stroke-width="3" stroke-linecap="round"/>
    <circle cx="13" cy="13.5" r="2.2" fill="#D9482B"/>
    <circle cx="25" cy="13" r="2.2" fill="#D9482B"/>
    <path d="M8 24a12 12 0 0 0 24 0" fill="none" stroke="#2B1D00" stroke-opacity=".18" stroke-width="1.5"/>
  </g>
</svg>`
}

async function writePng(name, svg) {
  const buf = await sharp(Buffer.from(svg)).png().toBuffer()
  await writeFile(join(outDir, name), buf)
  console.log('wrote', name)
}

await mkdir(outDir, { recursive: true })
await writePng('icon-192.png', tacoSvg(192, { pad: 24 }))
await writePng('icon-512.png', tacoSvg(512, { pad: 64 }))
await writePng('icon-512-maskable.png', tacoSvg(512, { maskable: true }))
await writePng('apple-touch-icon.png', tacoSvg(180, { pad: 22 }))
// Also at site root — Safari’s default discovery path for Home Screen icons
await writeFile(
  join(root, 'public', 'apple-touch-icon.png'),
  await sharp(Buffer.from(tacoSvg(180, { pad: 22 }))).png().toBuffer(),
)
console.log('wrote public/apple-touch-icon.png')
console.log('done')
