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
const HEAD  = { cx: 0.452, topY: 0.04, width: 0.44 }

// Cor EXATA do fundo teal do template (amostrada do template-base.jpg).
const TEAL = { r: 92, g: 190, b: 210 }

const TARGET_W = 1200
// Modelo correto para geração de imagens no Gemini API
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.0-flash-preview-image-generation'
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

/* 1) Localiza o rosto na foto do lead (Gemini detecta). */
async function detectFaceBox(
  photoB64: string, photoMime: string, imgW: number, imgH: number,
): Promise<{ left: number; top: number; width: number; height: number }> {
  const fallback = {
    left: Math.round(imgW * 0.18), top: Math.round(imgH * 0.04),
    width: Math.round(imgW * 0.64), height: Math.round(imgH * 0.55),
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
    const bw = r - l, bh = b - t
    // Margem extra no topo para capturar o cabelo completo
    l -= bw * 0.08; r += bw * 0.08; t -= bh * 0.18; b += bh * 0.06
    l = Math.max(0, l); t = Math.max(0, t); r = Math.min(imgW, r); b = Math.min(imgH, b)
    const width = Math.round(r - l), height = Math.round(b - t)
    if (width < 20 || height < 20) return fallback
    return { left: Math.round(l), top: Math.round(t), width, height }
  } catch (e) {
    console.error('[gerar] detectFaceBox falhou, usando fallback:', e)
    return fallback
  }
}

/* 2) Prepara o rosto:
   - raw  = recorte JPEG puro, sem máscara (enviado para o modelo de IA)
   - alpha = recorte com máscara oval suave (fallback local)
   - teal  = alpha achatado sobre a cor do template (fallback alternativo)          */
async function prepareFace(
  photo: Buffer,
  box: { left: number; top: number; width: number; height: number },
): Promise<{ raw: Buffer; alpha: Buffer; teal: Buffer; w: number; h: number }> {
  const crop = await sharp(photo)
    .extract(box)
    .resize(640, 860, { fit: 'inside', withoutEnlargement: false })
    .toBuffer()
  const meta = await sharp(crop).metadata()
  const cw = meta.width!, ch = meta.height!

  // Máscara oval melhorada: mais justa ao rosto, menos blur
  // O rosto ocupa ~80% do crop (com as margens adicionadas em detectFaceBox)
  const faceTopY   = ch * 0.04   // onde começa o topo do cabelo
  const faceCenterY = ch * 0.43  // centro vertical do rosto
  const rxFace = cw * 0.46       // raio horizontal (quase largura total)
  const ryFace = ch * 0.40       // raio vertical

  const svg =
    '<svg width="' + cw + '" height="' + ch + '" xmlns="http://www.w3.org/2000/svg">' +
    // Oval principal cobrindo rosto + cabeça
    '<ellipse cx="' + (cw * 0.5) + '" cy="' + faceCenterY + '" rx="' + rxFace + '" ry="' + ryFace + '" fill="#fff"/>' +
    // Pescoço: retângulo fino descendo do queixo até o final do crop
    '<rect x="' + (cw * 0.35) + '" y="' + (faceCenterY + ryFace * 0.75) + '" width="' + (cw * 0.30) + '" height="' + (ch - (faceCenterY + ryFace * 0.75)) + '" fill="#fff"/>' +
    '</svg>'

  // Blur menor = bordas mais nítidas (2% em vez de 6%)
  const sigma = Math.max(1.5, cw * 0.022)
  const maskPng = await sharp(Buffer.from(svg)).blur(sigma).png().toBuffer()

  const alpha = await sharp(crop)
    .ensureAlpha()
    .composite([{ input: maskPng, blend: 'dest-in' }])
    .png()
    .toBuffer()

  const teal = await sharp(alpha)
    .flatten({ background: TEAL })
    .jpeg({ quality: 95 })
    .toBuffer()

  // Raw: recorte puro sem nenhuma máscara (para envio ao modelo de IA)
  const raw = await sharp(crop).jpeg({ quality: 95 }).toBuffer()

  return { raw, alpha, teal, w: cw, h: ch }
}

