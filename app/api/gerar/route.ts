import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { put } from '@vercel/blob'
import sharp from 'sharp'
import satori from 'satori'
import { createElement } from 'react'
import path from 'path'
import fs from 'fs'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

// ── Carrega fontes para o satori (executado uma vez no cold start) ─
// O prebuild copia de node_modules/@fontsource → public/fonts/
// Em produção (Vercel) lemos de public/fonts/; em dev lemos de node_modules como fallback
function loadFont(publicFile: string, pkg: string, pkgFile: string): ArrayBuffer | null {
  const candidates = [
    path.join(process.cwd(), 'public', 'fonts', publicFile),
    path.join(process.cwd(), 'node_modules', pkg, 'files', pkgFile),
  ]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const buf = fs.readFileSync(p)
        const ab  = new ArrayBuffer(buf.length)
        new Uint8Array(ab).set(buf)
        return ab
      }
    } catch { /* tenta próximo */ }
  }
  return null
}

// public/fonts/*.woff são baixados pelo prebuild (WOFF1 — satori não suporta WOFF2)
// fallback para node_modules usa também .woff (requer @fontsource v4 localmente)
const FONT_BEBAS = loadFont('bebas-neue.woff', '@fontsource/bebas-neue', 'bebas-neue-latin-400-normal.woff')
const FONT_OPEN  = loadFont('open-sans.woff',  '@fontsource/open-sans',  'open-sans-latin-400-normal.woff')

type SatoriFont = { name: string; data: ArrayBuffer; weight: 400; style: 'normal' }

function getFonts(): SatoriFont[] {
  const fonts: SatoriFont[] = []
  if (FONT_BEBAS) fonts.push({ name: 'BebasNeue', data: FONT_BEBAS, weight: 400, style: 'normal' })
  if (FONT_OPEN)  fonts.push({ name: 'OpenSans',  data: FONT_OPEN,  weight: 400, style: 'normal' })
  return fonts
}

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
    cor: 'rgb(11,18,78)',  // cor da faixa — ajuste se necessário
  },
  nome:  { yPercent: 0.775, fontSizePercent: 0.062 },
  info:  { yPercent: 0.845, fontSizePercent: 0.038 }, // data | altura | peso
  clube: { yPercent: 0.905, fontSizePercent: 0.038 },
}
// ================================================================

export const maxDuration = 30

// ── Satori: faixa + textos → SVG com paths (sem fontes do sistema) ──
async function buildTextSvg(
  tw: number, th: number,
  nome: string, infoStr: string, clube: string,
): Promise<Buffer> {
  const nomeFontSize = Math.round(tw * LAYOUT.nome.fontSizePercent)
  const infoFontSize = Math.round(tw * LAYOUT.info.fontSizePercent)
  const nomeFamily   = FONT_BEBAS ? 'BebasNeue' : 'sans-serif'
  const infoFamily   = FONT_OPEN  ? 'OpenSans'  : 'sans-serif'

  // Posições Y: yPercent aponta pro meio do texto, ajustamos subtraindo metade do lineHeight
  const nomeTop  = Math.floor(th * LAYOUT.nome.yPercent)  - Math.round(nomeFontSize * 0.55)
  const infoTop  = Math.floor(th * LAYOUT.info.yPercent)  - Math.round(infoFontSize * 0.55)
  const clubeTop = Math.floor(th * LAYOUT.clube.yPercent) - Math.round(infoFontSize * 0.55)

  const svg = await satori(
    createElement('div', {
      style: { display: 'flex', position: 'relative', width: tw, height: th },
    },
      // Faixa azul escura (cobre texto original do template)
      createElement('div', {
        style: {
          position: 'absolute',
          top:    Math.floor(th * LAYOUT.faixa.topPercent),
          left:   Math.floor(tw * 0.02),
          width:  Math.floor(tw * 0.96),
          height: Math.floor(th * LAYOUT.faixa.heightPercent),
          background: LAYOUT.faixa.cor,
        },
      }),
      // Nome do jogador
      createElement('div', {
        style: {
          position: 'absolute',
          top: nomeTop, left: 0, width: tw,
          display: 'flex', justifyContent: 'center',
          fontSize: nomeFontSize,
          fontFamily: nomeFamily,
          color: 'white',
          letterSpacing: 1,
        },
      }, nome.toUpperCase()),
      // Data | Altura | Peso
      createElement('div', {
        style: {
          position: 'absolute',
          top: infoTop, left: 0, width: tw,
          display: 'flex', justifyContent: 'center',
          fontSize: infoFontSize,
          fontFamily: infoFamily,
          color: 'white',
        },
      }, infoStr),
      // Clube
      createElement('div', {
        style: {
          position: 'absolute',
          top: clubeTop, left: 0, width: tw,
          display: 'flex', justifyContent: 'center',
          fontSize: infoFontSize,
          fontFamily: infoFamily,
          color: 'white',
        },
      }, clube.toUpperCase()),
    ),
    { width: tw, height: th, fonts: getFonts() },
  )

  return Buffer.from(svg)
}

