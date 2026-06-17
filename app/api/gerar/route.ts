import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { put } from '@vercel/blob'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

// ── Carrega fontes para embutir no SVG (resolve problema de fontes no Vercel) ──
function loadFontBase64(pkg: string, file: string): string {
  try {
    const p = path.join(process.cwd(), 'node_modules', pkg, 'files', file)
    return fs.readFileSync(p).toString('base64')
  } catch {
    return ''
  }
}

const FONT_BEBAS = loadFontBase64('@fontsource/bebas-neue', 'bebas-neue-latin-400-normal.woff2')
const FONT_OPEN  = loadFontBase64('@fontsource/open-sans',  'open-sans-latin-400-normal.woff2')

function fontFaceStyles(): string {
  const styles: string[] = []
  if (FONT_BEBAS) styles.push(
    `@font-face { font-family: 'BebasNeue'; src: url('data:font/woff2;base64,${FONT_BEBAS}') format('woff2'); }`
  )
  if (FONT_OPEN) styles.push(
    `@font-face { font-family: 'OpenSans'; src: url('data:font/woff2;base64,${FONT_OPEN}') format('woff2'); }`
  )
  return styles.join('\n')
}

const NOME_FONT  = FONT_BEBAS ? 'BebasNeue' : 'Impact, Arial Black, sans-serif'
const INFO_FONT  = FONT_OPEN  ? 'OpenSans'  : 'Arial, Helvetica, sans-serif'

