import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { put } from '@vercel/blob'
import sharp from 'sharp'
import satori from 'satori'
import { createElement } from 'react'
import path from 'path'
import fs from 'fs'

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! })

/* ═══════════════════════════════════════════════════════════════
   CALIBRAÇÃO — frações (0–1) relativas ao template.
   Ajuste aqui se mudar a arte do template.
   ─────────────────────────────────────────────────────────────
   HEAD  = elipse onde o ROSTO REAL é colado (silhueta da cabeça)
   NAME  = linha do nome (grande)
   STATS = linha de nascimento | altura | peso
   CLUB  = linha do clube
   STRIP = limites horizontais das tarjas (para centralizar texto)
═══════════════════════════════════════════════════════════════ */
const HEAD = { cx: 0.425, cy: 0.232, w: 0.355, h: 0.420 }
const STRIP = { x0: 0.055, x1: 0.715 }
const NAME  = { cy: 0.866, size: 0.071 }
const STATS = { cy: 0.900, size: 0.030 }
const CLUB  = { cy: 0.944, size: 0.041 }

const TARGET_W = 1200 // resolução de trabalho (largura)

// ── Fontes ────────────────────────────────────────────────────
function loadFont(publicFile: string): ArrayBuffer | null {
  const p = path.join(process.cwd(), 'public', 'fonts', publicFile)
  try {
    if (fs.existsSync(p)) {
      const buf = fs.readFileSync(p)
      const ab  = new ArrayBuffer(buf.length)
      new Uint8Array(ab).set(buf)
      return ab
    }
  } catch { /* ignora */ }
  return null
}

const FONT_BEBAS = loadFont('bebas-neue.woff')
const FONT_OPEN  = loadFont('open-sans.woff')

type SatoriFont = { name: string; data: ArrayBuffer; weight: 400; style: 'normal' }
function getFonts(): SatoriFont[] {
  const fonts: SatoriFont[] = []
  if (FONT_BEBAS) fonts.push({ name: 'BebasNeue', data: FONT_BEBAS, weight: 400, style: 'normal' })
  if (FONT_OPEN)  fonts.push({ name: 'OpenSans',  data: FONT_OPEN,  weight: 400, style: 'normal' })
  return fonts
}

// ── Texto da figurinha (nome / stats / clube) sobre a tarja ────
async function buildTextSvg(
  tw: number, th: number,
  nome: string, stats: string, clube: string,
): Promise<Buffer> {
  const nameFamily = FONT_BEBAS ? 'BebasNeue' : 'sans-serif'
  const bodyFamily = FONT_OPEN  ? 'OpenSans'  : 'sans-serif'

  const stripLeft  = Math.round(STRIP.x0 * tw)
  const stripWidth = Math.round((STRIP.x1 - STRIP.x0) * tw)

  const line = (cy: number, size: number, family: string, weight: number, text: string, key: string) =>
    createElement('div', {
      key,
      style: {
        position: 'absolute',
        top: Math.round(cy * th - size * 0.72),
        left: stripLeft,
        width: stripWidth,
        height: Math.round(size * 1.4),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size),
        fontFamily: family,
        fontWeight: weight,
        color: '#FFFFFF',
        letterSpacing: family === 'BebasNeue' ? 1 : 0.3,
        whiteSpace: 'nowrap',
        textAlign: 'center',
      },
    }, text)

  const els = [
    line(NAME.cy,  NAME.size  * tw, nameFamily, 700, nome,  'name'),
    line(STATS.cy, STATS.size * tw, bodyFamily, 700, stats, 'stats'),
    line(CLUB.cy,  CLUB.size  * tw, bodyFamily, 700, clube, 'club'),
  ]

  const svg = await satori(
    createElement('div', {
      style: { display: 'flex', position: 'relative', width: tw, height: th },
    }, els as any),
    { width: tw, height: th, fonts: getFonts() },
  )
  return Buffer.from(svg)
}

