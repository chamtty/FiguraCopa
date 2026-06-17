// Baixa fontes em formato WOFF1 do jsDelivr (satori não suporta WOFF2)
// @fontsource v4 tinha WOFF1; v5 só tem WOFF2 — por isso usamos o CDN com @4
const fs   = require('fs')
const path = require('path')

const root     = path.join(__dirname, '..')
const fontsDir = path.join(root, 'public', 'fonts')

const fonts = [
  {
    // Bebas Neue WOFF1 via @fontsource@4
    url:  'https://cdn.jsdelivr.net/npm/@fontsource/bebas-neue@4/files/bebas-neue-latin-400-normal.woff',
    name: 'bebas-neue.woff',
  },
  {
    // Open Sans WOFF1 via @fontsource@4
    url:  'https://cdn.jsdelivr.net/npm/@fontsource/open-sans@4/files/open-sans-latin-400-normal.woff',
    name: 'open-sans.woff',
  },
]

function isWoff1(buf) {
  // WOFF1 magic bytes: "wOFF" (0x774F4646)
  // WOFF2 magic bytes: "wOF2" (0x774F4632)
  return buf.length >= 4 &&
    buf[0] === 0x77 && buf[1] === 0x4F && buf[2] === 0x46 && buf[3] === 0x46
}

async function download(url, dst) {
  // Sempre re-baixa para garantir que não há arquivo WOFF2 residual
  console.log(`→ Baixando ${path.basename(dst)}...`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} ao baixar ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (!isWoff1(buf)) {
    const sig = buf.slice(0, 4).toString('ascii')
    throw new Error(`Formato inválido (esperado WOFF1, recebeu "${sig}") em ${url}`)
  }
  fs.writeFileSync(dst, buf)
  console.log(`✓ ${path.basename(dst)} OK — WOFF1 confirmado (${Math.round(buf.length / 1024)}KB)`)
}

async function main() {
  fs.mkdirSync(fontsDir, { recursive: true })
  for (const { url, name } of fonts) {
    await download(url, path.join(fontsDir, name))
  }
}

main().catch(err => {
  console.error('Erro ao baixar fontes:', err.message)
  process.exit(1)
})