/* Fallback deterministico: encaixa a cabeca (alfa) na silhueta do template. */
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

    // Carrega o template base (com silhueta vazia)
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

    const baseMeta = await sharp(templateRaw).metadata()
    const TW = TARGET_W
    const TH = Math.round(TARGET_W * (baseMeta.height! / baseMeta.width!))
    const baseResized = await sharp(templateRaw).resize(TW, TH, { fit: 'fill' }).toBuffer()

    // Detecta rosto e prepara o recorte
    const pMeta = await sharp(photoBuffer).metadata()
    const box   = await detectFaceBox(photoBuffer.toString('base64'), photoMime, pMeta.width!, pMeta.height!)
    const face  = await prepareFace(photoBuffer, box)

    // Prompt para o modelo de imagem:
    // Enviamos (1) o template limpo e (2) o rosto bruto (sem máscara),
    // para que a IA faça a remoção de fundo e o encaixe com qualidade.
    const prompt = [
      'You are creating a personalized soccer sticker. You have TWO images.',
      'IMAGE 1 = the sticker template. It has a teal/light-blue background with a green "26", a COPA trophy logo, a Brazilian flag badge, "BRA" lettering, and a real yellow Brazil jersey (CBF badge). In the upper-center there is a light-blue EMPTY head silhouette — that is where the person\'s face must go. The two teal bars at the bottom must stay completely empty (no text).',
      'IMAGE 2 = a real photo of the person whose face should be placed in the sticker.',
      'TASK:',
      '1. Extract the person\'s face and neck from IMAGE 2, removing the background completely.',
      '2. Place the clean face inside the empty head silhouette of IMAGE 1, sized to fill it naturally.',
      '3. Blend the hair/neck edges smoothly into the teal background — no rectangular borders, no hard seams.',
      '4. Build a natural neck that connects seamlessly into the green jersey collar.',
      'STRICT RULES:',
      '- Preserve the person\'s identity EXACTLY: same face, skin tone, eyes, hair. Do NOT change their appearance.',
      '- Do NOT add any text or numbers anywhere.',
      '- Keep all other elements of IMAGE 1 unchanged: jersey, logos, colors, bottom bars.',
      'Output: only the finished sticker (same dimensions as IMAGE 1).',
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
            // Envia o rosto PURO (sem máscara) para que a IA faça a remoção de fundo corretamente
            { inlineData: { mimeType: 'image/jpeg', data: face.raw.toString('base64') } },
          ],
        }],
        config: { responseModalities: ['IMAGE', 'TEXT'] },
      })
      const parts = response.candidates?.[0]?.content?.parts ?? []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imgData = (parts.find((p: any) => p.inlineData?.data) as any)?.inlineData?.data as string | undefined
      if (imgData) {
        generated = await sharp(Buffer.from(imgData, 'base64')).resize(TW, TH, { fit: 'fill' }).toBuffer()
        console.log('[gerar] Gemini gerou imagem com sucesso')
      } else {
        console.error('[gerar] Gemini nao retornou imagem, usando composicao local')
      }
    } catch (e) {
      console.error('[gerar] Modelo de imagem falhou, usando composicao local:', e)
    }

    // Fallback: composicao local com mascara oval melhorada
    if (!generated) {
      generated = await composeHeadOnTemplate(baseResized, face.alpha, face.w, face.h, TW, TH)
    }

    // Restaura as barras do template limpo (garante que o texto de exemplo sumiu)
    const bx = Math.round(BARS.x0 * TW), by = Math.round(BARS.y0 * TH)
    const bw = Math.round((BARS.x1 - BARS.x0) * TW), bh = Math.round((BARS.y1 - BARS.y0) * TH)
    const cleanBars = await sharp(baseResized)
      .extract({ left: bx, top: by, width: bw, height: Math.min(bh, TH - by) })
      .toBuffer()

    // Overlay de texto com nome, stats e clube
    const textSvg = await buildTextSvg(TW, TH, nome.toUpperCase(), statsLine, clubeLine)

    // Imagem final limpa (sem watermark) — salva no Vercel Blob
    const cleanImage = await sharp(generated)
      .composite([
        { input: cleanBars, top: by, left: bx },
        { input: textSvg,   top: 0,  left: 0 },
      ])
      .jpeg({ quality: 92 })
      .toBuffer()

    const id = crypto.randomUUID()
    await put('figurinhas/' + id + '.jpg', cleanImage, { access: 'public', addRandomSuffix: false })

    // Versão com watermark PREVIEW para exibir ao usuario (antes do pagamento)
    const watermarkSvg = await buildWatermarkSvg(TW, TH)
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
