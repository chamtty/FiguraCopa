import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { put } from '@vercel/blob'
import sharp from 'sharp'
import satori from 'satori'
import { createElement } from 'react'
import path from 'path'
import fs from 'fs'

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! })

/* CALIBRACAO - fracoes (0-1) relativas ao template.
   NAME / STATS / CLUB = linha de texto (cy = centro vertical)
   STRIP = limites horizontais das tarjas (centralizacao do texto)
   BARS  = regiao das tarjas restaurada do template limpo
   HEAD  = onde a cabeca e encaixada na silhueta (fallback/composicao) */
const STRIP = { x0: 0.055, x1: 0.715 }
const NAME  = { cy: 0.868, size: 0.052, weight: 800 }
const STATS = { cy: 0.902, size: 0.030, weight: 600 }
const CLUB  = { cy: 0.949, size: 0.038, weight: 700 }
const BARS  = { x0: 0.03, y0: 0.825, x1: 0.74, y1: 1.0 }
const HEAD  = { cx: 0.452, topY: 0.05, width: 0.42 }

// Cor EXATA do fundo teal do template (amostrada do template-base.jpg).
// Pulo do gato: mandamos o rosto JA com este fundo, entao mesmo que a IA
// so "encaixe" a cabeca sem refinar, o fundo se funde com o template
// (sem aquele quadrado cinza ao redor da cabeca).
const TEAL = { r: 92, g: 190, b: 210 }

const TARGET_W = 1200
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image'
const VISION_MODEL = 'gemini-2.5-flash'

// -- Fontes --
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
const FONT_OS = {
  400: loadFont('open-sans-400.woff') || loadFont('open-sans.woff'),
  600: loadFont('open-sans-600.woff'),
  700: loadFont('open-sans-700.woff'),
  800: loadFont('open-sans-800.woff'),
}

type SatoriFont = { name: string; data: ArrayBuffer; weight: 400 | 600 | 700 | 800; style: 'normal' }
function getFonts(): SatoriFont[] {
  const fonts: SatoriFont[] = []
  if (FONT_BEBAS) fonts.push({ name: 'BebasNeue', data: FONT_BEBAS, weight: 400, style: 'normal' })
  for (const w of [400, 600, 700, 800] as const) {
    const data = FONT_OS[w]
    if (data) fonts.push({ name: 'OpenSans', data, weight: w, style: 'normal' })
  }
  return fonts
}

// -- Texto da figurinha (nome / stats / clube) --
async function buildTextSvg(
  tw: number, th: number,
  nome: string, stats: string, clube: string,
): Promise<Buffer> {
  const family = FONT_OS[400] ? 'OpenSans' : 'sans-serif'
  const stripLeft  = Math.round(STRIP.x0 * tw)
  const stripWidth = Math.round((STRIP.x1 - STRIP.x0) * tw)

  const fitSize = (text: string, size: number, factor = 0.60) => {
    const est = text.length * size * factor
    return est > stripWidth ? Math.floor(size * (stripWidth / est)) : size
  }

  const line = (cy: number, size: number, weight: number, text: string, key: string) =>
    createElement('div', {
      key,
      style: {
        position: 'absolute',
        top: Math.round(cy * th - size * 0.72),
        left: stripLeft,
        width: stripWidth,
        height: Math.round(size * 1.45),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size),
        fontFamily: family,
        fontWeight: weight,
        color: '#FFFFFF',
        whiteSpace: 'nowrap',
        textAlign: 'center',
      },
    }, text)

  const els = [
    line(NAME.cy,  fitSize(nome,  NAME.size  * tw), NAME.weight,  nome,  'name'),
    line(STATS.cy, fitSize(stats, STATS.size * tw), STATS.weight, stats, 'stats'),
    line(CLUB.cy,  fitSize(clube, CLUB.size  * tw), CLUB.weight,  clube, 'club'),
  ]

  const svg = await satori(
    createElement('div', { style: { display: 'flex', position: 'relative', width: tw, height: th } }, els as any),
    { width: tw, height: th, fonts: getFonts() },
  )
  return Buffer.from(svg)
}

