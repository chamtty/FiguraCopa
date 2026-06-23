import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { put } from '@vercel/blob'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! })
const IMAGE_MODEL  = process.env.GEMINI_IMAGE_MODEL  || 'gemini-3-pro-image'
const VISION_MODEL = process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash'
const TARGET_W = 1200

export const maxDuration = 60

/* Detecta o rosto e retorna recorte quadrado com padding generoso */
async function cropFace(photoBuf: Buffer, photoMime: string): Promise<Buffer> {
  const meta = await sharp(photoBuf).metadata()
  const W = meta.width!, H = meta.height!
  let left = Math.round(W * 0.15), top = Math.round(H * 0.05)
  let width = Math.round(W * 0.70), height = Math.round(H * 0.70)
  try {
    const prompt = 'Detect the single main person in this photo. Return ONLY strict JSON: {"box_2d":[ymin,xmin,ymax,xmax]} where values are integers 0-1000 normalized to image size. Include the full head (hair to chin) and shoulders. No markdown.'
    const res = await ai.models.generateContent({
      model: VISION_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: photoMime, data: photoBuf.toString('base64') } }] }],
      config: { responseMimeType: 'application/json', temperature: 0 },
    })
    const txt = res.text ?? ''
    const m = txt.match(/\[\s*\d+[\s,]+\d+[\s,]+\d+[\s,]+\d+\s*\]/)
    if (m) {
      const [ymin, xmin, ymax, xmax] = JSON.parse(m[0]) as number[]
      const pad = 0.15
      const l = Math.max(0, ((xmin / 1000) - pad) * W)
      const t = Math.max(0, ((ymin / 1000) - pad) * H)
      const r = Math.min(W, ((xmax / 1000) + pad) * W)
      const b = Math.min(H, ((ymax / 1000) + pad) * H)
      left = Math.round(l); top = Math.round(t)
      width = Math.round(r - l); height = Math.round(b - t)
    }
  } catch { /* usa fallback */ }
  return sharp(photoBuf)
    .extract({ left, top, width, height })
    .resize(800, 800, { fit: 'inside' })
    .jpeg({ quality: 95 })
    .toBuffer()
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

    const alturaNum = parseFloat(altura)
    const alturaStr = alturaNum > 3
      ? (alturaNum / 100).toFixed(2).replace('.', ',') + 'm'
      : alturaNum.toString().replace('.', ',') + 'm'
    const dd = String(parseInt(dia)).padStart(2, '0')
    const mm = String(parseInt(mes)).padStart(2, '0')
    const nomeUpper  = nome.toUpperCase()
    const clubeUpper = clube.toUpperCase() + ' (BRA)'
    const infoLine   = dd + '-' + mm + '-' + ano + ' | ' + alturaStr + ' | ' + peso + 'kg'

    const templatePath = path.join(process.cwd(), 'public', 'template.jpg')
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({ error: 'Template nao encontrado' }, { status: 500 })
    }
    const templateBuf = fs.readFileSync(templatePath)

    const photoBuf  = Buffer.from(await photoFile.arrayBuffer())
    const photoMime = photoFile.type || 'image/jpeg'

    // Pre-recorta apenas o rosto para nao vazar fundo da foto
    const faceCrop = await cropFace(photoBuf, photoMime)

    const promptParts = [
      'TASK: Photorealistic face transplant on a soccer sticker card.',
      '',
      'IMAGE 1 = the soccer sticker card. This is BOTH your canvas and your output.',
      'IMAGE 2 = a cropped photo of a face.',
      '',
      'STEP 1 - FACE REPLACEMENT:',
      '- Study where Neymar head is in IMAGE 1: its exact pixel position, scale, and bounding box.',
      '- Remove only Neymar head from IMAGE 1.',
      '- Place the face from IMAGE 2 into that EXACT same bounding box. The new head must be the same size as Neymar head was — do NOT scale it up or down beyond that box.',
      '- Preserve EXACTLY the real skin tone, hair, eyes, nose, mouth from IMAGE 2. Photorealistic only — do NOT redraw, illustrate, or stylize.',
      '- Blend hair edges and neck smoothly into the teal background.',
      '- Keep the body/jersey exactly as-is in IMAGE 1.',
      '',
      'STEP 2 - TEXT UPDATE in the bottom bar only:',
      '  Name: ' + nomeUpper,
      '  Info: ' + infoLine,
      '  Club: ' + clubeUpper,
      '',
      'OUTPUT RULES (non-negotiable):',
      '- Output = IMAGE 1 at 100% size, edge to edge, same proportions.',
      '- Do NOT include any background from IMAGE 2.',
      '- Do NOT place the card floating over the photo.',
      '- Do NOT crop or rotate the card.',
      '- Preserve everything else: yellow border, teal background, green 26, COPA logo, flag, BRA, jersey.',
    ]
    const prompt = promptParts.join('\n')

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/jpeg', data: templateBuf.toString('base64') } },
          { inlineData: { mimeType: 'image/jpeg', data: faceCrop.toString('base64') } },
        ],
      }],
      config: { responseModalities: ['IMAGE', 'TEXT'] },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts   = response.candidates?.[0]?.content?.parts ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imgData = (parts.find((p: any) => p.inlineData?.data) as any)?.inlineData?.data as string | undefined

    if (!imgData) {
      console.error('[gerar] Gemini nao retornou imagem')
      return NextResponse.json({ error: 'Erro ao gerar a figurinha. Tente novamente.' }, { status: 500 })
    }

    const templateMeta = await sharp(templateBuf).metadata()
    const TH = Math.round(TARGET_W * (templateMeta.height! / templateMeta.width!))

    const cleanImage = await sharp(Buffer.from(imgData, 'base64'))
      .resize(TARGET_W, TH, { fit: 'fill' })
      .jpeg({ quality: 92 })
      .toBuffer()

    const id = crypto.randomUUID()
    await put('figurinhas/' + id + '.jpg', cleanImage, { access: 'public', addRandomSuffix: false })

    const watermark = buildWatermarkSvg(TARGET_W, TH)
    const previewImage = await sharp(cleanImage)
      .composite([{ input: Buffer.from(watermark), top: 0, left: 0 }])
      .jpeg({ quality: 88 })
      .toBuffer()

    return NextResponse.json({
      image: 'data:image/jpeg;base64,' + previewImage.toString('base64'),
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

function buildWatermarkSvg(tw: number, th: number): string {
  const size      = Math.round(tw * 0.10)
  const smallSize = Math.round(tw * 0.032)
  const bigPos    = [0.04, 0.20, 0.37, 0.54, 0.70, 0.87]
  const smallPos  = [0.12, 0.29, 0.46, 0.62, 0.79]
  let svg = '<svg width="' + tw + '" height="' + th + '" xmlns="http://www.w3.org/2000/svg">'
  for (const f of bigPos) {
    const y = Math.round(th * f); const cx = Math.round(tw / 2)
    svg += '<text x="' + cx + '" y="' + y + '" font-family="Impact,Arial,sans-serif" font-size="' + size + '" font-weight="bold" fill="white" fill-opacity="0.21" text-anchor="middle" transform="rotate(-38,' + cx + ',' + y + ')">PREVIEW - PREVIEW</text>'
  }
  for (const f of smallPos) {
    const y = Math.round(th * f); const cx = Math.round(tw / 2)
    svg += '<text x="' + cx + '" y="' + y + '" font-family="Arial,sans-serif" font-size="' + smallSize + '" fill="white" fill-opacity="0.24" text-anchor="middle" transform="rotate(-38,' + cx + ',' + y + ')">figurinha-copa2026.com</text>'
  }
  svg += '</svg>'
  return svg
}
