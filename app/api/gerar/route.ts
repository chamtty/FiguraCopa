import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { put } from '@vercel/blob'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! })
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image'

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

    // Formata dados
    const alturaNum = parseFloat(altura)
    const alturaStr = alturaNum > 3
      ? (alturaNum / 100).toFixed(2).replace('.', ',') + 'm'
      : alturaNum.toString().replace('.', ',') + 'm'
    const dd = String(parseInt(dia)).padStart(2, '0')
    const mm = String(parseInt(mes)).padStart(2, '0')
    const nomeUpper  = nome.toUpperCase()
    const clubeUpper = clube.toUpperCase() + ' (BRA)'
    const infoLine   = dd + '-' + mm + '-' + ano + ' | ' + alturaStr + ' | ' + peso + 'kg'

    // Carrega template (com Neymar — base para o Gemini replicar)
    const templatePath = path.join(process.cwd(), 'public', 'template.jpg')
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({ error: 'Template nao encontrado' }, { status: 500 })
    }
    const templateBuf = fs.readFileSync(templatePath)
    const templateMeta = await sharp(templateBuf).metadata()
    const TW = templateMeta.width!
    const TH = templateMeta.height!

    // Foto do lead
    const photoBuf  = Buffer.from(await photoFile.arrayBuffer())
    const photoMime = photoFile.type || 'image/jpeg'

    // Prompt direto e objetivo
    const promptLines = [
      'TASK: Face-swap on a soccer sticker card.',
      '',
      'IMAGE 1 = the sticker card template (your output base).',
      'IMAGE 2 = the person whose face replaces Neymar in the card.',
      '',
      'Instructions:',
      '1. Keep IMAGE 1 exactly as-is.',
      '2. Replace only Neymar face/head with the face from IMAGE 2. Same position, same scale.',
      '3. Replace the text in the bottom bar. Show ONLY the values, no labels:',
      '   Line 1 (large bold white): ' + nomeUpper,
      '   Line 2 (small white): ' + infoLine,
      '   Line 3 (small white): ' + clubeUpper,
      '',
      'Output rules:',
      '- Output dimensions must match IMAGE 1 exactly: ' + TW + 'x' + TH + ' pixels.',
      '- The sticker card fills the entire output frame edge to edge.',
      '- No background from IMAGE 2 should appear.',
      '- Do not rotate, crop, or scale the card.',
      '- Preserve all card elements: yellow border, teal background, green 26, COPA logo, flag badge, BRA text, jersey.',
    ]
    const prompt = promptLines.join('\n')

    // Chama o modelo de imagem
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

    // Redimensiona para as dimensoes EXATAS do template sem distorcer
    // fit:cover = preenche o frame sem esticar, cortando minimos pixels se necessario
    const cleanImage = await sharp(Buffer.from(imgData, 'base64'))
      .resize(TW, TH, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 92 })
      .toBuffer()

    const id = crypto.randomUUID()
    await put('figurinhas/' + id + '.jpg', cleanImage, { access: 'public', addRandomSuffix: false })

    // Watermark para preview
    const wm = buildWatermarkSvg(TW, TH)
    const previewImage = await sharp(cleanImage)
      .composite([{ input: Buffer.from(wm), top: 0, left: 0 }])
      .jpeg({ quality: 88 })
      .toBuffer()

    return NextResponse.json({
      image: 'data:image/jpeg;base64,' + previewImage.toString('base64'),
      id,
    })

  } catch (err) {
    console.error('[gerar]', err)
    return NextResponse.json({ error: 'Erro ao gerar a figurinha. Tente novamente.' }, { status: 500 })
  }
}

function buildWatermarkSvg(tw: number, th: number): string {
  const size = Math.round(tw * 0.10)
  const sm   = Math.round(tw * 0.032)
  const bp   = [0.04, 0.20, 0.37, 0.54, 0.70, 0.87]
  const sp   = [0.12, 0.29, 0.46, 0.62, 0.79]
  let svg = '<svg width="' + tw + '" height="' + th + '" xmlns="http://www.w3.org/2000/svg">'
  for (const f of bp) {
    const y = Math.round(th * f), cx = Math.round(tw / 2)
    svg += '<text x="' + cx + '" y="' + y + '" font-size="' + size + '" fill="white" fill-opacity="0.21" font-weight="bold" text-anchor="middle" transform="rotate(-38,' + cx + ',' + y + ')">PREVIEW - PREVIEW</text>'
  }
  for (const f of sp) {
    const y = Math.round(th * f), cx = Math.round(tw / 2)
    svg += '<text x="' + cx + '" y="' + y + '" font-size="' + sm + '" fill="white" fill-opacity="0.24" text-anchor="middle" transform="rotate(-38,' + cx + ',' + y + ')">figurinha-copa2026.com</text>'
  }
  return svg + '</svg>'
}