// -- Watermark PREVIEW --
async function buildWatermarkSvg(tw: number, th: number): Promise<Buffer> {
  const bigSize   = Math.round(tw * 0.10)
  const smallSize = Math.round(tw * 0.032)
  const family    = FONT_BEBAS ? 'BebasNeue' : (FONT_OS[800] ? 'OpenSans' : 'sans-serif')
  const bigFracs   = [0.04, 0.20, 0.37, 0.54, 0.70, 0.87]
  const smallFracs = [0.12, 0.29, 0.46, 0.62, 0.79]

  const bigEls = bigFracs.map((frac, i) =>
    createElement('div', {
      key: 'b' + i,
      style: {
        position: 'absolute', top: Math.floor(th * frac), left: -Math.round(tw * 0.18),
        width: Math.round(tw * 1.36), display: 'flex', justifyContent: 'center',
        fontSize: bigSize, fontFamily: family, fontWeight: 'bold',
        color: 'rgba(255,255,255,0.21)', transform: 'rotate(-38deg)',
        letterSpacing: Math.round(tw * 0.025), whiteSpace: 'nowrap',
      },
    }, 'PREVIEW  -  PREVIEW'))

  const smallEls = smallFracs.map((frac, i) =>
    createElement('div', {
      key: 's' + i,
      style: {
        position: 'absolute', top: Math.floor(th * frac), left: -Math.round(tw * 0.12),
        width: Math.round(tw * 1.24), display: 'flex', justifyContent: 'center',
        fontSize: smallSize, fontFamily: family, color: 'rgba(255,255,255,0.24)',
        transform: 'rotate(-38deg)', letterSpacing: Math.round(tw * 0.012), whiteSpace: 'nowrap',
      },
    }, 'figurinha-copa2026.com  -  figurinha-copa2026.com'))

  const svg = await satori(
    createElement('div', {
      style: { display: 'flex', position: 'relative', width: tw, height: th, overflow: 'hidden' },
    }, [...bigEls, ...smallEls] as any),
    { width: tw, height: th, fonts: getFonts() },
  )
  return Buffer.from(svg)
}

/* 1) Localiza o rosto na foto do lead (Gemini SO localiza).
   Retorna bbox em pixels [left, top, width, height]. */
async function detectFaceBox(
  photoB64: string, photoMime: string, imgW: number, imgH: number,
): Promise<{ left: number; top: number; width: number; height: number }> {
  const fallback = {
    left: Math.round(imgW * 0.18), top: Math.round(imgH * 0.06),
    width: Math.round(imgW * 0.64), height: Math.round(imgH * 0.68),
  }
  try {
    const prompt =
      "Detect the single main person's HEAD in this image (from the top of the hair to the bottom of the chin, including the ears). " +
      'Respond ONLY with strict JSON: {"box_2d":[ymin,xmin,ymax,xmax]} where each value is an integer 0..1000 ' +
      'normalized to the image dimensions (y vertical, x horizontal). No prose, no markdown.'

    const res = await ai.models.generateContent({
      model: VISION_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: photoMime, data: photoB64 } }] }],
      config: { responseMimeType: 'application/json', temperature: 0 },
    })

    const txt = res.text ?? ''
    const m = txt.match(/\[\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\]/)
    if (!m) return fallback
    const [ymin, xmin, ymax, xmax] = JSON.parse(m[0]) as number[]
    if ([ymin, xmin, ymax, xmax].some(v => typeof v !== 'number' || isNaN(v))) return fallback
    let l = (xmin / 1000) * imgW, t = (ymin / 1000) * imgH
    let r = (xmax / 1000) * imgW, b = (ymax / 1000) * imgH
    if (r <= l || b <= t) return fallback
    // respiro JUSTO: o suficiente p/ cabelo/orelhas/queixo, sem trazer muito fundo
    const bw = r - l, bh = b - t
    l -= bw * 0.06; r += bw * 0.06; t -= bh * 0.10; b += bh * 0.08
    l = Math.max(0, l); t = Math.max(0, t); r = Math.min(imgW, r); b = Math.min(imgH, b)
    const width = Math.round(r - l), height = Math.round(b - t)
    if (width < 20 || height < 20) return fallback
    return { left: Math.round(l), top: Math.round(t), width, height }
  } catch (e) {
    console.error('[gerar] detectFaceBox falhou, usando fallback:', e)
    return fallback
  }
}

