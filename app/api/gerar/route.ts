import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { put } from '@vercel/blob'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'
// @napi-rs/canvas carregado com require para evitar análise estática do webpack/tsc
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas') as any

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

// ── Registro de fontes (executado uma vez no cold start) ───────
;(function registerFonts() {
  const entries = [
    { pkg: '@fontsource/bebas-neue', file: 'bebas-neue-latin-400-normal.woff2', family: 'BebasNeue' },
    { pkg: '@fontsource/open-sans',  file: 'open-sans-latin-400-normal.woff2',  family: 'OpenSans'  },
    { pkg: '@fontsource/open-sans',  file: 'open-sans-latin-700-normal.woff2',  family: 'OpenSans'  },
  ]
  for (const e of entries) {
    try {
      const p = path.join(process.cwd(), 'node_modules', e.pkg, 'files', e.file)
      if (fs.existsSync(p)) GlobalFonts.registerFromPath(p, e.family)
    } catch { /* ignora */ }
  }
})()

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

// ── Renderiza faixa + textos via canvas (sem dependência de fontes do sistema) ──
function buildTextBuffer(
  tw: number, th: number,
  nome: string, infoStr: string, clube: string,
): Buffer {
  const canvas = createCanvas(tw, th)
  const ctx    = canvas.getContext('2d')

  ctx.clearRect(0, 0, tw, th)

  // Cobre o texto original do template com retângulo azul escuro
  const faixaTop  = Math.floor(th * LAYOUT.faixa.topPercent)
  const faixaH    = Math.floor(th * LAYOUT.faixa.heightPercent)
  const faixaLeft = Math.floor(tw * 0.02)
  const faixaW    = Math.floor(tw * 0.96)

  ctx.fillStyle = LAYOUT.faixa.cor
  ctx.fillRect(faixaLeft, faixaTop, faixaW, faixaH)

  const nomeFontSize = Math.round(tw * LAYOUT.nome.fontSizePercent)
  const infoFontSize = Math.round(tw * LAYOUT.info.fontSizePercent)

  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle    = 'white'

  // Nome — Bebas Neue
  ctx.font = `${nomeFontSize}px BebasNeue, Impact, sans-serif`
  ctx.fillText(nome.toUpperCase(), tw / 2, Math.floor(th * LAYOUT.nome.yPercent))

  // Data | Altura | Peso — Open Sans
  ctx.font = `${infoFontSize}px OpenSans, Arial, sans-serif`
  ctx.fillText(infoStr, tw / 2, Math.floor(th * LAYOUT.info.yPercent))

  // Clube
  ctx.font = `${infoFontSize}px OpenSans, Arial, sans-serif`
  ctx.fillText(clube.toUpperCase(), tw / 2, Math.floor(th * LAYOUT.clube.yPercent))

  return canvas.toBuffer('image/png') as Buffer
}

// ── Renderiza watermark PREVIEW via canvas ─────────────────────
function buildWatermarkBuffer(tw: number, th: number): Buffer {
  const canvas = createCanvas(tw, th)
  const ctx    = canvas.getContext('2d')

  ctx.clearRect(0, 0, tw, th)

  const wFontSize = Math.round(tw * 0.13)
  ctx.font         = `bold ${wFontSize}px BebasNeue, Impact, sans-serif`
  ctx.fillStyle    = 'rgba(255,255,255,0.28)'
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'

  const deg = -38 * (Math.PI / 180)
  const drawRotated = (x: number, y: number) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(deg)
    ctx.fillText('PREVIEW', 0, 0)
    ctx.restore()
  }

  drawRotated(tw / 2, th * 0.30)
  drawRotated(tw / 2, th * 0.60)

  return canvas.toBuffer('image/png') as Buffer
}

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

    // ── Gerar buffers de texto e watermark via canvas ──────────
    const textBuffer      = buildTextBuffer(tw, th, nome, infoStr, clube)
    const watermarkBuffer = buildWatermarkBuffer(tw, th)

    // ── Versão limpa (sem watermark) → salva no Vercel Blob ───
    const cleanImage = await sharp(templateBuf)
      .composite([
        { input: userPhoto,  top: 0, left: 0 },
        { input: textBuffer, top: 0, left: 0 },
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
      .composite([{ input: watermarkBuffer, top: 0, left: 0 }])
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
