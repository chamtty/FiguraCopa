import { NextRequest, NextResponse } from 'next/server'
import { put, del } from '@vercel/blob'
import Replicate from 'replicate'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! })

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
    const templateBuf  = fs.readFileSync(templatePath)
    const templateMeta = await sharp(templateBuf).metadata()
    const TW = templateMeta.width!
    const TH = templateMeta.height!

    // Foto do lead
    const photoBuf = Buffer.from(await photoFile.arrayBuffer())

    const promptLines = [
      'You are a sports trading card designer.',
      '',
      'IMAGE 1 = a FIFA World Cup 2026 collectible sticker card (the design template).',
      'IMAGE 2 = a photo of the person to feature on this card.',
      '',
      'Your task: create a personalized version of IMAGE 1 featuring the person from IMAGE 2.',
      '',
      'Instructions:',
      '1. Use IMAGE 1 as the complete card layout — keep every design element exactly as shown.',
      '2. Feature the person from IMAGE 2 in the portrait area of the card. Show their full upper',
      '   body from approximately waist level to just above the top of the head — same framing as',
      '   the template player. Do NOT zoom in on just the face or head. Match the studio lighting.',
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

    // ── Replicate openai/gpt-image-2 ──────────────────────────────
    // Modelo oficial da OpenAI no Replicate. moderation:'low' permite fotos de crianças/adolescentes.
    let cleanImage: Buffer | null = null
    let tempPhotoUrl: string | null = null

    try {
      const tempId = crypto.randomUUID()
      const [tempPhotoBlob, templateBlobAsset] = await Promise.all([
        put('figurinhas/temp/' + tempId + '.jpg', photoBuf, { access: 'public', addRandomSuffix: false }),
        put('figurinhas/assets/template.jpg', templateBuf, { access: 'public', addRandomSuffix: false }),
      ])
      tempPhotoUrl = tempPhotoBlob.url

      console.log('[gerar] gpt-image-2: iniciando geração')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const output: any = await replicate.run('openai/gpt-image-2' as `${string}/${string}`, {
        input: {
          prompt:           promptLines.join('\n'),
          input_images:     [templateBlobAsset.url, tempPhotoUrl],
          aspect_ratio:     '2:3',
          quality:          'medium',  // high ultrapassa 120s de maxDuration
          output_format:    'png',     // PNG intermediário evita dupla compressão JPEG
          moderation:       'low',     // bypassa bloqueio de fotos de crianças/adolescentes
          number_of_images: 1,
        },
      })

      if (output) {
        const resultUrl: string = Array.isArray(output)
          ? output[0]
          : typeof output?.url === 'function' ? output.url() : String(output)

        const genBuf = Buffer.from(await (await fetch(resultUrl)).arrayBuffer())

        // Sem redimensionamento: gpt-image-2 gera em 2:3 e o template é ~3:4.
        // Qualquer conversão entre os dois ratios implica distorção (fill),
        // corte (cover) ou barras (contain). Salvamos na resolução nativa 2:3
        // que já contém o card completo sem artefatos.
        cleanImage = await sharp(genBuf)
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

    if (!cleanImage) {
      return NextResponse.json({
        error: 'Não conseguimos processar esta foto. Envie uma foto com o rosto bem visível, em boa iluminação e sem outras pessoas no enquadramento.',
        blocked: true,
      }, { status: 422 })
    }

    // ── Salva no Blob ────────────────────────────────────────────
    const id   = crypto.randomUUID()
    const blob = await put('figurinhas/' + id + '.jpg', cleanImage, { access: 'public', addRandomSuffix: false })

    // Metadata por ID (webhook + cron de limpeza)
    await put('figurinhas/meta/' + id + '.json',
      Buffer.from(JSON.stringify({
        email,
        nome: nomeUpper,
        blobUrl: blob.url,
        createdAt: Date.now(), // usado pelo /api/cleanup para expirar após 24h
      })),
      { access: 'public', addRandomSuffix: false, contentType: 'application/json' })

    // Index por e-mail (área de membros)
    if (email) {
      const emailKey = email.toLowerCase().replace('@', '--at--')
      await put('figurinhas/idx/' + emailKey + '/' + id + '.json',
        Buffer.from(JSON.stringify({ nome: nomeUpper, blobUrl: blob.url, paid: false })),
        { access: 'public', addRandomSuffix: false, contentType: 'application/json' })
    }

    // Preview com watermark — usa dimensões reais da imagem gerada (pode diferir do template)
    const { width: IW, height: IH } = await sharp(cleanImage).metadata()
    const wm = buildWatermarkSvg(IW!, IH!)
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
  const size = Math.round(tw * 0.11)
  const sm   = Math.round(tw * 0.036)
  const bp   = [0.04, 0.20, 0.37, 0.54, 0.70, 0.87]
  const sp   = [0.12, 0.29, 0.46, 0.62, 0.79]
  let svg = '<svg width="' + tw + '" height="' + th + '" xmlns="http://www.w3.org/2000/svg">'
  for (const f of bp) {
    const y = Math.round(th * f), cx = Math.round(tw / 2)
    svg += '<text x="' + cx + '" y="' + y + '" font-size="' + size + '" fill="white" fill-opacity="0.82" font-weight="bold" text-anchor="middle" stroke="#000000" stroke-width="4" stroke-opacity="0.55" paint-order="stroke" transform="rotate(-38,' + cx + ',' + y + ')">PREVIEW - PREVIEW</text>'
  }
  for (const f of sp) {
    const y = Math.round(th * f), cx = Math.round(tw / 2)
    svg += '<text x="' + cx + '" y="' + y + '" font-size="' + sm + '" fill="white" fill-opacity="0.80" text-anchor="middle" stroke="#000000" stroke-width="2" stroke-opacity="0.50" paint-order="stroke" transform="rotate(-38,' + cx + ',' + y + ')">figurinha-copa2026.com</text>'
  }
  return svg + '</svg>'
}