/* 2) Isola a cabeca e a coloca SOBRE o teal do template.
   Mascara suave (elipse da cabeca + coluna do pescoco) com borda esfumada ->
   o fundo original (quarto, roupa, estudio) some e da lugar ao MESMO teal do
   template. Retorna { teal, alpha }:
     teal  = cabeca achatada sobre o teal (input p/ o Gemini)
     alpha = PNG com transparencia (usado no fallback/composicao) */
async function isolateHead(
  photo: Buffer,
  box: { left: number; top: number; width: number; height: number },
): Promise<{ teal: Buffer; alpha: Buffer; w: number; h: number }> {
  const crop = await sharp(photo)
    .extract(box)
    .resize(640, 860, { fit: 'inside', withoutEnlargement: false })
    .toBuffer()
  const meta = await sharp(crop).metadata()
  const cw = meta.width!, ch = meta.height!

  // Mascara: elipse da cabeca + coluna do pescoco, branco sobre transparente.
  // O blur esfuma a borda (alfa) -> cabelo/pescoco derretem no fundo.
  const svg =
    '<svg width="' + cw + '" height="' + ch + '" xmlns="http://www.w3.org/2000/svg">' +
    '<ellipse cx="' + (cw * 0.5) + '" cy="' + (ch * 0.45) + '" rx="' + (cw * 0.42) + '" ry="' + (ch * 0.41) + '" fill="#fff"/>' +
    '<rect x="' + (cw * 0.36) + '" y="' + (ch * 0.62) + '" width="' + (cw * 0.28) + '" height="' + (ch * 0.38) + '" fill="#fff"/>' +
    '</svg>'
  const sigma = Math.max(2, cw * 0.06)
  const maskPng = await sharp(Buffer.from(svg)).blur(sigma).png().toBuffer()

  // Aplica a mascara como canal alfa (dest-in mantem so onde a mascara existe).
  const alpha = await sharp(crop)
    .ensureAlpha()
    .composite([{ input: maskPng, blend: 'dest-in' }])
    .png()
    .toBuffer()

  // Versao achatada sobre o teal do template (input p/ o Gemini).
  const teal = await sharp(alpha)
    .flatten({ background: TEAL })
    .jpeg({ quality: 95 })
    .toBuffer()

  return { teal, alpha, w: cw, h: ch }
}

/* Fallback deterministico: encaixa a cabeca (alfa) na silhueta do template
   limpo. Usado se o Gemini de imagem falhar - garante que NUNCA volte o
   quadrado cinza nem um erro pro usuario. */