// ── Watermark PREVIEW (inalterado) ─────────────────────────────
async function buildWatermarkSvg(tw: number, th: number): Promise<Buffer> {
  const bigSize   = Math.round(tw * 0.10)
  const smallSize = Math.round(tw * 0.032)
  const family    = FONT_BEBAS ? 'BebasNeue' : 'sans-serif'
  const bigFracs   = [0.04, 0.20, 0.37, 0.54, 0.70, 0.87]
  const smallFracs = [0.12, 0.29, 0.46, 0.62, 0.79]

  const bigEls = bigFracs.map((frac, i) =>
    createElement('div', {
      key: `b${i}`,
      style: {
        position: 'absolute', top: Math.floor(th * frac), left: -Math.round(tw * 0.18),
        width: Math.round(tw * 1.36), display: 'flex', justifyContent: 'center',
        fontSize: bigSize, fontFamily: family, fontWeight: 'bold',
        color: 'rgba(255,255,255,0.21)', transform: 'rotate(-38deg)',
        letterSpacing: Math.round(tw * 0.025), whiteSpace: 'nowrap',
      },
    }, 'PREVIEW  •  PREVIEW'))

  const smallEls = smallFracs.map((frac, i) =>
    createElement('div', {
      key: `s${i}`,
      style: {
        position: 'absolute', top: Math.floor(th * frac), left: -Math.round(tw * 0.12),
        width: Math.round(tw * 1.24), display: 'flex', justifyContent: 'center',
        fontSize: smallSize, fontFamily: family, color: 'rgba(255,255,255,0.24)',
        transform: 'rotate(-38deg)', letterSpacing: Math.round(tw * 0.012), whiteSpace: 'nowrap',
      },
    }, 'figurinha-copa2026.com  •  figurinha-copa2026.com'))

  const svg = await satori(
    createElement('div', {
      style: { display: 'flex', position: 'relative', width: tw, height: th, overflow: 'hidden' },
    }, [...bigEls, ...smallEls] as any),
    { width: tw, height: th, fonts: getFonts() },
  )
  return Buffer.from(svg)
}

/* ═══════════════════════════════════════════════════════════════
   Detecção do rosto — Gemini SÓ localiza (não repinta nada).
   Retorna bbox em pixels da foto original [left, top, width, height].
═══════════════════════════════════════════════════════════════ */
async function detectFaceBox(
  photoB64: string, photoMime: string, imgW: number, imgH: number,
): Promise<{ left: number; top: number; width: number; height: number }> {
  // Fallback heurístico: rosto costuma estar no centro-superior.
  const fallback = {
    left: Math.round(imgW * 0.18),
    top: Math.round(imgH * 0.05),
    width: Math.round(imgW * 0.64),
    height: Math.round(imgH * 0.70),
  }

  try {
    const prompt =
      'Detect the single main person\'s HEAD in this image (from the top of the hair to the bottom of the chin, including the ears). ' +
      'Respond ONLY with strict JSON: {"box_2d":[ymin,xmin,ymax,xmax]} where each value is an integer from 0 to 1000 ' +
      'normalized to the image dimensions (y = vertical, x = horizontal). No prose, no markdown.'

    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: photoMime, data: photoB64 } },
        ],
      }],
      config: { responseMimeType: 'application/json', temperature: 0 },
    })

    const txt = res.text ?? ''
    const m = txt.match(/\[\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\]/)
    if (!m) return fallback
    const arr = JSON.parse(m[0]) as number[]
    let [ymin, xmin, ymax, xmax] = arr
    if ([ymin, xmin, ymax, xmax].some(v => typeof v !== 'number' || isNaN(v))) return fallback
    // normalizado 0–1000 → pixels
    let l = (xmin / 1000) * imgW
    let t = (ymin / 1000) * imgH
    let r = (xmax / 1000) * imgW
    let b = (ymax / 1000) * imgH
    if (r <= l || b <= t) return fallback

    // Expande para incluir cabelo/queixo/orelhas e dar respiro
    const bw = r - l, bh = b - t
    l -= bw * 0.18; r += bw * 0.18
    t -= bh * 0.28; b += bh * 0.12
    l = Math.max(0, l); t = Math.max(0, t)
    r = Math.min(imgW, r); b = Math.min(imgH, b)

    const width = Math.round(r - l), height = Math.round(b - t)
    if (width < 20 || height < 20) return fallback
    return { left: Math.round(l), top: Math.round(t), width, height }
  } catch (e) {
    console.error('[gerar] detectFaceBox falhou, usando fallback:', e)
    return fallback
  }
}

