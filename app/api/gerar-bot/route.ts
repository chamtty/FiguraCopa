import { NextRequest, NextResponse } from 'next/server'
import { put, del } from '@vercel/blob'
import Replicate from 'replicate'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! })

// Mesmo limite do /api/gerar — gpt-image-2 leva ~50s
export const maxDuration = 120

// Endpoint chamado pelo Leona (bloco de integração POST) quando o lead
// solicita a figurinha pelo WhatsApp.
//
// POST /api/gerar-bot
// Body JSON:
//   { photoUrl, nome, dia, mes, ano, clube, peso, altura, phone?, email? }
//
// Resposta (200):
//   { id, previewUrl, checkoutUrl }
//   previewUrl → URL pública do preview com watermark (Leona envia como imagem)
//   checkoutUrl → link de compra para enviar ao lead
//
// Header opcional: X-API-Key: LEONA_API_SECRET
export async function POST(req: NextRequest) {
  const apiSecret = process.env.LEONA_API_SECRET
  if (apiSecret) {
    if (req.headers.get('x-api-key') !== apiSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const body = await req.json()
    const {
      photoUrl,
      nome    = '',
      dia     = '1',
      mes     = '1',
      ano     = '2000',
      clube   = '',
      peso    = '70',
      altura  = '1.70',
      phone   = '',
      email   = '',
    } = body as Record<string, string>

    if (!photoUrl || !nome.trim() || !clube.trim()) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: photoUrl, nome, clube' },
        { status: 400 }
      )
    }

    // Baixa a foto do WhatsApp (URL pública enviada pelo Leona)
    const photoRes = await fetch(photoUrl)
    if (!photoRes.ok) {
      return NextResponse.json({ error: 'Não foi possível baixar a foto' }, { status: 400 })
    }
    const photoBuf = Buffer.from(await photoRes.arrayBuffer())

    // Formata os dados
    const alturaNum  = parseFloat(altura)
    const alturaStr  = alturaNum > 3
      ? (alturaNum / 100).toFixed(2).replace('.', ',') + 'm'
      : alturaNum.toFixed(2).replace('.', ',') + 'm'
    const dd         = String(parseInt(dia)).padStart(2, '0')
    const mm         = String(parseInt(mes)).padStart(2, '0')
    const nomeUpper  = nome.trim().toUpperCase()
    const clubeUpper = clube.trim().toUpperCase() + ' (BRA)'
    const infoLine   = `${dd}-${mm}-${ano} | ${alturaStr} | ${peso}kg`

    // Carrega template
    const templatePath = path.join(process.cwd(), 'public', 'template.jpg')
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 500 })
    }
    const templateBuf  = fs.readFileSync(templatePath)
    const templateMeta = await sharp(templateBuf).metadata()
    const TW = templateMeta.width!
    const TH = templateMeta.height!

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
      '2. Feature the person from IMAGE 2 in the portrait area of the card, in the same position,',
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

    // ── Gera figurinha via gpt-image-2 ────────────────────────────
    let cleanImage: Buffer | null = null
    let tempPhotoUrl: string | null = null

    try {
      const tempId = crypto.randomUUID()
      const [tempPhotoBlob, templateBlobAsset] = await Promise.all([
        put('figurinhas/temp/' + tempId + '.jpg', photoBuf, { access: 'public', addRandomSuffix: false }),
        put('figurinhas/assets/template.jpg', templateBuf, { access: 'public', addRandomSuffix: false }),
      ])
      tempPhotoUrl = tempPhotoBlob.url

      console.log('[gerar-bot] gpt-image-2: iniciando geração para', nomeUpper)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const output: any = await replicate.run('openai/gpt-image-2' as `${string}/${string}`, {
        input: {
          prompt:           promptLines.join('\n'),
          input_images:     [templateBlobAsset.url, tempPhotoUrl],
          aspect_ratio:     '2:3',
          quality:          'medium',
          output_format:    'png',
          moderation:       'low',
          number_of_images: 1,
        },
      })

      if (output) {
        const resultUrl: string = Array.isArray(output)
          ? output[0]
          : typeof output?.url === 'function' ? output.url() : String(output)

        const genBuf = Buffer.from(await (await fetch(resultUrl)).arrayBuffer())
        cleanImage = await sharp(genBuf).jpeg({ quality: 92 }).toBuffer()
        console.log('[gerar-bot] gpt-image-2 OK')
      } else {
        console.warn('[gerar-bot] gpt-image-2 retornou null')
      }

      if (tempPhotoUrl) del(tempPhotoUrl).catch(() => {})
    } catch (repErr) {
      if (tempPhotoUrl) del(tempPhotoUrl).catch(() => {})
      console.warn('[gerar-bot] gpt-image-2 falhou:', repErr)
    }

    if (!cleanImage) {
      return NextResponse.json({
        error: 'Não conseguimos processar esta foto. Peça ao lead para enviar uma foto com rosto bem visível, em boa iluminação, sem outras pessoas.',
      }, { status: 422 })
    }

    // ── Salva figurinha + preview no Blob ─────────────────────────
    const id = crypto.randomUUID()

    // Figurinha limpa (alta resolução — para download após pagamento)
    const stickerBlob = await put(
      'figurinhas/' + id + '.jpg',
      cleanImage,
      { access: 'public', addRandomSuffix: false }
    )

    // Preview com watermark salvo no Blob (Leona precisa de URL pública para enviar como imagem)
    const { width: IW, height: IH } = await sharp(cleanImage).metadata()
    const wm = buildWatermarkSvg(IW!, IH!)
    const previewBuf = await sharp(cleanImage)
      .composite([{ input: Buffer.from(wm), top: 0, left: 0 }])
      .jpeg({ quality: 88 })
      .toBuffer()
    const previewBlob = await put(
      'figurinhas/preview/' + id + '.jpg',
      previewBuf,
      { access: 'public', addRandomSuffix: false }
    )

    // Metadata (webhook Kirvano + cron de limpeza)
    await put(
      'figurinhas/meta/' + id + '.json',
      Buffer.from(JSON.stringify({
        email,
        nome: nomeUpper,
        blobUrl: stickerBlob.url,
        phone,
        source: 'whatsapp',
        createdAt: Date.now(),
      })),
      { access: 'public', addRandomSuffix: false, contentType: 'application/json' }
    )

    // Index por e-mail (área de membros)
    if (email) {
      const emailKey = email.toLowerCase().replace('@', '--at--')
      await put(
        'figurinhas/idx/' + emailKey + '/' + id + '.json',
        Buffer.from(JSON.stringify({ nome: nomeUpper, blobUrl: stickerBlob.url, paid: false })),
        { access: 'public', addRandomSuffix: false, contentType: 'application/json' }
      )
    }

    // Index por telefone (webhook Kirvano identifica por phone quando não tem email)
    if (phone) {
      const phoneKey = phone.replace(/\D/g, '')
      await put(
        'figurinhas/idx-phone/' + phoneKey + '/' + id + '.json',
        Buffer.from(JSON.stringify({ nome: nomeUpper, blobUrl: stickerBlob.url, paid: false })),
        { access: 'public', addRandomSuffix: false, contentType: 'application/json' }
      )
    }

    // URL de checkout
    const baseCheckout = (process.env.NEXT_PUBLIC_CHECKOUT_URL || '').replace(/\/$/, '')
    const checkoutUrl  = baseCheckout
      ? `${baseCheckout}?custom=${id}${email ? '&customer.email=' + encodeURIComponent(email) : ''}`
      : ''

    return NextResponse.json({ id, previewUrl: previewBlob.url, checkoutUrl })

  } catch (err) {
    console.error('[gerar-bot]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
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