// ── Satori: watermark PREVIEW ──────────────────────────────────
async function buildWatermarkSvg(tw: number, th: number): Promise<Buffer> {
  const wFontSize = Math.round(tw * 0.13)
  const family    = FONT_BEBAS ? 'BebasNeue' : 'sans-serif'

  const previewEl = (top: number) =>
    createElement('div', {
      style: {
        position: 'absolute',
        top, left: 0, width: tw,
        display: 'flex', justifyContent: 'center',
        fontSize: wFontSize,
        fontFamily: family,
        fontWeight: 'bold',
        color: 'rgba(255,255,255,0.28)',
        transform: 'rotate(-38deg)',
      },
    }, 'PREVIEW')

  const svg = await satori(
    createElement('div', {
      style: { display: 'flex', position: 'relative', width: tw, height: th },
    },
      previewEl(Math.floor(th * 0.18)),
      previewEl(Math.floor(th * 0.48)),
    ),
    { width: tw, height: th, fonts: getFonts() },
  )

  return Buffer.from(svg)
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
        if (
          typeof parsed.x === 'number' && typeof parsed.y === 'number' &&
          typeof parsed.w === 'number' && typeof parsed.h === 'number' &&
          parsed.w > 5 && parsed.h > 5
        ) {
          cropData = parsed
        }
      }
    } catch {
      console.warn('[gerar] Gemini face detection falhou, usando crop padrão')
    }

    // ── Carregar template ──────────────────────────────────────
    const templatePath = path.join(process.cwd(), 'public', 'template.png')
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { error: 'Template não encontrado em /public/template.png' },
        { status: 500 },
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
      ? `${(alturaNum / 100).toFixed(2)}m`  // veio em cm (ex: 142)
      : `${alturaNum}m`                      // veio em m  (ex: 1.42)

    const nascimento = `${pad(dia)}-${pad(mes)}-${ano}`
    const infoStr    = `${nascimento} | ${alturaStr} | ${peso}kg`

    // ── Gerar SVGs via satori (texto vira paths — sem fontes do sistema) ─
    const [textSvg, watermarkSvg] = await Promise.all([
      buildTextSvg(tw, th, nome, infoStr, clube),
      buildWatermarkSvg(tw, th),
    ])

    // ── Versão limpa (sem watermark) → Vercel Blob ────────────
    const cleanImage = await sharp(templateBuf)
      .composite([
        { input: userPhoto, top: 0, left: 0 },
        { input: textSvg,   top: 0, left: 0 },
      ])
      .jpeg({ quality: 90 })
      .toBuffer()

    const id = crypto.randomUUID()
    await put(`figurinhas/${id}.jpg`, cleanImage, {
      access: 'public',
      addRandomSuffix: false,
    })

    // ── Versão com watermark → preview base64 ─────────────────
    const previewImage = await sharp(cleanImage)
      .composite([{ input: watermarkSvg, top: 0, left: 0 }])
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
      { status: 500 },
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
