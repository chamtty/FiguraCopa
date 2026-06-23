import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { put } from '@vercel/blob'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! })

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image'
const TARGET_W = 1200

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
      : alturaNum.toString().replace('.', ',') + 'm'
    const dd = String(parseInt(dia)).padStart(2, '0')
    const mm = String(parseInt(mes)).padStart(2, '0')
    const nascimento = dd + '-' + mm + '-' + ano
    const nomeUpper  = nome.toUpperCase()
    const clubeUpper = clube.toUpperCase() + ' (BRA)'
    const infoLine   = nascimento + ' | ' + alturaStr + ' | ' + peso + 'kg'

    const templatePath = path.join(process.cwd(), 'public', 'template.jpg')
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({ error: 'Template nao encontrado' }, { status: 500 })
    }
    const templateBuf = fs.readFileSync(templatePath)

    const photoBuf  = Buffer.from(await photoFile.arrayBuffer())
    const photoMime = photoFile.type || 'image/jpeg'

    const promptParts = [
      'TASK: Face-swap on a soccer sticker card.',
      '',
      'IMAGE 1 = the sticker card. This is your canvas and your output.',
      'IMAGE 2 = a photo of a person. Extract only their face — ignore the background completely.',
      '',
      'Make exactly two changes to IMAGE 1:',
      '1. Replace the face/head in the card with the face from IMAGE 2. Blend edges into the teal background. Keep the body/jersey exactly as-is.',
      '2. Replace the text in the bottom bar with:',
      '   Name: ' + nomeUpper,
      '   Info: ' + infoLine,
      '   Club: ' + clubeUpper,
      '',
      'OUTPUT RULES (critical):',
      '- Output only the sticker card, filling the entire frame edge to edge, same proportions as IMAGE 1.',
      '- Do NOT show any background from IMAGE 2.',
      '- Do NOT show the card floating on the person photo.',
      '- Do NOT rotate or scale down the card.',
      '- Everything else in IMAGE 1 stays identical: yellow border, teal background, green 26, COPA logo, flag, BRA, jersey.',
    ]
    const prompt = promptParts.join('\n')

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/jpeg', data: templateBuf.toString('base64') } },
          { inlineData: { mimeType: photoMime,    data: photoBuf.toString('base64') } },
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

    // Usa 'cover' com crop central para preservar proporcoes sem distorcer
    const cleanImage = await sharp(Buffer.from(imgData, 'base64'))
      .resize(TARGET_W, TH, { fit: 'cover', position: 'centre' })
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
    const y = Math.round(th * f)
    const cx = Math.round(tw / 2)
    svg += '<text x="' + cx + '" y="' + y + '" font-family="Impact,Arial,sans-serif" font-size="' + size + '" font-weight="bold" fill="white" fill-opacity="0.21" text-anchor="middle" transform="rotate(-38,' + cx + ',' + y + ')">PREVIEW - PREVIEW</text>'
  }
  for (const f of smallPos) {
    const y = Math.round(th * f)
    const cx = Math.round(tw / 2)
    svg += '<text x="' + cx + '" y="' + y + '" font-family="Arial,sans-serif" font-size="' + smallSize + '" fill="white" fill-opacity="0.24" text-anchor="middle" transform="rotate(-38,' + cx + ',' + y + ')">figurinha-copa2026.com</text>'
  }
  svg += '</svg>'
  return svg
}
