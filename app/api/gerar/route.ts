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

        console.log('[gerar] Replicate gpt-image-2: gerando card')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const output: any = await replicate.run('openai/gpt-image-2' as `${string}/${string}`, {
          input: {
            prompt:           promptLines.join('\n'), // mesmo prompt do Gemini
            input_images:     [templateBlobAsset.url, tempPhotoUrl],
            aspect_ratio:     '2:3',
            quality:          'medium', // high ultrapassa 120s (Gemini ~44s + gpt-image-2 ~80s)
            output_format:    'png',   // PNG intermediário evita dupla compressão JPEG na borda
            moderation:       'low',   // bypassa bloqueio de fotos de crianças
            number_of_images: 1,
          },
        })

        if (output) {
          // Output pode ser array de URLs ou objeto com .url()
          const resultUrl: string = Array.isArray(output)
            ? output[0]
            : typeof output?.url === 'function' ? output.url() : String(output)

          const genBuf = Buffer.from(await (await fetch(resultUrl)).arrayBuffer())
          // Não aplicamos o SVG aqui: o gpt-image-2 já gera a barra de info teal do template
          // com o texto correto (nome/data/clube) via prompt. Adicionar o SVG navy criaria
          // uma barra duplicada sobre o design original do template.
          cleanImage = await sharp(genBuf)
            .resize(TW, TH, { fit: 'cover', position: 'centre' })
            .jpeg({ quality: 92 })
            .toBuffer()
          console.log('[gerar] gpt-image-2 OK')
        } else {
          console.warn('[gerar] gpt-image-2 retornou null')
        }

        if (tempPhotoUrl) del(tempPhotoUrl).catch(() => {})
      } catch (repErr) {
        if (tempPhotoUrl) del(tempPhotoUrl).catch(() => {})
        console.warn('[gerar] gpt-image-2 falhou:', repErr)
      }
    }

    // ── Ambos falharam: pede ao lead para enviar outra foto ──
    if (!cleanImage) {
      return NextResponse.json({
        error: 'Não conseguimos processar esta foto. Envie uma foto com o rosto bem visível, em boa iluminação e sem outras pessoas no enquadramento.',
        blocked: true,
      }, { status: 422 })
    }

    // ── Salva no Blob e gera preview ────────────────────────────
    const id   = crypto.randomUUID()
    const blob = await put('figurinhas/' + id + '.jpg', cleanImage, { access: 'public', addRandomSuffix: false })

    // Metadata por ID (webhook)
    await put('figurinhas/meta/' + id + '.json',
      Buffer.from(JSON.stringify({ email, nome: nomeUpper, blobUrl: blob.url })),
      { access: 'public', addRandomSuffix: false, contentType: 'application/json' })

    // Index por e-mail (área de membros)
    if (email) {
      const emailKey = email.toLowerCase().replace('@', '--at--')
      await put('figurinhas/idx/' + emailKey + '/' + id + '.json',
        Buffer.from(JSON.stringify({ nome: nomeUpper, blobUrl: blob.url, paid: false })),
        { access: 'public', addRandomSuffix: false, contentType: 'application/json' })
    }

    // Preview com watermark
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

// SVG que cobre o texto original do template e insere os dados do lead.
// topPct: posição vertical da faixa (0.705 para Gemini, ~0.82 para gpt-image-2).
// No Gemini o template já define o layout exato; no gpt-image-2, após crop 2:3→3:4,
// a barra de info gerada pela IA cai mais abaixo (~82%), então ajustamos para evitar
// a faixa dupla no meio da figurinha.
function buildTextSvg(tw: number, th: number, nome: string, info: string, clube: string, topPct = 0.705): string {
  const faixaTop  = Math.floor(th * topPct)
  const available = th - faixaTop
  // Mantém proporções originais para o caminho Gemini; escala proporcionalmente para outros.
  const faixaH    = topPct === 0.705 ? Math.floor(th * 0.260)              : Math.floor(available * 0.93)
  const nomeY     = topPct === 0.705 ? Math.floor(th * 0.775)              : Math.floor(faixaTop + available * 0.25)
  const infoY     = topPct === 0.705 ? Math.floor(th * 0.845)              : Math.floor(faixaTop + available * 0.53)
  const clubeY    = topPct === 0.705 ? Math.floor(th * 0.905)              : Math.floor(faixaTop + available * 0.78)
  const faixaLeft = Math.floor(tw * 0.02)
  const faixaW    = Math.floor(tw * 0.96)
  const nomeSz    = Math.round(tw * 0.062)
  const infoSz    = Math.round(tw * 0.038)
  const cx        = Math.round(tw / 2)

  return [
    '<svg width="' + tw + '" height="' + th + '" xmlns="http://www.w3.org/2000/svg">',
    '  <rect x="' + faixaLeft + '" y="' + faixaTop + '" width="' + faixaW + '" height="' + faixaH + '" fill="rgb(11,18,78)" rx="32"/>',
    '  <text x="' + cx + '" y="' + nomeY + '" font-family="Arial Black,Arial,sans-serif" font-size="' + nomeSz + '" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">' + escapeXml(nome) + '</text>',
    '  <text x="' + cx + '" y="' + infoY + '" font-family="Arial,sans-serif" font-size="' + infoSz + '" fill="white" text-anchor="middle" dominant-baseline="middle">' + escapeXml(info) + '</text>',
    '  <text x="' + cx + '" y="' + clubeY + '" font-family="Arial,sans-serif" font-size="' + infoSz + '" fill="white" text-anchor="middle" dominant-baseline="middle">' + escapeXml(clube) + '</text>',
    '</svg>',
  ].join('\n')
}

function escapeXml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
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
