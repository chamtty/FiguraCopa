// Copia fontes do @fontsource para public/fonts/ antes do build
// Garante que os arquivos estejam disponíveis no Vercel serverless
const fs   = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')

const fonts = [
  {
    src: path.join(root, 'node_modules/@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2'),
    dst: path.join(root, 'public/fonts/bebas-neue.woff2'),
  },
  {
    src: path.join(root, 'node_modules/@fontsource/open-sans/files/open-sans-latin-400-normal.woff2'),
    dst: path.join(root, 'public/fonts/open-sans.woff2'),
  },
]

fs.mkdirSync(path.join(root, 'public/fonts'), { recursive: true })

for (const { src, dst } of fonts) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst)
    console.log(`✓ ${path.basename(src)} → public/fonts/`)
  } else {
    console.warn(`⚠ Fonte não encontrada: ${src}`)
  }
}
