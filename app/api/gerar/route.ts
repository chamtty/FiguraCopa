import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { put, del } from '@vercel/blob'
import Replicate from 'replicate'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! })
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image'
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! })

// Modelo Replicate para face-swap (usado como fallback quando Gemini bloqueia)
const REPLICATE_MODEL = 'codeplugtech/face-swap:278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const photoFile = formData.get('photo') as File | null
    const nome   = (formData.get('nome')   as string | null)?.trim() || ''
    const dia    = (formData.get('dia')    as string | null) || ''
    const mes    = (formData.get('mes')    as string | null) || ''
    const ano    = (formData.get('ano')    as string | null) || ''
    const clube  = (formData.get('clube')  as string | null)?.trim() || ''
    const email  = (formData.get('email')  as string | null)?.trim() || ''
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

    // Carrega template
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

    // ── TENTATIVA 1: Gemini ──────────────────────────────────────
    let cleanImage: Buffer | null = null

    const promptLines = [
      'You are a sports trading card designer.',
      '',
      'IMAGE 1 = a FIFA World Cup 2026 collectible sticker card (the design template).',
      'IMAGE 2 = a photo of the soccer player to feature on this card.',
      '',
      'Your task: create a personalized version of IMAGE 1 featuring the player from IMAGE 2.',
      '',
      'Instructions:',
      '1. Use IMAGE 1 as the complete card layout — keep every design element exactly as shown.',
      '2. Feature the player from IMAGE 2 in the portrait area of the card, in the same position,',
      '   size and style as the original player portrait. Match the studio lighting of the card.',
      '3. Update the text in the bottom info bar — show ONLY the values below, no labels:',
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

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{
        role: 'user',
        parts: [
          { text: promptLines.join('\n') },
          { inlineData: { mimeType: 'image/jpeg', data: templateBuf.toString('base64') } },
          { inlineData: { mimeType: photoMime,    data: photoBuf.toString('base64') } },
        ],
      }],
      config: { responseModalities: ['IMAGE', 'TEXT'] },
    })

    const candidate    = response.candidates?.[0]
    const finishReason = (candidate?.finishReason as string | undefined) ?? ''
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts        = candidate?.content?.parts ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imgData      = (parts.find((p: any) => p.inlineData?.data) as any)?.inlineData?.data as string | undefined

    if (imgData) {
      // Gemini funcionou — redimensiona para as dimensões exatas do template
      cleanImage = await sharp(Buffer.from(imgData, 'base64'))
        .resize(TW, TH, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 92 })
        .toBuffer()
      console.log('[gerar] Gemini OK')
    } else {
      console.warn('[gerar] Gemini bloqueou (finishReason:', finishReason, ') — tentando Replicate')
    }

    // ── TENTATIVA 2: Replicate openai/gpt-image-2 ──
    // Aceita input_images (array com template + foto do lead) + prompt.
    // moderation:'low' bypassa o bloqueio de fotos de crianças.
    // Mesma abordagem do Gemini, custo ~$0,05/geração (quality:medium).
    if (!cleanImage && process.env.REPLICATE_API_TOKEN) {
      let tempPhotoUrl: string | null = null
      try {
        const tempId = crypto.randomUUID()
        const [tempPhotoBlob, templateBlobAsset] = await Promise.all([
          put('figurinhas/temp/' + tempId + '.jpg', photoBuf, { access: 'public', addRandomSuffix: false }),
          put('figurinhas/assets/template.jpg', templateBuf, { access: 'public', addRandomSuffix: false }),
        ])
        tempPhotoUrl = tempPhotoBlob.url

        console.log('[gerar] Repli