async function composeHeadOnTemplate(
  baseResized: Buffer, headAlpha: Buffer, headW: number, headH: number,
  TW: number, TH: number,
): Promise<Buffer> {
  const placeW = Math.round(HEAD.width * TW)
  const placeH = Math.round(placeW * (headH / headW))
  const headResized = await sharp(headAlpha).resize(placeW, placeH).png().toBuffer()
  const left = Math.round(HEAD.cx * TW - placeW / 2)
  const top  = Math.round(HEAD.topY * TH)
  return sharp(baseResized)
    .composite([{ input: headResized, top: Math.max(0, top), left: Math.max(0, left) }])
    .toBuffer()
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
      ? (alturaNum / 100).toFixed(2).replace('.', ',') + 'm'
      : alturaNum + 'm'
    const nascimento = parseInt(dia || '0') + '-' + parseInt(mes || '0') + '-' + ano
    const statsLine  = nascimento + ' | ' + alturaStr + ' | ' + peso + 'kg'
    const clubeLine  = clube.toUpperCase() + ' (BRA)'

    // -- Template base COPA limpo (cabeca e tarjas vazias) --
    const baseCandidates = ['template-base.png', 'template-base.jpg', 'template.png', 'template.jpg']
    const templatePath = baseCandidates
      .map(f => path.join(process.cwd(), 'public', f))
      .find(p => fs.existsSync(p))
    if (!templatePath) {
      return NextResponse.json({ error: 'Template nao encontrado' }, { status: 500 })
    }
    const templateRaw  = fs.readFileSync(templatePath)
    const templateMime = templatePath.endsWith('.png') ? 'image/png' : 'image/jpeg'

    const photoBuffer = Buffer.from(await photoFile.arrayBuffer())
    const photoMime   = (photoFile.type || 'image/jpeg')

    // Resolucao de trabalho
    const baseMeta = await sharp(templateRaw).metadata()
    const TW = TARGET_W
    const TH = Math.round(TARGET_W * (baseMeta.height! / baseMeta.width!))
    const baseResized = await sharp(templateRaw).resize(TW, TH, { fit: 'fill' }).toBuffer()

    // -- 1) Localizar o ROSTO e isola-lo sobre o teal do template --
    const pMeta = await sharp(photoBuffer).metadata()
    const box   = await detectFaceBox(photoBuffer.toString('base64'), photoMime, pMeta.width!, pMeta.height!)
    const head  = await isolateHead(photoBuffer, box)

    // -- 2) Gemini FUNDE a cabeca na silhueta (refino/composicao) --
    const prompt = [
      'You are finishing a personalized soccer sticker. You are given TWO images.',
      '',
      'IMAGE 1 = the sticker template. It already contains everything: the teal background, the green "26", the COPA logo, the flag, "BRA", and a yellow Brazil jersey with a GREEN collar. In the upper-center there is an EMPTY light-blue head/neck SILHOUETTE. The two empty teal bars at the bottom must stay EMPTY.',
      '',
      'IMAGE 2 = a real person\'s head, already placed on the SAME teal color as the template background.',
      '',
      'TASK: Composite the head from IMAGE 2 into the empty silhouette of IMAGE 1 as a clean, front-facing portrait (head + neck).',
      '',
      'STRICT RULES:',
      '- PRESERVE THE IDENTITY EXACTLY: same face shape, eyes, nose, mouth, eyebrows, skin tone, hair and expression as IMAGE 2. Do NOT beautify, age, slim, change ethnicity, or stylize. It must look like a PHOTO of the same person.',
      '- Blend the hair and all edges SMOOTHLY into the teal background. There must be NO rectangular box, NO hard seam, and NO leftover original background (no room, no furniture, no clothing, no studio/gray box) around the head.',
      '- Build a realistic NECK in the person\'s own skin tone that connects naturally into the green jersey collar - no empty teal gap between the chin and the collar.',
      '- Keep EVERYTHING ELSE identical to IMAGE 1: the green "26", the COPA logo, the flag, "BRA", the jersey, the teal background and the two empty bottom bars.',
      '- Do NOT add any text anywhere.',
      '',
      'Output: only the finished sticker image.',
    ].join('\n')

    let generated: Buffer | null = null
    try {
      const response = await ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: templateMime, data: templateRaw.toString('base64') } },
            { inlineData: { mimeType: 'image/jpeg',  data: head.teal.toString('base64')    } },
          ],
        }],
        config: { responseModalities: ['IMAGE', 'TEXT'] },
      })
      const parts = response.candidates?.[0]?.content?.parts ?? []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imgData = (parts.find((p: any) => p.inlineData?.data) as any)?.inlineData?.data as string | undefined
      if (imgData) {
        generated = await sharp(Buffer.from(imgData, 'base64')).resize(TW, TH, { fit: 'fill' }).toBuffer()
      } else {
        console.error('[gerar] Gemini nao retornou imagem. Parts:', JSON.stringify(parts).slice(0, 400))
      }
    } catch (e) {
      console.error('[gerar] modelo de imagem falhou, usando composicao local:', e)
    }

    // Fallback deterministico (nunca devolve quadrado cinza nem erro)
    if (!generated) {
      generated = await composeHeadOnTemplate(baseResized, head.alpha, head.w, head.h, TW, TH)
    }

    // -- 3) Restaurar as tarjas LIMPAS do template (anti-drift) --
    const bx = Math.round(BARS.x0 * TW), by = Math.round(BARS.y0 * TH)
    const bw = Math.round((BARS.x1 - BARS.x0) * TW), bh = Math.round((BARS.y1 - BARS.y0) * TH)
    const cleanBars = await sharp(baseResized)
      .extract({ left: bx, top: by, width: bw, height: Math.min(bh, TH - by) })
      .toBuffer()

    // -- 4) Texto (Open Sans) sobre as tarjas --
    const textSvg = await buildTextSvg(TW, TH, nome.toUpperCase(), statsLine, clubeLine)

    const cleanImage = await sharp(generated)
      .composite([
        { input: cleanBars, top: by, left: bx },
        { input: textSvg,   top: 0,  left: 0 },
      ])
      .jpeg({ quality: 92 })
      .toBuffer()

    // -- Salvar versao limpa no Blob --
    const id = crypto.randomUUID()
    const blobResult = await put('figurinhas/' + id + '.jpg', cleanImage, { access: 'public', addRandomSuffix: false })

    // -- Watermark PREVIEW --
    const watermarkSvg = await buildWatermarkSvg(TW, TH)
    const previewImage = await sharp(cleanImage)
      .composite([{ input: watermarkSvg, top: 0, left: 0 }])
      .jpeg({ quality: 88 })
      .toBuffer()

    return NextResponse.json({
      image: 'data:image/jpeg;base64,' + previewImage.toString('base64'),
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
}, 400))
      }
    } catch (e) {
      console.error('[gerar] modelo de imagem falhou, usando composicao local:', e)
    }

    // Fallback deterministico (nunca devolve quadrado cinza nem erro)
    if (!generated) {
      generated = await composeHeadOnTemplate(baseResized, head.alpha, head.w, head.h, TW, TH)
    }

    // -- 3) Restaurar as tarjas LIMPAS do template (anti-drift) --
    const bx = Math.round(BARS.x0 * TW), by = Math.round(BARS.y0 * TH)
    const bw = Math.round((BARS.x1 - BARS.x0) * TW), bh = Math.round((BARS.y1 - BARS.y0) * TH)
    const cleanBars = await sharp(baseResized)
      .extract({ left: bx, top: by, width: bw, height: Math.min(bh, TH - by) })
      .toBuffer()

    // -- 4) Texto (Open Sans) sobre as tarjas --
    const textSvg = await buildTextSvg(TW, TH, nome.toUpperCase(), statsLine, clubeLine)

    const cleanImage = await sharp(generated)
      .composite([
        { input: cleanBars, top: by, left: bx },
        { input: textSvg,   top: 0,  left: 0 },
      ])
      .jpeg({ quality: 92 })
      .toBuffer()

    // -- Salvar versao limpa no Blob --
    const id = crypto.randomUUID()
    const blobResult = await put('figurinhas/' + id + '.jpg', cleanImage, { access: 'public', addRandomSuffix: false })

    // -- Watermark PREVIEW --
    const watermarkSvg = await buildWatermarkSvg(TW, TH)
    const previewImage = await sharp(cleanImage)
      .composite([{ input: watermarkSvg, top: 0, left: 0 }])
      .jpeg({ quality: 88 })
      .toBuffer()

    return NextResponse.json({
      image: 'data:image/jpeg;base64,' + previewImage.toString('base64'),
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