export const maxDuration = 60

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

    const alturaNum = parseFloat(altura)
    const alturaStr = alturaNum > 3
      ? `${(alturaNum / 100).toFixed(2).replace('.', ',')}m`
      : `${alturaNum}m`
    const nascimento = `${parseInt(dia || '0')}-${parseInt(mes || '0')}-${ano}`
    const statsLine  = `${nascimento} | ${alturaStr} | ${peso}kg`
    const clubeLine  = `${clube.toUpperCase()} (BRA)`

    // ── Template base (SEM texto — sobre ele desenhamos tudo) ──
    const baseCandidates = ['template-base.png', 'template-base.jpg', 'template.png', 'template.jpg']
    const templatePath = baseCandidates
      .map(f => path.join(process.cwd(), 'public', f))
      .find(p => fs.existsSync(p))
    if (!templatePath) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 500 })
    }

    const photoBuffer = Buffer.from(await photoFile.arrayBuffer())
    const photoB64    = photoBuffer.toString('base64')
    const photoMime   = (photoFile.type || 'image/jpeg')

    // Dimensões do template em resolução de trabalho
    const baseMeta = await sharp(fs.readFileSync(templatePath)).metadata()
    const TW = TARGET_W
    const TH = Math.round(TARGET_W * (baseMeta.height! / baseMeta.width!))
    const baseBuf = await sharp(fs.readFileSync(templatePath))
      .resize(TW, TH, { fit: 'fill' })
      .toBuffer()

    // ── 1) Localizar o rosto na foto do lead ──────────────────
    const pMeta = await sharp(photoBuffer).metadata()
    const box = await detectFaceBox(photoB64, photoMime, pMeta.width!, pMeta.height!)

    // ── 2) Recortar os PIXELS REAIS do rosto ──────────────────
    const faceCrop = await sharp(photoBuffer)
      .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
      .toBuffer()

    // ── 3) Encaixar na silhueta da cabeça com máscara suave ───
    const fw = Math.round(HEAD.w * TW)
    const fh = Math.round(HEAD.h * TH)
    const faceResized = await sharp(faceCrop)
      .resize(fw, fh, { fit: 'cover', position: 'top' })
      .toBuffer()

    // Máscara elíptica com bordas suavizadas (alpha)
    const rx = (fw / 2) * 0.94
    const ry = (fh / 2) * 0.98
    const maskSvg = Buffer.from(
      `<svg width="${fw}" height="${fh}" xmlns="http://www.w3.org/2000/svg">` +
      `<ellipse cx="${fw / 2}" cy="${fh / 2}" rx="${rx}" ry="${ry}" fill="#fff"/></svg>`,
    )
    const mask = await sharp(maskSvg)
      .blur(Math.max(2, fw * 0.035))
      .extractChannel(0)
      .toBuffer()

    const faceMasked = await sharp(faceResized)
      .ensureAlpha()
      .joinChannel(mask) // substitui o canal alpha pela máscara
      .png()
      .toBuffer()

    const faceLeft = Math.round(HEAD.cx * TW - fw / 2)
    const faceTop  = Math.round(HEAD.cy * TH - fh / 2)

    // ── 4) Texto (nome / stats / clube) ───────────────────────
    const textSvg = await buildTextSvg(TW, TH, nome.toUpperCase(), statsLine, clubeLine)

    // ── Composição final (template + rosto + texto) ───────────
    const cleanImage = await sharp(baseBuf)
      .composite([
        { input: faceMasked, top: faceTop, left: faceLeft },
        { input: textSvg,    top: 0,       left: 0 },
      ])
      .jpeg({ quality: 92 })
      .toBuffer()

    // ── Salvar versão limpa no Blob ───────────────────────────
    const id = crypto.randomUUID()
    const blobResult = await put(`figurinhas/${id}.jpg`, cleanImage, { access: 'public', addRandomSuffix: false })

    // ── Watermark PREVIEW ─────────────────────────────────────
    const watermarkSvg = await buildWatermarkSvg(TW, TH)
    const previewImage = await sharp(cleanImage)
      .composite([{ input: watermarkSvg, top: 0, left: 0 }])
      .jpeg({ quality: 88 })
      .toBuffer()

    return NextResponse.json({
      image: `data:image/jpeg;base64,${previewImage.toString('base64')}`,
      id,
      blobUrl: blobResult.url,
    })

  } catch (err) {
    console.error('[gerar]', err)
    return NextResponse.json(
      { error: 'Erro ao gerar a figurinha. Tente novamente.' },
      { status: 500 },
    )
  }
}