// ================================================================
// LAYOUT DO TEMPLATE — ajuste se os textos não ficarem na posição certa
// Todos os valores são porcentagens (0 a 1) da largura/altura do template
// ================================================================
const LAYOUT = {
  foto: {
    topPercent:    0.00,   // início da área da foto (topo do card)
    heightPercent: 0.70,   // a foto ocupa 70% da altura total
  },
  faixa: {
    topPercent:    0.705,  // onde começa a cobertura da faixa azul
    heightPercent: 0.26,   // altura da cobertura
    cor: 'rgb(11, 18, 78)', // cor da faixa — ajuste se necessário
  },
  nome:  { yPercent: 0.775, fontSizePercent: 0.062 },
  info:  { yPercent: 0.845, fontSizePercent: 0.038 }, // data | altura | peso
  clube: { yPercent: 0.905, fontSizePercent: 0.038 },
}
// ================================================================

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const photoFile = formData.get('photo') as File | null
    const nome   = (formData.get('nome')   as string | null)?.trim() || ''
    const dia    = (formData.get('dia')    as string | null) || ''
    const mes    = (formData.get('mes')    as string | null) || ''
    const ano    = (formData.get('ano')    as string | null) || ''
    const clube  = (formData.get('clube')  as string | null)?.trim() || ''
    const peso   = (formData.get('peso')   as string | null) || ''
    const altura = (formData.get('altura') as string | null) || ''

    if (!photoFile || !nome || !clube) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    // Buffer da foto enviada
    const photoBuffer = Buffer.from(await photoFile.arrayBuffer())

    // ── Detectar rosto com Gemini ──────────────────────────────
    let cropData = { x: 5, y: 0, w: 90, h: 85 } // fallback genérico
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
      const b64   = photoBuffer.toString('base64')
      const mime  = (photoFile.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp'

      const result = await model.generateContent([
        { inlineData: { data: b64, mimeType: mime } },
        `Encontre a pessoa principal nesta imagem.
Retorne APENAS um objeto JSON com as coordenadas de recorte para mostrar o rosto e parte superior do corpo (incluindo ombros), com boa margem acima da cabeça.
Formato: {"x": numero, "y": numero, "w": numero, "h": numero}
Onde x e y são o canto superior esquerdo, w e h são largura e altura — todos como porcentagem (0-100) da imagem total.
Retorne somente o JSON, sem texto adicional.`,
      ])

      const text  = result.response.text().trim()
      const match = text.match(/\{[\s\S]*?\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        // Validação básica dos valores
        if (
          typeof parsed.x === 'number' && typeof parsed.y === 'number' &&
          typeof parsed.w === 'number' && typeof parsed.h === 'number' &&
          parsed.w > 5 && parsed.h > 5
        ) {
          cropData = parsed
        }
      }
    } catch {
      // Continua com o fallback — não bloqueia a geração
      console.warn('[gerar] Gemini face detection falhou, usando crop padrão')
    }

    // ── Carregar template ──────────────────────────────────────
    const templatePath = path.join(process.cwd(), 'public', 'template.png')
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { error: 'Template não encontrado em /public/template.png' },
        { status: 500 }
      )
    }

    const templateBuf = fs.readFileSync(templatePath)
    const { width: TW, height: TH } = await sharp(templateBuf).metadata()
    const tw = TW!, th = TH!

    // ── Recortar e redimensionar foto do usuário ───────────────
    const { width: PW, height: PH } = await sharp(photoBuffer).metadata()
    const pw = PW!, ph = PH!

    const cx = clamp(Math.floor((cropData.x / 100) * pw), 0, pw - 2)
    const cy = clamp(Math.floor((cropData.y / 100) * ph), 0, ph - 2)
    const cw = clamp(Math.floor((cropData.w / 100) * pw), 1, pw - cx)
    const ch = clamp(Math.floor((cropData.h / 100) * ph), 1, ph - cy)

    const fotoH = Math.floor(th * LAYOUT.foto.heightPercent)

    const userPhoto = await sharp(photoBuffer)
      .extract({ left: cx, top: cy, width: cw, height: ch })
      .resize(tw, fotoH, { fit: 'cover', position: 'top' })
      .toBuffer()

    // ── Formatar dados para exibição ───────────────────────────
    const alturaNum = parseFloat(altura)
    const alturaStr = alturaNum > 3
      ? `${(alturaNum / 100).toFixed(2)}m`  // se veio em cm (ex: 142)
      : `${alturaNum}m`                      // se veio em m (ex: 1.42)

    const nascimento = `${pad(dia)}-${pad(mes)}-${ano}`
    const infoStr    = `${nascimento} | ${alturaStr} | ${peso}kg`

    // ── Posições em pixels ─────────────────────────────────────
    const faixaTop  = Math.floor(th * LAYOUT.faixa.topPercent)
    const faixaH    = Math.floor(th * LAYOUT.faixa.heightPercent)
    const faixaLeft = Math.floor(tw * 0.02)
    const faixaW    = Math.floor(tw * 0.96)

    const nomeY  = Math.floor(th * LAYOUT.nome.yPercent)
    const infoY  = Math.floor(th * LAYOUT.info.yPercent)
    const clubeY = Math.floor(th * LAYOUT.clube.yPercent)

    const nomeFontSize  = Math.round(tw * LAYOUT.nome.fontSizePercent)
    const infoFontSize  = Math.round(tw * LAYOUT.info.fontSizePercent)

    // ── SVG com textos da figurinha ────────────────────────────
    const textSvg = `<svg width="${tw}" height="${th}" xmlns="http://www.w3.org/2000/svg">
      <defs><style>${fontFaceStyles()}</style></defs>

      <!-- Cobre o texto original da faixa -->
      <rect x="${faixaLeft}" y="${faixaTop}" width="${faixaW}" height="${faixaH}"
        fill="${LAYOUT.faixa.cor}" />

      <!-- Nome do jogador -->
      <text
        x="${tw / 2}" y="${nomeY}"
        font-family="${NOME_FONT}"
        font-size="${nomeFontSize}"
        fill="white"
        text-anchor="middle"
        dominant-baseline="middle"
        letter-spacing="1"
      >${escapeXml(nome.toUpperCase())}</text>

      <!-- Data | Altura | Peso -->
      <text
        x="${tw / 2}" y="${infoY}"
        font-family="${INFO_FONT}"
        font-size="${infoFontSize}"
        fill="white"
        text-anchor="middle"
        dominant-baseline="middle"
      >${escapeXml(infoStr)}</text>

      <!-- Clube -->
      <text
        x="${tw / 2}" y="${clubeY}"
        font-family="${INFO_FONT}"
        font-size="${infoFontSize}"
        fill="white"
        text-anchor="middle"
        dominant-baseline="middle"
      >${escapeXml(clube.toUpperCase())}</text>
    </svg>`

    // ── SVG watermark ──────────────────────────────────────────
    const wFontSize = Math.round(tw * 0.13)
    const wmSvg = `<svg width="${tw}" height="${th}" xmlns="http://www.w3.org/2000/svg">
      <text
        transform="rotate(-38, ${tw / 2}, ${th * 0.30})"
        x="${tw / 2}" y="${th * 0.30}"
        font-family="Impact, 'Arial Black', sans-serif"
        font-size="${wFontSize}"
        fill="white" fill-opacity="0.28"
        text-anchor="middle" dominant-baseline="middle"
        font-weight="bold"
      >PREVIEW</text>
      <text
        transform="rotate(-38, ${tw / 2}, ${th * 0.60})"
        x="${tw / 2}" y="${th * 0.60}"
        font-family="Impact, 'Arial Black', sans-serif"
        font-size="${wFontSize}"
        fill="white" fill-opacity="0.28"
        text-anchor="middle" dominant-baseline="middle"
        font-weight="bold"
      >PREVIEW</text>
    </svg>`

    // ── Versão limpa (sem watermark) → salva no Vercel Blob ───
    const cleanImage = await sharp(templateBuf)
      .composite([
        { input: userPhoto,            top: 0, left: 0 },
        { input: Buffer.from(textSvg), top: 0, left: 0 },
      ])
      .jpeg({ quality: 90 })
      .toBuffer()

    const id = crypto.randomUUID()
    await put(`figurinhas/${id}.jpg`, cleanImage, {
      access: 'public',
      addRandomSuffix: false,
    })

    // ── Versão com watermark → retorna como base64 pro preview ─
    const previewImage = await sharp(cleanImage)
      .composite([{ input: Buffer.from(wmSvg), top: 0, left: 0 }])
      .jpeg({ quality: 88 })
      .toBuffer()

    return NextResponse.json({
      image: `data:image/jpeg;base64,${previewImage.toString('base64')}`,
      id,
    })

  } catch (err) {
    console.error('[gerar]', err)
    return NextResponse.json(
      { error: 'Erro ao gerar a figurinha. Tente novamente.' },
      { status: 500 }
    )
  }
}

// ── Helpers ────────────────────────────────────────────────────
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function pad(n: string): string {
  return n.padStart(2, '0')
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;')
}
